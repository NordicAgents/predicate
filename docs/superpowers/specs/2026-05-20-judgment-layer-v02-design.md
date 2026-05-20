# Predicate v0.2 — Judgment Layer + Session-One Eval — Design Spec

**Status:** Approved design (brainstorming output) — ready for implementation planning
**Date:** 2026-05-20
**Source of truth:** [`docs/predicate-prd.md`](../../predicate-prd.md) v0.2
**Implements:** [`docs/predicate-judgment-layer.md`](../../predicate-judgment-layer.md) v0.1
**Scope owner:** [you]

---

## 1. Problem and goal

The shipped product (v2.x) stores **lookups** — `imports`, `declaredIn`, `reads`, `path`, `modifiedIn`, session facts — all re-derivable from live source. The PRD v0.2 stakes the product's identity on the opposite: **"Predicate stores judgments, not lookups."** The `j:` vocabulary, the contradiction-surfacing rules, the worked corpora, and the session-one eval that prove this thesis exist only as a design artifact (`predicate-judgment-layer.md`), not as code.

This spec turns that artifact into a shipping slice. The goal is the PRD's **leading indicator** made executable: within a single session the agent can answer a why/what-breaks/what-conflicts question that has no live source, and a planted contradiction is **flagged by the reasoner** (materialized into `kg:inferred`), not silently overwritten and not detected by the model reading two rows in prose.

The judgment layer sits **on top of** the existing engine. The reasoner (`r01`–`r19`), the eight named graphs, RDF-star provenance, and the `kg_assert` predicate gate are reused unchanged.

## 2. Scope

### In scope

1. The `j:` ontology overlay (`judgment.ttl` + `judgment.shacl.ttl`), loaded into `kg:tbox` by default.
2. Two new derive-only reasoner rules — `r20` (current judgment) and `r21` (unresolved conflict) — plus `r21` backward-chaining for `kg_explain`.
3. A host-model-driven capture tool, `kg_extract_judgments` (no server-side LLM, no API key).
4. SKILL.md guidance for when/how the host captures judgments.
5. Three planted-contradiction judgment corpora (codebase / ops / personal) and the **E1–E6 session-one eval**.
6. Explicit supersession + basis recording (the scoped slice of PRD §9.4).

### Out of scope (separate follow-on spec)

- Dashboard Oxigraph support (P3) and other P1/P2 items: reasoner property-chain/`hasKey` completeness, broad `kg_explain` rule coverage, contract-adherence metric instrumentation, continuous/debounced inference, provenance query surface.
- Automatic basis-change invalidation (`kg_maintain` retracting judgments whose basis vanished). v0.2 records the basis so this is buildable later; it is not built here.
- A standalone server-side transcript→judgment LLM extractor. The in-context `kg_extract_judgments` tool **is** the v0.2 extractor.
- **Opportunistic exception:** `r21` backward-chaining is pulled in because E4 needs it.

## 3. Key design decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Scope is the judgment layer + E1–E6 eval only; infra fixes are a separate spec. | Keeps the plan tight and executable. |
| D2 | Capture path is **host-model in-context extraction**, not server-side LLM and not MCP sampling. | Claude Code does not support MCP sampling (verified); the host already holds the full session in context; no API key required; works on every MCP client. |
| D3 | Conflicts are **soft and queryable** — `r21` materializes `j:UnresolvedConflict` into `kg:inferred`. Reasoning never halts. | Matches the eval's "materialized by the reasoner" bar; gives `kg_ask` a queryable conflict; avoids the entity-merge footgun (D4). |
| D4 | `j:settledAs` / `j:prefers` are **NOT** `owl:FunctionalProperty`. A marker class `j:ConflictFunctionalProperty` flags them; `r21` keys off the marker. | A plain functional property would make existing `r08` infer the two conflicting values are `owl:sameAs` and merge distinct entities — the opposite of flagging a conflict. OWL functional semantics stay intact for real data. |
| D5 | Invalidation depth: **explicit supersession + basis recorded**. Automatic basis-change retraction deferred. | Smallest path that satisfies E2 and keeps the graph honest; preserves the foundation for later invalidation. |
| D6 | The `j:` overlay is loaded by **default** at `init`, not as an opt-in seed domain. | It is the product's core vocabulary, not one domain among several. |

## 4. Architecture

### 4.1 Component map

