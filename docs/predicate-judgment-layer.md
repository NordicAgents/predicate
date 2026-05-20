# Predicate — Judgment Layer (PRD §16 next-artifact)

**Status:** Draft v0.1 — design artifact, not shipping code
**Companion to:** [`predicate-prd.md`](predicate-prd.md) v0.2
**Last updated:** May 2026

This is the concrete starting point the PRD's closing note promised, re-aimed at the v0.2 thesis (**judgments, not lookups**). It contains four things:

1. **The judgment vocabulary** — a small cross-domain ontology layer (`j:`) for the agent's reconciled conclusions.
2. **The axioms that make contradictions *fire*** — how disagreement becomes a reasoner-detectable inconsistency instead of a silent overwrite.
3. **A worked judgment corpus** per seed domain (codebase / ops / personal), each with a planted contradiction.
4. **The session-one eval spec** — the questions, the expected behaviors, and the no-Predicate baseline.

What it deliberately does **not** redo: the named-graph layout (`packages/predicate-mcp/src/graphs.ts`), the OWL 2 RL rules `r01`–`r19` (`packages/predicate-reasoner/src/rules/`), or the meta vocabulary (`predicate-meta.ttl`). Those exist and are reused. The judgment layer sits *on top* of them.

---

## 0. Why a new layer at all

The shipped `codebase.ttl` ontology models **lookups**: `imports`, `declaredIn`, `reads`, `path`, `modifiedIn`. Every one of those is re-derivable from a live source — exactly what PRD §6 principle #1 says not to store. None of them can represent *"Postgres was tried for the event store and abandoned because of write amplification."*

That sentence is a **judgment**. It has no live source. It needs vocabulary the current TBox doesn't have: a notion of a decision, the rejected alternatives, the rationale, what the judgment was based on, and what supersedes it when it goes stale. That's this layer.

The layer also has to make principle #4 real: when two judgments disagree on something the schema says can have only one value, the **reasoner** must flag it — not the model, and not by silently keeping the last write. That's the difference between a settled model and a pile of assertions.

---

## 1. The judgment vocabulary (`j:`)

```turtle
@prefix j:    <https://predicate.dev/judgment#> .
@prefix pred: <https://predicate.dev/meta#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

# --- Core classes -------------------------------------------------

j:Judgment       a owl:Class ;
    rdfs:label "Judgment" ;
    rdfs:comment "A reconciled conclusion the agent reached. Has no live source; "
                 "exists only because the agent did the reasoning. The thing this "
                 "layer governs." .

j:Decision       a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:comment "A chosen option, with the rejected alternatives recorded." .
j:Preference     a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:comment "A standing preference inferred from repeated observation." .
j:Reconciliation a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:comment "A judgment that settled a conflict between two or more sources." .
j:Assessment     a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:comment "A qualitative call about an entity, e.g. 'this dependency is fragile'." .

# --- Status individuals (disjoint → r11 fires on contradiction) ---

j:Status     a owl:Class .
j:Active     a j:Status .
j:Abandoned  a j:Status .
j:Superseded a j:Status .

[] a owl:AllDisjointClasses ;
   owl:members ( j:ActiveThing j:AbandonedThing ) .   # see §2 for the class-shaped variant

# --- Provenance of reasoning (the basis, for §9.4 invalidation) ---

j:basedOn        a owl:ObjectProperty ;
    rdfs:domain j:Judgment ;
    rdfs:comment "An input the judgment rests on. If this disappears or changes, "
                 "the judgment is a candidate for retraction (PRD §9.4)." .

j:reconciledFrom a owl:ObjectProperty ; rdfs:subPropertyOf j:basedOn ;
    rdfs:domain j:Reconciliation ;
    rdfs:comment "A conflicting source this judgment settled. The 'losing' source "
                 "stays cited at lower confidence rather than being deleted." .

j:rationale      a owl:DatatypeProperty ;
    rdfs:domain j:Judgment ; rdfs:range xsd:string ;
    rdfs:comment "The 'why', in the agent's own words. The answer to a why-question." .

j:assertedFor    a owl:ObjectProperty ;
    rdfs:domain j:Judgment ;
    rdfs:comment "The goal (in kg:goals) that motivated this judgment. Lets pruning "
                 "archive judgments whose goal is done and unreferenced." .

# --- Supersession (newest settled value wins; §9.4) --------------

j:supersedes   a owl:ObjectProperty , owl:TransitiveProperty ;
    rdfs:domain j:Judgment ; rdfs:range j:Judgment ;
    owl:inverseOf j:supersededBy .
j:supersededBy a owl:ObjectProperty .

# --- Decisions and their rejected alternatives -------------------

j:settledAs    a owl:ObjectProperty , owl:FunctionalProperty ;
    rdfs:domain j:Decision ;
    rdfs:comment "The chosen option. FUNCTIONAL on purpose: two different settled "
                 "values for the same decision is an inconsistency the reasoner "
                 "must surface (r08), not a silent overwrite." .
j:rejected     a owl:ObjectProperty ;
    rdfs:domain j:Decision ;
    rdfs:comment "An alternative that was considered and not chosen." .

# --- Preferences -------------------------------------------------

j:prefers      a owl:ObjectProperty , owl:FunctionalProperty ;
    rdfs:comment "FUNCTIONAL per (agent, choice-context): conflicting preferences "
                 "on the same context fire the reasoner." .
j:over         a owl:ObjectProperty ;
    rdfs:comment "The dominated option in a preference." .

# --- Unresolved-conflict marker (derive-only, materialized) ------

j:UnresolvedConflict a owl:Class ;
    rdfs:subClassOf j:Judgment ;
    rdfs:comment "Derive-only. Materialized into kg:inferred when two non-superseding "
                 "judgments disagree on a functional value. This is the thing the "
                 "session-one eval asserts must appear." .

j:Current a owl:Class ;
    rdfs:comment "Derive-only. A judgment with no j:supersededBy. Queries for the "
                 "'settled' answer filter to j:Current." .
```

