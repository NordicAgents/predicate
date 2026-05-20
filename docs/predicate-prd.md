# Predicate — Product Requirements Document

**Status:** Draft v0.2 (supersedes v0.1; reframed around experiential memory — judgments, not lookups)
**Owner:** [you]
**Last updated:** May 2026

---

## 1. Summary

Predicate is a local-first memory substrate that gives an AI agent a knowledge graph of the **judgments it has accumulated and reconciled over time** — and lets it reason over them. Not a cache of documents, not a transcript of conversations: the settled, provenanced understanding an agent builds through use. Facts are stored as RDF triples with per-triple provenance and confidence. An OWL 2 RL reasoner materializes entailments deterministically and produces an explanation path for every derived claim. The schema is versioned like code and evolves under a propose → validate → use-gated promotion loop. Everything runs locally — no daemon, no Docker by default — and nothing leaves the machine.

The distinction that defines the product: **Predicate stores judgments, not lookups.**

- A **lookup** is re-derivable from a live source on demand — what a file imports, what a document says, the current value of a config. The agent can fetch it fresh whenever it needs it. Lookups do *not* belong in the graph.
- A **judgment** is the residue of reasoning the agent already did — *this approach was tried and abandoned, and why; the user prefers X; these two sources conflict and source A won; this dependency is fragile.* A judgment has **no other source**. It is not written in any file. Reconstructing it means redoing the reasoning, often across information that is no longer available.

Lookups have a short half-life and a live source. Judgments have a long half-life and no source but the agent's own experience. Predicate owns the second category and is honest about ignoring the first.

The bet: agents lose most of their value to two failures — they forget the judgments they made, and they re-litigate questions they already settled. A reasoning graph of accumulated, reconciled judgments fixes both, and the gap to a memoryless agent widens the longer it runs.

## 2. Problem

Ask a long-running agent *why* it does something, *what breaks* if you change something, or *whether* two things it has learned conflict — and it usually can't answer, because the answer was never a fact in a file. It was a conclusion the agent reached and then forgot.

Three concrete shapes of this, across three different kinds of agent:

- **Personal agent.** "Why do you always batch my errands on Tuesdays?" The reason — months of observed traffic patterns and the user's calendar — lives in nothing readable. The agent formed a judgment, acted on it repeatedly, and cannot now reconstruct or even stay consistent with it.
- **Ops / on-call agent.** "What's the blast radius if we deprecate the `billing-events` topic?" The service topology was learned incrementally across incidents and deploys; no single document holds it. Worse, two runbooks disagree on who owns a downstream consumer — and the agent already reconciled that conflict once. It should not re-litigate it every session.
- **Analyst agent.** "Does this new filing contradict what management said in Q2?" Detecting the contradiction requires holding a reconciled, provenanced model of the prior claims. Re-reading everything fresh and *hoping* to notice the conflict is not the same capability.

None of these are lookups. None can be answered by reading a live source, because the source doesn't exist — the knowledge is the agent's own accumulated reasoning. The "agent memory" category has largely noticed the *forgetting* of conversations and has answered it with transcript and vector recall. It has mostly not built the thing that makes recall worth having: a **reconciled, reasoned, provenanced** model of what the agent actually concluded, with contradictions surfaced rather than averaged away.

## 3. Objective

Give any long-running AI agent a local, self-improving knowledge graph of its **accumulated and reconciled judgments**, so the agent's understanding compounds with use, stays internally consistent, and can explain itself — instead of resetting and re-deciding every session.

The one-line pitch: *Predicate is the memory of what your agent figured out — reconciled, explainable, and getting deeper every time you use it.*

Two value moments, deliberately separated so neither hides behind the other:

- **In a single session (leading indicator).** When two inputs conflict on a fact the schema marks functional or disjoint, the reasoner flags the conflict instead of silently picking one, and `kg_explain` shows why. This is testable on day one and does not depend on the long game.
- **Across sessions (compounding).** The judgment persists. Next session the agent does not re-derive it, does not contradict it, and can cite it. The value gap to a memoryless agent widens with use.

## 4. Users and jobs

