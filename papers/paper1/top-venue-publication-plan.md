# Predicate: top-venue publication plan

**Audit date:** 2026-07-12  
**Primary recommendation:** rebuild the paper around **conflict-complete retrieval with proof witnesses**, not around Predicate as a product and not around generic “reasoning memory.”  
**Primary venue:** AAAI-28 main track, with KRR as the primary area.  
**Alternative venue:** NeurIPS 2027 Evaluations & Datasets if the benchmark/audit becomes the dominant contribution.  
**Stretch checkpoint:** ICML 2027 only if a genuinely general algorithmic or learning contribution is complete by December 2026.

## 1. Executive decision

Predicate is a serious prototype, but the current evidence package is **not ready for a top-venue submission**. The repository contains useful falsification work and a working reasoning system; it does not yet contain a manuscript, a real-world benchmark, independently validated labels, a fair collection of strong baselines, or enough independent experimental units for statistical claims.

The most promising current observation is narrow and useful:

> A query-local retriever can miss a contradiction when the two supporting records are connected only through an identifying key that the retriever does not index. Increasing hop depth eventually retrieves almost the whole store, whereas key closure exposes the pair directly.

This is currently a **constructed mechanism demonstration**, not yet a general scientific result. The generator deliberately places the duplicate record outside the IRI-only BFS ball, so the observed zero recall follows from the fixture construction. Five seeds change record identities but not the mechanism or outcome; they are regression tests, not five independent replications.

The paper should therefore answer a broader and falsifiable question:

> **What information must an agent-memory retrieval policy index to be conflict-complete, and can it return minimal, source-grounded conflict witnesses more accurately and cheaply than current memory systems?**

The research object becomes a retrieval guarantee, a minimal-witness algorithm, and an empirical boundary. Predicate is the implementation used to test those ideas.

## 2. Current readiness assessment

| Dimension | Current state | Top-venue bar | Verdict |
|---|---|---|---|
| Research question | Conflict preservation and retrieval boundary are emerging | One crisp, general question | Promising but not frozen |
| Method novelty | OWL-style rules, provenance, conflict objects, scoped materialization | Clear advance over trivial exact methods and prior systems | Unproven |
| Formal contribution | No paper-level definition, theorem, or complexity analysis | Soundness/completeness or a strong empirical law | Missing |
| Evaluation | Synthetic fixtures; 8 questions per fixture; several single runs | Large independent test set, external validity, strong controls | Major gap |
| Baselines | Flat-all, IRI-BFS, partial Mem0; Graphiti pending | Exact key join, database/SHACL/Datalog, key-aware retrieval, recommended configs of real systems | Major gap |
| Model coverage | Two local models plus undocumented in-session frontier agents | Pinned, reproducible strong open and closed models | Major gap |
| Statistical validity | Five structurally identical seeds; degenerate bootstrap intervals | Instances/domains as units; clustered uncertainty and paired tests | Major gap |
| Reproducibility | Good raw logs and tests, but dirty results and environment-sensitive test | One-command evidence build, clean checkout, fixed artifacts | Moderate gap |
| Manuscript | Strategy notes only | Complete anonymous paper with central evidence in main pages | Missing |

**Overall:** good research prototype; approximately 9–12 months from a strong AAAI submission, assuming one primary researcher and occasional domain/statistics help.

## 3. What the existing experiments establish

### Results worth keeping

1. **The negative same-record result is valuable.** When the complete small store and schema are in context, a frontier model detects the planted conflicts perfectly. Do not claim symbolic reasoning is universally better.
2. **The IRI-BFS reachability failure is real for the constructed graph.** At `k <= 3`, the duplicated key record is unreachable; at `k = 4`, retrieval approaches the whole store. This is a useful mechanistic sanity check.
3. **Full-context accuracy does not collapse in the tested regime.** At 10.4k triples, the tested frontier workflow still answered correctly, although with questionable pattern shortcuts and high reading cost. The claim is about cost and evidential honesty, not demonstrated accuracy collapse.
4. **Mem0 classic loses information in the tested ingest configuration.** On the same-record fixture, 0/8 conflicts retained both values; on the cross-record fixture, it linked 0/12 duplicate pairs. This motivates the problem.
5. **The optimized reasoner is materially faster than the previous implementation.** This is good engineering, but semi-naive evaluation and indexed joins are established techniques and are not a primary research contribution.

### Results that must not become headline claims

