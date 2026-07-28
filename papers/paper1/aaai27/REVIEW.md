# Internal AAAI-style review after the publication audit

## Recommendation

**Score: 7/10 — weak accept.**

**Confidence: 4/5.**

The pre-audit draft was approximately **3/10 (reject)** because two real-data claims used invalid identity semantics, the reader comparison was confounded, the central completeness quantifier was too strong, the bibliography was largely placeholder metadata, essential exact and learned baselines were missing, and the manuscript exceeded the usual page limit.

The revised submission is defensible and reproducible. It now resolves the fixed-context objection formally and empirically; acceptance still cannot be guaranteed because external semantic validity remains limited.

## Summary

The paper defines conflict completeness: every query-relevant conflict must be returned with at least one complete source-grounded witness. It characterizes the exact minimum joint budget, proves joint witness selection NP-complete, and gives CWI a complete-or-explicit-overflow contract with a $|\Gamma|$ approximation bound. Twelve multi-conflict queries exercise shared and disjoint witnesses, while an adversarial class-stress leg exposes the quadratic materialization regime. The original 252-instance benchmark, baselines, scaling ledger, and carefully scoped topology audit remain.

## Strengths

1. **Precise and checkable contract.** The existential witness quantifier is operationally meaningful and clearly separated from proof-exhaustive completeness.
2. **Fixed-budget gap is closed.** The minimum joint union gives an exact feasibility boundary; NP-completeness and the CWI approximation bound explain the algorithmic tradeoff.
3. **Overflow is safe.** CWI never labels a truncated context complete and distinguishes selection overflow from proven infeasibility.
4. **Strong adversarial evidence.** Shared/disjoint multi-conflict cases and the large-class stress leg test the central favorable and unfavorable regimes.
5. **Strong baselines and negative results.** Fresh and adaptive exact methods, key-aware retrieval, and learned baselines prevent an easy straw-man win.
6. **Reproducibility.** The anonymous archive installs offline, all 61 focused tests pass, outputs are materialized, and PDFs build cleanly.

## Weaknesses

1. **External semantic validity remains limited.** Confirmatory results are synthetic and use an oracle schema. The external benchmark validates topology and disagreement only, not true semantic conflict.
2. **Novelty remains contract-level.** The joint-budget and complexity results strengthen it, but reviewers may still prefer a richer logic or new explanation-enumeration algorithm.
3. **Restricted formal fragment.** One exact key per class, exact literal identity, pairwise single-valued constraints, and record-snapshot time/scope semantics leave out learned entity resolution, composite keys, deletion, and richer constraints.
4. **No causal consumer study.** This is the correct evidentiary decision, but the paper establishes retrievability rather than downstream agent behavior.

## Acceptance prediction

- **AAAI/KRR reviewer fit:** weak accept if reviewers value the exact fixed-budget boundary, honest overflow behavior, adversarial baselines, and auditability.
- **Likely reject path:** reviewers demand independently labeled real conflicts or judge the formal novelty too incremental.
- **Likely accept path:** reviewers treat the feasibility/complexity results plus complete-or-overflow implementation as a useful systems/KRR contribution.

The highest-value future addition is an independently adjudicated real-memory dataset with validated identity, temporal scope, exclusivity constraints, and conflict labels. That requires domain annotation or a trusted external benchmark; it should not be synthesized after seeing the results.
