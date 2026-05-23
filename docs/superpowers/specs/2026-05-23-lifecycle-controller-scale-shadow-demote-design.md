# Predicate — Lifecycle Controller: Scale-Gate + Shadow Harness + Programmatic Demote

> **Status:** Design approved 2026-05-23. Next step: implementation plan (superpowers:writing-plans).
> **Spec reference:** [`2026-05-16-predicate-design.md`](./2026-05-16-predicate-design.md) §§4.3 (schema lifecycle), 5 (named graphs), 5.1 (event log), 11 (storage hygiene), 14 (risks), 15 (out of scope).

## 1. Purpose and scope

The schema-evolution loop (design §§9–11) is the riskiest, least-proven, most-expensive
part of Predicate. Its promotion thresholds are **asserted, not validated** (§15 admits
the `N=3 uses / 7d TTL` numbers are guesses), and most of its machinery (reaper,
generalizer, bounded-growth) only pays off at 10⁶ triples — a scale most installs never
reach before churning (success-metric §16 / retention reality).

This spec adds **one control strategy in three composing parts**, all built on a shared
substrate, to make the loop *cheap to run early, empirically tunable, and reversible*:

1. **Scale-gate** — management machinery is a no-op until total triple count justifies it.
2. **Shadow harness** — counterfactually log what every gate *would* decide under
   alternative thresholds, with zero behavior change.
3. **Programmatic demote** — `kg_demote(proposalId)` makes any promotion reversible by id,
   so the gate can be loosened safely.

**Unifying principle:** *defer irreversible commitment until evidence justifies it.* Scale
defers cost; shadow defers threshold-commitment; demote makes commitment itself reversible.
No number is asserted as final.

**Explicitly NOT in scope (v1):** auto-demote feedback controller; multi-tier scale model
beyond `Seedling`/`Active`; retuning the live thresholds (this spec *gathers the data* to
retune; the retune is a follow-on decision driven by that data).

## 2. Architecture: the unifying primitive

A new `LifecycleController` in `predicate-agent` (`lifecycle-controller.ts`) owns three
primitives that the existing `promotion-sweeper.ts`, `generalizer.ts`, and the reaper
currently each implement ad hoc:

| Primitive | Responsibility |
|---|---|
| `scaleSignal()` | Returns the active tier from total triple count (one cached `COUNT` per pass). |
| `evaluateGate(candidate, { commit })` | Gate logic (validation + usage) factored out of the sweeper; runs in `commit:true` (move + log) or `commit:false` (shadow — emit event, move nothing). |
| `move(from, to, selector, eventType)` | The single atomic operation. Promote, demote, and reaper-archive are all calls to this. Does the SPARQL move, writes the `kg:meta` event, drops `kg:inferred`. |

The decisive consolidation: **promote, demote, and reaper-archive are the same operation**
— "move triples between named graphs, log an event, drop `kg:inferred`." The sweeper's
existing move code (`promotion-sweeper.ts:224–407`) becomes the first caller of `move()`.

**Data flow:**

```
kg_maintain
  → LifecycleController.runPass()
      → scaleSignal()                       // tier = Seedling | Active
      → sweeper.evaluate()  via evaluateGate(commit:true)   // ALWAYS (gate stays live)
      → shadow.evaluate()   via evaluateGate(commit:false)  // ALWAYS (observation-only)
      → if Active: reaper.run(), generalizer.run() via move() // cost-machinery
      → else:      emit maintenance-skipped events
```

The controller is a thin coordinator, not a god-object: each domain module still decides
*what* its candidates are; the controller owns only *when machinery runs* (scale),
*whether a gate decision commits or shadows*, and *how triples move atomically*.

## 3. Strategy #1 — Scale-gate

**Signal:** total triple count (single number). Configured as `SCALE_GATE_TRIPLES`
(default **25,000**) via `kg-config`. Below → `Seedling`; at/above → `Active`.

**Count semantics:** sum over data graphs `kg:abox`, `kg:tbox`, `kg:inferred`, `kg:goals`,
`kg:usage`. **Excludes** `kg:meta` (event log grows unbounded by design) and archive graphs
(already evicted). Computed once per pass and passed to all consumers.

