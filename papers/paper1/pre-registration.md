# Pre-registration — Conflict-Complete Retrieval under Bounded Context (mechanism-v0)

**Version:** v1.0
**Date:** 2026-07-12
**Status:** FROZEN. This document must be AMENDED (dated sections appended under §10), never edited or rewritten. Any change to hypotheses, metrics, fixtures, exclusions, or analysis code after this date requires an amendment entry; silent edits invalidate the pre-registration.
**Registered against:** git tag `evidence-snapshot-2026-07-12` (commit `3b63c1e`), branch `paper1-evidence-sprint`.
**Governing plan:** `papers/paper1/top-venue-publication-plan.md` §7–§9 and Phase 0 (§11), which mandates: "Pre-register hypotheses, primary metrics, exclusions, and the analysis script before headline runs."

---

## 1. Frozen primary question

Aligned with plan §1:

> **What information must an agent-memory retrieval policy index to be conflict-complete under a bounded context budget — and at what context cost does each policy return the source-grounded conflict witness?**

Narrowed operational form for this registration (mechanism-v0 scope):

> For each retrieval policy π and context budget B, on what fraction of gold conflict instances does π's returned context contain the complete gold witness (both source records / all gold witness triples), and what does that containment cost in triples, bytes, and milliseconds — compared against exact symbolic baselines that index the key relation directly?

Explicit **non-claims** at this stage (per plan §3 and Gate A):