**Design note — why functional properties and disjointness carry the weight.** The contradiction-surfacing of PRD principle #4 is not new machinery: it's `r08` (functional-property + `sameAs`) and `r11` (`disjointWith`) from the *existing* reasoner, pointed at judgment predicates. We get reconciliation enforcement by *modeling* `j:settledAs` and `j:prefers` as functional. That's the leverage of having a real reasoner — we declare the constraint and the engine finds the violation.

---

## 2. The two CONSTRUCT rules the layer adds

Everything else reuses `r01`–`r19`. The judgment layer needs exactly two new derive-only rules. Sketches below in the same SPARQL-`CONSTRUCT`-to-fixpoint form as the existing ruleset (`packages/predicate-reasoner/src/rules/`).

### `r20-current-judgment` — the settled value

```sparql
# A judgment that nothing supersedes is Current. Queries for "the answer" filter to j:Current.
PREFIX j: <https://predicate.dev/judgment#>
CONSTRUCT { ?jd a j:Current }
WHERE {
  ?jd a j:Judgment .
  FILTER NOT EXISTS { ?jd j:supersededBy ?newer }
}
```

### `r21-unresolved-conflict` — make disagreement visible

```sparql
# Two current judgments give different functional values for the same subject/predicate,
# and neither supersedes the other → flag both as an unresolved conflict.
PREFIX j: <https://predicate.dev/judgment#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
CONSTRUCT {
  ?a a j:UnresolvedConflict .
  ?b a j:UnresolvedConflict .
  ?a j:conflictsWith ?b .
}
WHERE {
  ?p a owl:FunctionalProperty .
  ?s ?p ?va . ?s ?p ?vb .
  FILTER (?va != ?vb)
  ?a a j:Current ; j:about ?s .   # 'j:about' reifies which subject a judgment concerns
  ?b a j:Current ; j:about ?s .
  FILTER NOT EXISTS { ?a j:supersedes ?b }
  FILTER NOT EXISTS { ?b j:supersedes ?a }
}
```

> Open design point (tracked in PRD §15): `r21` overlaps with what `r08`/`r11` already detect as a hard inconsistency. The intended split — **`r08`/`r11` halt on a logical inconsistency that must be repaired; `r21` materializes a *soft, queryable* conflict the agent is expected to reconcile next session** — needs validating against the fixpoint engine so the two don't fight. If a functional-property violation already raises an inconsistency, `r21` may be redundant; if the engine tolerates it, `r21` is what makes it visible. Resolve before implementing.

---

## 3. Worked judgment corpus

