# Predicate — Design Spec

**Status:** v0.1 (brainstorming output)
**Date:** 2026-05-16
**Source PRD:** [`docs/predicate-prd.md`](../../predicate-prd.md)
**Synthesis sources:** context-mode (1.0.111), claude-mem (12.7.5), superpowers (5.1.0)

---

## 1. Purpose and scope

Predicate is a local-first MCP skill that gives an AI agent a knowledge graph it can reason over. This spec defines the v1 architecture, the three concurrent lifecycles, the component inventory, the interfaces between layers, and the discipline mechanisms that make the system safe to use.

The spec is deliberately scoped to v1 (Foundation + Discipline + thin Agent loop, ~6 weeks per PRD §13). The pruner/generalizer (PRD's "Efficiency" phase) is designed for here but built later.

## 2. Cross-framework synthesis (why this design looks the way it does)

Three reference frameworks were studied for skill-lifecycle patterns:

- **context-mode** — per-project SQLite, worktree isolation, snapshot-as-search-index, hook-driven capture. Adopted: per-project graph isolation, worktree-aware dataset names, hook-driven capture (additive, not mandatory).
- **claude-mem** — persistent background worker, observer agent decoupled from primary, hierarchical observation model, deferred summarization. Adopted: separation between the host agent (asks questions) and Predicate's internal extractor/proposer (writes data); deferred re-materialization debounced by activity.
- **superpowers** — markdown state machine with `HARD-GATE` and `EXTREMELY-IMPORTANT` discipline blocks; spec→plan→execute pipeline; subagent prompt templating with full-text passing. Adopted: `SKILL.md` discipline as the host-agent contract; schema lifecycle as a file-state-machine (Turtle in git); HARD-GATE on schema mutations to prevent thrashing.

The convergent pattern across all three: **bootstrap (SessionStart) → capture (tool hooks) → index (per-project store) → inject (skill body or system context) → discipline (gates)**. Predicate's contribution is to make the substrate logical (RDF/OWL + reasoner) rather than lexical or symbolic.

## 3. Architecture overview

Four layers, each with a single responsibility:

```
Skill layer       SKILL.md + plugin.json + hooks
                  (host-agent integration; what teaches Claude Code to use Predicate)
        ↓
MCP layer         predicate-mcp (Node/TS): 8 MCP tools
        ↓
Agent loop        goals · decomposer · gap detector · research orchestrator ·
                  triple extractor · schema proposer · promotion gate · pruner
        ↓
Substrate         Fuseki/TDB2 (Docker) · OWL 2 RL reasoner adapter ·
                  SHACL validator · RDF-star provenance
```

Two designed-in swap points:

- `ReasonerAdapter` — Fuseki-CONSTRUCT in v1; GraphDB Free / RDFox via the same interface in v2.
- `ResearchSource` — Web + docs in v1; code-analysis source deferred (PRD open question §15.4).

## 4. The three lifecycles

Predicate is best understood as three concurrent state machines running on different clocks. This is the central organizing idea.

### 4.1 Query lifecycle — execution-bounded (LLM round-trips included)

```
kg_explore_schema(concept)
  → draft SPARQL against asserted ∪ inferred
  → execute
  → empty/odd? → refine
  → interpret → kg_explain (inference path)
```

Pre-baked SPARQL templates are discouraged (PRD §8.3) — the model reads a fresh TBox slice each time, drafts SPARQL against it, and `kg_explain` walks the inference path. This is a *workflow guideline*, not an enforceable gate: there is no reliable way for the substrate to detect templated-vs-fresh drafting, so it lives in `SKILL.md` as an instruction and in code review as a norm, not as a runtime check.

Guardrails (enforced by the substrate): query-cost ceiling — Fuseki `arq:queryTimeout` set to 5000 ms, row cardinality cap 100k via streaming result truncation, mandatory provenance citation in `kg_explain` output. The `kg_ask` refinement loop is capped at 3 iterations before returning whatever was found.

### 4.2 Assertion lifecycle — seconds

```
research_goal(goal)
  → extract candidate triples with (source, confidence, method)
  → SHACL validate
  → kg_assert
  → write kg:abox + kg:provenance (RDF-star)
  → debounced re-materialize kg:inferred
     (every 30s of write activity OR every 100 triples)
```

The extractor lives in the `predicate-agent` package and is invoked by the MCP layer via `kg_research_goal`. It *never writes to `kg:abox` directly*; it emits candidate triples that flow back through `kg_assert`, which is the single ABox writer. This keeps SHACL validation and the server-side TBox check (see §6) on one code path.

Two named confidence thresholds, with different jobs:

| Threshold | Default | Used by | Effect |
|---|---|---|---|
| `CLOSURE_CUTOFF` | 0.5 | reasoner adapter | triples below are queryable in `kg:abox` but excluded from reasoner closure input; cannot poison `kg:inferred` |
| `ARCHIVE_CUTOFF` | 0.6 | reaper (`kg_maintain`) | triples below with `use_count == 0` after 30 days are archived to a parallel graph |

### 4.3 Schema lifecycle — days

```
kg_propose_schema(delta, justification)
  → kg:tbox-staging
  → VALIDATION GATE:
      run reasoner over (tbox ∪ staging ∪ ABox sample)
      reject if: unsatisfiable class | inconsistency | SHACL meta-shape fails
      record impact: N ABox triples touched, M recent queries affected
  → USAGE GATE:
      N successful uses within TTL (default N=3, TTL=7d)
      else: expire to kg:meta with "expired-unused" record
  → PROMOTION:
      atomic: git commit (Turtle delta) → kg:meta record →
              drop kg:inferred → re-materialize → advance TBox version

[Rollback: revert the Turtle commit; ABox untouched; kg:inferred regenerates]
```

This gate is the anti-thrashing mechanism *and* the safety mechanism for inferred goals. It is encoded as `HARD-GATE` blocks in `SKILL.md` so the host agent cannot bypass it.

## 5. Named graph layout

Exactly the 8 graphs from PRD §7.2:

| Graph | Holds | Mutability | Writers |
|---|---|---|---|
| `kg:tbox` | live ontology | versioned, gated | promotion sweeper only |
| `kg:tbox-staging` | proposed schema changes | scratch | `kg_propose_schema` |
| `kg:abox` | asserted facts | append + explicit migration | `kg_assert` only (extractor flows through it) |
| `kg:inferred` | materialized entailments | disposable, regenerated | reasoner only |
| `kg:provenance` | RDF-star metadata per triple | append | every writer |
| `kg:goals` | goals, decompositions, status | live | goal store |
| `kg:usage` | query/access logs | append | SPARQL planner |
| `kg:meta` | Lifecycle event log: schema proposals, gate decisions, promotions, rejections, rollbacks, goal status changes, maintenance runs, reasoner inconsistencies, TBox version history | append | every mutating tool + every gate decision |

Worktree isolation (from context-mode): the Fuseki dataset name is hashed from `git rev-parse --show-toplevel` plus an optional worktree suffix. If `PREDICATE_PER_WORKTREE=1`, each git worktree gets its own `kg:abox` while sharing `kg:tbox` and `kg:meta`.

### 5.1 Lifecycle event log

`kg:meta` is the append-only audit trail for every **product event** — distinct from `kg:provenance` (per-triple data lineage) and `kg:usage` (per-query telemetry). Every mutating operation and every gate decision writes one event record carrying timestamp, actor (agent or sweeper), motivating goal (if any), and a type-specific payload. Events are *metadata about the system's behavior*, never input to the reasoner.

Event types (v1):

| Event type | Emitted by | Payload |
|---|---|---|
| `schema-proposed` | `kg_propose_schema` | delta, justification, goal |
| `schema-validation-passed` | promotion sweeper | proposal-id, impact stats |
| `schema-validation-failed` | promotion sweeper | proposal-id, gate, reason |
| `schema-promoted` | promotion sweeper | proposal-id, git SHA, final use-count |
| `schema-rejected` | promotion sweeper | proposal-id, reason (`expired` \| `validation`) |
| `schema-rolled-back` | maintenance / manual | from-version, to-version, reason |
| `goal-created` / `goal-status-changed` | host agent, sweeper | goal-id, transition, source |
| `inconsistency-detected` | reasoner adapter | conflicting triples, rule, severity |
| `maintenance-run` | `kg_maintain` | archived-count, generalized-count, duration |
| `tbox-version-advanced` | promotion sweeper | from-version, to-version, git SHA |

The event log is the data foundation for the deferred web/visualizer surface (see §15), for the success-metric dashboards (§16), and for any future external audit story. Because `kg:meta` is RDF in the same dataset, every event is queryable with SPARQL — the visualizer is a read-only consumer, not a separate system.

## 6. The eight MCP tools

| Tool | Reads | Writes | Discipline (HARD-GATE in SKILL.md) |
|---|---|---|---|
| `kg_explore_schema(concept)` | `kg:tbox` | — | Must be called before drafting SPARQL when predicates are unfamiliar |
| `kg_ask(question)` | `kg:tbox ∪ kg:abox ∪ kg:inferred` | `kg:usage` | Fresh SPARQL only, no templates |
| `kg_explain(claim)` | inference trace | — | Must accompany any answer the user might act on |
| `kg_assert(triple, source, confidence)` | `kg:tbox` (validation) | `kg:abox`, `kg:provenance` | Source URI/path + confidence ∈ [0,1] required; substrate also enforces — `kg_assert` rejects any triple whose predicate is not declared in `kg:tbox` or `kg:tbox-staging`, so a host agent that skips `kg_explore_schema` cannot fabricate predicates |
| `kg_propose_schema(delta, justification)` | `kg:tbox`, ABox sample | `kg:tbox-staging`, `kg:meta` | Never write directly to `kg:tbox` |
| `kg_research_goal(goal)` | web + docs | `kg:goals`, `kg:meta` (goal events), then assertions/proposals | Goal must link to current session intent |
| `kg_stats()` | all graphs | — | — |
| `kg_maintain()` | usage, provenance | `kg:abox` (archive), staging (expire), `kg:meta` (`maintenance-run` event) | Idempotent; safe on a cron |

Every tool in this table that has `kg:meta` in its Writes column emits a typed event record per §5.1. The reasoner adapter and the promotion sweeper write `kg:meta` events too, even though they are not user-callable tools.

### 6.1 `kg_propose_schema` delta format

The single most consequential input in the v1 surface. The delta is a tagged union over the four change kinds supported by the validation gate:

```ts
type SchemaDelta =
  | { kind: 'add-class';    add: Quad[];                       shapes?: Quad[] }
  | { kind: 'add-property'; add: Quad[];                       shapes?: Quad[] }
  | { kind: 'refine-class'; parent: IRI; add: Quad[];          shapes?: Quad[] }
  | { kind: 'breaking';     remove: Quad[]; add: Quad[];
                            migration: SparqlUpdate;           shapes?: Quad[] };

type Quad = { s: IRI; p: IRI; o: IRI | Literal; g?: IRI };
```

- `add-class` / `add-property` are **additive** (monotonic; no migration required — the existing ABox cannot break).
- `refine-class` splits an existing class; existing instances remain valid under `parent`; an optional backfill `CONSTRUCT` is flagged with `auto-reclassified` provenance.
- `breaking` covers renames, removals, tighter domain/range, and disjointness added against existing data. `migration` is required — a SPARQL UPDATE the validation gate runs against an ABox sample to confirm no orphans or contradictions emerge.

Every delta also carries `justification: string` and `motivatingGoal: IRI?` for the `kg:meta` event payload. A delta that fails this tagged-union typecheck is rejected at the MCP boundary before reaching the validation gate.

The other seven tools' I/O lives in `packages/predicate-mcp/src/tools/*.ts`; they're not duplicated here because their inputs are stable (concept names, SPARQL strings, triples). `SchemaDelta` is the one shape that needs cross-team alignment.

## 7. The SKILL.md — host-agent contract

The single most important file in the project. Structure:

```
---
name: predicate
description: Local reasoning knowledge graph for "why", "what breaks if",
             and "what's connected to" questions. OWL-backed, provenance-tracked,
             schema-versioned.
---

<EXTREMELY-IMPORTANT>
Do NOT invent predicates. Read the TBox via kg_explore_schema before drafting
SPARQL. If a predicate you need does not exist, call kg_propose_schema — never
kg_assert with a fabricated property.
</EXTREMELY-IMPORTANT>

# Triggers
- Multi-hop reasoning ("why did login break?")
- Blast-radius / impact analysis
- Contradiction detection
- Anything answered well by structured traversal, poorly by RAG

# Anti-triggers
- Fuzzy semantic recall (use vector search instead)
- One-shot Q&A with no entities or relations

# Workflow
1. Ask first → kg_explore_schema, kg_ask, kg_explain
2. Assert only after research → kg_research_goal → kg_assert(source, confidence)
3. Propose schema only if the ABox cannot represent the fact

# HARD-GATE anti-patterns
- ❌ Don't dump raw text into kg_assert
- ❌ Don't query kg:inferred for write-back
- ❌ Don't bypass SHACL
- ❌ Don't invent predicates

# Worked examples
[four end-to-end chains: a why-question, a blast-radius, a contradiction,
 a schema-evolution prompted by a gap]
```

The `EXTREMELY-IMPORTANT`/`HARD-GATE` framing is borrowed from superpowers; everything else is tuned to PRD §8.2.

## 8. Reasoning engine — OWL 2 RL subset

12–15 rules implemented as SPARQL `CONSTRUCT` queries, run to fixpoint:

1. `rdfs:subClassOf` transitivity
2. `rdfs:subPropertyOf` transitivity
3. `owl:TransitiveProperty`
4. `owl:inverseOf`
5. `owl:propertyChainAxiom` (the traversal workhorse)
6. `rdfs:domain` → type inference
7. `rdfs:range` → type inference
8. `owl:FunctionalProperty` + `owl:sameAs` propagation
9. `owl:InverseFunctionalProperty`
10. `owl:SymmetricProperty`
11. `owl:disjointWith` → inconsistency detection
12. `owl:equivalentClass` (one direction)
13. `owl:equivalentProperty`
14. `owl:hasKey` — the standard idiom for entity resolution (PRD §7.3); in-scope for v1
15. Class assertion via `rdf:type` propagation through chains

Fixpoint runner: iterate until no new triples produced; OWL 2 RL on this subset is provably finite, so 10 iterations is a sanity-check ceiling that should never fire — if it does, the run **hard-fails** (we do not silently accept partial closure). Triples with `confidence < CLOSURE_CUTOFF` are excluded from the closure input set.

**Property-chain blast radius (rule 5).** `owl:propertyChainAxiom` is the traversal workhorse and can explode combinatorially over deep chains. Predicate's policy: materialize property-chain entailments only for chains of length ≤ 2 (covers `dependsOn ← calls ∘ declaredIn`-style v1 patterns); evaluate deeper chains at query time via SPARQL property paths.

SHACL runs separately post-materialization against `kg:abox ∪ kg:inferred` for closed-world constraints (e.g., "every Employee has exactly one manager").

### 8.1 `ReasonerAdapter` interface

The swap point named in §3 has to be a concrete contract or it's aspirational. The interface:

```ts
interface ReasonerAdapter {
  materialize(input: MaterializeInput): Promise<MaterializeResult>;
  validate(input: ValidateInput):       Promise<ValidationResult>;
  explain(claim: Quad):                 Promise<InferenceTrace>;
}

type MaterializeInput = {
  tboxGraph: IRI;          // kg:tbox
  aboxGraphs: IRI[];       // [kg:abox]
  targetGraph: IRI;        // kg:inferred — fully replaced each call
  closureCutoff: number;   // triples below excluded from input set
};
type MaterializeResult = {
  inferredCount: number;
  inconsistencies: Inconsistency[];   // disjoint-class violations, etc.
  iterations: number;                  // hard-fail if > 10 on v1 rule subset
  elapsedMs: number;
};

type ValidateInput = {
  tboxGraph: IRI;
  stagingGraph: IRI;       // kg:tbox-staging
  aboxSample: IRI;         // small materialized sample to test the proposal
};
type ValidationResult = {
  ok: boolean;
  unsatisfiableClasses: IRI[];
  shaclViolations: ShaclViolation[];
  impactedTriples: number;             // ABox triples touched
  impactedQueries: number;             // recent kg:usage queries affected
};
```

The Fuseki-CONSTRUCT default `materialize` replaces `kg:inferred` wholesale (no incremental delta). RDFox would later override the same interface with an incremental impl when the v1.1 swap happens — the interface accommodates both because the inferred graph is **disposable** (§5).

### 8.2 Inference trace and inferred-triple provenance

PRD §13 mandates "provenance citation on every claim." Asserted triples carry that natively via `kg:provenance` (§5). Inferred triples are harder: CONSTRUCT-style fixpoint reasoners do not preserve a derivation tree by default.

**v1 approach — re-derivation on demand.** `kg_explain(triple)` runs a backward-chained reconstruction against the current graph: for each v1 rule that could have produced the conclusion, find body-matching premises in `kg:abox ∪ kg:inferred`, recurse, ground out at `kg:abox` (cite `kg:provenance`) or `kg:tbox` axioms. Return:

```ts
type InferenceTrace = {
  conclusion: Quad;
  derivation: DerivationStep[];        // ordered: premises → conclusion
  citedProvenance: ProvenanceRecord[]; // one per asserted premise
  alternatesExist: boolean;            // true if more than one valid derivation
};
type DerivationStep = {
  rule: string;                        // 'owl:propertyChainAxiom', etc.
  premises: Quad[];
  conclusion: Quad;
};
```

Consequences: (i) `kg_explain` is a reasoning op, not a lookup; (ii) explanations are non-unique — the system returns one valid derivation and sets `alternatesExist` when others exist; (iii) the reasoner adapter does not need to preserve any derivation state, which keeps the Fuseki-CONSTRUCT default simple.

**v1.1 path — tag-while-deriving.** Each CONSTRUCT rule wraps its conclusions in RDF-star annotations citing the firing premises, so explanation becomes a graph walk. Faster repeated explanation, more invasive in the rules. Tracked as the next reasoning-engine investment.

## 9. Component inventory

| Package | Purpose | v1? |
|---|---|---|
| `predicate-server` | Docker compose (Fuseki + TDB2), boot-load TBox | yes |
| `predicate-mcp` | Node/TS MCP server, 8 tools | yes |
| `predicate-reasoner` | OWL 2 RL CONSTRUCT engine + SHACL runner + fixpoint loop | yes |
| `predicate-agent` | Goals, decomposer, gap detector, extractor, proposer, promotion gate | yes (research orchestrator: web + docs only) |
| `predicate-ontology` | Versioned TBox in git (Turtle), seed = codebase domain | yes |
| `predicate-skill` | `SKILL.md` + `.claude-plugin/plugin.json` + SessionStart hook | yes |
| `predicate-eval` | Fixed multi-hop eval set + RAG control harness | yes |

## 10. Hooks (optional but high-leverage)

Following context-mode's pattern; additive — MCP tools work without them.

| Hook | Purpose |
|---|---|
| `SessionStart` | Inject a static overview: count of `kg:tbox` classes, count of active goals in `kg:goals`, last-promoted TBox version. No intent — the user hasn't spoken yet |
| `UserPromptSubmit` | (a) classify intent; (b) if multi-hop/why/blast-radius, surface "consider Predicate"; (c) call `kg_explore_schema` for the inferred topic and inject that slice |
| `Stop` | Trigger debounced re-materialization; update goal status in `kg:goals` |

## 11. Storage hygiene

- Worktree-aware dataset selection (context-mode pattern).
- Reaper policy (`kg_maintain`, v1): archive triples with `use_count == 0` and `confidence < ARCHIVE_CUTOFF` after 30 days; archive concepts whose motivating goal is `done` with no other references. Implementation is a single SPARQL `DELETE … INSERT … WHERE …` per pass — small enough to ship in v1 so the bounded-growth metric (§16) is meetable.
- `kg_stats` exposes: triple count, inferred ratio, materialization latency p50/p95, unused-concept ratio (PRD success metric §12).
- Eviction is provenance-aware: archive to parallel graph, never delete; rollback always possible.

## 12. Eval harness

`predicate-eval` ships 30–50 multi-hop questions in the codebase domain with ground-truth answers, run against (a) Predicate and (b) a RAG control over the same source corpus. CI runs the suite on every TBox promotion to catch regressions. Borrowed pattern: tests are the gate (superpowers).

## 13. Discipline summary

The lessons from superpowers tell us discipline mechanisms must be **explicit, non-negotiable, and visible**. Predicate's discipline surface:

| Mechanism | Where | What it prevents |
|---|---|---|
| `EXTREMELY-IMPORTANT` in SKILL.md | host-agent layer | inventing predicates |
| `HARD-GATE` on anti-patterns | host-agent layer | dumping text, bypassing SHACL, write-back from inferred |
| Validation gate | promotion sweeper | unsatisfiable schemas, contradictions |
| Usage gate | promotion sweeper | schema thrashing, premature codification |
| SHACL post-materialization | reasoner adapter | closed-world constraint violation |
| Low-confidence exclusion | reasoner adapter | poisoned entailment |
| RDF-star provenance on every triple | every writer | un-auditable claims |
| Lifecycle event log in `kg:meta` (§5.1) | every mutating tool + every gate | untraceable schema or goal changes; no "what happened when" timeline |
| Git-tracked TBox | promotion sweeper | un-reviewable schema change, no rollback |

## 14. Risks and countermeasures

| PRD risk | Design countermeasure |
|---|---|
| Schema thrashing | Two-tier staging + usage-gated promotion; HARD-GATE in SKILL.md |
| Weak default reasoner | Pluggable adapter; benchmark suite from day one; rule subset chosen for query coverage |
| Reasoning cost at scale | Materialize inferred classes + frequent rule outputs only; deep chains at query time; cache hot results; debounced re-materialization |
| Competitive timing | Ship the MCP-tools surface first; reasoning quality + bounded growth are the defended moat |

## 15. Out of scope for v1

- Generalization detector (the K-instance pattern-lift sweep in PRD §9.3) — the *thin reaper* ships in v1 per §11; full generalization is the PRD "Efficiency" phase.
- Code-analysis research source (PRD open question §15.4).
- GraphDB / RDFox adapter implementations (interface ships, only Fuseki-CONSTRUCT impl).
- Multi-domain TBoxes (seed = codebase domain; SRE/security/research deferred).
- Cloud sync / multi-machine continuity.
- Web view / lifecycle visualizer (the `kg:meta` event log defined in §5.1 ships in v1; the UI consuming it is post-v1, see brainstorming notes).

## 16. Success criteria (from PRD §12, made measurable)

| Metric | Target for v1 exit |
|---|---|
| Multi-hop eval correctness | ≥ 70% vs RAG baseline ≤ 30% on the same set |
| `kg_inferred` materialization p95 | ≤ 5s on a 100k-triple graph |
| Schema-thrash incidents | 0 (no rollback caused by usage gate failure within first 30 sessions) |
| Cross-session continuity | 0 sessions require user to re-explain context |
| Bounded growth | unused-concept ratio < 15% after 30 days of use (meetable because the thin reaper ships in v1, §11) |

## 17. Known gaps for v0.2

This v0.1 spec is design-complete on the substrate, the three lifecycles, and the discipline surface. The following are *known unaddressed* and tracked for the v0.2 revision before v1 implementation begins. Each cluster names the critique numbers from the design audit so nothing is silently dropped.

**Discipline that needs more than SKILL.md** (A2.7, A2.9)
- Cross-system promotion atomicity (git + Fuseki + drop `kg:inferred` + re-materialize): needs a journal, idempotent steps, recovery semantics. "Atomic" is currently an adjective, not a transaction.
- Worktree hashing edge cases: non-git directories, repo renames, deleted worktrees, orphaned datasets, dataset-vs-named-graph routing.

**Hand-waved subsystems** (A5.18, A5.21–24)
- SHACL meta-shape examples (the validation-gate input).
- Intent classifier used by `UserPromptSubmit` — heuristic, rule-based, or LLM call; where it lives.
- Goal extraction from conversation — trigger, owner, `kg:goals` data shape.
- Debounce trigger semantics — "30s of write activity" is currently ambiguous (rolling window vs. since-last-write); ABox-write-driven and promotion-driven re-materialization have different urgency and should not share one trigger.

**Operational story** (A7.26–27, B2.7–12)
- Concurrency model: single-writer, per-graph mutex, optimistic versioning on TBox?
- Cold-start: what runs on Fuseki boot; whether `kg:inferred` is regenerated lazily or eagerly.
- Backpressure when extractor + reasoner can't keep up with assertion rate (drop / queue / throttle / error).
- Storage budget per 100k triples (asserted + inferred + RDF-star provenance) — local-first promise hides surprises without it.
- Observability: logs, metrics, traces; where the operator looks when a promotion fails or SHACL violations spike.

**Threat / privacy** (B3.13–15)
- Trust model for sources; adversarial extractor input.
- SPARQL injection surface where user input flows into `kg_ask`-drafted SPARQL.
- Privacy for `kg_research_goal` web fetches (credentials, PII, caching, per-domain opt-out).

**Content not yet promoted from plan to spec** (A3.13, A5.24, B4.16–18, B5.19–21)
- Seed TBox contents (the 50-triple codebase ontology lives in the Phase-1 plan; should move here for spec-level falsifiability).
- Eval-set definition: question-category taxonomy and ground-truth generation method. The "≥70% vs ≤30%" target is otherwise unfalsifiable.
- The four worked SKILL.md examples named in §7 but not yet written.
- Concrete trigger-detection patterns the host agent matches on (beyond example phrases).

**Coherence** (B6.22–25)
- One full end-to-end session trace composing the three lifecycle diagrams.
- PRD-to-spec traceability matrix (PRD §10 friction-free goal classification and §9.3 generalization cadence are under-covered).
- Predicate-versioning — upgrading Predicate when *its own* data model evolves.
- Multi-worktree merge story when a branch lands on main.

**Comparative** (B7.26–27)
- Glossary (TBox / ABox / RBox / RDF-star / OWL 2 RL / SHACL / fixpoint).
- Where Predicate's mechanics diverge from Graphiti — the design defense PRD §5 implies.

All numerical defaults — `N=3`, `TTL=7d`, 30s/100-triple debounce, `CLOSURE_CUTOFF=0.5`, `ARCHIVE_CUTOFF=0.6`, query timeout 5s, row cap 100k, fixpoint hard-fail at 10 iterations, refinement cap 3 — are **v1.0 calibration targets** to be tuned in v1.1 against measured behavior.

## 18. Intentionally replaceable

Three subsystems are designed in but explicitly "cheap to throw away," so contributors know what's *expected* to flex:

- **The OWL 2 RL rule subset (§8).** 15 rules cover expected v1 queries. The set is empirically curated, not minimal. If a Phase-3 workload reveals a gap, add a rule; if a rule never fires, drop it. The subset is not a contract.
- **The default `ReasonerAdapter` (§8.1).** Fuseki-CONSTRUCT is the v1 default precisely because it can be swapped. The interface ships ready to accept GraphDB Free, RDFox, or a custom Datalog impl.
- **The seed TBox (`predicate-ontology/tbox/codebase.ttl`).** Codebase is the v1 seed because the PRD says it's the loudest "aha." Replace or extend with SRE / security / research seeds without touching any code outside `predicate-ontology/`.

Things that are **not** replaceable without a spec rewrite: the 8 named graphs (§5), the three lifecycles (§4), the propose → stage → validate → usage-gate → promote pipeline (§4.3), and RDF-star provenance.