```
predicate-ontology/catalog/
  judgment.ttl            (NEW)  j: vocabulary overlay
  judgment.shacl.ttl      (NEW)  judgment integrity shapes
  catalog.json            (EDIT) register judgment overlay; mark as default-loaded

predicate-reasoner/src/rules/
  r20-current-judgment.ts (NEW)  j:Current materialization
  r21-unresolved-conflict.ts (NEW) j:UnresolvedConflict materialization + backward support
  index.ts                (EDIT) add r20, r21 to RULES

predicate-mcp/src/tools/
  kg-extract-judgments.ts (NEW)  in-context capture tool (no LLM call)
  <registry>              (EDIT) register tool (8 -> 9 tools)

predicate-skill/skills/predicate/
  SKILL.md                (EDIT) judgment trigger, workflow, anti-patterns, worked example

predicate-eval/
  fixtures/judgments/codebase.ttl   (NEW)
  fixtures/judgments/ops.ttl        (NEW)
  fixtures/judgments/personal.ttl   (NEW)
  src/judgment-corpus.ts            (NEW)  loader for the judgment fixtures
  tests/session-one.test.ts         (NEW)  E1-E6
```

The existing lookup `load-corpus.ts` and its tests (`end-to-end.test.ts`, `research-loop.test.ts`, `schema-evolution.test.ts`) are **untouched** — no regression. The API-key `semantic-extractor.ts` is left as-is (dormant without a key).

### 4.2 Data flow — capture

```
session running (host model has full context)
        |
   SKILL.md trigger: "made a decision / reconciled conflict?" near session end
        v
   host calls kg_extract_judgments
        |  returns: (a) j: schema slice
        |           (b) existing j:Current judgments about touched entities
        |           (c) extraction brief (fields + supersession instructions)
        v
   host model distills judgments from its own context
        |
   host calls kg_assert(j:Decision/Preference/Assessment/Reconciliation ...)
        |  predicate gate accepts declared j: predicates, writes RDF-star provenance
        |  host asserts j:supersedes when new judgment conflicts with an existing Current one
        v
   kg:abox grows; kg:provenance records source/confidence/method/timestamp/basedOn
```

### 4.3 Data flow — reasoning

```
materialize() runs the fixpoint over RULES (now incl. r20, r21)
   r04 (existing): j:supersedes  -> j:supersededBy (inverse)
   r20: j:Judgment with no j:supersededBy -> j:Current
   r21: two j:Current judgments j:about same subject, ConflictFunctionalProperty
        values differ, neither supersedes the other
        -> j:UnresolvedConflict on both + j:conflictsWith
   (r03 existing: transitive dependsOn -> blast radius for E5)
        v
   kg:inferred holds j:Current, j:UnresolvedConflict, conflictsWith, transitive edges
        v
   kg_ask queries asserted+inferred; kg_explain backward-chains (incl. r21)
```

## 5. Component detail

### 5.1 `judgment.ttl` (the `j:` overlay)

Prefix `j: <https://predicate.dev/judgment#>`. Mirrors `predicate-judgment-layer.md` §1 with the D4 deviation.

**Classes**
- `j:Judgment` (core) ; subclasses `j:Decision`, `j:Preference`, `j:Reconciliation`, `j:Assessment`.
- Derive-only: `j:UnresolvedConflict ⊑ j:Judgment`, `j:Current`.
- Marker: `j:ConflictFunctionalProperty` (a class used to type properties that must hold a single settled value *per judgment-subject*; drives `r21`).

**Properties**
- `j:about` — the entity a judgment concerns (subject reification).
- `j:basedOn` (ObjectProperty) ; `j:reconciledFrom ⊑ j:basedOn` (domain `j:Reconciliation`).
- `j:rationale` (DatatypeProperty, xsd:string).
- `j:assertedFor` — links to the goal in `kg:goals`.
- `j:supersedes` (ObjectProperty, TransitiveProperty, `owl:inverseOf j:supersededBy`) ; `j:supersededBy`.
- `j:settledAs` (domain `j:Decision`), typed `j:ConflictFunctionalProperty`. **Not** `owl:FunctionalProperty`.
- `j:prefers` (domain `j:Preference`), typed `j:ConflictFunctionalProperty`. **Not** `owl:FunctionalProperty`.
- `j:rejected` (domain `j:Decision`) ; `j:over` (dominated option in a preference).
- `j:conflictsWith` (symmetric; materialized by `r21`).

### 5.2 `judgment.shacl.ttl`

