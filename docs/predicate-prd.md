# Predicate — Product Requirements Document

**Status:** Draft v0.1
**Owner:** [you]
**Last updated:** May 2026

---

## 1. Summary

Predicate is a local-first MCP skill that gives an AI agent a knowledge graph it can reason over and that improves itself with use. Instead of retrieving text chunks, the agent reads a structured graph, runs SPARQL against it, gets logically entailed answers from an OWL reasoner, and grows the schema toward whatever the user is trying to do. Every fact carries provenance and confidence. The schema is versioned like code. Nothing leaves the machine.

The bet: agents lose most of their value to two failures — they forget across sessions, and they can only answer shallow lookups. A reasoning graph that compounds fixes both, and the value gap widens the longer it runs.

## 2. Problem

An AI coding or research agent today re-explains context every session and answers single-hop questions. Ask "why did login break" and the agent cannot traverse `auth.ts → validateToken → jwt.verify → JWT_SECRET → .env.production → commit abc123`. It can't tell you the blast radius of a rename, the services downstream of a failing dependency, or which of two documents contradicts the other.

The "agent memory" category has noticed the forgetting half of this. It has mostly not solved the reasoning half. Most products in the space store text or vectors with light graph structure and call it a knowledge graph. They do not separate schema from data, do not run a reasoner, do not track provenance per triple, and grow without bound until the operator has to clean up by hand.

## 3. Objective

Give AI coding and research agents a local, self-improving knowledge graph that reasons over relationships, so the agent's understanding of a domain compounds with use instead of resetting every session.

The one-line pitch: *Predicate understands your world, and gets smarter every time you use it.*

## 4. Users and jobs

**Primary user:** a developer running an agent (Claude Code, Cursor, and similar) who is tired of re-explaining context and getting shallow answers.

**Primary job:** let the agent answer "why," "what breaks if," and "what's connected to" questions correctly, and remember the answer next session.

**Secondary users (later):** SRE/on-call engineers, security and compliance analysts, research and due-diligence analysts. Same mechanics, different seed ontology.

## 5. Why now and competitive context

The temporal-knowledge-graph-for-agents space is consolidating. Zep's Graphiti is the closest serious effort in this direction — it offers prescribed and learned ontology and provenance-tracked context graphs for agents, and it is well resourced and moving. The crowded "engram"-style memory projects (eight or more on GitHub) compete on memory recall, not reasoning.

Predicate's wedge is the combination almost no one ships together: local-first delivery as a skill, a real RDF/OWL reasoner (not a property graph used as a slow document store), and goal-conditioned schema evolution with active pruning. Graphiti is the project to track. The differentiator to defend is reasoning quality and bounded growth.

## 6. Product principles

These decide every later trade-off.

1. **TBox and ABox are different systems, not different graphs.** The schema evolves slowly, deliberately, with review and versioning. Instance data flows fast with provenance and confidence. Mixing their workflows is the most common way homegrown graphs die.
2. **Provenance first.** Every triple records source, time, confidence, extraction method. Without this you cannot prune, resolve conflicts, or explain an answer.
3. **Reasoning is the product.** If the system does not run OWL inference, it is a slow document store. Logical entailment comes from the engine, never from the model guessing.
4. **Goal-conditioned, not corpus-driven.** Concepts enter the graph because a goal needed them, not because a document mentioned them. This is the moat against "build a KG from documents" projects.
5. **The schema is code.** Versioned in git, changed by proposal and review, diffable, rollback-able, tested with SHACL shapes.

## 7. Architecture

### 7.1 Storage and reasoning

**Decision: Apache Jena Fuseki in Docker as the bundled default, behind a reasoner adapter.**

Fuseki is Apache 2.0, embeddable, easily containerized, with TDB2 for persistence and no redistribution problem. Ontotext GraphDB is proprietary and cannot be bundled in a source-available distribution; its free tier has concurrency limits. So Fuseki ships in the box.