**Suppressed in `Seedling`:**
- Reaper (archive of unused / low-confidence triples)
- Generalizer (`generalizer.ts` K-instance pattern lift)
- Any future bounded-growth enforcement

**Always live, regardless of size:**
- Promotion **usage gate** + **validation gate** — anti-thrash (§14, "non-negotiable") and
  correctness are small-scale concerns; disabling them early reintroduces thrashing.
- Schema proposal/promotion itself — early "visible learning" is the retention lever.
- Event logging and the shadow harness.

**Suppression is explicit, not silent:** when `Seedling`, `runPass()` simply does not
dispatch reaper/generalizer, and emits a `maintenance-skipped` event
(`{tier, reason:"below-scale-gate", tripleCount}`) so the skip is observable.

**Known tuning consideration (not solved speculatively):** because `kg:inferred` is counted,
aggressive materialization could trip the gate on inferred bulk rather than user data. The
shadow harness will expose whether this matters; the threshold is revisited from data, not
guessed again here. Crossing the threshold is non-destructive in either direction.

## 4. Strategy #2 — Shadow harness

**Mechanism:** `evaluateGate(candidate, { commit:false })` runs the *real* gate logic but
emits one `pred:GateShadow` event to `kg:meta` instead of moving triples. Runs every pass
over all staging candidates, and (in `Seedling`) over what the reaper *would* archive.

**Counterfactual grid** (recorded per candidate, pure in-memory arithmetic over
already-fetched use-counts — no extra SPARQL per cell):
- Usage gate: `N ∈ {2,3,5}` × `TTL ∈ {3,7,14}d` → 9 cells, each `promote | wait | expire`.
- Reaper rider: `ARCHIVE_CUTOFF ∈ {0.5,0.6,0.7}` × `age ∈ {14,30,60}d` → would-archive count.

**Event shape** (one per candidate per pass):

```
pred:GateShadow
  proposalId, passTimestamp, tier
  goalSource: "explicit" | "inferred"      ← safety-critical tag (design §10)
  liveDecision: promote | wait | expire
  counterfactual: [ {N, ttl, decision}, ... ]
  currentUseCount, ageInStaging
```

The `goalSource` tag lets the *same* log be sliced into the §10 inferred-goal safety view
(filter `inferred`) without a second mechanism.

**Output:** a rollup exposed via `kg_stats` and a CLI `predicate shadow-report`, answering
"under each threshold, what fraction of inferred-goal promotions would fire, and how many
were later demoted/abandoned?" The join *shadow decision × eventual demote* (Strategy #3)
is the empirical basis for loosening the gate: shadow says "looser would promote these 12
extra"; demote history says "11 of 12 would have survived." Evidence, not assertion.

**Safety property:** the harness only ever emits events. A bug yields bad analytics, never
bad schema. This is why it can ship before any gate retuning.

**Cost guard:** one `GateShadow` event per candidate per pass; candidate counts are small
(staging is gated), so `kg:meta` growth is bounded by proposal volume, not triple volume.

## 5. Strategy #3 — Programmatic demote

**New MCP tool `kg_demote(proposalId, reason)`** (`kg-demote.ts`) + CLI
`predicate schema demote <id>`. One call to `move()` in reverse:

`move('kg:tbox', 'kg:tbox-demoted', <triples-for-proposalId>, 'schema-demoted')`

Steps (all inside the existing atomic-move path):
1. Select promoted triples by `proposalId` (RDF-star metadata written by the sweeper).
2. Move `kg:tbox` → `kg:tbox-demoted` — **never hard-delete** (mirrors the reaper's
   "archive, never delete" invariant; rollback-of-rollback stays possible).
3. Emit `pred:SchemaDemoted {proposalId, reason, fromVersion, timestamp}` and a
   `tbox-version-advanced` (demotion moves the version *forward* — it is a new version,
   not a git rewind).
4. Drop `kg:inferred` → next reasoner pass re-materializes without the demoted axioms.