- `1.0` Tier-1 reasoner accuracy: the questions and rules are built together, and the golden queries read the system's own materialized output. It verifies implementation behavior, not scientific superiority.
- Degenerate `[1.0, 1.0]` bootstrap intervals over five seeds: the seeds do not create varying outcomes or independent domains.
- Weak/mid-model gains dominated by parse failure or context configuration: these are harness/configuration findings, not evidence that Predicate solves reasoning.
- “Frontier model” results produced by in-session agents: model identity, API version, prompt, sampling implementation, and raw responses are not independently reproducible.
- Flat-retrieved global enumeration failures when the task is deliberately given no retrieval seed: this tests the chosen interface, not a competitive retrieval system.

## 4. The fatal reviewer objections to solve first

1. **“A hash join solves this.”** The current key-mediated conflict can be found with `GROUP BY email HAVING COUNT(DISTINCT office) > 1`, a key-value inverted index, SHACL, or a targeted SPARQL query. These are mandatory baselines. Predicate must either beat them on generality/cost or move beyond conflicts reducible to a single join.
2. **“The benchmark engineers the baseline failure.”** The generator explicitly prevents IRI-BFS from reaching the second record. Add key-aware, literal-aware, embedding, lexical, learned, and hybrid retrieval policies; do not call plain IRI-BFS representative of all retrieval.
3. **“Where do the keys and constraints come from?”** The TBox currently supplies perfect email keys and single-valued properties. Separate oracle-schema experiments from schema induction/extraction experiments, report axiom acquisition cost and error, and never mix the two claims.
4. **“Real offices change over time.”** Different values may be a temporal update, a concurrent disagreement, a scoped fact, or a genuine contradiction. Add time, scope, source reliability, and multi-valued near-misses. Human or independently curated labels must decide the intended relation.
5. **“This is not standard OWL behavior.”** Predicate intentionally avoids the value merging/explosion induced by ordinary functional-property semantics. Define the inconsistency-tolerant semantics explicitly and verify it with an independent Datalog/description-logic implementation.
6. **“Eight questions are not an experiment.”** Build hundreds or thousands of conflict instances with many paraphrases and downstream decisions. Questions, entities, and domains—not random seeds—are the experimental units.
7. **“The end-to-end bottleneck is extraction.”** Run both an oracle-structure track and a raw-text track. Measure entity linking, predicate extraction, temporal classification, conflict detection, retrieval, and final answer separately.
8. **“Why does this matter?”** Measure a consequential downstream task: wrong deployment action, unsafe recommendation, incorrect compliance decision, or coding change made from a silently selected fact. Conflict detection alone is not enough.
9. **“The related-work scan is already stale.”** ActMem (arXiv:2603.00026) explicitly combines agent memory, structured causal/semantic graphs, conflict resolution, and a reasoning-oriented benchmark, but is absent from the current strategy. Deep-read it and repeat a systematic search before freezing novelty claims.

## 5. Recommended paper: Conflict-Complete Memory Retrieval

### Working title

**When Is Agent Memory Conflict-Complete? Minimal Proof-Witness Retrieval under Bounded Context**

Keep “Predicate,” “MCP,” and “OWL” out of the title. They are implementation choices, not the general contribution.

### Formal problem

Represent each memory assertion as:

\[
a = (s, p, o, \tau, \sigma, \pi)
\]

where `s,p,o` are the fact, `τ` is valid/transaction time, `σ` is scope, and `π` is provenance. Define:

- an entity-equivalence relation induced by declared keys or an entity linker;
- an exclusivity constraint conditioned on time and scope;
- a **conflict witness**: the smallest set of source assertions and rules sufficient to establish a conflict;
- **conflict completeness**: whenever a conflict witness relevant to a query exists in the store, the retrieval policy returns enough of that witness for a sound detector to identify it;
- **witness cost**: tokens, latency, bytes, and index/update work required to return the witness.

### Proposed method

Build a **Conflict Witness Index (CWI)** rather than materializing the entire OWL closure:

1. Maintain indexes from declared key tuples to equivalence classes.
2. Maintain per-class values for constrained predicates, partitioned by valid time and scope.
3. On insert, incrementally emit or retract conflict-witness objects.
4. Store the minimal proof DAG linking the witness to source assertions.
5. At query time, return the answer plus the smallest relevant witness, not an arbitrary k-hop neighborhood.

Target formal results:

- Soundness of emitted conflict witnesses for a precisely defined rule fragment.
- Completeness for key equivalence + scoped single-valued constraints + bounded rule chains.
- An impossibility/lower-bound result for retrievers that do not index the witness-connecting relation.
- Update and query complexity compared with full materialization and whole-store retrieval.