Fuseki's native OWL reasoning is weak, so the product does not depend on it. Reasoning runs through a pluggable adapter. The default implementation applies a curated OWL 2 RL rule subset as SPARQL `CONSTRUCT` rules run to a fixpoint. Power users can repoint the adapter at GraphDB Free (strong built-in OWL 2 RL) or RDFox (incremental materialization, the long-term ideal) without touching the rest of the system. Ship Fuseki, design for swap.

### 7.2 Named graph layout

| Graph | Holds | Mutability |
|---|---|---|
| `kg:tbox` | live ontology (classes, properties, axioms) | versioned, gated |
| `kg:tbox-staging` | proposed schema changes under review | scratch |
| `kg:abox` | asserted facts | append + explicit migration only |
| `kg:inferred` | materialized entailments | disposable, regenerated |
| `kg:provenance` | RDF-star metadata per triple | append |
| `kg:goals` | goals, decompositions, status | live |
| `kg:usage` | query and access logs per resource | append |
| `kg:meta` | TBox version history and justifications | append |

The mental model: ABox is a river, fast and monotonic and cheap. TBox is bedrock, slow and gated and versioned. Inferred is weather, regenerated on demand and never migrated.

### 7.3 Ruleset

**Decision: a curated subset of OWL 2 RL plus SHACL for validation.** RDFS alone is too weak (no property chains, inverses, or disjointness). OWL DL is intractable at any real graph size. OWL Full is undecidable.

The product does not implement all of OWL 2 RL. It implements roughly 12 to 15 rule patterns that cover what the use cases need: subclass and subproperty transitivity, transitive properties, inverse properties, property chains, domain and range type inference, functional properties and `sameAs` for entity resolution, and disjointness. Disjointness earns its place specifically because it is how the reasoner detects that the agent learned something contradictory.

SHACL covers the closed-world side that OWL's open-world semantics cannot — shape constraints like "every Employee has exactly one manager." Both are required; they do different jobs.

### 7.4 Provenance representation

Use RDF-star (RDF 1.2) for triple-level metadata rather than reification. It is cleaner and supported by Jena 4.x and GraphDB 10+. Low-confidence triples remain visible to queries but are excluded from the inference closure so they cannot poison entailment.

## 8. Functional requirements

### 8.1 MCP tools (v1)

| Tool | Behavior | Priority |
|---|---|---|
| `kg_ask(question)` | drafts SPARQL against the live schema, executes, iterates on poor results, returns an answer | P0 |
| `kg_explain(claim)` | returns the inference path that produced a claim | P0 |
| `kg_assert(triple, source, confidence)` | writes to `kg:abox` with provenance | P0 |
| `kg_explore_schema(concept)` | returns the relevant TBox slice so the model uses real predicates | P0 |
| `kg_propose_schema(delta, justification)` | sends a schema change to staging | P0 |
| `kg_research_goal(goal)` | runs the gap-detect → research → propose loop | P1 |
| `kg_stats()` | triples, inferences, staleness, goal progress, savings | P1 |
| `kg_maintain()` | triggers pruning, generalization, refactor sweep | P1 |

### 8.2 The skill descriptor

A `SKILL.md` tells the calling agent when and how to use these tools:

- **Triggers:** multi-hop questions, "why" questions, blast-radius questions, anything needing structured reasoning rather than fuzzy recall.
- **Workflow:** ask first; assert only after research; propose schema only when the ABox cannot represent a fact.
- **Anti-patterns:** do not dump raw text in; do not bypass the validator; do not query the inferred graph for write-back; do not invent predicates.
- **Examples:** four worked chains so the agent learns the rhythm.

### 8.3 Reasoning model

Split the word "reasoning" cleanly. Logical entailment is the engine's job: OWL 2 RL materialization computes the deductive closure deterministically and soundly. The model must never hand-derive a subclass chain — model-derived logic is the hallucination the product exists to escape.

Query formulation and interpretation are the model's job. The loop: read the relevant TBox slice, draft SPARQL against asserted plus inferred graphs, execute, inspect, refine on empty or odd results, interpret into an answer with the inference path exposed through `kg_explain`. Pre-baked SPARQL templates are forbidden — fresh SPARQL against a freshly read schema is the core mechanic. Guardrails: query cost ceilings, result truncation, mandatory provenance citation.