Predicate sits between three nested stakeholders. The design serves all three, and confusing them is how the v0.1 framing went wrong.

| Stakeholder | Who they are | Their job-to-be-done |
|---|---|---|
| **Agent builder** | A developer wiring Predicate into an agent (Claude Code, Cursor, a custom MCP client, an ops bot, a personal assistant) | Drop in a memory + reasoning substrate that is local, auditable, and bounded — without standing up infrastructure or hand-curating an ontology. |
| **The agent** | The model at runtime, operating over many sessions | Record judgments as they're formed, reconcile them against prior judgments, query and traverse them, and never invent or re-derive what it already settled. |
| **End user** | The human the agent works for | Get continuity and consistency: an agent that remembers *why*, stays consistent with its own past reasoning, and can show its work. |

The product is **domain-agnostic by construction.** What makes it concrete in a given setting is the seed ontology, not the engine. Codebase intelligence, SRE topology, research/due-diligence, and personal assistance are *seed domains*, not separate products — same mechanics, different starting vocabulary.

## 5. Why now and competitive context

The agent-memory space is consolidating around *recall* — storing conversations, text, or vectors and fetching the nearest match. That solves "the agent forgot what we said." It does not solve "the agent forgot what it concluded, and now contradicts itself." Zep's Graphiti is the most serious effort moving toward provenance-tracked, temporally-aware context graphs and is the project to track. The crowded "engram"-style memory projects compete on recall quality.

Predicate's wedge is a combination almost no one ships together: local-first delivery as a skill, a real RDF/OWL reasoner (not a property graph used as a slow document store), **storage scoped to reconciled judgments rather than raw corpus**, and goal-conditioned schema evolution with active pruning. The differentiator to defend is reasoning quality, contradiction handling, and bounded growth — not how much the agent can remember, where the field is already crowded.

Predicate is explicitly **not** a retrieval system and is not positioned against retrieval-augmented approaches; it owns a different category — the agent's reasoned, structured conclusions — and is honest about that boundary (see §11).

## 6. Product principles

These decide every later trade-off.

1. **Judgments, not lookups.** The graph stores the agent's reconciled conclusions, which have no live source and a long half-life. It does not mirror anything that can be fetched fresh on demand. When in doubt, ask: *could the agent re-derive this by reading a source right now?* If yes, it's a lookup — don't store it.
2. **TBox and ABox are different systems, not different graphs.** The schema evolves slowly, deliberately, with review and versioning. Judgment data flows fast with provenance and confidence. Mixing their workflows is the most common way homegrown graphs die.
3. **Provenance first.** Every triple records source, time, confidence, extraction method. Without this you cannot prune, resolve conflicts, explain an answer, or invalidate a judgment when its basis changes.
4. **Reconciliation is the product, and reasoning is how it's enforced.** The value is a *settled* model: contradictions surfaced, duplicates merged, confidence tracked. Logical entailment comes from the engine and never from the model guessing; that's what makes the settled model trustworthy rather than just asserted.
5. **Goal-conditioned, not corpus-driven.** Concepts and judgments enter because a goal needed them, not because a document mentioned them. Every growth path — including the generalization sweep (§9.3) — is gated by goals and usage, never by raw scanning of a corpus. This is the moat against "build a KG from documents" projects and the guard against unbounded growth.
6. **The schema is code.** Versioned in git, changed by proposal and review, diffable, rollback-able, tested with SHACL shapes.

## 7. Architecture

### 7.1 Storage and reasoning

**Decision: Oxigraph, in-process and file-backed, as the bundled default, behind a reasoner adapter. Fuseki is an opt-in backend.**

The v0.1 default was Fuseki-in-Docker. That was reversed: requiring Docker to use a memory skill is friction the primary "drop it in" job cannot afford. Oxigraph (Apache 2.0, embeddable, native Node binding) gives sub-second startup, file-backed persistence at `~/.predicate/store/`, and zero daemon — the agent builder installs and runs immediately. Apache Jena Fuseki / TDB2 in Docker remains available behind `PREDICATE_BACKEND=fuseki` for very large graphs or multi-process sharing.