**File-vs-graph reconciliation:** demote writes/moves a `tbox/demoted/<id>.ttl` marker so
git history and the live graph agree. Principle: **the graph is the source of truth for
what is live; git is the source of truth for what was reviewed.**

**Relationship to existing git-revert path:** git revert remains the *human disaster* path;
`kg_demote` is the *programmatic, queryable, by-id* path.

**NOT in v1:** no auto-demote controller. `kg_demote` is the *primitive*; automatic
triggering on negative signal (unused promoted concept, SHACL-violation spike, abandoned
goal) is a clearly-scoped future phase that consumes this primitive + shadow data.

**Why this loosens the gate:** once demote is one cheap, fully-reversible, logged call, the
cost of a wrong promotion collapses from "git surgery + lost trust" to "one undoable move."
That cost collapse — not a better threshold — dissolves §14's tight-vs-loose dilemma.

## 6. Composition

```
scale-gate ──> WHICH machinery runs (cost deferred until size justifies)
                  │
shadow harness ──> what every gate WOULD do, goal-source tagged (no commits)
                  │
   demote ──> every promotion REVERSIBLE & queryable by id
                  │
                  ▼
   join(shadow decisions × demote outcomes) ──> evidence to retune the gate
                                                 and revise the scale threshold
```

## 7. Observability

Every decision and non-decision emits a `kg:meta` event: `maintenance-skipped`
(scale-gate suppression), `gate-shadow` (counterfactuals), `schema-demoted`. `kg_stats`
gains: current tier + triple count vs. threshold; shadow-grid rollup; demote count &
survival rate. The operator can always answer "why isn't this graph pruning / why did this
promote / what would a looser gate have done."

## 8. Testing (TDD)

- **Controller primitives:** `scaleSignal` tier boundaries (just-below / just-above);
  `move()` atomicity (mid-move failure leaves no partial state) — reuse the sweeper's
  existing move tests.
- **Scale-gate:** `Seedling` pass dispatches sweeper but not reaper/generalizer and emits
  `maintenance-skipped`; `Active` runs all.
- **Shadow:** `commit:false` emits `gate-shadow` and moves zero triples; counterfactual
  cells match hand-computed decisions; `goalSource` tag correct for inferred vs explicit.
- **Demote:** round-trip (promote → demote → triples in `kg:tbox-demoted`, absent from
  `kg:tbox`, `kg:inferred` dropped, event logged); demote-then-re-promote works.
- **Integration (`predicate-eval`):** a session crossing the scale threshold flips
  machinery on; a promote+demote cycle leaves the eval suite green.

## 9. Delivery order

On the shared substrate, in the requested sequence — each phase independently
shippable and testable:

1. **Controller + `scaleSignal` + scale-gate.** Refactor sweeper/reaper/generalizer to
   delegate `move()` and consult the controller. Introduces the substrate.
2. **Shadow mode.** `evaluateGate(commit:false)` + harness + `pred:GateShadow` events +
   `shadow-report`. Reuses the event log.
3. **Programmatic demote.** `kg_demote` tool + CLI + `tbox/demoted/`. Reuses `move()`.

## 10. File inventory

```
packages/predicate-agent/src/
  lifecycle-controller.ts        ← new (scaleSignal, evaluateGate, move)
  promotion-sweeper.ts           ← modified (delegate move() + evaluateGate)
  generalizer.ts                 ← modified (gated by scaleSignal; via move())
  shadow-evaluator.ts            ← new (counterfactual grid + GateShadow events)
  types.ts                       ← extended (Tier, GateShadow, SchemaDemoted)
packages/predicate-mcp/src/tools/
  kg-demote.ts                   ← new
  kg-maintain.ts                 ← modified (calls LifecycleController.runPass)
  kg-stats.ts                    ← modified (tier, shadow rollup, demote survival)
  registry.ts                    ← modified (register kg_demote)
packages/predicate-cli/src/commands/
  schema.ts                      ← modified (demote subcommand)
  shadow-report.ts               ← new
packages/predicate-ontology/tbox/
  demoted/                       ← new (.gitkeep)
packages/predicate-eval/tests/
  lifecycle-controller.test.ts   ← new integration
```
