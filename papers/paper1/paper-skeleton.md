# Paper skeleton — When Is Agent Memory Conflict-Complete? Minimal Proof-Witness Retrieval under Bounded Context

**Status:** Phase 0 contract (plan §11), frozen 2026-07-12. This is a contract, not a draft.
Any change to the claim, non-claims, or section claims below re-opens Gate A.
Sources: `top-venue-publication-plan.md` §1/§5/§13/§15; `prior-art-validation.md` "Novelty refresh — 2026-07-12".

## THE claim (one sentence)

Under a bounded context budget, an agent-memory retrieval policy is conflict-complete only if it
indexes the relation that connects conflict witnesses; we formalize conflict completeness as a
property of the retrieval policy, prove that lower bound, give a sound-and-complete incremental
witness index for an explicitly bounded rule fragment, and measure when minimal proof-witness
retrieval beats exact joins, retrieval policies, and production memory systems on detection
accuracy and cost.

## Explicit non-claims

1. **Not claiming symbolic beats LLMs in-context.** With the full store and schema in context, a
   frontier model detects the planted conflicts perfectly (plan §3.1). The claim is about what a
   retrieval policy must return under a budget, and about cost — never about reasoning superiority.
2. **Not claiming novelty of witnesses/justifications per se.** Justifications/MinA, MUS, minimal
   conflict sets (Reiter), why-provenance, proof extraction, and AR/IAR repair semantics are the
   cited raw material (refresh R3). The only claimed novelty is the composition: conflict
   completeness as a retrieval-policy property under budget + the lower bound + the cost study.
3. **Not claiming results beyond the exact-single-key synthetic regime until the realistic
   benchmark lands.** Everything to date is a constructed mechanism demonstration (`mechanism-v0`);
   external validity is claimed only after Phase 2 layers 2–3 pass Gate C.

## Gate decision points

- **Gate A — 2026-07-31 (end Phase 0):** if the mechanism has no advantage in generality,
  guarantee, or cost over a key-index join, pivot immediately to the benchmark/audit paper
  (NeurIPS E&D shape, plan §6A).
- **Gate B — 2026-09-30 (end Phase 1):** require a nontrivial theorem or a clear Pareto
  improvement over exact baselines; otherwise take the NeurIPS E&D path.

---

## §1 Introduction

- **Claim:** Silent conflict selection in agent memory is a retrieval-completeness failure — the
  policy never returns both sides of the contradiction — not merely an LLM reasoning error.
- **Evidence:** Mem0 ingest arms (0/8 same-record conflicts retained both values; 0/12 key-linked
  duplicate pairs linked — pilots D/D2, EXPERIMENT-LOG); IRI-BFS mechanism demo (k≤3 unreachable,
  k=4 ≈ whole store, `mechanism-v0`); full-context frontier control showing detection succeeds
  when both records are present (plan §3.1).
- **Status:** done (as mechanism demonstration); realistic-prevalence version Phase 2.
- **Must survive:** §4.2 "the benchmark engineers the baseline failure" — the intro presents the
  mechanism as constructed and rests generality on Phase 2; §4.8 "why does this matter" — open
  with a downstream decision gone wrong, not a detection metric.

## §2 Problem

- **Claim:** Conflict completeness is a definable property of a retrieval policy — whenever a
  query-relevant conflict witness exists in the store, the policy returns enough of it, within the
  context budget, for a sound detector to identify it — and is distinct from detection,
  resolution, and repair.
- **Evidence:** formal definitions doc (Defs 1.1–1.6 assertion tuple (s,p,o,τ,σ,π) and
  key-induced equivalence; Def 2.1 conflict witness; Defs 3.1–3.3 relevance and
  (B,µ)-conflict-completeness; Defs 5.1–5.3 witness cost), with classical lineage
  (justifications, MUS, diagnosis, why-provenance, AR/IAR) cited inline per refresh R3.
- **Status:** this-sprint (plan §14.2, one-page formal definition).
- **Must survive:** §4.5 "this is not standard OWL behavior" — the inconsistency-tolerant
  semantics is defined explicitly; §4.3 "where do keys and constraints come from" — oracle-schema
  and induced-schema settings are separated in the problem statement itself.

## §3 Method

- **Claim:** An incremental Conflict Witness Index (CWI) is sound and complete for key equivalence
  plus scoped single-valued constraints plus bounded rule chains; and IRI-adjacency-only bounded-hop
  retrieval (the policy class of Prop. 3, of which plain IRI-BFS is a deliberately weak member) is
  conflict-incomplete for cross-record witnesses at every finite hop bound. Extending the lower
  bound beyond that policy class — toward "any policy that fails to index the witness-connecting
  relation" — is a Phase-1 proof obligation, not an established result.
- **Evidence:** formal doc Prop. 1 (witness soundness), Prop. 2 (completeness for the bounded
  fragment), Prop. 3 (lower bound for the IRI-adjacency policy class); Prop. 4 currently states the
  exact-baseline hash-join linearity result (the honest Gate-A concession) — the update/query
  complexity analysis vs full materialization and whole-store reading is a Phase-1 deliverable;
  outputs verified against an independent Datalog/DL engine on generated worlds.
- **Status:** Phase 1 (Aug–Sep 2026); Gate B gates on Prop. 2 or Prop. 3 being nontrivial.
- **Must survive:** §4.1 "a hash join solves this" — the method section states exactly where CWI
  exceeds `GROUP BY … HAVING` (rule chains, time/scope partitioning, minimal proof DAG,
  incremental retraction) or concedes the reduction and pivots novelty to framework + phase
  diagram; §4.5 — independent-implementation verification is part of the method, not an appendix.