Native OWL reasoning is not depended upon in either backend. Reasoning runs through a pluggable adapter. The default implementation applies a curated OWL 2 RL rule subset as SPARQL `CONSTRUCT` rules run to a fixpoint. Power users can repoint the adapter at GraphDB Free (strong built-in OWL 2 RL) or RDFox (incremental materialization, the long-term ideal) without touching the rest of the system. Ship the embedded default, design for swap.

### 7.2 Named graph layout

| Graph | Holds | Mutability |
|---|---|---|
| `kg:tbox` | live ontology (classes, properties, axioms) | versioned, gated |
| `kg:tbox-staging` | proposed schema changes under review | scratch |
| `kg:abox` | asserted judgments | append + explicit migration/retraction only |
| `kg:inferred` | materialized entailments | disposable, regenerated |
| `kg:provenance` | RDF-star metadata per triple | append |
| `kg:goals` | goals, decompositions, status | live |
| `kg:usage` | query and access logs per resource | append |
| `kg:meta` | TBox version history and justifications | append |

The mental model: ABox is the agent's settled memory, monotonic and provenanced; it grows by assertion and shrinks only by explicit retraction (§9.4). TBox is bedrock, slow and gated and versioned. Inferred is weather, regenerated on demand and never migrated.

### 7.3 Ruleset

**Decision: a curated subset of OWL 2 RL plus SHACL for validation.** RDFS alone is too weak (no property chains, inverses, or disjointness). OWL DL is intractable at any real graph size. OWL Full is undecidable.

The product implements roughly 12–19 rule patterns that cover what the use cases need: subclass and subproperty transitivity, transitive properties, inverse properties, property chains, domain and range type inference, functional properties and `sameAs` for entity resolution, and disjointness. Disjointness earns its place specifically because it is how the reasoner detects that the agent reconciled two sources into a contradiction — the core of principle #4.

SHACL covers the closed-world side that OWL's open-world semantics cannot — shape constraints like "every reconciled claim cites at least one source." Both are required; they do different jobs.

### 7.4 Provenance representation

Use RDF-star (RDF 1.2) for triple-level metadata rather than reification. It is cleaner and supported by the embedded store and by GraphDB 10+. Low-confidence triples remain visible to queries but are excluded from the inference closure so they cannot poison entailment. Provenance is also what makes invalidation possible (§9.4): a judgment knows what it was based on, so it can be retracted when that basis changes.

## 8. Functional requirements

### 8.1 MCP tools (v1)

| Tool | Behavior | Priority |
|---|---|---|
| `kg_ask(question, sparql)` | executes caller-drafted SPARQL against asserted + inferred graphs, truncates and logs usage, returns bindings | P0 |
| `kg_explain(claim)` | returns the inference path that produced a claim, cited to provenance | P0 |
| `kg_assert(triple, source, confidence)` | writes a judgment to `kg:abox` with provenance; rejects undeclared predicates | P0 |
| `kg_explore_schema(concept)` | returns the relevant TBox slice so the model uses real predicates | P0 |
| `kg_propose_schema(delta, justification)` | sends a schema change to staging | P0 |
| `kg_research_goal(goal)` | runs the decompose → gap-detect → optional research → plan loop | P1 |
| `kg_stats()` | triples, inferences, inferred ratio, unused-concept ratio, latency | P1 |
| `kg_maintain()` | triggers reaper, generalizer, promotion sweeper; re-materializes inferred | P1 |