If the exact index is just a standard incremental join, say so. The novelty must then be the formal conflict-completeness framework plus the empirical phase diagram, not the data structure.

### Contributions that would clear the bar

1. A formal definition of conflict completeness and minimal proof-witness retrieval.
2. A sound and complete incremental algorithm for a useful, explicitly bounded rule fragment.
3. A benchmark containing realistic contradictions, temporal updates, scope changes, and hard non-conflicts across at least three domains.
4. A controlled study showing when exact witness retrieval improves downstream decisions at competitive cost.

## 6. Alternative paper shapes

### A. Benchmark/audit paper — NeurIPS E&D

Use this if the method reduces to a conventional index but the evaluation reveals an important field-wide failure.

Claim: current agent-memory evaluations conflate retrieval, update, contradiction, and temporal supersession; a new protocol separates them and changes system rankings.

Required assets: public dataset, strong documentation, independently checked labels, system adapters, raw outputs, evaluation cards, and a broad audit of production/research memories. Negative findings are acceptable if systematic and surprising.

### B. Learning paper — ICML/ICLR

Use this only if a learned component becomes central, for example a cost-aware router that predicts when to use vector retrieval, key closure, temporal resolution, or symbolic witness search and transfers across domains/models.

Required result: held-out transfer, calibration, regret/cost analysis, and clear improvement over fixed routing and learned-retrieval baselines. Adding a small classifier solely for venue fit will weaken the work.

### C. Inconsistency-tolerant KRR paper — AAAI/KR

Formalize preserve-and-surface semantics for agent memory, prove properties, compare to belief revision, paraconsistent reasoning, SHACL validation, Datalog, and temporal databases, and make the LLM experiments an application rather than the foundation.

## 7. Benchmark redesign

### Data composition

Build three layers and report each separately:

1. **Controlled synthetic:** exact manipulation of graph distance, key ambiguity, rule depth, conflict prevalence, temporal depth, and distractors. This supports causal/mechanistic claims.
2. **Semi-synthetic on real records:** inject controlled conflicts into naturally distributed records and dialogue histories. This tests realism while preserving gold labels.
3. **Natural conflicts:** human-annotated multi-session agent logs or public multi-source records. This establishes prevalence and external validity.

Target at least:

- 1,000 positive conflict instances;
- 1,000 hard negative/near-miss instances;
- three development domains and one held-out domain;
- at least two annotators plus adjudication for natural examples;
- released annotation guide, agreement, exclusions, and data statement.

### Conflict taxonomy

- Duplicate records joined by exact keys.
- Duplicate records joined by noisy/composite keys.
- Conflicts requiring a short relation or subclass chain.
- Disjoint-type conflicts through inferred types.
- Concurrent source disagreement.
- Temporal supersession where returning the latest value is correct.
- Scope-dependent facts where both values are correct.
- Legitimately multi-valued attributes.
- Unsupported questions requiring abstention.

### Downstream tasks

- **Detection:** identify a conflict and its type.
- **Evidence:** retrieve both source-grounded values.
- **Resolution policy:** surface, abstain, or return latest under the correct temporal/scope label.
- **Decision:** choose an action whose loss is defined when a hidden conflict exists.
- **Explanation:** return a minimal derivation independently verified against the gold witness.

## 8. Mandatory baselines

### Exact/non-LLM baselines

- Hash/inverted index over keys plus a distinct-value check.
- SQL or SPARQL join implementing the known constraint.
- SHACL validation.
- A standard Datalog/RDF reasoner or RDFox/Openllet where compatible.
- Last-write-wins/max-serial temporal resolver.
- Full materialization and query-time backward chaining.

### Retrieval baselines

- BM25 and dense retrieval.
- IRI-only graph BFS.
- Literal-aware graph traversal.
- Key-aware retrieval.
- Hybrid lexical/vector/graph retrieval.
- A strong learned retriever or reranker.
- Whole-context reading where it fits.

### Agent-memory systems

- Current Mem0 in the authors' recommended configuration.
- Zep/Graphiti in the authors' recommended configuration.
- At least one strong graph/reasoning memory contemporary at experiment freeze.
- One simple append-only memory and one temporal/versioned memory.

Every system gets:

- its recommended model/configuration;
- a matched-model configuration where technically possible;
- identical source information and constraint text;
- oracle-structure and raw-text tracks;
- pinned versions and a logged cost budget.

