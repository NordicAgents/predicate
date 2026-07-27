# Internal AAAI-style review after the publication audit

## Recommendation

**Score: 6/10 — weak accept / borderline.**

**Confidence: 4/5.**

The pre-audit draft was approximately **3/10 (reject)** because two real-data claims used invalid identity semantics, the reader comparison was confounded, the central completeness quantifier was too strong, the bibliography was largely placeholder metadata, essential exact and learned baselines were missing, and the manuscript exceeded the usual page limit.

The corrected submission is defensible and reproducible, but acceptance cannot be guaranteed. Its remaining risk is scientific scope rather than an obvious correctness or presentation defect.

## Summary

The paper defines conflict completeness for bounded memory retrieval: every query-relevant conflict must be returned with at least one complete source-grounded witness. It proves a counterexample for every fixed-hop IRI-only policy, implements an incremental Conflict Witness Index, and compares it against fresh exact, adaptive exact, key-aware, BM25, dense, and hybrid retrieval. The controlled benchmark has 252 instances and 132 conflicts. A repeated scaling companion reaches 100,000 records. An exploratory DBLP--Scholar audit establishes that gold co-reference chains and cross-source year disagreements co-occur, without promoting those disagreements to semantic conflict labels.

## Strengths

1. **Precise and checkable contract.** The existential witness quantifier is operationally meaningful and clearly separated from proof-exhaustive completeness.
2. **Correctly scoped theorem.** The fixed-hop lower bound is valid for IRI adjacency and no longer overgeneralizes to lexical, dense, or key-aware retrieval.
3. **Strong baselines.** The paper includes the most damaging alternatives: fresh exact computation returns the same minimal output, adaptive exact avoids maintained state for positive answers, and simple key-aware retrieval is highly competitive for direct conflicts.
4. **Negative results are retained.** The paper explicitly says where CWI does not help and does not claim novelty for exact detection, union--find, justifications, or incremental views.
5. **Reproducibility.** Dependencies/model revision are pinned, outputs are materialized, scaling has 11 measured repetitions, tests pass, and the PDF/bibliography build cleanly.
6. **Audit integrity.** Invalid public-data prevalence claims and the causally confounded reader result were removed rather than cosmetically weakened.

## Weaknesses

1. **External semantic validity remains limited.** Confirmatory results are synthetic and use an oracle schema. The external benchmark validates topology and disagreement only, not true semantic conflict.
2. **Novelty is narrow.** Reviewers may view conflict completeness as a useful packaging of justification/provenance and retrieval rather than a sufficiently deep new KRR result.
3. **Restricted formal fragment.** One exact key per class, exact literal identity, pairwise single-valued constraints, and record-snapshot time/scope semantics leave out learned entity resolution, composite keys, deletion, and richer constraints.
4. **Scaling is generator-specific.** Equivalence classes are bounded, hiding the implementation's class-local quadratic conflict-pair enumeration.
5. **No causal consumer study.** This is now the correct decision, but the paper establishes retrievability rather than downstream agent behavior.

## Acceptance prediction

- **AAAI/KRR reviewer fit:** borderline to weak accept if reviewers value the retrieval contract, adversarial baselines, and auditability.
- **Likely reject path:** reviewers demand independently labeled real conflicts or judge the formal novelty too incremental.
- **Likely accept path:** reviewers treat the precise contract plus lower-bound boundary and comprehensive cost study as a useful systems/KRR contribution.

The highest-value future addition is an independently adjudicated real-memory dataset with validated identity, temporal scope, exclusivity constraints, and conflict labels. That requires domain annotation or a trusted external benchmark; it should not be synthesized after seeing the results.