- `j:Judgment` → `sh:property` requiring ≥1 `j:basedOn` (minCount 1) and a `j:rationale` (minCount 1).
- `j:Reconciliation` → ≥1 `j:reconciledFrom`.
- `j:Decision` → ≤1 `j:settledAs` (maxCount 1) — per-judgment cardinality, **distinct** from the cross-judgment conflict `r21` detects.

Runs through the existing `runShacl` / `validate` path. Realizes PRD §7.3 "every reconciled claim cites at least one source."

### 5.3 `r20-current-judgment.ts`

Derive-only `INSERT` into `kg:inferred`, monotonic, fixpoint-safe.

```sparql
PREFIX j: <https://predicate.dev/judgment#>
INSERT { GRAPH <kg:inferred> { ?jd a j:Current } }
WHERE {
  ?jd a j:Judgment .
  FILTER NOT EXISTS { ?jd j:supersededBy ?newer }
  FILTER NOT EXISTS { GRAPH <kg:inferred> { ?jd a j:Current } }
}
```

`j:supersededBy` is produced from `j:supersedes` by the existing `r04` inverse rule, so the fixpoint converges in one extra iteration after a supersession is asserted.

### 5.4 `r21-unresolved-conflict.ts`

Derive-only `INSERT`, keyed on the `j:ConflictFunctionalProperty` marker (D4), operating on judgment nodes directly (values live on the judgment via `?p`).

```sparql
PREFIX j: <https://predicate.dev/judgment#>
INSERT {
  GRAPH <kg:inferred> {
    ?a a j:UnresolvedConflict .
    ?b a j:UnresolvedConflict .
    ?a j:conflictsWith ?b .
  }
}
WHERE {
  ?p a j:ConflictFunctionalProperty .
  ?a a j:Current ; j:about ?s ; ?p ?va .
  ?b a j:Current ; j:about ?s ; ?p ?vb .
  FILTER (str(?a) < str(?b))
  FILTER (?va != ?vb)
  FILTER NOT EXISTS { ?a j:supersedes ?b }
  FILTER NOT EXISTS { ?b j:supersedes ?a }
}
```

`str(?a) < str(?b)` dedupes the symmetric pair and guarantees determinism. After the agent asserts `j:supersedes`, the superseded judgment loses `j:Current` (r20) and `r21` stops firing — the E2 reconcile flow.

**Backward chaining (`rule.backward`):** given a target `?x a j:UnresolvedConflict`, the premise query finds the conflicting partner and both `j:basedOn` chains, so `kg_explain` can show *why* the conflict fired (E4). This is the only `kg_explain` coverage extension in v0.2.

### 5.5 `kg-extract-judgments.ts` (MCP tool)

**Makes no LLM call.** Input: optional `touchedEntities?: string[]` (IRIs the session worked with) and/or `sessionId?`. Returns:

```ts
{
  judgmentSchema: SchemaSlice,        // j: classes + properties, like kg_explore_schema scoped to j:
  currentJudgments: JudgmentSummary[],// existing j:Current judgments about touched entities (for supersession)
  brief: string                       // structured instructions: judgment kinds, required fields,
                                      //   "assert j:supersedes when your new judgment conflicts
                                      //    with an existing Current one"
}
```

The host model distills judgments from its own context and emits `kg_assert` calls. The existing predicate gate enforces declared `j:` predicates and writes RDF-star provenance (`source`, `confidence`, `method`, `timestamp`); the brief instructs the host to always include a `j:basedOn`. Registered in the MCP tool registry, taking the surface from 8 to 9 tools. Documented in README's MCP-tools table.

### 5.6 SKILL.md additions

- **Trigger:** "At the end of a session in which you made a non-obvious decision, formed a standing preference or a qualitative assessment, or reconciled two conflicting sources — call `kg_extract_judgments`, then assert each judgment with `kg_assert`."
- **Workflow:** call `kg_extract_judgments` → read the brief + current judgments → assert judgments (each with `j:about`, `j:rationale`, ≥1 `j:basedOn`; decisions add `j:settledAs`/`j:rejected`) → assert `j:supersedes` for any conflict with an existing `j:Current` judgment.
- **Anti-patterns:** do not store lookups (anything re-derivable from a live source); never assert a judgment without `j:basedOn`; do not invent `j:` predicates.
- **Worked example:** one full judgment chain (the codebase "Postgres abandoned" decision) end to end.

### 5.7 Judgment corpora + E1–E6 eval

