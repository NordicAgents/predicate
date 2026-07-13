# Paper 1 — "When Is Agent Memory Conflict-Complete?"

Working title: *When Is Agent Memory Conflict-Complete? Minimal Proof-Witness Retrieval
under Bounded Context* (frozen in [`paper-skeleton.md`](paper-skeleton.md), 2026-07-12;
supersedes the pre-audit title *Contradiction-Preserving Reasoning Memory for LLM Agents*).
Target: **AAAI-28** main track (KRR primary); alternative **NeurIPS 2027 E&D** if the
Gate-A pivot to a benchmark/audit paper is taken. Full roadmap + gates:
[`top-venue-publication-plan.md`](top-venue-publication-plan.md).

## Thesis (frozen 2026-07-12, paper-skeleton.md)

Under a bounded context budget, an agent-memory retrieval policy is conflict-complete
only if it indexes the relation that connects conflict witnesses; we formalize conflict
completeness as a property of the retrieval policy, prove the lower bound for the
IRI-adjacency policy class (general form: Phase 1), give a sound-and-complete incremental
witness index for an explicitly bounded rule fragment, and measure when minimal
proof-witness retrieval beats exact joins, retrieval policies, and production memory
systems on detection accuracy and cost.

## Workspace

| File | What |
|---|---|
| [`top-venue-publication-plan.md`](top-venue-publication-plan.md) | Independent 2026-07-12 audit and restart-to-submission roadmap for AAAI/NeurIPS/ICML/ICLR |
| [`gate-a-analysis.md`](gate-a-analysis.md) | Gate A decision analysis — DECIDED 2026-07-13: Option 1, proceed reframed under conditions 5(a)–(c) |
| [`probes/`](probes/) | Gate C preview probes: C1/OSV prevalence probe script + 2026-07-13 report |
| [`formal-conflict-completeness.md`](formal-conflict-completeness.md) | Formal core: assertions, witnesses, (B,µ)-conflict-completeness, Props 1–4 |
| [`pre-registration.md`](pre-registration.md) | Frozen hypotheses/metrics/analysis plan + Amendment A1 (amendments-only) |
| [`paper-skeleton.md`](paper-skeleton.md) | Phase-0 claim contract: THE claim, non-claims, §-by-§ evidence plan |
| [`domain-selection.md`](domain-selection.md) | Phase-2 domain dossiers: CVE, ClinicalTrials, scholarly; NPI held-out |
| [`EVIDENCE-MANIFEST.md`](EVIDENCE-MANIFEST.md) | Frozen-evidence contract: tags, one-command rebuild, citable-files inventory |
| [`aaai-strategy.md`](aaai-strategy.md) | Pre-audit strategy (superseded where it conflicts with the plan/skeleton) |
| [`prior-art-validation.md`](prior-art-validation.md) | Prior-art sweeps incl. 2026-07-12 ActMem deep-read + novelty refresh |
| [`EXPERIMENT-LOG.md`](EXPERIMENT-LOG.md) | Append-only evidence trail: every pilot/experiment with setup, numbers, honest read |

## Status (2026-07-13)

- **Built + verified:** E1 multi-model harness · E2a semi-naive fixpoint (~47× at 500) ·
  E2b scoped materialization (honest recall cliff) · r11/r22 conflict rules ·
  CONFLICT-BENCH v1 (3 densities, FP slice, schema-symmetric) · CONFLICT-BENCH v2
  (hasKey-mediated cross-record, xr-small/xr-scale) · instance-level measurement
  contract (`instances.json` + PredictionRow + scorer) · exact baselines
  (key hash-join, SPARQL GROUP BY) · key-aware/literal-aware retrieval policies ·
  reasoner instance arm (r14→r23→r22) · pinned-model runner with full raw logging ·
  one-command evidence build. 535 tests green (+15 skipped).
- **Phase-0 sprint results (2026-07-12/13):** three-way detection tie at P=R=F1=1.0
  (exact join, SPARQL, reasoner chain) on all fixtures; join wins cost by 1–3 orders of
  magnitude; retrieval crossover — IRI-BFS 0/12 & 0/60 witness-complete at k≤3 (k=4 =
  whole store) vs key/literal-aware 12/12 & 60/60 at k=1 with ~8-triple contexts;
  H1/H2/H4/H5 in registered direction, H3 untestable on mechanism-v0. See
  `gate-a-analysis.md` and EXPERIMENT-LOG.
- **Phase-1 kickoff results (2026-07-13, Amendment A2; registered before implementation):**
  phase1-v3 fixtures landed (chain-m2/m3, h3-nk1/nk3, tausig) + extended exact baseline
  `exact-key-join-x` (union-find + τ/σ partitioning). All four registered hypotheses in
  registered direction: H6 — single-join detectors 0-recall on chains, extended join and
  reasoner P=R=1, key-aware@k completes exactly at k=m, iri-bfs 0 at every k; H7 — τ/σ-blind
  detectors (incl. our reasoner chain) flag all 24 temporal/scoped negatives (P=0.333),
  aware baseline perfect; H3 — literal-aware@1 context premium 7→20.6× (monotone in nk);
  H8 — extended join within 1.21× of plain join, 27–708× cheaper than the reasoner.
  Gate C preview (exploratory): 80.7% of OSV/PyPI CVE groups are multi-record;
  13.3% / 48.4% severity/range disagreement. 561 tests green (+15 skipped).
- **Exploratory (motivational only):** Mem0 ingest pilots (0/8 preserved, 0/12 linked,
  1/8 additive); in-session frontier-agent runs (permanently exploratory); C1/OSV
  prevalence probe (A2.7).

## Binding gates (operative)

- **Gate A (2026-07-31, plan §11):** *fired on its literal terms* and **DECIDED
  2026-07-13 — Option 1, proceed reframed** to conflict-complete retrieval (Def 3.3 +
  Prop 3 + cost curves), reasoner demoted to one witness-indexing implementation, under
  binding conditions 5(a)–(c) (`gate-a-analysis.md` §6).
- **Gate B (2026-09-30):** requires a nontrivial theorem or Pareto improvement over
  exact baselines on fixtures the single join structurally cannot solve (chain depth ≥2,
  τ/σ), plus a non-key-literal fixture making H3 testable, plus ≥1 realistic domain
  reproducing the mechanism. Otherwise: NeurIPS E&D path. **Status 2026-07-13:** the
  5(a)/5(b) fixtures exist and separate as registered; 5(c) has a positive exploratory
  preview (C1/OSV). Warning shot: the extended exact baseline is complete AND cheapest
  on the deeper fragment too — falsification clause 3's first conjunct is TRUE, so the
  Phase-1 method must win on the RETRIEVAL side (witness-completeness per context
  budget, index/update ledger), not on detection.
- **Gate C (Phase 2):** ≥2 realistic domains must reproduce the failure mechanism, else
  narrow the claim to the domains where it occurs.
- Self-improving schema: CUT to one future-work sentence (former Gate 3 default).