One small Turtle corpus per seed domain. Each is loadable into `kg:abox` with provenance, and each contains a **planted contradiction** so the session-one eval has something to detect. These replace the regex-extracted lookup corpus in `load-corpus.ts` for eval purposes.

### 3.1 Codebase domain — *abandoned approach + ownership conflict*

```turtle
@prefix j:  <https://predicate.dev/judgment#> .
@prefix c:  <https://predicate.dev/codebase#> .
@prefix ex: <https://predicate.dev/corpus/codebase#> .

# Judgment: Postgres was tried for the event store and abandoned. No live source has this.
ex:eventStoreDecision a j:Decision ;
    j:about        ex:eventStore ;
    j:settledAs    ex:kafkaOption ;
    j:rejected     ex:postgresOption ;
    j:rationale    "Postgres trialled in 2026-02; abandoned — write amplification under "
                   "fan-out load exceeded budget. Kafka chosen for the append path." ;
    j:basedOn      ex:loadTest_2026_02 , ex:incident_4471 ;
    j:assertedFor  ex:goalEventStore .

# Assessment: a fragility call with no source.
ex:authFragility a j:Assessment ;
    j:about     ex:authService ;
    j:rationale "Fragile: token refresh path has no retry and shares a connection "
                "pool with billing; failed twice during billing spikes." ;
    j:basedOn   ex:incident_4471 , ex:incident_4520 .

# PLANTED CONTRADICTION: two sessions settled different owners for the payments module.
ex:ownerJudgmentA a j:Decision ;
    j:about ex:paymentsModule ; j:settledAs ex:teamPlatform ;
    j:rationale "Platform owns payments per 2026-03 reorg." ; j:basedOn ex:reorgDoc .
ex:ownerJudgmentB a j:Decision ;
    j:about ex:paymentsModule ; j:settledAs ex:teamCheckout ;
    j:rationale "Checkout owns payments per on-call rotation." ; j:basedOn ex:pagerConfig .
# Neither supersedes the other → r21 must flag both as j:UnresolvedConflict.
```

### 3.2 Ops / SRE domain — *reconciled topology + blast radius*

```turtle
@prefix j:  <https://predicate.dev/judgment#> .
@prefix o:  <https://predicate.dev/ops#> .          # seed ontology, dependsOn is transitive (reuse r03)
@prefix ex: <https://predicate.dev/corpus/ops#> .

ex:checkout    o:dependsOn ex:billingEvents .
ex:billingEvents o:dependsOn ex:ledger .
ex:dunning     o:dependsOn ex:billingEvents .
# Transitive closure (r03) gives blast radius of deprecating billingEvents:
#   checkout, dunning (direct) + anything depending on them.

# Reconciliation: two runbooks disagreed on who owns the dunning consumer; settled.
ex:dunningOwner a j:Reconciliation ;
    j:about ex:dunningConsumer ;
    j:settledAs    ex:teamBilling ;
    j:reconciledFrom ex:runbookA , ex:runbookB ;   # runbookB (said teamGrowth) kept, lower confidence
    j:rationale "runbookA (current) overrides runbookB (last edited 14 months ago). "
                "Confirmed against the deploy that moved the consumer." .
```

> `ex:runbookB`'s claim stays in the graph at low confidence (excluded from the inference closure per PRD §7.4), so the agent can *show* it reconciled rather than pretend the conflict never existed.

### 3.3 Personal domain — *standing preference + a fresh contradiction*

```turtle
@prefix j:  <https://predicate.dev/judgment#> .
@prefix ex: <https://predicate.dev/corpus/personal#> .

# The "why do you batch my errands on Tuesdays" judgment — no live source anywhere.
ex:errandPref a j:Preference ;
    j:about     ex:errandScheduling ;
    j:prefers   ex:tuesday ;
    j:over      ex:thursday ;
    j:rationale "Tuesdays: lowest observed traffic on the user's route + a recurring "
                "free 2pm block. Inferred over ~3 months of calendar + traffic data." ;
    j:basedOn   ex:trafficObservations , ex:calendarPattern .

# PLANTED CONTRADICTION (newer, conflicting): a fresh observation prefers Thursday.
# j:prefers is FUNCTIONAL per choice-context → r08/r21 fires unless one supersedes the other.
ex:errandPrefNew a j:Preference ;
    j:about   ex:errandScheduling ;
    j:prefers ex:thursday ;
    j:rationale "Recent: user moved standing 2pm meeting to Tuesdays." ;
    j:basedOn ex:calendarChange_2026_05 .
# Correct agent behavior: detect the conflict, then SUPERSEDE the old judgment
# (ex:errandPrefNew j:supersedes ex:errandPref) rather than silently keeping both.
```

