# Gate A decision analysis — mechanism-v0 vs the key-index join

**Date:** 2026-07-12
**Status:** decision recommendation. This document recommends; the human researcher decides (§6).
**Gate deadline:** 2026-07-31 (end of Phase 0, per `paper-skeleton.md` "Gate decision points").
**Evidence base:** git tag `evidence-snapshot-2026-07-12` (commit `3b63c1e`), branch `paper1-evidence-sprint`; all numbers below reproducible via `scripts/build-evidence.sh` (oxigraph-wasm `:memory:`); consolidated artifact `papers/paper1/evidence/summary-3b63c1e61801-dirty.json`.
**Inputs:** `top-venue-publication-plan.md` §1–§6, §11; `formal-conflict-completeness.md`; `pre-registration.md` (incl. Amendment A1); `paper-skeleton.md`; `domain-selection.md`; `prior-art-validation.md` (novelty refresh 2026-07-12).

---

## 1. The Gate A question

Verbatim from `top-venue-publication-plan.md` §11, Phase 0:

> **Gate A:** if the proposed mechanism has no advantage in generality, guarantee, or cost over a key-index join, pivot immediately to the benchmark/audit paper.

The mechanism under judgment is the OWL-style rule chain (F1/F2/F3 = `r14`/`r23`/`r22`: hasKey → sameAs, value propagation across the equivalence, conflict flag with both values preserved), as exercised on the frozen mechanism-v0 fixtures. The comparator is the exact key-index join of Prop. 4 (`formal-conflict-completeness.md` §4): a hash join over `(key predicate, key value)` plus a distinct-value check.

---

## 2. Evidence

All detection and retrieval numbers are from the instance-level measurement contract frozen in `pre-registration.md` Amendment A1: instance manifests `fixtures/<domain>/instances.json`, prediction rows in `results/exact/*.jsonl`, `results/retrieval/retrieval.<domain>.jsonl`, `results/instances/reasoner-r14r23r22.<domain>.jsonl`, scores in `results/instances/summary.<domain>.json`. Systems are deterministic; the post-registration rerun of `scripts/build-evidence.sh` reproduces every decision value exactly (Amendment A1 timing disclosure).

### 2.1 Detection accuracy (instance-level)

All three detection systems — `exact-key-join`, `sparql-groupby`, `reasoner-r14r23r22` — score identically on all three fixtures:

| Fixture | Instances (conflict / total) | Conflicts detected | P | R | F1 | Both-value recall | Witness recall | Benign false positives |
|---|---|---|---|---|---|---|---|---|
| conflict-d20 | 8 / 14 | 8/8 (all 3 systems) | 1.000 | 1.000 | 1.000 | 1.0 | 1.0 | 0 |
| conflict-xr-small | 12 / 16 | 12/12 (all 3 systems) | 1.000 | 1.000 | 1.000 | 1.0 | 1.0 | 0 |
| conflict-xr-scale | 60 / 64 | 60/60 (all 3 systems) | 1.000 | 1.000 | 1.000 | 1.0 | 1.0 | 0 |

There is no accuracy separation anywhere: a perfect three-way tie, including zero false positives on every `benign-*` hard negative. (Artifacts: `results/instances/summary.<domain>.json`, `results/exact/*.jsonl`.)

### 2.2 Detection cost

Timings are run-variable (single-run wall-clock; only decision values are byte-stable across rebuilds). The values below are read from the artifacts committed with this document (`results/exact/*.jsonl` `extra.totalDomainMs`/`extra.phaseMs.detect`; `results/instances/summary.<domain>.json` `meanCostMs`):

| System | conflict-d20 | conflict-xr-small | conflict-xr-scale | Notes |
|---|---|---|---|---|
| exact-key-join (cold, end-to-end) | 1.4 ms | 1.6 ms | 5.0 ms | detect phase alone: 0.64 / 0.70 / 1.49 ms |
| sparql-groupby (cold, end-to-end) | 45.7 ms | 49.7 ms | 72.1 ms | `GROUP BY key HAVING COUNT(DISTINCT value) > 1` |
| reasoner-r14r23r22 (materialize) | 55.6 ms | 276.0 ms | 6,244.5 ms | semi-naive, 2 iterations; 16 / 102 / 486 inferred triples |

