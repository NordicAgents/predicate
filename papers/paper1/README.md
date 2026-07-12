# Paper 1 — "When Does Verifiable Memory Earn Its Cost?"

Working title: *Contradiction-Preserving Reasoning Memory for LLM Agents.*
Target: **AAAI-28** main track (KRR primary) via a Plan-B archival venue ~Dec 2026
(ESWC 2027 resource track front-runner). Full plan + gates: [`aaai-strategy.md`](aaai-strategy.md).

## Thesis (fused, post-pilot wording)

A deterministic, contradiction-preserving reasoning memory surfaces mutually-exclusive
facts — and cites both sources — on the slice where retrieval-mediated and
LLM-write-mediated memories structurally cannot: **cross-record conflicts that require
inference (key-based co-reference, disjointness through inferred chains) to even see** —
and we give a predictive boundary for when that edge appears.

## Workspace

| File | What |
|---|---|
| [`top-venue-publication-plan.md`](top-venue-publication-plan.md) | Independent 2026-07-12 audit and restart-to-submission roadmap for AAAI/NeurIPS/ICML/ICLR |
| [`aaai-strategy.md`](aaai-strategy.md) | The full strategy: framings, protocol, engineering roadmap, rebuttal prep, timeline, gates + citation-audit addendum |
| [`prior-art-validation.md`](prior-art-validation.md) | Web-verified prior-art sweep (6 agents): verdicts, novelty threats, venue confirmations |
| [`EXPERIMENT-LOG.md`](EXPERIMENT-LOG.md) | Append-only evidence trail: every pilot/experiment with setup, numbers, honest read |

## Status (2026-07-11)

- **Built + verified:** E1 multi-model harness · E2a semi-naive fixpoint (~47× at 500) ·
  E2b scoped materialization (honest recall cliff) · r11/r22 conflict rules ·
  CONFLICT-BENCH v1 (3 densities, FP slice, schema-symmetric). 404 tests green.
- **Pilots run (key-free):** org three-way + density sweep → both easy versions of the
  thesis eliminated; claim now staked on cross-subject/inference-mediated conflicts,
  scale + retrieval mediation, and real-system ingest arms (see EXPERIMENT-LOG).
- **In progress:** CONFLICT-BENCH v2 (hasKey-mediated cross-record conflicts +
  retrieval-mediated flat arm) · E3 (Mem0/Zep ingest-pipeline baselines, Ollama-backed).

## Binding gates

- **Gate 2 (go/no-go for AAAI):** statistically-significant win on contradiction P/R +
  wrong-answer-avoidance over BOTH a strong conflict-aware-prompted flat baseline AND
  Mem0+Zep, across ≥2 model tiers, surviving schema-symmetric baselines. MARGINAL →
  crossover-study framing at a Plan-B venue. FAIL → honest negative study at
  NeSy/ISWC/NeurIPS D&B.
- **Gate 3:** self-improving schema is build-or-CUT (default cut to one future-work sentence).