---

## 4. Session-one eval spec

The PRD's leading indicator (§12). Each case must pass **within a single session** and is paired with the **no-Predicate baseline** that proves the capability is real, not incidental.

| # | Domain | Question | Expected Predicate behavior | What it proves | No-Predicate baseline |
|---|---|---|---|---|---|
| E1 | Personal | "Why do you schedule my errands on Tuesdays?" | `kg_ask` returns `ex:errandPref` with its `j:rationale`; `kg_explain` cites `j:basedOn` traffic + calendar. | Answers a **why** with no live source. | Agent has no record of its own past reasoning → cannot answer or fabricates. |
| E2 | Personal | (after the Thursday observation is asserted) "Which day do you prefer for errands?" | Reasoner materializes `j:UnresolvedConflict` on the two preferences (r08/r21); agent surfaces the conflict and reconciles via `j:supersedes`. | **Contradiction flagged, not silently overwritten** (principle #4). | Last-write-wins memory silently picks one; the conflict is invisible. |
| E3 | Codebase | "Why didn't we use Postgres for the event store?" | `kg_ask` returns `ex:eventStoreDecision` (`j:rejected ex:postgresOption`, rationale); `kg_explain` cites the load test + incident. | **Knowledge with no live source** — the rejected path isn't in any file. | The code only shows Kafka; the *reason Postgres was dropped* is unrecoverable from live sources. |
| E4 | Codebase | "Who owns the payments module?" | Reasoner flags `ex:ownerJudgmentA` / `ex:ownerJudgmentB` as `j:UnresolvedConflict`; agent reports the disagreement + both bases instead of guessing. | Reconciliation enforcement on a functional property. | Agent reads CODEOWNERS or asks again — re-litigating what was already (conflictingly) concluded. |
| E5 | Ops | "What breaks if we deprecate `billing-events`?" | Transitive `o:dependsOn` (r03) returns `checkout`, `dunning`, and their dependents; `kg_explain` shows the chain. | **Blast radius** over reconciled topology. | Agent can grep configs for one hop but misses transitive/incident-learned edges. |
| E6 | Ops | "Who owns the dunning consumer, and was that ever in dispute?" | Returns `ex:teamBilling` as settled **and** that `runbookB` disagreed (kept at low confidence). | Provenance of reconciliation — shows its work. | No memory that a conflict existed or how it was resolved. |

**Pass bar (gates longitudinal claims):** all six green, and E2/E4 specifically must show the conflict *materialized by the reasoner*, not detected by the model reading two rows and reasoning in prose. The whole point is that entailment is the engine's job.

**Contract-adherence sub-metric (PRD §14 risk):** log whether the host model called `kg_explore_schema` before each `kg_ask`, and whether `kg_assert` calls carried `j:basedOn`. Low adherence here predicts graph rot regardless of E1–E6 outcomes.

---

## 5. What this implies for the shipped code (not done here)

Recorded so the gap is explicit; turning these into changes is a separate plan, not this artifact:

1. **A judgment extractor** distinct from the lookup extractor. Today `turn-extractor.ts` and `extractor.ts` capture only lookups (file-edited, regex imports). Judgments come from the *assistant's reasoning text and decisions*, not tool I/O — a different extraction surface entirely.
2. **`j:` catalog file** under `packages/predicate-ontology/catalog/` plus SHACL shapes ("every `j:Judgment` cites ≥1 `j:basedOn`").
3. **Rules `r20`/`r21`** added to `packages/predicate-reasoner/src/rules/`, after resolving the §2 overlap question.
4. **Eval corpus swap** — `load-corpus.ts` currently loads the regex lookup corpus; the session-one eval needs these judgment fixtures instead.

---

*Next decision: whether to (a) promote the `j:` vocabulary into the ontology catalog and write `r20`/`r21` as a first implementation slice, or (b) hold until the judgment-extractor design (item 1 above) is specced, since an empty judgment layer is only exercised by hand-loaded corpus.*