The join is 1–3 orders of magnitude cheaper than the reasoner chain at detection, and the gap widens with store size: at 1,689 triples (xr-scale) the reasoner materializes in ~6.2 s where the cold end-to-end join takes ~5.0 ms (~1,250×).

### 2.3 Retrieval witness-complete matrix (worst-case seed, over conflict instances)

| Policy | conflict-xr-small (12 conflict instances) | conflict-xr-scale (60 conflict instances) |
|---|---|---|
| iri-bfs @k=1 | 0/12 | 0/60 |
| iri-bfs @k=2 | 0/12 | 0/60 |
| iri-bfs @k=3 | 0/12 (context identical to @k=2 — only leaf hub nodes added) | 0/60 (same) |
| iri-bfs @k=4 | 12/12 — context 345 triples = the **entire abox** (28 KB), i.e. equivalent to flat-all | 60/60 — context 1,689 triples = **whole store** (132 KB) |
| literal-aware @k=1 | 12/12 — mean context 8.0 triples (~2 KB), conflicts-only mean | 60/60 — mean context 8.0 triples |
| key-aware @k=1 | 12/12 — mean context 8.0 triples (~2 KB), conflicts-only mean | 60/60 — mean context 8.0 triples |

This is the empirical face of Prop. 3 (`formal-conflict-completeness.md`): IRI-only bounded-hop retrieval is conflict-incomplete at every k below the (here infinite-through-IRIs) record distance, and the k that recovers completeness destroys B-boundedness — k=4 *is* whole-store reading. Key-indexed traversal is witness-complete at k=1 for ~2 KB.

**Measurement limitation (binding on H3):** the literal-aware and key-aware balls are IDENTICAL on both fixtures (verified per-seed set equality), because `cb2:email` is the only literal in these aboxes. H3 (literal-aware pays a context premium over key-aware) is therefore **untestable on mechanism-v0**. (Artifact: `results/retrieval/retrieval.<domain>.jsonl`; disclosure: pre-registration Amendment A1.)

### 2.4 Exploratory context (motivational only, per pre-registration §8)

- Mem0 classic ingest: conflict-d20 — 0/8 conflicts preserved both-values; conflict-xr-small — 0/12 duplicate pairs linked. Mem0 v2 additive arm: 1/8. (Pilots D/D2; verdict counts in `baselines/results/mem0-verdicts.*.json`, raw operation logs in `baselines/results/mem0-ops.*.jsonl`; no verdict file exists yet for the incomplete xr-small v2-additive resume.) These are exploratory, hypothesis-generating runs and may not be presented as confirmatory.
- Tier-1 deterministic harness (d20): episode1 accuracy 0.63 → episode2 accuracy 1.00 (lift 0.38). Per plan §3, the 1.0 endpoint verifies implementation behavior and must not be a headline claim.

### 2.5 Hypothesis verdicts (pre-registration §3; drafted same day as the runs — see Amendment A1 timing disclosure)

| Hypothesis | Verdict |
|---|---|
| H1 — iri-bfs@k≤2 witness-complete rate exactly 0 on cross-record fixtures | **Confirmed** (registered mechanism check, not a discovery — §2.1 of the pre-registration) |
| H2 — key-aware@1 and literal-aware@1 witness-complete rate 1.0 | **Confirmed** |
| H3 — literal-aware pays a context premium over key-aware | **Untestable on mechanism-v0** (single-literal aboxes; new fixture required) |
| H4 — exact-key-join P = R = 1.0 at < 10 ms median | **Confirmed — the pre-committed null result** |
| H5 — reasoner ties exact baselines on accuracy | **Confirmed** (perfect tie, §2.1) |

---

## 3. Honest advantage inventory: OWL chain vs key-index join

| Dimension | Verdict | Basis |
|---|---|---|
| Accuracy | **Tie.** | H4/H5 confirmed: perfect three-way tie on all fixtures (§2.1). Pre-registration §9.6 pre-committed that no accuracy-based superiority claim is admissible on mechanism-v0. |
| Cost | **Join wins, by 1–3 orders of magnitude.** | §2.2: reasoner 55.6 ms → 6.2 s across fixtures vs join 1.4–5.0 ms cold end-to-end; the gap grows with store size. |
| Guarantee | **No edge yet.** | Prop. 4 states it outright: for the single-join subfragment (every witness in the current fixtures has ∼K-chain length ≤ 1), the hash join computes *all* witnesses in O(n + out) — the same completeness as Prop. 2, at lower cost. The chain's claimed guarantee edge (Prop. 2 for chains of any length m; τ/σ-conditioned exclusivity; confidence gating) exists on paper but **no current fixture exercises it** (`formal-conflict-completeness.md` §6 scope table: chain length m ≤ 1, all τ = σ = ⊥ everywhere, fixed θ). |
| Generality | **Designed but unexercised.** | Chain depth ≥ 2, temporal/scope conditioning, noisy keys, provenance gating are all defined in §1–§4 of the formal doc and all sit in the "not exercised" column of its §6 table. As evidence, generality currently counts for nothing; as design, it defines exactly what a Phase-1 fixture must test. |