- No claim that the reasoner is more *accurate* than exact key-join / SPARQL baselines on mechanism-v0 (H4/H5 below predict the opposite of any such claim).
- No claim of external validity: all current fixtures are synthetic mechanism demonstrations (`mechanism-v0`); realism claims are deferred to the Phase 2 benchmark.
- No claim about LLM reasoning ability; LLM arms measure the *interface* (what a reader can see given a policy's context), not model intelligence.
- No RAG-competition framing.

## 2. Measurement contract this registration binds to

The instance-level contract being built this sprint (headline runs may not start before it is frozen; see §9):

- **Fixtures (frozen at tag `evidence-snapshot-2026-07-12`):**
  - `packages/predicate-eval/fixtures/conflict-d20/` — same-subject conflicts (d=0.20).
  - `packages/predicate-eval/fixtures/conflict-xr-small/` — cross-record conflicts, co-reference only via shared email key literal (60 persons).
  - `packages/predicate-eval/fixtures/conflict-xr-scale/` — same mechanism, 300 persons.
  - All are **synthetic mechanism-v0**. The generator deliberately places the twin record outside the IRI-only BFS ball; this is a designed property, disclosed, and is why H1 is a mechanism check, not a discovery (§2.1).
- **Instance records:** `packages/predicate-eval/fixtures/<domain>/instances.json`, one record per instance with `kind ∈ {conflict, benign-coreference, benign-shared-value, benign-duplicate, benign-multivalued}`, the gold witness triple set, and the entity (key-equivalence class) it belongs to. Positives = `conflict`; all `benign-*` kinds are hard negatives.
- **System outputs:** one `PredictionRow` per (system, instance): predicted conflict yes/no, returned/decisive values, returned context (triples and bytes), `costMs`, and raw output for LLM arms.
- **Systems registered for the comparison runs:**
  1. `exact-key-join` (hash join on the declared key + distinct-value check)
  2. `sparql-groupby` (GROUP BY key HAVING COUNT(DISTINCT value) > 1)
  3. `reasoner-r14r23r22` (hasKey→sameAs chain, value propagation, conflict flag)
  4. `retrieval:iri-bfs@k` — IRI-only BFS ball, witness-containment semantics
  5. `retrieval:literal-aware@k` — BFS that also traverses shared literals
  6. `retrieval:key-aware@k` — traversal only across declared-key literals
  7. Mem0 ingest arms — **exploratory to date** (§8); any confirmatory rerun requires an amendment
  8. Pinned-LLM flat arms (`flat-all`, `flat-retrieved`) — infrastructure ready, **no API keys yet**; these run under this registration only if fixtures/metrics are unchanged when keys arrive, otherwise via amendment.
- **Witness-containment semantics for retrieval arms:** a retrieval policy is scored on whether its returned context *contains all gold witness triples* for the instance — i.e., whether a sound detector reading that context could establish the conflict. Retrieval arms are never penalized for lacking a detector; symbolic and LLM arms are scored on the emitted conflict decision.

### 2.1 Prior-knowledge disclosure (what is already known that bears on the hypotheses)

Honesty requirement: Pilot E's deterministic k-sweep (EXPERIMENT-LOG.md, 2026-07-11) already established pair-level reach for IRI-BFS: twin reach 0.000 at k≤3, 1.000 at k=4, on conflict-xr fixtures. **H1 is therefore a registered mechanism check under the new instance-level witness-containment metric, not a novel prediction.** H2, H3, and H4 concern systems that exist but whose comparison runs have **not** landed as of this date (no results files exist for exact-key-join, sparql-groupby, key-aware, or literal-aware arms). H5's equality prediction is registered before any reasoner-vs-exact-baseline paired run exists.

## 3. Named hypotheses (directional, registered before the comparison runs land)

- **H1 (mechanism).** `retrieval:iri-bfs@k` for k ≤ 2 achieves a witness-complete rate of **exactly 0** on the cross-record fixtures (`conflict-xr-small`, `conflict-xr-scale`): no conflict instance's full gold witness set is contained in any k≤2 IRI-only ball seeded at either record. (Status: mechanism check — see §2.1.)
- **H2 (sufficiency of key indexing).** `retrieval:key-aware@1` and `retrieval:literal-aware@1` both achieve witness-complete rate **1.0** on the same cross-record fixtures: one hop across the shared key literal reaches the twin record, so the full witness is contained at k=1.
- **H3 (cost separation, direction only).** `literal-aware@k` pays a **context-size premium** over `key-aware@k` (more triples and more bytes per instance at equal k), and this premium **grows monotonically with the number of non-key shared literals** in the store (literal-aware traverses every shared literal; key-aware traverses only declared keys). Direction only is registered; no effect size is predicted. On benign-shared-value instances the premium is predicted to be largest.
- **H4 (the null result that forces the generality argument).** `exact-key-join` achieves conflict **precision = recall = 1.0** on all three current fixtures at **< 10 ms median per-instance `costMs`**. Consequence, registered in advance: on mechanism-v0, *no accuracy-based superiority claim for the reasoner (or any other system) over a trivial exact join is admissible*. If H4 holds, the paper's argument must rest on generality, guarantees, or cost on richer data (plan §11 Gate A), not on mechanism-v0 accuracy.
- **H5 (reasoner parity, edge deferred).** `reasoner-r14r23r22` **matches** exact-baseline accuracy on all current fixtures (predicted paired per-instance F1 difference vs `exact-key-join` = 0). The reasoner's claimed edge — rule-chain generality beyond single joins, τ/σ (time/scope) conditioning, provenance gating — is **not testable on mechanism-v0**, and no such claim will be made from these runs; it is deferred in full to the realistic benchmark (plan Phase 2).

Falsification is symmetric and binding: if H2 fails (key-aware misses witnesses) the sufficiency story is wrong as stated; if H4 fails in the accuracy direction (exact join < 1.0) the fixtures or the join are broken and an amendment plus root-cause entry is required before any further runs; if H5 fails in either direction it is reported as-is.

## 4. Primary vs secondary metrics

**Primary (exactly three; all instance-level):**

1. **Conflict F1** per system per fixture: precision/recall/F1 over the binary per-instance conflict decision, positives = `conflict` instances, negatives = all `benign-*` instances. (Precision and recall are reported; F1 is the single headline number.)
2. **Witness recall**: fraction of gold witness triples contained in the system's returned context / cited evidence, averaged over conflict instances; and the derived **witness-complete rate** (fraction of conflict instances with witness recall = 1.0), which is the quantity named in H1/H2.
3. **B-bounded completeness curve**: for each retrieval policy, witness-complete rate as a function of context budget B, computed on a fixed grid of B in **triples** {5, 10, 25, 50, 100, 250, 500, 1000, whole-store} and mirrored in **bytes**; a policy's point at B uses only instances where its returned context ≤ B. The curve is the primary cost-completeness object; single-k points (H1/H2) are cross-sections of it.

**Secondary (reported, never headlined, no hypothesis may be promoted to them post hoc):**

- Both-value recall (both conflicting values present in returned context/answer).
- Context cost: triples and bytes per instance (absolute, and premium ratios for H3).
- `costMs` per instance (p50/p95 per system).
- Parse/format compliance rate for LLM arms (separate metric per plan §9; see §6).
- Benign-kind breakdown (false-positive rate per `benign-*` kind).
- Aggregate 8-question scores from the legacy harness (kept only for continuity with pilots; never a headline).

## 5. Experimental units and clustering

- **Unit of analysis: the instance.** Never the seed, never the run, never the question-set aggregate. Random seeds of the same generator are regression checks, not replications (plan §9), and contribute no degrees of freedom.
- **Fixtures are strata, not independent domains.** All three fixtures come from one synthetic generator family (mechanism-v0); results are reported per fixture but pooled claims across fixtures are labelled single-domain. True domain-level clustering begins only when Phase 2 realistic domains exist.
- **Paired comparisons only.** Every system runs on the identical instance set; system contrasts (e.g., H5's reasoner vs exact-key-join) use paired per-instance differences — McNemar's test for binary decisions, paired bootstrap for F1/witness-recall differences.
- **Cluster bootstrap by entity.** Uncertainty intervals resample **entities** (key-equivalence classes / persons), not instances, since multiple instances can share an entity and are not independent. 10,000 resamples, seed fixed at 20260712, percentile intervals. Degenerate all-identical outcomes are reported as "identical outcome on N instances across M entities", never as [x, x] confidence intervals (Pilot E lesson).
- Effect sizes with intervals are reported for every contrast; significance alone is never reported.

## 6. Exclusion rules

1. **Parse failures are counted, never dropped.** For LLM arms, an unparseable output is recorded as `parse_failure` in the PredictionRow. Primary metrics are computed under the **strict** rule registered here: a parse failure counts as *no conflict detected* (a miss on positives, a correct-rejection contribution on negatives is NOT granted — the instance is scored as incorrect for the arm). Compliance rate is reported alongside as its own secondary metric. No "parseable-only" variant may be headlined; if computed, it is labelled diagnostic.
2. **No instance-level exclusions of any kind post hoc.** Every instance in `instances.json` at the frozen tag is scored for every system. Systems that cannot run a fixture produce an explicit `not-run` row with reason, reported in the results table.
3. **No post-hoc fixture edits.** mechanism-v0 is frozen at tag `evidence-snapshot-2026-07-12`. If a fixture or oracle bug is discovered after any comparison run, the fix requires a dated amendment (§10), a new tag, and a complete rerun of **all** systems; both pre-fix and post-fix results are retained and reported.
4. **No silent reruns.** Every run of the analysis pipeline appends to results; superseded runs are moved to `packages/predicate-eval/results/archive-*/` (existing convention), never deleted.
5. Infrastructure failures (OOM, disk-guard aborts) are logged with cause and the cell is marked `incomplete`, never backfilled with a partial score.

## 7. Analysis plan (scripts and exact file paths)

The scoring code must be frozen (committed, hash recorded via amendment §10) **before** the first headline comparison run. Planned contract, binding once frozen:

| Artifact | Path | Role |
|---|---|---|
| Instance fixtures | `packages/predicate-eval/fixtures/{conflict-d20,conflict-xr-small,conflict-xr-scale}/instances.json` | Gold instances, kinds, witness triples, entity ids |
| System runners | `packages/predicate-eval/src/contract/run-systems.ts` (invoked via `npm run contract-run` in `packages/predicate-eval/`) | Emits one PredictionRow JSONL per (system, fixture) |
| Prediction rows | `packages/predicate-eval/results/contract/<fixture>.<system>.predictions.jsonl` | Raw per-instance outputs incl. context, costMs, raw LLM text |
| Scoring script | `packages/predicate-eval/src/contract/score.ts` (invoked via `npm run contract-score`) | Computes §4 primary + secondary metrics from prediction rows + instances.json; no other code path may produce headline numbers |
| Scored tables | `packages/predicate-eval/results/contract/scores.<fixture>.json` and `packages/predicate-eval/results/contract/scoreboard.md` | Per-system metric tables, B-curves, paired contrasts with cluster-bootstrap intervals |
| Statistical contrasts | computed inside `score.ts` (McNemar, paired/cluster bootstrap, seed 20260712) | H1/H2/H4/H5 verdicts printed explicitly as PASS/FAIL against §3 |

`score.ts` responsibilities, registered now: (a) conflict P/R/F1 per §4.1; (b) witness recall and witness-complete rate per §4.2; (c) B-bounded curves on the §4.3 grid; (d) H1–H5 verdicts; (e) secondary metrics; (f) strict parse-failure handling per §6.1. Existing scripts (`src/conflict/xr-stats.ts`, `src/flat*.ts`, `baselines/*.sh`) remain pilot infrastructure and may feed PredictionRows but may not compute headline metrics.

## 8. What is exploratory (hypothesis-generating, already run, NOT pre-registerable)

Everything in `papers/paper1/EXPERIMENT-LOG.md` to date is exploratory and may only be described as such in the paper:

- **Pilot A** (org three-way; the org-q02 information-asymmetry artifact).
- **Pilot B** (CONFLICT-BENCH v1 density sweep; the same-subject perfect tie).
- **Pilot C** (conflict-xr-small three-arm; flat-retrieved 0.58).
- **Pilot D / D2** (Mem0 classic ingest on d20 and xr-small; 0/8 preserved, 0/12 linked) and the Mem0 2.x additive arm (1/8) — all Mem0 runs to date, including `baselines/results/mem0-ops.*.jsonl`.
- **Pilot E** (5-seed replication, k-sweep, xr-scale; degenerate-interval lesson).
- **Pilot F** (p1000/p2000 flat-all cost sweep; pattern-shortcut observation).
- **Pilot G** (model-tier matrix; fair-parser/ctx fixes).
- All in-session frontier-subagent results (not pinned, not independently reproducible — plan §3).

These motivated the hypotheses in §3; none of them may be presented as confirmatory tests of those hypotheses. Confirmatory status attaches only to runs executed **after** this registration is committed and the §7 scoring script is frozen.

## 9. Stopping and deviation rules

1. **Start gate.** Headline comparison runs may begin only when all of: (a) `instances.json` exists for all three fixtures at the frozen tag (or an amended tag), (b) `src/contract/score.ts` is committed and its hash recorded in an amendment below, (c) this document is committed. Runs started before the gate are exploratory by definition.
2. **Amendment-only changes.** Any change to fixtures, instance definitions, metrics, exclusion rules, hypothesis wording, or scoring code after the start gate requires a dated amendment section under §10 stating what changed, why, what had already been observed at the time, and which results are invalidated/rerun. The original text above is never edited (typo fixes included — note them in an amendment).
3. **Fixture-bug rule.** Discovery of a generator or oracle bug stops all runs; §6.3 applies.
4. **No optional stopping on LLM cells.** The number of repeats for stochastic LLM arms is fixed before the first repeat of that cell runs and recorded by amendment; cells are never extended because the current estimate looks unfavorable.
5. **Pinned-LLM arms.** When API keys arrive, model IDs, prompts, sampling parameters, and repeat counts are registered by amendment *before* the first pinned run; in-session subagent results remain exploratory forever.
6. **Gate A consequence, pre-committed.** If H4 holds (expected), the mechanism-v0 accuracy story is closed as a null result and the project proceeds per plan §11 Gate A (generality/guarantee/cost or pivot to the benchmark/audit paper). No amendment may reframe mechanism-v0 accuracy as a headline win.

## 10. Amendments

*(Append dated entries below. Never edit sections 1–9.)*

### Amendment A1 — 2026-07-12 (same-day: implemented paths, schema freeze, timing disclosure)

**What changed.** The §7 analysis plan named planned paths (`src/contract/run-systems.ts`, `src/contract/score.ts`, `results/contract/*.predictions.jsonl`). The sprint implemented the same contract under different names, now frozen:

- Instance manifests: `packages/predicate-eval/fixtures/<domain>/instances.json`, built by `src/instances/build-manifest-cli.ts` (manifest logic `src/instances/manifest.ts`, sha256 `fa2d95a84eb1…`). All three fixtures carry manifests; recorded explicitly: `conflict-xr-scale` is a full stratum with its own `instances.json`, not a cost-only stratum.
- Scoring script: `src/instances/score-cli.ts` (sha256 `0967623a0112…`; includes a loud warning when any system has instances with no prediction row, so manifest-id drift can never again be silently scored as un-flagged).
- Schema note: `InstanceRecord` carries no explicit `entity` field; the §5 cluster-bootstrap-by-entity procedure derives the entity as the shared `key` literal (v2 fixtures) or the single `subjects[0]` (v1 fixtures).
- Systems and prediction outputs: `src/exact/run-exact-cli.ts` → `results/exact/<system>.<domain>.jsonl`; `src/rigs/retrieval-policies-cli.ts` → `results/retrieval/retrieval.<domain>.jsonl`; `src/instances/reasoner-arm-cli.ts` → `results/instances/reasoner-r14r23r22.<domain>.jsonl`; scores → `results/instances/summary.<domain>.json`.
- PredictionRow field schema frozen as implemented: `{instanceId, domain, system, flagged, values[], witness[] ("s|p|o" ids), costMs, extra{}}`; InstanceRecord as in `src/exact/contract.ts`.
- One-command rebuild: `scripts/build-evidence.sh` (stages: fixtures-drift-check, deterministic, summary → `papers/paper1/evidence/summary-<sha>.json`).

**Timing disclosure (required by §9.1–9.2).** This registration was drafted by an agent running **in parallel with** the implementation agents on 2026-07-12; the first full comparison runs executed the same day, before this document was committed. By §9.1 those runs are therefore **exploratory**. Because every registered system is deterministic (hash join, SPARQL GROUP BY, witness-containment, fixpoint), the post-commit rerun of `scripts/build-evidence.sh` constitutes the confirmatory record; its decision values must (and do) reproduce exactly, with only timing fields varying. H1, H2, H4, H5 outcomes observed today: all in the registered direction. H3 was **not testable**: `cb2:email` is the only literal in the current aboxes, so literal-aware and key-aware balls are provably identical on mechanism-v0 (verified by per-seed set equality); testing H3 requires a fixture with non-key shared literals (registered here as a required Phase-1 fixture addition, subject to the §6.3 no-silent-rewrite rule — it must be a NEW fixture, not an edit of mechanism-v0).

**Known deviation — reconciled before landing.** During the sprint the exact arm derived per-subject `benign-shared-value` probes (17 rows on conflict-xr-small, 65 on conflict-xr-scale) vs the canonical paired-instance manifests (16 / 64), so the scorer reported `missing=1` for exact systems on xr domains, counted as un-flagged benign (TN; conflict P/R/F1 unaffected). The exact arm was reconciled to the canonical paired-instance ids in the landing commit; `missing=0` for every system on every domain in the committed artifacts.

### Amendment A2 — 2026-07-13 (Phase-1 registration: chain-depth, τ/σ, and H3-capable fixtures; extended exact baseline; hypotheses H6–H8)

**Context.** Gate A was decided 2026-07-13: Option 1, proceed reframed (method paper on conflict-complete retrieval under bounded context), per `gate-a-analysis.md` §6, under the binding conditions of its §5(a)–(c). This amendment registers the Phase-1 fixture family, the extended exact baseline, and the new hypotheses **before** any of the fixtures, systems, or runs exist. mechanism-v0 remains frozen and untouched (§6.3): everything below is NEW fixtures and NEW system code.

**Timing disclosure (required by §9.1–9.2).** At the time of drafting, no `generate-v3` code, no v3 fixture data, and no extended-baseline code exists in the repository; the designs are informed by the (closed) mechanism-v0 results and by `formal-conflict-completeness.md`. Predictions marked *(mechanism check)* below are guaranteed by fixture construction — registered for honesty, not as discoveries — exactly as H1 was in §2.1. All other predictions are forward-looking.

**A2.1 New fixture family (`phase1-v3`), generator `src/conflict/generate-v3.ts`.**
Deterministic (mulberry32, fixed seed recorded in the generator source), namespace `cb3: = http://ex/cb3#`, same file set as v2 (`world.ttl`, `episodes/*.jsonl`, `oracle.json`, `questions.json`) plus the derived `instances.json`. Registered fixtures:

1. **`conflict-chain-m2`** (40 person-chains) and **`conflict-chain-m3`** (24 person-chains): each instance is a ∼K-chain of m+1 records across sessions — two *endpoint* records carrying the constrained value (`cb3:office`) and m−1 *sparse intermediate* records carrying **two** key values (`cb3:email`) each and **no** constrained value. Conflict instances have differing endpoint values; benign-coreference chains agree. By construction every conflict witness has chain length m (2 or 3) and cardinality **|W| = 3m+3** (see A2.5). Sparse intermediates carry no IRI-object triples, so they are isolated vertices of the IRI graph G(S) — d(endpoint, intermediate) = ∞ through IRIs. `benign-shared-value` probe instances are included as in v2. Conflicted fraction: 10/40 (m2), 6/24 (m3).
2. **`conflict-h3-nk1`** and **`conflict-h3-nk3`** (60 persons each, 12 conflicted, mirroring conflict-xr-small): the v2 cross-record twin mechanism unchanged, PLUS **nk ∈ {1, 3}** non-key shared-literal predicates (`cb3:city`; + `cb3:title`, `cb3:building` at nk=3) whose string values are shared across groups of ~10 person-records. These make the literal-aware and key-aware balls provably different, making H3 testable (registered as required by Amendment A1).
3. **`conflict-tausig`** (60 persons; 12 conflict, 12 benign-temporal, 12 benign-scoped, 24 benign-coreference): τ/σ carried as **record-level annotation triples** — `cb3:validFrom`/`cb3:validTo` (ISO date literals; interval [from, to), absent = ⊥) and `cb3:sourceScope` (string literal; absent = ⊥) on the record subject; every assertion of a record inherits its record's τ/σ (the record-as-snapshot encoding used by realistic registries, cf. `domain-selection.md` C2/C4). Kinds: `conflict` = co-keyed records, overlapping-or-⊥ τ AND equal-or-⊥ σ, differing constrained value; `benign-temporal` = disjoint τ intervals (temporal supersession), differing value; `benign-scoped` = differing σ, differing value; `benign-coreference` = agreeing values.

**A2.2 Schema extension.** `InstanceKind` gains `benign-temporal` and `benign-scoped` (hard negatives, exactly like the existing `benign-*` kinds). `InstanceRecord` and `PredictionRow` are otherwise unchanged. The scorer (`src/instances/score-cli.ts`) is reused; its per-kind breakdown covers the new kinds with no metric changes. Verdicts for H3/H6/H7/H8 are computed by a new script `src/instances/phase1-verdicts-cli.ts` from prediction rows only; its hash is recorded at the landing commit (as A1 did for the scorer).

**A2.3 New system: `exact-key-join-x`** (the Prop. 4 *full-fragment* exact baseline). Per-(keyed-class, key-value) bucketing + a **union–find** closure over co-key pairs (O(n·α(n))), then per-equivalence-class, per-constrained-predicate distinct-value check **partitioned by τ/σ overlap**: two values conflict only if their records' τ intervals overlap (⊥ overlaps everything) and their σ are equal-or-⊥ — i.e., F3's side conditions implemented exactly. It runs on ALL domains (mechanism-v0 + phase1-v3) so cost and accuracy are paired against `exact-key-join`, `sparql-groupby`, and `reasoner-r14r23r22`. The existing three detection systems run UNCHANGED on the new fixtures; their predicted failures below are registered predictions, not bugs, and must be reported as measured.

**A2.4 New hypotheses (directional, registered before any v3 fixture or run exists).**

- **H6 (chain depth).** On `conflict-chain-m{2,3}`: (i) *(mechanism check)* the single-join detectors `exact-key-join` and `sparql-groupby` detect **0** of the chain conflicts (recall 0, no false positives) — structural, since no single key-value bucket contains two distinct constrained values; (ii) `exact-key-join-x` and `reasoner-r14r23r22` both achieve P = R = 1.0 (Prop. 2 / Prop. 4 full fragment); (iii) `retrieval:key-aware@k` has witness-complete rate **0 for k < m and 1.0 for k ≥ m** (completeness budget grows with chain length); (iv) *(mechanism check)* `retrieval:iri-bfs@k` has witness-complete rate **0 at every k ∈ {1..4}** — stronger than on mechanism-v0, because sparse intermediates are IRI-isolated, so no hop budget recovers them.
- **H7 (τ/σ conditioning).** On `conflict-tausig`: the τ/σ-blind detectors (`exact-key-join`, `sparql-groupby`, `reasoner-r14r23r22`) flag **all** `benign-temporal` and `benign-scoped` instances (false-positive rate 1.0 on those kinds; conflict precision ≈ 12/36 = 0.333 if recall holds at 1.0), while `exact-key-join-x` achieves P = R = 1.0 with zero benign false positives. Scope: H7 binds the detection systems only; retrieval arms are witness-containment-scored and carry no τ/σ prediction here.
- **H8 (extended-baseline cost, direction only).** `exact-key-join-x` keeps an end-to-end cost advantage of at least one order of magnitude over `reasoner-r14r23r22` materialization on every fixture where both are accurate, and stays within one order of magnitude of plain `exact-key-join` on mechanism-v0. Registered per Gate A condition 5(a)'s honesty clause: if the extended baseline is *also* complete and cheapest on the deeper fragment, that result stands and bears on Gate B falsification clause 3 (`gate-a-analysis.md` §5).
- **H3 (unchanged wording, §3), now operationalized.** Target fixtures `conflict-h3-nk1`/`conflict-h3-nk3`: mean returned-context triples and bytes of `literal-aware@1` strictly exceed `key-aware@1` on conflict instances (premium > 1×), the premium at nk=3 strictly exceeds the premium at nk=1 (monotonicity in non-key shared literals), and the premium is largest on `benign-shared-value` instances. Witness-complete rates of both policies remain 1.0 at k=1 (H2 carries over).

**A2.5 Correction of record (witness cardinality formula).** `formal-conflict-completeness.md` §2 and `gate-a-analysis.md` §5(a) state |W| = 4m + 2 for chain-length-m witnesses. As a **set** cardinality this double-counts the type assertions of intermediate records shared between adjacent F1 applications; the correct count is **|W| = 3m + 3** (m+1 type assertions + 2m key assertions + 2 value assertions; both formulas agree at m = 1, where |W| = 6). The formal doc and gate doc are corrected in the same commit as this amendment; no frozen text in §1–§9 of this registration stated the formula, so no §1–§9 result is affected.

**A2.6 Protocol carry-over and exclusions.** Primary metrics, B-grid, paired-comparison and cluster-bootstrap rules (§4–§5), and exclusion rules (§6) apply unchanged to the new fixtures; the entity for cluster bootstrap on v3 fixtures is the person id (one chain/twin group per person). The legacy tier-1 8-question `eval` stage is NOT run on phase1-v3 fixtures (it is a mechanism-v0 continuity metric only). `scripts/build-evidence.sh` gains the five new domains, the v3 generator in its drift check, the `exact-key-join-x` arm on all domains, and the verdicts script; mechanism-v0 stages are byte-unchanged.

**A2.7 Exploratory registration: Gate C preview probe (condition 5(c)).** A prevalence probe on domain C1 (vulnerability records, `domain-selection.md` §6): group records in a dated OSV bulk export slice (PyPI ecosystem) by shared CVE alias — records co-referent only through the CVE key — and report (a) the fraction of CVE-keyed groups with ≥ 2 independently authored records, and (b) the disagreement rate on severity and affected-range fields within co-keyed groups. This is **exploratory / hypothesis-generating** (it estimates prevalence before Phase-2 density decisions, per plan §11); no confirmatory status is claimed, and no benchmark instance is built from it under this registration.
