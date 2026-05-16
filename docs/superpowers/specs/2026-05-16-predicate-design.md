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

### 4.1 Query lifecycle — milliseconds

```
kg_explore_schema(concept)
  → draft SPARQL against asserted ∪ inferred
  → execute
  → empty/odd? → refine
  → interpret → kg_explain (inference path)
```

Pre-baked SPARQL templates are forbidden (PRD §8.3). The model reads a fresh TBox slice each time, drafts SPARQL against it, and `kg_explain` walks the inference path so the user can audit the answer.

Guardrails: query-cost ceiling (configurable, default 5s wall-clock and 100k intermediate rows), result truncation with a "more available" signal, mandatory provenance citation on every claim.

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

The extractor runs inside the MCP server but logically belongs to the agent loop. It is the *only* writer to `kg:abox` other than direct `kg_assert` calls from the host agent.

Low-confidence triples (default threshold 0.5) remain queryable but are excluded from reasoner closure input — they cannot poison `kg:inferred`.

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
| `kg:abox` | asserted facts | append + explicit migration | `kg_assert`, extractor |
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
| `kg_assert(triple, source, confidence)` | `kg:tbox` (validation) | `kg:abox`, `kg:provenance` | Source URI/path + confidence ∈ [0,1] required |
| `kg_propose_schema(delta, justification)` | `kg:tbox`, ABox sample | `kg:tbox-staging`, `kg:meta` | Never write directly to `kg:tbox` |
| `kg_research_goal(goal)` | web + docs | `kg:goals`, `kg:meta` (goal events), then assertions/proposals | Goal must link to current session intent |
| `kg_stats()` | all graphs | — | — |
| `kg_maintain()` | usage, provenance | `kg:abox` (archive), staging (expire), `kg:meta` (`maintenance-run` event) | Idempotent; safe on a cron |

Every tool in this table that has `kg:meta` in its Writes column emits a typed event record per §5.1. The reasoner adapter and the promotion sweeper write `kg:meta` events too, even though they are not user-callable tools.

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

Mechanism borrowed from superpowers; content tuned to PRD §8.2.

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
14. `owl:hasKey` (entity resolution; optional in v1)
15. Class assertion via `rdf:type` propagation through chains

Fixpoint runner: iterate until no new triples; cap at 10 iterations with overflow warning. Low-confidence triples excluded from closure input.

SHACL runs separately post-materialization against `kg:abox ∪ kg:inferred` for closed-world constraints (e.g., "every Employee has exactly one manager").

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
| `SessionStart` | Inject `kg_explore_schema(current_intent)` slice + open goals into system context |
| `UserPromptSubmit` | Lightweight intent classifier; if multi-hop/why/blast-radius → surface "consider Predicate" |
| `Stop` | Trigger debounced re-materialization; update goal status in `kg:goals` |

## 11. Storage hygiene

- Worktree-aware dataset selection (context-mode pattern).
- Pruning policy (`kg_maintain`): archive triples with `use_count == 0` and `confidence < 0.6` after 30 days; archive concepts whose motivating goal is `done` with no other references.
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

- Pruner/generalizer (designed but built in PRD's "Efficiency" phase, weeks 9–12).
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
| Bounded growth | unused-concept ratio < 15% after 30 days of use |