## 9. Metrics and statistics

Primary metrics:

- conflict precision, recall, and AUPRC;
- both-source evidence recall and precision;
- correct policy among `{surface, abstain, latest}`;
- downstream expected loss/risk-coverage;
- token cost, p50/p95 query latency, ingest latency, index size, and update amplification;
- proof validity and proof minimality.

Experimental discipline:

- Pre-register hypotheses, primary metrics, exclusions, and the analysis script before headline runs.
- Keep development and held-out domains frozen.
- Use paired comparisons on the same instances.
- Cluster uncertainty by conversation/entity/domain; do not bootstrap structurally identical seeds as if independent.
- Report effect sizes and intervals, not only significance.
- Repeat stochastic LLM cells enough to estimate order/paraphrase sensitivity.
- Treat parse/format compliance as a separate metric from task correctness.
- Publish all prompts, raw responses, versions, seeds, token counts, and failures.

## 10. What to do with the experiments running now

### Finish selectively

- Preserve and summarize the current Mem0/Graphiti raw logs.
- Run a small Graphiti smoke/diagnostic study if the infrastructure is already ready.
- Re-run the core reasoner behavior with an independent implementation.
- Freeze the current synthetic fixtures as `mechanism-v0`; do not silently rewrite them after seeing results.

### Stop or demote

- Stop larger regular synthetic flat-all sweeps; they consume resources without fixing external validity.
- Do not spend more time producing many runs of weak local models until parsing, context, and model capability are cleanly separated.
- Do not treat more random seeds of the same generator as statistical hardening.
- Do not build self-improving schema work for this paper.
- Do not optimize full OWL materialization further unless the new method requires it.

### Replace

- Replace in-session “frontier agents” with pinned APIs and complete raw logs.
- Replace the eight-question aggregate with instance-level benchmark records.
- Replace plain IRI-BFS as the only retrieval competitor with key-aware and literal-aware retrieval.
- Replace the internal golden-query verifier with an independent oracle/reasoner.

## 11. Twelve-month execution plan

### Phase 0 — reset and research contract (2026-07-13 to 2026-07-31)

- Freeze one question, one claim, and explicit non-claims.
- Write the formal task definition and a two-page paper skeleton.
- Add the trivial key-join, SHACL, and key-aware retrieval baselines.
- Create a clean experiment manifest and one-command evidence build.
- Resolve the environment-sensitive test and verify a clean checkout.
- Pre-register the controlled benchmark axes before running more models.

**Gate A:** if the proposed mechanism has no advantage in generality, guarantee, or cost over a key-index join, pivot immediately to the benchmark/audit paper.

### Phase 1 — formal method (August–September 2026)

- Define the semantics and conflict-completeness property.
- Implement CWI/incremental witness retrieval.
- Prove soundness/completeness for the bounded fragment.
- Verify outputs against an independent engine on generated worlds.
- Measure update/query complexity against exact baselines.

**Gate B:** require a nontrivial theorem or a clear Pareto improvement over exact baselines. Otherwise choose the NeurIPS E&D path.

### Phase 2 — real benchmark (September–November 2026)

- Select public/licensable data sources and obtain any needed ethics review.
- Write annotation guidelines and pilot annotation.
- Build controlled, semi-synthetic, and natural subsets.
- Estimate real conflict prevalence before fixing the density sweep.
- Freeze train/development/held-out partitions.

**Gate C:** at least two realistic domains must reproduce the failure mechanism; otherwise narrow the claim to the domains where it occurs.

### Phase 3 — baseline study (November 2026–January 2027)

- Validate every adapter on a small published or authors' example.
- Run exact, retrieval, and memory-system baselines.
- Run oracle-structure and raw-text tracks.
- Measure both correctness and total system cost.

**ICML stretch decision, 2026-12-15:** submit only if the method and held-out results are already stable. Do not turn January into a deadline-driven experiment sprint.

### Phase 4 — held-out validation (February–April 2027)

- Lock code/configs before held-out evaluation.
- Run domain transfer, model transfer, paraphrase/order robustness, and ablations.
- Perform error analysis with a taxonomy fixed in advance.
- Release an anonymous reproducibility package.

**Gate D:** the main conclusion must survive a strong closed model, a strong open model, key-aware retrieval, exact key joins, and recommended real-system configurations.

### Phase 5 — paper and review hardening (April–July 2027)