## §4 Benchmark

- **Claim:** A three-layer benchmark — controlled synthetic, semi-synthetic on real records,
  natural conflicts — with ≥1,000 positives, ≥1,000 hard negatives, three development domains and
  one held-out domain separates retrieval failure from detection and resolution failure under
  independently validated labels.
- **Evidence:** layer 1 controlled axes (graph distance, key noise, rule depth, prevalence,
  temporal depth, distractors — pre-registered); layers 2–3 with annotation guide, two annotators
  + adjudication, agreement stats, prevalence estimate; nine-type conflict taxonomy (plan §7);
  ActMemEval cited as the benchmark-adjacent neighbor, with our tasks scoped to
  witness-groundable conflicts (both sides stored) vs its commonsense-groundable constraints.
- **Status:** `mechanism-v0` frozen (done); layer-1 pre-registration this-sprint; layers 2–3
  Phase 2 (Gate C: ≥2 realistic domains reproduce the mechanism or the claim narrows).
- **Must survive:** §4.4 "real offices change over time" — temporal supersession, scope, and
  multi-valued near-misses are labeled classes, not noise; §4.6 "eight questions are not an
  experiment" — instances/entities/domains are the units; §4.2 — key-aware/lexical/hybrid
  retrieval included by construction (ActMem's low-similarity design shows reviewers now
  recognize engineered-against-similarity benchmarks).

## §5 Experiments

- **Claim:** Minimal proof-witness retrieval matches or dominates every mandatory baseline class —
  exact key-join/SHACL/Datalog, key-aware/literal-aware/BM25/dense/hybrid retrieval, and
  recommended-config Mem0 and Zep/Graphiti — on conflict recall and witness-citation accuracy at
  strictly lower token cost, or the paper reports precisely where it does not.
- **Evidence:** main comparison table (systems × conflict P/R/AUPRC, both-source evidence recall,
  policy correctness {surface, abstain, latest}, downstream loss, tokens, p50/p95 latency);
  paired per-instance comparisons with clustered uncertainty (plan §9); oracle-structure and
  raw-text tracks reported as separate tables, never merged.
- **Status:** pilots done (Mem0 ingest arms, flat-all/flat-retrieved); exact key-join + SHACL +
  key-aware retrieval baselines this-sprint (plan §14.3–5, feeds Gate A); full study Phase 3.
- **Must survive:** §4.1 — the trivial exact baselines head the table; §4.2 — key-aware retrieval
  is in every figure; §4.7 "the end-to-end bottleneck is extraction" — the raw-text track
  decomposes linking/extraction/detection/retrieval/answer stages.

## §6 Analysis

- **Claim:** The advantage region of witness-indexed retrieval is predictable from measurable
  problem parameters — witness-half graph distance, key noise, rule depth, conflict prevalence,
  and context budget — yielding a phase diagram that states when the exact machinery earns its
  cost.
- **Evidence:** phase-diagram figure over layer-1 axes; cost-crossover curves (witness cost vs
  whole-context reading, extending pilot E's seed-robust crossover); oracle-schema vs
  schema-induction sensitivity split with axiom acquisition cost and error; failure taxonomy
  fixed before held-out runs.
- **Status:** pilot crossover done (mechanism regime only); full phase diagram Phase 3–4.
- **Must survive:** §4.3 — oracle and induced schema results never mixed in one claim; §4.8 —
  the phase diagram is read out as downstream expected loss, not detection F1 alone.

## §7 Related work

- **Claim:** No prior work states a completeness property of what a retrieval policy must return
  for conflict detection under a bounded context budget — the composition is new, and every
  ingredient's classical name is cited.
- **Evidence:** properties × systems table (P1 deterministic detection … P5 checkable derivation)
  scoring ActMem ✗✗✗✗✗ alongside MRMS, TOKI, SLM-V3, Kumiho, Mem0^g; ConflictRAG (88.7 detection
  F1) and TCR cited as detection-F1 prior work with our metric claim rescoped per refresh R4
  (detection P/R over agent-memory stores with provenance-witness-citation scoring); KR
  preferred-repair (2508.07742) plus ASP(Q)/argumentation repairs as the formal-section
  comparison; certified-RAG cluster distinguished (robustness certificates ≠ conflict coverage).
- **Status:** sweep + 2026-07-12 refresh done; monthly rescans through submission week (Phase 5),
  standing watch on ActMem v3, Spectron, open-ontologies.
- **Must survive:** §4.9 "the related-work scan is already stale" — ActMem is deep-cited as
  benchmark-adjacent, not footnoted, and the novelty scan date appears in the paper.

## §8 Limitations and responsible release

- **Claim:** The completeness guarantee covers only witness-groundable conflicts — both sides
  stored as assertions under a declared or induced schema within the proven fragment — and
  explicitly excludes commonsense/memory-vs-intention conflicts (ActMem's regime), noisy
  open-domain entity resolution, and unproven rule depths.
- **Evidence:** scope statement tied verbatim to the Prop. 2 fragment boundary; reproducibility
  package (one-command evidence build from clean checkout, pinned models, all prompts/raw
  responses/seeds/token counts); data statement, annotation ethics, and exclusion log for the
  natural-conflict layer.
- **Status:** scope statement this-sprint; reproducibility package Phase 4 (locked before
  held-out evaluation).
- **Must survive:** §4.7 — extraction is named as the unsolved end-to-end bottleneck rather than
  hidden; §4.5 — the non-standard, inconsistency-tolerant semantics choice is stated as a design
  decision with its consequences, not as OWL.