Bottom line of the inventory: **on the evidence in hand, the mechanism has no demonstrated advantage in generality, guarantee, or cost over a key-index join.** The literal reading of Gate A therefore fires.

One clarification the inventory must not blur: the tables in §2.1–§2.2 judge the reasoner *as a store-side detector*. The retrieval matrix in §2.3 judges *retrieval policies*, and there the separation is real — but it separates key-indexed retrieval from IRI-only retrieval, not the OWL chain from the join. The join and the reasoner are on the same side of that result.

---

## 4. What Gate A actually licenses

**The store-side detection story on mechanism-v0 is a CLOSED NULL RESULT.** This was pre-committed: pre-registration §9.6 ("Gate A consequence, pre-committed. If H4 holds (expected), the mechanism-v0 accuracy story is closed as a null result… No amendment may reframe mechanism-v0 accuracy as a headline win."). H4 held. In the currently exercised subfragment, detection is a textbook join (Prop. 4, "honest reading"), and the reasoner is a slower implementation of it. No paper claim may rest on mechanism-v0 detection accuracy, and none of the reasoner's designed generality can be claimed until a fixture exercises it.

**What survives is the retrieval-boundary contribution.** The sprint's separations all live on the retrieval side:

- **Def. 3.3** — (B,µ)-conflict-completeness as a property of a *retrieval policy* under a context budget;
- **P3 (impossibility)** — IRI-only k-hop BFS is conflict-incomplete at every finite k when the records connect only through a shared key literal (d = ∞), and raising k to recover completeness destroys B-boundedness (empirically: k=4 = whole store, §2.3);
- **the B-bounded cost curves** — witness-complete at k=1 for ~2 KB (key-indexed) vs whole-store 28–132 KB (IRI-BFS@4 / flat-all).