- Draft the paper around one result, not the repository architecture.
- Put every claim-critical result in the main PDF.
- Obtain reviews from one KRR expert, one agent-memory expert, one retrieval expert, and one skeptical general ML reviewer.
- Run a novelty scan monthly and again in the submission week.
- Complete reproducibility, ethics, limitations, and artifact documentation.

## 12. Venue strategy

| Venue | Fit | Decision |
|---|---|---|
| AAAI-27 | Strong topical fit, but abstract 2026-07-21 and paper 2026-07-28 | **Do not submit.** Evidence and manuscript are not ready. |
| ICLR 2027 | Possible only for a strong learned or representation-centered method; official 2027 CFP not found as of audit | **Skip main paper.** The expected September window is too close. |
| ICML 2027 | Possible for a general algorithm/learning contribution; 2027 dates not yet official | **Stretch checkpoint only.** |
| NeurIPS 2027 E&D | Excellent if the contribution is the benchmark, audit, negative result, or evaluation framework | **Primary alternative.** Expect a spring deadline, but wait for the official CFP. |
| NeurIPS 2027 main | Requires broader ML methodological significance | Submit only if the router/index method clearly transfers beyond this system. |
| AAAI-28 | Best match for KRR + agents + empirical method | **Primary target.** Wait for official dates. |
| KR/ISWC/ESWC | Strong specialist fit | Use as an alternative archival destination, not as an archival stepping stone for the same paper. |

Publication-safety rule: do not publish the same paper at an archival Plan-B venue before a top-venue submission. Use non-archival workshops for feedback. If pursuing two papers, define non-overlapping contributions, experiments, and text, and check each venue's concurrent-submission policy.

## 13. Paper skeleton

1. **Introduction:** silent conflict selection is a retrieval-completeness failure, not merely an LLM reasoning error.
2. **Problem:** memory assertions, equivalence, time/scope, conflict witnesses, completeness, and cost.
3. **Method:** incremental witness index and proof retrieval; theorems and complexity.
4. **Benchmark:** construction, annotation, prevalence, controls, and limitations.
5. **Experiments:** exact baselines, retrieval policies, real systems, downstream decisions, and cost.
6. **Analysis:** phase diagram, failure mechanisms, schema/extraction sensitivity, and scope of guarantees.
7. **Related work:** agent memory, entity resolution, KRR/inconsistency tolerance, temporal databases, retrieval, and benchmark methodology.
8. **Limitations and responsible release.**

## 14. Immediate next ten actions

1. Freeze the current experiments and tag the evidence snapshot.
2. Write a one-page formal definition of conflict completeness.
3. Implement the exact email-key hash-join baseline.
4. Implement literal/key-aware retrieval.
5. Compare those baselines with r14/r22/r23 on current fixtures.
6. Decide method-paper versus benchmark-paper at Gate A.
7. Select three realistic data domains and document licensing/annotation feasibility.
8. Replace the eight-question evaluation with instance-level records.
9. Set up pinned strong-model runs and full request/response logging.
10. Recruit external readers/domain annotators; do not wait until the paper draft.

## 15. Definition of submission-ready

Submit only when all are true:

- One-sentence claim is stable for at least six weeks.
- At least one contribution is clearly nontrivial over exact key joins/SHACL/Datalog.
- The result holds on realistic data in multiple domains and one untouched held-out domain.
- Strongest fair baselines and recommended real-system configurations are included.
- Oracle-structure and raw-text results are separated.
- Independent labels and an independent verifier support the main claims.
- Statistical units and uncertainty are defensible.
- Clean checkout reproduces every main table/figure with one documented workflow.
- Four hostile internal reviews find no missing experiment that would change the conclusion.
- Novelty scan is current as of submission week.

## Sources used for venue calibration

- [AAAI-27 official timetable](https://aaai.org/conference/aaai/aaai-27/)
- [AAAI main-track review criteria](https://aaai.org/conference/aaai/aaai-26/main-technical-track-call/)
- [ICLR reviewer guidance](https://iclr.cc/Conferences/2026/ReviewerGuide)
- [ICML reviewer criteria](https://icml.cc/Conferences/2026/ReviewerInstructions)
- [NeurIPS main reviewing guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines)
- [NeurIPS Evaluations & Datasets call](https://neurips.cc/Conferences/2026/CallForEvaluationsDatasets)
- [NeurIPS E&D reviewing guidelines](https://neurips.cc/Conferences/2026/EvaluationsDatasetsReviewerGuidelines)
- [ActMem, a current adjacent memory-and-reasoning system](https://arxiv.org/abs/2603.00026)