## 9. Ontology lifecycle

### 9.1 How the schema changes

The schema is never edited directly. The path is propose, stage, validate, promote, version.

1. The agent emits a schema delta into `kg:tbox-staging`, never `kg:tbox`.
2. **Validation gate.** Run the reasoner over `tbox + staging + an ABox sample`; reject if it produces an unsatisfiable class or an inconsistency. Run SHACL meta-shapes. Compute impact: how many ABox triples and recent queries the change touches.
3. **Promotion gate.** A staged change is promoted only after it has been referenced by N successful queries or research answers within a TTL (default: 3 to 5 uses within 7 days). Unused proposals expire quietly.
4. Every promotion is a git-tracked Turtle commit plus a provenance record in `kg:meta` — version, time, the goal that motivated it, justification.
5. Rollback reverts the TBox version. The ABox is untouched. The inferred graph regenerates.

This promotion gate is the anti-thrashing mechanism and also the safety mechanism for inferred goals (see section 11).

### 9.2 What happens to existing data

The governing rule: the ABox is never silently corrupted. Either the change is non-breaking, or it ships with a validated migration, or it is rejected.

- **Additive change** (new subclass, new property — roughly 80% of changes if the agent is disciplined). Existing ABox untouched. Re-materialize; some instances gain newly inferred types. No migration. RDF is monotonic here, so additive changes cannot break existing data.
- **Refinement** (a class splits into two subclasses). Old instances stay valid under the parent class. New instances get finer types. Optional backfill re-classifies old instances via a `CONSTRUCT` heuristic, flagged in provenance as auto-reclassified and low confidence. Nothing is destroyed.
- **Breaking change** (rename, removal, tighter domain or range, disjointness that existing data violates). The staged change must carry a migration — a SPARQL `UPDATE` generated by the agent, with `owl:deprecated` annotations kept for provenance. If the change would create an inconsistency and no valid migration accompanies it, the validation gate rejects it before it reaches main.

Asserted and inferred graphs stay strictly separate. On any TBox change, drop `kg:inferred` and re-materialize. Only `kg:abox` ever needs migration, and only for breaking changes.

### 9.3 Cadence and strategies

ABox and TBox run on different clocks.

ABox is fast, continuous, event-driven. Assert facts the moment the agent learns them serving a goal. Re-materialize the inferred graph on a debounced schedule — roughly every 30 seconds of write activity or every 100 triples, not per triple.

TBox is slow and gated, with several triggers:

- **Gap-triggered (primary).** A goal sub-question's SPARQL returns null or inconsistent, and the gap is structural (no class or property exists to represent the needed fact). Demand-driven, never speculative.
- **Generalization sweep (periodic).** When the ABox grows past a threshold, scan for K or more untyped instances sharing a structural pattern and propose lifting them to a class. Bounded by growth, not a fixed timer.
- **Specialization (workload-driven).** A class repeatedly queried with the same filter triggers a subclass proposal, driven by `kg:usage`.
- **Consistency repair (reactive).** The reasoner finds an inconsistency; propose a minimal fix, usually retracting the lowest-confidence conflicting triples.
- **Pruning and refactor (low frequency).** Weekly or on `kg_maintain`: archive unused concepts, merge near-duplicate classes, flatten dead hierarchy. This is the efficiency mechanism that keeps the graph from rotting.

## 10. Goal handling

Infer continuously, confirm lightly, gate promotion strictly.

The agent classifies session intent and extracts a working goal from the conversation with zero friction. It surfaces this in one non-blocking line — "Treating this session as: reduce checkout latency; building knowledge around services on that path. Redirect me if that's off" — and the user corrects with a word or ignores it.

Explicit goals, when stated, get the fast lane: a larger research budget, proactive insight, permission to drive bolder schema proposals. Inferred goals get the conservative lane: ABox growth is fine, but TBox proposals go through the normal staging and usage-based promotion gate.