**Division of labor (made explicit because it's load-bearing).** `kg_ask` is a read-only executor of *caller-supplied* SPARQL, not a query author. Query formulation, refinement on empty/odd results, and interpretation are the model's job; logical entailment is the engine's. Because the entire value chain depends on the host model drafting correct SPARQL against a freshly read schema, `kg_explore_schema` is mandatory before non-trivial `kg_ask` calls, and the schema slice is shaped to make good queries easy to write. This dependency is the product's biggest reliability risk and is tracked as such (§14).

### 8.2 The skill descriptor

A `SKILL.md` tells the calling agent when and how to use these tools:

- **Triggers:** "why" questions, "what breaks if" questions, "do these conflict" questions — anything that needs the agent's *reconciled judgment* rather than a fresh lookup.
- **Workflow:** explore schema first; assert a judgment only after it's reconciled, with provenance and confidence; propose schema only when the ABox cannot represent a judgment.
- **Anti-patterns:** do not store lookups (anything re-derivable from a live source); do not dump raw text or transcripts in; do not bypass the validator; do not query the inferred graph for write-back; do not invent predicates.
- **Examples:** four worked judgment chains (one per seed domain) so the agent learns the rhythm.

### 8.3 Reasoning model

Split the word "reasoning" cleanly. Logical entailment is the engine's job: OWL 2 RL materialization computes the deductive closure deterministically and soundly. The model must never hand-derive a subclass chain — model-derived logic is the hallucination the product exists to escape.

Query formulation and interpretation are the model's job. The loop: read the relevant TBox slice, draft SPARQL against asserted plus inferred graphs, execute, inspect, refine on empty or odd results, interpret into an answer with the inference path exposed through `kg_explain`. Pre-baked SPARQL templates are forbidden — fresh SPARQL against a freshly read schema is the core mechanic. Guardrails: query cost ceilings, result truncation, mandatory provenance citation.

## 9. Ontology and judgment lifecycle

### 9.1 How the schema changes

The schema is never edited directly. The path is propose, stage, validate, promote, version.

1. The agent emits a schema delta into `kg:tbox-staging`, never `kg:tbox`.
2. **Validation gate.** Run the reasoner over `tbox + staging + an ABox sample`; reject if it produces an unsatisfiable class or an inconsistency. Run SHACL meta-shapes. Compute impact: how many ABox triples and recent queries the change touches.
3. **Promotion gate.** A staged change is promoted only after it has been referenced by N successful queries or research answers within a TTL (default: 3–5 uses within 7 days). Unused proposals expire quietly.
4. Every promotion is a git-tracked Turtle commit plus a provenance record in `kg:meta` — version, time, the goal that motivated it, justification.
5. Rollback reverts the TBox version. The ABox is untouched. The inferred graph regenerates.

This promotion gate is the anti-thrashing mechanism and the safety mechanism for inferred goals (§10).

### 9.2 What happens to existing data

The governing rule: the ABox is never silently corrupted. Either the change is non-breaking, or it ships with a validated migration, or it is rejected.

- **Additive change** (new subclass, new property — most changes if the agent is disciplined). Existing ABox untouched. Re-materialize; some instances gain newly inferred types. RDF is monotonic here, so additive changes cannot break existing data.
- **Refinement** (a class splits into two subclasses). Old instances stay valid under the parent class. New instances get finer types. Optional backfill re-classifies old instances via a `CONSTRUCT` heuristic, flagged in provenance as auto-reclassified and low confidence.
- **Breaking change** (rename, removal, tighter domain or range, disjointness that existing data violates). The staged change must carry a migration — a SPARQL `UPDATE` generated by the agent, with `owl:deprecated` annotations kept for provenance. If the change would create an inconsistency and no valid migration accompanies it, the validation gate rejects it.

Asserted and inferred graphs stay strictly separate. On any TBox change, drop `kg:inferred` and re-materialize. Only `kg:abox` ever needs migration, and only for breaking changes.

### 9.3 Cadence and growth triggers

ABox and TBox run on different clocks.

ABox is fast, continuous, event-driven. Assert a judgment the moment the agent forms one serving a goal. Re-materialize the inferred graph on a debounced schedule — roughly every 30 seconds of write activity or every 100 triples, not per triple.

TBox is slow and gated, with several triggers — **all goal- or usage-conditioned, never raw corpus scanning** (principle #5):

- **Gap-triggered (primary).** A goal sub-question's SPARQL returns null or inconsistent, and the gap is structural (no class or property exists to represent the needed judgment). Demand-driven, never speculative.
- **Generalization sweep (usage-gated).** When several instances *that goals have already touched* share a structural pattern, propose lifting them to a class. The candidate set is drawn from `kg:usage` and `kg:goals`, not from an undirected scan of the ABox — so this remains goal-conditioned, not corpus-driven. Bounded by referenced-instance growth, not a fixed timer.
- **Specialization (workload-driven).** A class repeatedly queried with the same filter triggers a subclass proposal, driven by `kg:usage`.
- **Consistency repair (reactive).** The reasoner finds an inconsistency; propose a minimal fix, usually retracting the lowest-confidence conflicting triples.
- **Pruning and refactor (low frequency).** On `kg_maintain`: archive unused concepts, merge near-duplicate classes, flatten dead hierarchy.

### 9.4 Staleness and invalidation

Judgments have a long half-life but not an infinite one. A judgment's basis can change, and the ABox must be able to retract — not just accumulate.

- **Basis tracking.** Every asserted judgment records, in provenance, what it was based on (source, time, the goal, the inputs reconciled). This is what distinguishes a retractable judgment from an orphaned fact.
- **Invalidation triggers.** When a cited source changes, when a higher-confidence judgment contradicts an existing one (caught by disjoint/functional rules), or when `kg_maintain` finds a judgment whose basis no longer exists, the judgment is retracted or superseded — with the change itself recorded in provenance and the prior version kept via `owl:deprecated`.
- **Re-derivation, not blind trust.** A judgment that has gone stale is not silently served. The agent re-reconciles from current inputs and asserts a fresh judgment, superseding the old one.

This is the mechanism that keeps the graph from rotting into confidently-stated obsolete conclusions — the failure mode a code-shaped (lookup-heavy) graph would have hit immediately, and the reason §1 draws the judgment/lookup line.

## 10. Goal handling

Infer continuously, confirm lightly, gate promotion strictly.

The agent classifies session intent and extracts a working goal with zero friction, surfaces it in one non-blocking line, and the user corrects with a word or ignores it.

Explicit goals get the fast lane: larger research budget, proactive insight, bolder schema proposals. Inferred goals get the conservative lane: ABox growth is fine, but TBox proposals go through the normal staging and usage-based promotion gate.

The promotion gate makes inferred goals safe by construction. Nothing reshapes the durable schema until a proposed concept has proven useful across several real queries; a concept built toward a misread intent simply never gets used and expires. The gate, not the goal source, is the safety mechanism.

Goals are first-class nodes in `kg:goals` with status (active, dormant, done). Every learned judgment links to the goal that motivated it, so pruning can reason: this goal is done and nothing else references these judgments, so archive them.

## 11. Non-goals (v1)

- Not a general-purpose triple store competing with GraphDB or Stardog. It is an agent skill, not infrastructure.
- Not cloud SaaS. Local-first, privacy by default.
- **Not a lookup or retrieval layer.** Predicate does not mirror documents, code, or any source the agent can read live, and is not positioned against retrieval-augmented approaches — they answer "what does the source say," Predicate answers "what did I conclude." It owns reconciled, reasoned, structured judgments and is honest about that boundary.
- Not a conversation/transcript memory. Storing raw turns is explicitly out; only the judgments distilled from them are in.
- Not an attempt to model every domain perfectly on day one. It starts narrow per seed domain and earns breadth.

## 12. Success metrics

Separated into a session-one leading indicator and the longitudinal trends, so the core mechanism is provable before the long game.

**Session-one capability (leading indicator).** On a fixed eval set, within a single session the agent: (a) flags a planted contradiction between two inputs instead of silently picking one, (b) answers a "why/what-breaks/what-conflicts" question that has no live source, and (c) produces a correct `kg_explain` path. Measured as pass rate; must clear a bar before longitudinal claims are made. **Baseline: the same agent with no Predicate, allowed to re-read live sources** — Predicate must win specifically on the no-live-source and contradiction cases.

**Capability over time.** Correct-answer rate on a fixed multi-hop judgment eval set, tracked as it grows with use.

**Boundedness.** Active graph size stays within a target band as usage grows; pruning and generalization demonstrably fire. Track triple count, unused-concept ratio, stale-judgment retraction rate, and materialization latency. *(This metric becomes meaningful only once pruning/generalization ship — see §13 phase 4; it is not a phase-1 gate.)*

**Continuity and consistency.** Zero re-explaining across sessions; the agent does not contradict its own prior judgments. Track resumed sessions that proceed without restated context, and self-contradiction incidents per N sessions.

**Adoption and compounding.** Builders keep it installed past week two; queries per session and judgment-reuse rate rise over time. Track install retention and per-user query trend.

## 13. v1 plan

| Phase | Weeks | Deliverable |
|---|---|---|
| Foundation | 1–2 | Embedded Oxigraph store; MCP server with `kg_ask`/`kg_assert`; seed ontology (codebase domain) with a hand-built judgment corpus; end-to-end ask → answer; **session-one leading-indicator eval green** |
| Discipline | 3–4 | named-graph separation; RDF-star provenance + basis tracking; SHACL shapes; OWL 2 RL CONSTRUCT rule layer incl. disjointness; ontology in git with a CI consistency check |
| Agent loop | 5–8 | goal store; question decomposer; gap detector; research orchestrator; judgment extractor with confidence and reconciliation; staging and promotion pipeline |
| Efficiency | 9–12 | usage tracking; reaper; **invalidation/retraction (§9.4)**; generalization detector; materialization tuning; SKILL.md; packaged skill |

Minimum viable version is roughly six weeks (Foundation + Discipline + a thin agent loop). The version where generalization, pruning, and invalidation genuinely work — and where the **boundedness** success metric becomes measurable — is closer to four months. Seed domain for v1 is codebase intelligence, but **only its judgment layer** (fragile dependencies, abandoned approaches, reconciled ownership), not its lookup layer (imports, symbols, current config). SRE/on-call is the strongest second domain and the best candidate for the first commercial wedge.

## 14. Key risks

**Host-model discipline (biggest product risk).** The entire value chain depends on the host model following the tool contract: exploring schema first, drafting correct SPARQL, asserting judgments with provenance, and never storing lookups or inventing predicates. If the model follows the contract only part of the time, the graph fills with noise or stays empty. Mitigation: a tight SKILL.md with worked examples, mandatory `kg_explore_schema` before non-trivial queries, schema slices shaped to make correct SPARQL easy, `kg_assert` rejection of undeclared predicates, and a session-one eval that measures contract adherence directly.

**The judgment/lookup line is hard to hold.** Agents will be tempted to dump lookups (cheaper than reasoning). If they do, the graph rots and the staleness problem returns. Mitigation: principle #1 enforced in SKILL.md and `kg_assert` guidance, plus the §9.4 invalidation loop as a backstop.

**Schema thrashing.** Aggressive ontology rewrites break downstream queries and learned patterns. Mitigation: two-tier staging and usage-gated promotion, non-negotiable from day one.

**Weak default reasoner.** If the CONSTRUCT rule layer underperforms, the core claim weakens. Mitigation: curated rule subset, early benchmarking against GraphDB as a quality reference, adapter design so heavy users can upgrade.

**Reasoning cost at scale.** Full materialization can dwarf the data. Mitigation: materialize only inferred classes and frequent rule outputs; leave deep chains for query time; cache hot results.

**Competitive timing.** Graphiti is moving in an adjacent direction with resources. Mitigation: ship; compete on reconciliation, contradiction handling, and bounded growth rather than on recall.

## 15. Open questions

- Exact membership of the OWL 2 RL CONSTRUCT rules and their fixpoint execution strategy at target graph sizes.
- Promotion-gate thresholds (N uses, TTL) — defaults proposed, need tuning against real sessions.
- The judgment/lookup boundary in practice: where, precisely, does a borderline fact fall, and can the SKILL.md make that call reliably for the model?
- Invalidation policy (§9.4): how aggressively to retract on source change vs. flag-and-keep; confidence thresholds for supersession.
- Entity resolution for the ABox: SHACL plus similarity, and where the confidence cutoff sits.
- Whether the v1 research orchestrator ships with code analysis from day one or web and docs only.

---

*Next artifact: the named-graph schema in Turtle plus the explicit OWL 2 RL CONSTRUCT rule set, and a worked judgment corpus per seed domain to drive the session-one eval.*