Three Turtle fixtures from `predicate-judgment-layer.md` §3, each with a planted contradiction:
- `codebase.ttl` — abandoned-Postgres decision, auth fragility assessment, **planted**: two `j:Decision`s settling different owners for the payments module.
- `ops.ttl` — transitive `dependsOn` topology (reuses `top:dependsOn`, already transitive) + a `j:Reconciliation` of the dunning-consumer owner with the losing source kept at low confidence.
- `personal.ttl` — Tuesday errand `j:Preference` + a **planted** newer Thursday preference.

`judgment-corpus.ts` loads fixtures into `kg:abox` via the `kg_assert` path (with provenance) and `judgment.ttl`/`top.ttl` into `kg:tbox`. `tests/session-one.test.ts` runs the six cases:

| # | Domain | Assertion |
|---|--------|-----------|
| E1 | Personal | `kg_ask` returns `errandPref` + `j:rationale`; `kg_explain` cites `j:basedOn`. |
| E2 | Personal | After asserting the Thursday preference + materialize, `j:UnresolvedConflict` is present **in `kg:inferred`**; after asserting `j:supersedes` + re-materialize, the conflict is gone and the Thursday preference is the sole `j:Current`. |
| E3 | Codebase | `kg_ask` returns the event-store decision (`j:rejected` Postgres, rationale); `kg_explain` cites the load test + incident. |
| E4 | Codebase | `j:UnresolvedConflict` on both owner judgments is **materialized in `kg:inferred`**; `kg_explain` of the conflict cites both judgments' `j:basedOn`. |
| E5 | Ops | Transitive `dependsOn` (r03) returns `checkout`, `dunning`, and dependents; `kg_explain` shows the chain. |
| E6 | Ops | `kg_ask` returns the settled owner **and** the kept low-confidence losing source. |

**Pass bar (gates longitudinal claims):** all six green, and E2/E4 specifically must show the conflict materialized by the reasoner in `kg:inferred` — not produced by the test reasoning over two rows in prose.

## 6. Testing strategy

- **Unit (reasoner):** `r20` (Current set excludes superseded; idempotent), `r21` (fires on conflict; suppressed by `j:supersedes`; symmetric dedupe), `r21.backward` (explain trace cites both bases). Follow the existing `rules/*.test.ts` pattern.
- **Unit (tool):** `kg_extract_judgments` returns the `j:` slice and current judgments; returns empty-but-valid when no judgments exist; never throws on an empty graph.
- **Integration (SHACL):** judgment without `j:basedOn` fails the shape; well-formed judgment passes.
- **Integration (eval):** `session-one.test.ts` E1–E6 as above, run on the default Oxigraph backend, no Docker.
- **Regression:** existing `predicate-eval` and reasoner suites stay green.

All tests run against the default Oxigraph backend (`pnpm test`, no Docker).

## 7. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Host-model discipline (PRD risk #1): the model may not call `kg_extract_judgments` or may assert sloppy judgments. | `kg_assert` predicate gate + SHACL `j:basedOn` requirement reject malformed judgments; SKILL.md worked example; contract-adherence metric (separate P1 spec) will measure adherence directly. |
| `r20`/`r21` fight the fixpoint or fail to converge. | Both are monotonic derive-only `INSERT`s with `FILTER NOT EXISTS` guards; covered by the existing 10-iteration ceiling; unit tests assert convergence and idempotence. |
| `r21` overlaps with `r08`/`r11` (the doc's open question). | Resolved by D4: `j:` conflict predicates are deliberately **not** `owl:FunctionalProperty`, so `r08`/`r11` never fire on them; `r21` is the sole judgment-conflict path. |
| Loading `judgment.ttl` by default changes `init` behavior for existing stores. | Overlay is additive (new classes/properties only); RDF is monotonic for additive TBox changes (PRD §9.2); existing ABox untouched, re-materialize only. |

## 8. Acceptance criteria

1. `judgment.ttl` + `judgment.shacl.ttl` ship in the catalog and load into `kg:tbox` by default at `init`.
2. `r20` and `r21` are in the `RULES` registry; `r21` has backward support.
3. `kg_extract_judgments` is registered, returns the documented payload, makes no LLM call, requires no API key.
4. SKILL.md documents the judgment trigger, workflow, anti-patterns, and a worked example.
5. The three judgment corpora load and `session-one.test.ts` passes all of E1–E6, with E2/E4 conflicts materialized in `kg:inferred`.
6. All pre-existing tests remain green; default backend is Oxigraph, no Docker.

---

*Next artifact: the implementation plan (via the writing-plans skill).*