The promotion gate makes inferred goals safe by construction. It does not matter whether a goal was explicit or misread, because nothing reshapes the durable schema until a proposed concept has proven useful across several real queries. A concept built toward a misread intent simply never gets used and expires from staging. The gate, not the goal source, is the safety mechanism.

Goals are first-class nodes in `kg:goals` with status (active, dormant, done). Every learned concept links to the goal that motivated it, so pruning can later reason: this goal is done and nothing else references these concepts, so archive them.

## 11. Non-goals (v1)

- Not a general-purpose triple store competing with GraphDB or Stardog. It is an agent skill, not infrastructure.
- Not cloud SaaS. Local-first, privacy by default.
- Not aimed at fuzzy semantic recall over unstructured text. Predicate owns structured, relational, inferable knowledge and is honest about that boundary.
- Not an attempt to model every domain perfectly on day one. It starts narrow and earns breadth.

## 12. Success metrics

**Capability.** The agent reliably answers multi-hop questions: transitive dependencies, contradictions, blast radius. Track a fixed eval set of such questions and measure correct-answer rate over time.

**Boundedness.** Active graph size stays within a target band as usage grows; pruning and generalization demonstrably fire. Track triple count, unused-concept ratio, and materialization latency over time.

**Continuity.** Zero re-explaining across sessions; working state survives compaction. Track resumed sessions that proceed without the user restating context.

**Adoption and compounding.** Developers keep it installed past week two, and queries per session rise over time — the compounding effect should be observable, not asserted. Track install retention and per-user query trend.

## 13. v1 plan

| Phase | Weeks | Deliverable |
|---|---|---|
| Foundation | 1–2 | Fuseki in Docker; MCP server with `sparql_query`/`sparql_update`; 50-triple seed ontology in the codebase domain; end-to-end ask → answer |
| Discipline | 3–4 | named-graph separation; RDF-star provenance; SHACL shapes; OWL 2 RL CONSTRUCT rule layer; ontology in git with a CI consistency check |
| Agent loop | 5–8 | goal store; question decomposer; gap detector; research orchestrator (web + code + docs); triple extractor with confidence; staging and promotion pipeline |
| Efficiency | 9–12 | usage tracking; reaper; generalization detector; materialization tuning; SKILL.md; packaged skill |

Minimum viable version is roughly six weeks (Foundation plus Discipline plus a thin agent loop). The version where generalization and pruning genuinely work is closer to four months. Seed domain for v1 is codebase intelligence — same audience as the context-optimization tools, clearest "aha" per query. SRE/on-call is the strongest second domain and the best candidate for the first commercial wedge.

## 14. Key risks

**Schema thrashing.** Aggressive ontology rewrites break downstream queries and learned patterns. Mitigation: the two-tier staging and usage-gated promotion is non-negotiable from day one.

**Weak default reasoner.** Fuseki's native OWL is poor; if the CONSTRUCT rule layer underperforms, the product's core claim weakens. Mitigation: curated rule subset, early benchmarking against GraphDB as a quality reference, adapter design so heavy users can upgrade.

**Reasoning cost at scale.** Full materialization can dwarf the data. Mitigation: materialize only inferred classes and frequent rule outputs; leave deep chains for query time; cache hot results.

**Competitive timing.** Graphiti is moving in an adjacent direction with resources. Mitigation: lock the name and ship; compete on reasoning quality and bounded growth rather than on memory recall, where the field is crowded.

## 15. Open questions

- Exact membership of the 12–15 OWL 2 RL CONSTRUCT rules, and their fixpoint execution strategy on Fuseki at target graph sizes.
- Promotion-gate thresholds (N uses, TTL) — defaults proposed, need tuning against real sessions.
- Entity resolution approach for the ABox: SHACL plus similarity, and where the confidence cutoff sits.
- Whether the v1 research orchestrator ships with code analysis from day one or web and docs only.
- npm package name and `predicate.dev` / `predicate.sh` availability, to be verified before any public commit.

---

*Next artifact: the named-graph schema in Turtle plus the explicit OWL 2 RL CONSTRUCT rule set, as the concrete starting point for the Fuseki build.*