Under this framing the **object of study becomes the retrieval policy, not the reasoner**. The reasoner/CWI is demoted to one witness-indexing implementation among several (hash join, SPARQL GROUP BY, incremental CWI), competing on cost and on the not-yet-exercised fragment, not on mechanism-v0 accuracy. This is consistent with the novelty position (`prior-art-validation.md` refresh R3/R5): the *only* claimable novelty is the retrieval-policy bridge — conflict completeness under bounded context, plus the lower bound, plus the cost study; the witness concept itself is classical (justifications/MinA, MUS, Reiter's minimal conflict sets, why-provenance) and must be cited as such.

**Be precise about what kind of outcome this is.** This is a **REFRAME, not a clean pass.** Plan §5 anticipated it explicitly ("If the exact index is just a standard incremental join, say so. The novelty must then be the formal conflict-completeness framework plus the empirical phase diagram, not the data structure."), and the paper skeleton's §3 "must survive" clause allows exactly this concession-and-pivot. Gate A's literal condition — no advantage of the mechanism over the join — is *met*, and the gate's escape is taken not by disputing that but by changing the research object to one on which the join is a baseline detector rather than the rival. The document of record must say this plainly; anything that presents Gate A as passed on the original mechanism claim would violate pre-registration §9.6.

---

## 5. Recommendation

**Recommendation: proceed on the reframed method-paper track (conflict-complete retrieval under bounded context, AAAI-28/KRR shape, plan §5) toward Gate B (2026-09-30) — under the following binding conditions.** By Gate B, all three must exist; any one missing at 2026-09-30 triggers the pivot below.

- **(a) Generality fixtures the join cannot pass structurally.** A chain-depth ≥ 2 fixture (witnesses with ∼K-chain length m ≥ 2, |W| = 4m + 2) and a τ/σ fixture (temporal-supersession and scoped-fact non-conflicts populated, per formal doc §6) on which the exact *single-join* baselines are structurally insufficient — i.e., the fixture separates systems by construction, not by tuning. Note Prop. 4 already concedes the full fragment is only O(n·α(n)) with a union–find pass; the fixtures must therefore also measure whether the extended exact baseline keeps its cost edge, honestly reported either way. Per pre-registration §6.3/Amendment A1, these are NEW fixtures, never edits of frozen mechanism-v0.
- **(b) An H3-capable fixture.** A fixture with non-key shared literals, so that literal-aware and key-aware retrieval have provably different balls and the H3 cost-premium prediction becomes testable (registered as a required Phase-1 addition in Amendment A1).
- **(c) Gate C preview on realistic data.** At least one domain from `domain-selection.md` (C1 vulnerabilities / C2 trial versions / C3 scholarly; C4 providers held-out, 48.7–52.2% measured location-inaccuracy prevalence) demonstrably reproduces the cross-record mechanism — records co-referent only through a shared key, with genuinely conflicting constrained values — via the prevalence probes in domain-selection §6.

**Otherwise: pivot to the NeurIPS E&D benchmark/audit paper (plan §6A).** The pivot is cheap because the sprint's assets transfer whole: the instance-level protocol (instances.json manifests, PredictionRow schema, witness-containment scoring, strict parse-failure handling, cluster-bootstrap-by-entity), the retrieval-policy battery, the exact-baseline discipline, and the domain-selection dossier are precisely the core assets of a benchmark paper. The Mem0 exploratory results (0/8, 0/12, 1/8) become the motivating audit finding, run confirmatorily under the same protocol.

**What would falsify the reframed claim** (stated now, so no later amendment can soften it):

1. **The boundary is vacuous in the wild.** If the (c) probes show realistic conflicts are overwhelmingly same-record or IRI-reachable at small k (i.e., no realistic domain reproduces the key-literal-only co-reference mechanism), P3 is a theorem about a store shape that does not occur, and the paper has no empirical object. This is Gate C's failure mode, previewed early.
2. **Key-indexing confers no cost separation.** If on H3-capable and realistic stores literal-aware (or lexical/dense/hybrid) retrieval is witness-complete at essentially the same context cost as key-aware, then "index the witness-connecting relation" degenerates to "index everything shared", and the completeness/budget trade-off has no interesting frontier.
3. **The Prop. 4 gap closes.** The claim lives in the gap between store-side detection and budget-bounded retrieval (formal doc, Prop. 4 honest reading: "The paper's claim lives in that gap, and dies if the gap closes."). If the deeper-fragment fixtures of (a) show the extended exact baseline (join + union–find, τ/σ partitioning) is both complete and cheapest there too, *and* store-side detection plus a flag-pointer satisfies consumers within budget (Def. 3.3 Remark 1's weaker variants dominating empirically), then no witness-indexing method — CWI included — earns its cost, and the method paper is dead at Gate B regardless of conditions (a)–(c).

---

## 6. Decision

This document **recommends**; it does not decide. The decision is the human researcher's (plan §11 / §14.6).

| Field | Entry |
|---|---|
| Option 1 | **Proceed, reframed:** method paper on conflict-complete retrieval under bounded context, toward Gate B (2026-09-30), under conditions 5(a)–(c). |
| Option 2 | **Pivot now:** NeurIPS E&D benchmark/audit paper on the sprint's protocol + domain assets. |
| Decision | ☐ _(empty — awaiting researcher)_ |
| Decided by | _(name)_ |
| Date | _(date)_ |

---

### Traceability

Every number in §2 traces to: `packages/predicate-eval/results/instances/summary.<domain>.json` (detection P/R/F1, both-value recall, witness recall, benign FPs, reasoner `meanCostMs`), `packages/predicate-eval/results/exact/*.jsonl` (exact-arm rows; `extra.totalDomainMs` / `extra.phaseMs`), `packages/predicate-eval/results/retrieval/retrieval.<domain>.jsonl` (witness-complete matrix, context sizes), `packages/predicate-eval/baselines/results/mem0-verdicts.*.json` (exploratory Mem0 verdict counts) — all as committed alongside this document at tag `phase0-evidence-2026-07-13`, rebuildable by `scripts/build-evidence.sh` (decision values reproduce exactly; timing fields vary run-to-run). The pre-sprint pilot evidence is separately frozen at tag `evidence-snapshot-2026-07-12` (commit `3b63c1e`). No number in this document appears anywhere else first.
