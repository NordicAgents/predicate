# Predicate → AAAI — Strategy & Implementation Plan

> **How this was produced.** A 22-agent analysis workflow (6 intel/audit agents with
> web search + code reading → 6 candidate paper theses scored by a calibrated AAAI
> program-committee panel → 5 strategy deep-dives → 3 simulated AAAI reviewers red-teaming
> the plan → synthesis), plus a direct read of the codebase (`predicate-reasoner`,
> `predicate-agent` schema lifecycle, `predicate-eval` incl. `SCALE-FINDINGS.md`).
> ~1.6M tokens of analysis. This file = my editor's notes (below) + the full consolidated
> plan (from "The Decisive Strategy" onward).

## Editor's notes (read these first) — Claude

**The one-sentence verdict.** Yes, this can become an AAAI paper — but **not AAAI-27**
(abstracts due 2026-07-21, ~10 days from now; the required evidence does not exist yet).
The honest path is a **~5-month evidence sprint** around a reframed thesis, an archival
Plan-B publication this winter, and a review-hardened **AAAI-28** submission.

**The reframe you must accept.** Your own eval (`SCALE-FINDINGS.md`) refutes the current
headline — the OWL reasoner loses to a 5-line BFS at every tested scale, and the
"self-improving schema" is design-only. Submitting that story is a Phase-1 desk-reject on
three independent grounds. The winning move (which five independent agents converged on) is
to **stop claiming the graph recalls better** and instead claim the one thing a flat/vector
memory *structurally cannot cheaply do*: **surface contradictions instead of silently
averaging or picking one**, with per-triple provenance and a machine-checkable derivation —
and to ship the negative result as a *predictive boundary* (the "crossover") rather than
hide it. **The negative result becomes the paper, not the obstacle.**

**The three make-or-break items** (solve these or the numbers won't matter):
1. **Scoping-vs-completeness.** Your cost fix (reason only over the retrieved neighbourhood)
   is in direct tension with the completeness that is the whole point. You need either a
   locality proof or an honestly-reported recall cliff. All three red-team reviewers flagged this.
2. **The conflict-aware-prompted baseline.** You must compare against a *strong* LLM that is
   explicitly told "if sources disagree, report all values with sources, don't average." Only
   the residual gap after that is a real symbolic contribution.
3. **Information symmetry.** Inject the functional/disjoint schema constraints into every
   baseline's context. If your edge survives that, it's real; if it collapses, the honest
   finding is "schema-in-context suffices" — publishable, but not your thesis.

**✅ Citation integrity — RESOLVED and INTEGRATED (2026-07-11).** Two same-day audits (a
citation-integrity pass, Addendum 1, and a seven-agent prior-art/novelty/venue validation,
Addendum 2 + `docs/prior-art-validation.md`) verified every load-bearing citation — zero
hallucinated IDs — and their corrections are now **folded into the body text below**, so the
body can be read at face value; the addenda remain as the audit trail. Standing obligations
from the audits: (1) the novelty claim is the **five-property composition** (§3), never
"first deterministic detection" or standalone-provenance; (2) two new mandatory rebuttal
rows (§8 #13–14) and a deterministic max-serial baseline arm (§4.3); (3) the closest-threat
cluster all appeared May–Jul 2026 — **re-run the novelty scans monthly and in the week
before any submission.**

**Where I'd push back slightly on the plan.** It is thorough to the point of being a
2-year research program compressed into 5 months. Be realistic: E1 (multi-model harness),
E2 (reasoner cost fix), E3 (real-system baselines), and one solid CONFLICT-BENCH is already
a heroic quarter for a small team. If staffing is thin, **do the cheapest highest-information
experiment first** — run the existing org three-way across 4 model tiers (a few days of work).
If the reasoner's edge over a *strong* model on the conflict question survives, you have a paper
worth sprinting for. If it evaporates, you've saved yourself five months and should aim
straight at NeSy/ISWC/NeurIPS-E&D with the honest crossover study. That is **Gate 2**, and it is binding.

**My bottom line.** The AAAI target is achievable but it is an **AAAI-28** target, and only
via the conflict-surfacing reframe with all three blockers solved *inside the submitted PDF*.
The plan below is the right one to execute against.

---

# Predicate → AAAI: The Decisive Strategy & Implementation Plan

**Status:** Lead-author consolidation. Committed recommendation, single path, explicit go/no-go gate and Plan B.
**Anchor date:** 2026-07-11.
**One-line verdict:** Do **not** chase AAAI-27 main track (17 days, evidence doesn't exist). Run a ~5-month evidence sprint around a **fused conflict-surfacing + predictive-crossover** thesis, land it first at an archival Plan-B venue this winter, then submit the review-hardened paper to **AAAI-28** main track (KRR primary). Everything is gated on one binary result (Gate 2).

---

## 1. Executive Summary & The One Recommended Thesis

### The thesis we commit to

> **"When does verifiable memory earn its cost? A deterministic, contradiction-preserving reasoning memory surfaces mutually-exclusive facts (and cites both sources) on the knowledge-update / conflicting-source slice where flat and vector agent memories silently return a stale or averaged answer — and we give a predictive boundary for when that structural edge appears."**

This is the **conflict-surfacing framing (p≈0.32)** as the positive spine, **fused with the crossover-study framing (p≈0.30)** as a built-in hedge. The fusion is deliberate and load-bearing: the conflict result is the *significance* (a thing flat memory structurally cannot do), and the predictive crossover boundary is the *generalizable scientific object* (the thing that survives even if the raw accuracy gap narrows against a frontier model). Three independent red-team reviewers converged on exactly this pairing — "pair the crossover map with a positive structural-advantage result that holds even if the accuracy crossover vanishes."

### Why this beats every alternative

| Candidate framing | Fatal problem | Verdict |
|---|---|---|
| "Graph recalls better than context" | Repo's own SCALE-FINDINGS.md refutes it; abstract-level desk-reject | **Dead** |
| Self-improving ontology (p=0.12) | Package doesn't exist; Generalizer is inert; unmeasured. (Audit note: EvolveMem evolves retrieval *config*, not schema — the TBox angle is more open than first assumed, but the neighbouring space is crowded: MemEvolve, two SAGEs, Kairos) | **Cut to future work** |
| Neighbourhood-scoped hybrid (p=0.15) | On its own it's a cost-parity optimization that ties the trivial baseline → significance-reject | **Demote to enabling method, not thesis** |
| Crossover-study alone (p=0.30) | May degrade to a pure negative result a 17.6%-venue cuts | **Fold in as the hedge/second contribution** |
| Coding-agent-memory wildcard (p=0.20) | Thin KRR novelty + heavy from-scratch benchmark build | **Use only as external-validity domain (P2)** |
| **Conflict-surfacing + crossover (fused)** | Borderline but the only spine that survives the repo's own negative data AND guarantees a contribution | **RECOMMENDED** |

The fused thesis is the only one where: (a) the repo's honest negative result becomes the paper's credibility asset rather than a gotcha; (b) there is a *guaranteed* contribution regardless of how Gate 2 resolves; and (c) the novelty claim — now scoped as the **five-property composition** (§3) — sits on ground verified unclaimed by a live literature sweep on 2026-07-11 (`docs/prior-art-validation.md`), with the caveat that five near-miss papers appeared May–Jul 2026, so the window is measured in months.

### The three contributions (as they appear in the paper)

1. **An analysis** — a predictive crossover boundary parameterized by *properties* (conflict density × hop-depth × model tier × provenance co-retrieval probability), validated on a held-out domain, that predicts when symbolic structure beats in-context retrieval for *any* memory system, not just Predicate.
2. **A benchmark** — CONFLICT-BENCH: a rigorously-scored contradiction / knowledge-update suite where staleness, temporal invalidation, and mutual-exclusivity density are controlled independent variables, with metrics baselines cannot game.
3. **A method** — neighbourhood-scoped contradiction-preserving reasoning that delivers deterministic conflict detection at retrieval-level cost (framed honestly as an application of decades-old query-scoped materialization, novelty = the empirical claim that it preserves detection at flat-retrieval cost, gated on a completeness characterization).

---

## 2. Reality Check: The Honest State of the Artifact

### What is real (confirmed in code)
- **Judgment layer works and is genuinely differentiated:** per-triple RDF-star provenance + confidence-gated closure (`closure.ts` cutoff 0.5), defeasible current-belief default (r20, negation-as-failure over `supersededBy`), and contradiction-*preserving* conflict flags (r21 uses a bespoke `j:ConflictFunctionalProperty`, deliberately **not** `owl:FunctionalProperty`, so r08 does not merge the values). Backward-chained `kg_explain` derivations exist.
- **Usage-gated schema lifecycle runs end-to-end:** propose → validate → usage-gate (N=3/TTL=7) → promote → git-version, wired into `kg_maintain`, tested in `schema-evolution.test.ts`.

### What is broken, inert, or missing (the honest liabilities)
- **The central mechanism loses to a 5-line BFS.** SCALE-FINDINGS.md: flat-retrieved holds F1 0.98 at constant ~1.6k tokens from 547→4,297 facts; the reasoner's naive O(n²) fixpoint blows to 320s at ~4k facts. The repo's own words: the reasoning layer "actively hurts."
- **The one positive number is a weak-model artifact by the authors' own admission.** Org three-way (1.00 / 0.75 / 0.65) is 8 facts, 8 questions, single run, Haiku only; the ~0.35 edge is attributed to "a weak model being sloppy." Flat even answers the conflict question (org-q06) at F1 1.0.
- **The headline self-improvement loop is vaporware.** No `predicate-autoresearch` package. The automatic Generalizer emits axiom-free, member-less class shells (`<gen:HASH> rdf:type owl:Class`) that no rule consumes → promoting them changes zero answers. The neighbouring "self-evolving memory" space is crowded (EvolveMem = retrieval-config evolution, MemEvolve, SAGE ×2, Kairos), though none evolves a TBox — the angle is open but unmeasured here, so it stays cut.
- **r11 (disjoint-class) is a no-op in the shipped fixpoint** (`insertWhere: () => ''`). Any disjoint-class claim currently has no running implementation behind it.
- **Metrics are tautological / gamed:** Tier-1 oracle computes answers via the same closure the reasoner materializes; questions carry `rule_under_test` tags; the abox∪inferred UNION was added "to make every domain reach 1.0."
- **Zero real-system baselines. Single model. Synthetic n=8 fixtures. Hand-driven single-run harness.**

### The central risk: **reasoner-loses-to-BFS**

Submitted as-is, this is a Phase-1 desk-reject on three independently fatal grounds (self-refuting eval, no recognized contribution, unbuilt headline). The 2,500-char rebuttal forbids new results, so every reviewer-demanded experiment must already be in the PDF.

### How the plan converts the risk into the paper's strength

The negative result is **conceded in sentence 2 of the abstract** and reframed as *boundary science*, deployed in three beats:

1. **Preempt** — state "cheap retrieval matches deterministic reasoning on general single-user recall; we do not dispute this, we explain and bound it" before any reviewer can weaponize it. A conceded weakness cannot be a gotcha.
2. **Reframe as boundary science** — AAAI reviewers explicitly reward mapping *when* a method helps. The negative result is one half of a phase diagram; the conflict regime is the other half. The boundary itself is the contribution.
3. **Dissolve the cost half with a method, not a framing** — neighbourhood-scoped reasoning makes cost constant. The paper never argues "reasoning is worth its cost"; it *removes* the cost, then shows the residual conflict-slice edge is free.

The sentence to defend throughout: **"We ship the negative result as a feature — a precise, predictive boundary — not a bug."**

---

## 3. Contribution & Novelty Claim

### The crisp "first to ___" (exact submittable wording)

> To our knowledge, Predicate is the first agent-memory system in which contradiction detection is performed as **deterministic, ontology-grounded symbolic inference** — mutually-exclusive facts, *including conflicts derivable only through inference chains* (disjointness via inferred subclasses), are detected by an OWL-2-RL reasoner; **both values are preserved and co-surfaced as a first-class conflict object** (no winner election, no merge, no LLM resolution); each value carries per-triple provenance; and every detection is exposed as an **independently machine-checkable** backward-chained derivation down to the asserted triples — with this composition **evaluated as a measured property** (contradiction-detection P/R, wrong-answer-avoidance, correct abstention under a false-positive penalty). And the **first to characterize the contradiction-density / knowledge-update / temporal-supersession regime** in which this outperforms LLM-judged (Mem0g), belief-revision (Kumiho), bitemporal-algebra (TOKI), and serial-order-deterministic (max-serial) memory.

This is the **five-property composition** (validated unclaimed 2026-07-11, `prior-art-validation.md`): P1 deterministic non-LLM detection · P2 ontology-grounded logical semantics · P3 preserve-and-co-surface with no winner election · P4 per-triple provenance · P5 machine-checkable derivation. The defensible core is the **P2+P3+P5 conjunction** — no published system or paper has any one of P2-as-implemented, P3, or P5, let alone all three.

Load-bearing, defensible words: *verifiable, measured property, preserved-and-co-surfaced, ontology-derived, characterize the regime, independently checkable*. **Never** claim first-graph-memory, first-provenance (Eywa forecloses it — provenance is a *component*, never standalone), first-temporal, first-self-improving-schema, **first-deterministic-detection** (TOKI's key-collision, NeuSymMS's CLIPS rules, and SLM-V3's geometric score all exist), or **first-conflict-benchmark** (MemConflict/STALE/BEAM exist) — each is false and an instant reject.

### Three-layer fallback (for the rebuttal, since no new results allowed)
- **Layer 1 (composition):** no single mechanism is new; the contribution is the specific *composition, evaluated as a measured property*, which no prior system assembles or scores.
- **Layer 2 (benchmark):** even granting overlap, no prior work measures contradiction-detection P/R, wrong-answer-avoidance under a false-positive penalty, and correct-abstention **with conflict density as a controlled IV** (abstention alone: BEAM/Selective-QA; recognition-among-candidates: MemConflict — the conjunction with manipulated density/chain-depth is unclaimed).
- **Layer 3 (kind-difference):** where prior systems handle conflicts, they do so by LLM judgment (Zep/Mem0g — probabilistic, non-reproducible, non-checkable), temporal supersession, or deterministic **winner election** (TOKI's operators, max-serial recipes — reproducible but blind to entailed, non-temporal exclusivity and electing a winner by construction); we measure the *rate at which each silently mis-resolves where we flag*.

### Positioned against prior art (the honest concessions that make the claim credible)

| Cluster | Prior art | What we concede | What survives as ours |
|---|---|---|---|
| Provenance + temporal | **Zep/Graphiti** | Provenance, bi-temporal validity, supersession-as-contradiction | Non-temporal **co-current logical** conflict; deterministic (not LLM) detection; checkable derivation |
| LLM conflict resolution | **Mem0/Mem0g** | LLM picks/merges a value | We **preserve+cite both**; measure Mem0g's silent mis-resolution rate |
| Belief-revision graph memory | **Kumiho** (dropped DL on purpose — quote verified verbatim; self-reported top LoCoMo retrieval-category F1, not overall SOTA) | AGM supersession, graph-native versioning (explicitly anti-git; the git-as-storage jab is aimed at Letta) | Conflicts requiring **TBox axioms + closure** (disjointness through inferred subclass chains) that propositional revision cannot flag |
| Ontology backing | **Cognee** (ships RDF/OWL validation) | "ontology-backed memory" is not novel | Measured conflict-surfacing, not the OWL stack |
| Self-evolving memory | **EvolveMem, Kairos, A-Mem, ADAS, DGM, Voyager** | Schema/memory evolution is an established category | **Cut from claims** — cited defensively as scoped-out future work |
| Neuro-symbolic | **LLM-Modulo, Huang et al.** ("LLMs can't self-correct/verify") | LLMs need an external verifier | **Converted to support:** our deterministic OWL-RL layer *is* the external non-LLM verifier they prove you need, applied to belief adjudication |
| Skeptical prior | **"You Don't Need Pre-built Graphs for RAG"** (LogicRAG, AAAI-26, 2508.06105) | Right for general recall — we reproduce it | Orthogonal: the graph earns its keep on **guarantees**, not recall; LogicRAG conspicuously does not answer *when* structure is worth it — our slot |
| Deterministic (non-logical) conflict detection | **TOKI** (2606.06240), **NeuSymMS** (2605.17596), **SLM-V3** (2603.14588) | Deterministic detection per se exists (key-collision + Allen overlap; CLIPS rules + string similarity; geometric sheaf score) | Conflicts **derived by ontological inference** (through inferred chains); no winner election (TOKI elects, NeuSymMS retracts, SLM-V3 prefers-newer); checkable derivation; measured P/R |
| Preserve-not-resolve design | **MRMS** (2607.04617), **BeliefMem** (2605.05583), **Spectron** (SurrealDB, preview — watch closely) | "Conflict preservation, not resolution" as a design thesis exists | Detection by symbolic inference rather than asserted relations or LLM extraction; first-class conflict object; derivation; controlled-density measurement |
| Provenance-grounded memory | **Eywa** (2605.30771) | Per-fact provenance + deterministic retrieval plumbing are table stakes | Provenance feeding a **logical justification** of *why* values conflict — Eywa has no detection step at all |
| OWL-validation-over-memory proposal | **Ontology-as-memory** (2604.20795) | The *idea* of OWL/SHACL verification over LLM-built memory is proposed | The first **realized and measured** version, with inverted semantics: preserve-and-surface vs their gate-and-reject (failing facts quarantined to logs) |
| Deterministic freshness resolution | **"Don't Ask the LLM to Track Freshness"** (2606.01435) | max(serial)/LWW beats LLM conflict pipelines (+10.8 FactConsolidation); "the bottleneck is assembly, not storage" | Entailed, **non-temporal** mutual exclusivity that serial order cannot see — must be demonstrated experimentally (§4.3 arm, §8 #13) |

**The Kumiho kill-move (rhetorical centerpiece):** the strongest recent graph-memory system *deliberately omitted* DL reasoning citing impossibility results, and has "no usage-gating or goal-conditioned schema" — it isolates our exact differentiators as its conscious omissions. We exhibit the precise slice where that omission costs correctness (disjointness propagated through inferred types — **not** simple same-subject functional violations, which any integrity check catches).

---

## 4. Experimental Protocol

Every number carries a **4-model matrix** (weak/mid/frontier-closed/open), **≥5 seeds**, **bootstrap 95% CIs**, and **paired significance** (paired bootstrap / McNemar) over hundreds-to-thousands of questions. The 8/8/2-question fixtures are retired from all quantitative claims.

### 4.1 The decisive crossover / scale study (paper spine, §3)
- Fact counts on a log grid (10¹…10⁵); sweep hop-depth (1…≥6), distractor density, **conflict density**. Model held fixed at each tier separately.
- Arms: `flat-all`, `flat-retrieved-BFS`, `full-materialize-reasoner`, **`neighbourhood-scoped-reasoner`**.
- Central deliverable: the crossover point where flat-all exceeds context and flat-retrieved-BFS mis-selects the relevant neighbourhood. **Note:** scaling noise alone will *not* collapse flat-retrieved (its cost is constant by design) — collapse must come from the relevant neighbourhood exceeding context or BFS heuristic mismatch.
- **Elevate to a falsifiable empirical law:** fit the crossover threshold on domain A, **predict it on held-out domain B and a different model tier, and show the prediction holds.** This is the KRR-recognized contribution; a shaded region on one synthetic generator is not.

### 4.2 CONFLICT-BENCH (the positive structural result, §5)
- **IVs, each swept:** conflict density, supersession-chain depth, number of conflicting writers, distractor/context pressure.
- **Three gold-label classes:** {surface-conflict + cite-both, abstain (unsupported), return-latest (temporally resolved)}.
- **Conflict types → rules:** functional-property violation (r08 non-merge), disjoint-class (r21, **requires r11 implemented first — see §5**), temporal supersession (r20).
- **Mandatory anti-gaming design (red-team non-negotiables):**
  - **Pre-register the difficulty function** before running any system. Report the *full* IV sweep including the low-density regime where Predicate ties/loses — the crossover is a contribution only if *discovered*, not chosen.
  - **False-positive slice:** near-duplicate values, unit/spelling variants ("v1.0" vs "v1.0.0"), two legitimately co-true multi-valued facts (two valid phone numbers) — r21 fires on bare `?va != ?vb`, so this exposes false flags.
  - **Independent gold labels** authored blind to the rules (second differently-implemented oracle or human labels), never from r21's own output.
  - **≥1 real-corpus conflict slice** from WikiContradict / ConflictBank (externally authored, un-gamed; both verified real and confirmed to be parametric-vs-context conflict, not agent memory — cite them as the adjacent line, not competitors).
  - **External validity:** measure naturally-occurring conflict density in a real multi-session corpus (replayed coding-agent transcripts, LongMemEval knowledge-update). If the crossover sits at 40% density but real workloads sit at 2%, say so and lower the claim.
- **Framing + reuse (post-validation):** "first memory-conflict benchmark" is unclaimable — MemConflict (2605.20926), STALE (2605.06527), and BEAM's contradiction slice exist. CONFLICT-BENCH's verified-unclaimed contribution is **conflict density + supersession-chain depth + mutual-exclusivity structure as manipulated IVs, detection P/R, the false-positive slice, and provenance-citation scoring**. Adopt (don't rebuild) the existing instruments: MemConflict's white-box gold-support protocol, Selective-QA's (2605.30087) selective-accuracy/coverage abstention metrics, MemoryAgentBench's FactConsolidation split.

### 4.3 Baselines (≥1 real system mandatory — vacuum eval = desk-reject)
- **Real systems:** Mem0 + Mem0g, Zep/Graphiti (closest competitor), A-Mem, HippoRAG2; Letta/MemGPT as reference floor.
- **Internal:** flat-all, flat-retrieved-BFS, full-materialize-reasoner, neighbourhood-scoped-reasoner.
- **Fairness protocol (the desk-reject landmine):**
  - **Reproduce each baseline's own published number on its own benchmark** (LongMemEval/LoCoMo) as harness validation *before* trusting it on CONFLICT-BENCH.
  - **Reproduce the field's known control** (Mem0g ≈ Mem0 on general QA) to certify the harness isn't handicapping graph systems.
  - Report each baseline in **both** its authors' recommended config **and** a matched-backend variant; show the conclusion holds in both. Pin versions in a lockfile; release adapters + raw outputs.
- **THE MANDATORY ARM (Reviewer #3's blocker):** a **conflict-aware-prompted** LLM over the *same* retrieved k-hop neighbourhood ("if sources disagree on a single-valued attribute, do not pick or average — report all values with sources"). Only the residual gap *after* this arm is a real symbolic contribution.
- **Information symmetry (Reviewer #2's blocker):** inject the functional/disjoint TBox declarations into every baseline's context. If Predicate's edge survives when the LLM is told the same constraints, it's real; if it collapses, the honest finding is "schema-in-context suffices" (publishable, but not our thesis).
- **NEW MANDATORY ARM (post-validation, from 2606.01435):** a **deterministic max-serial/last-write-wins** resolver over the same store — the "Don't Ask the LLM to Track Freshness" recipe, which beats LLM pipelines by +10.8 on FactConsolidation. Our thesis needs the slice where *serial order is insufficient* (entailed, non-temporal exclusivity); if Predicate doesn't beat this cheap arm there, the "assembly not storage" objection (§8 #13) stands and the symbolic claim dies.

### 4.4 Benchmarks (IDs verified 2026-07-11)
- **Primary:** LongMemEval-S (2410.10813, ICLR 2025; knowledge-update + abstention slices confirmed — cite V1, not the 2605.12493 V2 web-agent pivot).
- **Contradiction:** BEAM (2510.27246, ICLR 2026 — contradiction-resolution is 1 of 10 abilities, scores ≈0 at every context tier: lead the motivation with it); MemConflict (2605.20926 — white-box, separates answer-correctness from gold-support retrieval → maps onto `kg_explain`); **MemoryAgentBench FactConsolidation** (2507.05257, ICLR 2026 — **pin v1**: the Jun-2026 revision replaced "conflict resolution" with "selective forgetting"; its numbers — flat BM25 48% vs Zep 7%, multi-hop ≤7% for all 22 systems — are external replication of our negative result); **STALE** (2605.06527, stale-premise resistance) and **Selective-QA** (2605.30087, abstention scoring) as adjacent instruments.
- **Depth:** MetaQA (ships a ~135k-triple KG — load as RDF so reasoner and flat run over identical facts at 1/2/3-hop); MuSiQue 2–4hop (least gameable); 2WikiMultihopQA gold paths as an auditability oracle.
- **Temporal:** CronQuestions / TimeQuestions valid-time (r20); cite Supersede (2606.27472) for the "supersession gap" terminology — it owns the word in this space.
- **LoCoMo:** secondary comparability only, cleaned subset + programmatic judge, cite the 6.4%-wrong-key audit (Penfield Labs, Feb 2026, github.com/dial481/locomo-audit — 99/1,540 wrong gold answers; blog+repo grade, cite accordingly). Never a headline. **Never framed as Predicate-vs-RAG** — borrow only CRAG's question taxonomy and ALCE's citation metrics as instruments.

### 4.5 Metrics (report accuracy AND tokens AND latency together, always)
- Contradiction-detection **precision & recall separately** (so any operating point is computable); **false-positive rate**; wrong-answer-avoidance; correct-abstention.
- **Sweep the false-positive penalty** — report a full risk-coverage / PR curve and show *dominance across the whole curve*, never a single tuned operating point.
- A **downstream task-utility metric** where abstention has real opportunity cost (coding-agent setting) — an abstention-happy system must not win by construction.
- **Auditability:** ALCE-style citation recall/precision on `kg_explain`, checked by an **independent** OWL-2-RL reasoner (RDFox/Openllet), **not** Predicate's own engine (prover ≠ verifier). Redefine against ground truth: are the cited *source* triples actually correct; does the derivation cite the *right* supersession chain. Drop bare "proof-checkable-answer rate = 1.0" — it's tautological.
- **Determinism:** report only if made decision-relevant — show LLM baselines' residual non-determinism (temp-0, across paraphrase / fact ordering) *flips conflict outcomes* at a measured rate. Otherwise one sentence.

### 4.6 Completeness characterization (Reviewer #1/#2/#3 shared blocker)
The cost fix (scoping) and the guarantee (completeness) are in tension: scoped closure can only detect conflicts BFS co-retrieved. **Required:**
- Either **prove a locality property** — any r08/r21 conflict on subject *s* is detectable within a fixed k-hop ball of *s* (plausible for same-subject functional violations; much weaker for disjoint-class across chains), and show retrieval always pulls all provenance nodes attached to a retrieved subject — **or**
- Report the **scoped-vs-full-materialize recall cliff** as a first-class number vs graph-distance between the two conflicting triples, and scope the "guarantee" language honestly.

### 4.7 Ablations
- Reasoning scope: full-materialize vs scoped vs semi-naive/incremental (isolates cost fix).
- Rule ablations: toggle r08 / r11 / r20 / r21 individually (attribute detection gains to mechanisms).
- Confidence-gated closure ON/OFF.
- Extractor-quality ablation (end-to-end from raw text — extraction is non-deterministic and unmeasured today; report extraction P/R for the conflicting predicate and how many TBox axioms were hand-authored per domain).
- Gate-signal ablation (only if self-improvement is built): no-gate vs novelty-gate (SAGE) vs quality-gate (Kairos) vs usage-gate.

---

## 5. Engineering Roadmap (dependency-ordered)

Two independent P0 tracks (E1, E2) unblock everything. Critical path is months, not weeks.

| ID | Item | Priority / size | Depends on | Neutralizes |
|---|---|---|---|---|
| **E1** | **Unattended multi-model harness.** Generalize `completion-provider.ts` (hardcoded to `claude-haiku-4-5`) into a `ModelProvider` interface with pinned {vendor, model, temp=0, seed}. Replace the in-session hand-driven Tier2/flat flow (`DRIVING-TIER2.md`) with a direct API loop capturing raw request/response, version, seed, tokens, latency. ≥5 runs/condition. | P0/M | — | single-model, non-reproducible, weak-model confounds |
| **E2a** | **Semi-naive/delta materialization.** Replace naive `fixpoint.ts` (MAX_ITERATIONS=10, full re-COUNT each pass) with delta evaluation. Cite RDFox/DRed — **do not claim as novel.** | P0/L | — | O(n²) cost; "reinvented forward-chaining slowly" |
| **E2b** | **Query-scoped k-hop materialization** (the paper's method). Reason only over the retrieved neighbourhood via magic-sets/backward-chaining seeded from query subjects. **Must ship with the completeness characterization (§4.6).** | P0/L | — | "reasoner actively hurts" → defensible method |
| **E2c** | **Implement r11 as a firing rule** (currently `insertWhere: () => ''`). Without this, every disjoint-class claim has no running code. If not done, drop all disjoint-class claims and rest on r08 + r20 only. | P0/M | E2a | Reviewer #2's credibility-hit finding |
| **E3** | **Real-baseline harness** (`predicate-baselines`): common adapter, identical normalized format, **identical base model**, containerized (Zep needs graph DB, Mem0 needs vector store), version lockfile. | P0/L | E1 | vacuum-eval desk-reject |
| **E4** | **Public-benchmark loaders** (LongMemEval, BEAM, MemConflict, MetaQA-as-RDF, MuSiQue, CronQuestions; LoCoMo cleaned subset). | P0/L | E1 | comparability, external validity |
| **E5** | **Differentiator metric + oracle layer** (contradiction P/R, abstention, ALCE via **independent** reasoner, variance). Replace tautological Tier-1 oracle with independent/human gold. | P1/M | E4, E1 | Goodhart, unmeasured-guarantees |
| **E6** | **Adversarial CONFLICT-BENCH generator** (the spine). Pre-registered difficulty function; false-positive slice; real-corpus slice. Runs over E2 (cost not a confound), scored by E5. | P1/L | E2, E5 | the winning-framing evidence |
| **E7** | **Self-improvement: BUILD-OR-CUT (Gate 3). Default = CUT.** Prereq if building: fix Generalizer to type members + emit consuming axioms. Only build with schedule slack. | P1/L or 0.5-day cut | E1, E5 | vaporware desk-reject |
| **E8** | LUBM/OWL2Bench scaling validation — **only after E2**, gated on Gate 1. | P2/S | E2 | scalability kill-shot |
| **E9** | Reproducibility packaging: pinned configs, ≥5 seeds, raw outputs, AAAI checklist, `make evidence` entry point. | P2/M | E1, E3, E4 | statistical validity, reproducibility |

**Dependency order:** E1 ∥ E2 start now → E3/E4 (need E1's contract) → E5 (needs E4 gold) → E6/E7 (need E5 + E2) → E8/E9.

---

## 6. Related-Work Positioning + Must-Cite List

### The single most persuasive artifact: the properties × systems table (build first)
Rows: Predicate, Zep/Graphiti, Mem0/Mem0g, Letta, A-Mem, HippoRAG2, Cognee, GraphRAG, Kumiho, **TOKI, MRMS, Eywa, NeuSymMS, SLM-V3, Spectron, BeliefMem** (the 2026 conflict-aware cluster — including them is what makes the table credible). Columns: per-triple provenance | temporal validity | conflict-handling KIND {none / last-write-wins / temporal-supersession / LLM-judged / deterministic-definitional / deterministic-geometric / **deterministic-symbolic-ontological**} | preserves-vs-resolves | co-surfaces-as-conflict-object | determinism | machine-checkable derivation | OWL-grounded | **measured conflict metric (P/R)**. Only Predicate checks the last four decisive columns. Concede every crowded column honestly — TOKI gets deterministic+preserves, Eywa gets provenance, MRMS gets preserves — that's what makes the uncontested columns credible. Put Kumiho, TOKI, and Mem0g adjacent to Predicate.

### Opening related-work paragraph (the honest-concession → sharp-claim move)
Concede fast (provenance=Zep/**Eywa**, conflict-resolution=Mem0g, deterministic-detection=**TOKI/NeuSymMS/SLM-V3**, preservation-as-design=**MRMS/BeliefMem/Spectron**, ontology=Cognee/**2604.20795-as-proposal**, versioning=Kumiho/Letta/GitOfThoughts, self-evolution=EvolveMem/Kairos — "we claim novelty on none of these individually"), then claim narrow (the five-property composition, §3: ontology-DERIVED detection + preserve-and-co-surface + checkable derivation, evaluated as a measured property with controlled-density IVs), then the Kumiho kill-sentence.

### Must-cite (target 40–50 refs; unlimited references page — ALL IDs below verified 2026-07-11)
- **NON-NEGOTIABLE (omission = reject):** Zep/Graphiti (2501.13956); Mem0/Mem0g (2504.19413); Kumiho (2603.17244); EvolveMem (2605.13941); LLM-Modulo (2402.01817); Huang et al. (2310.01798); **TOKI (2606.06240); MRMS (2607.04617); MemConflict (2605.20926); Don't-Ask-Freshness (2606.01435); MemoryAgentBench (2507.05257, pin v1); GraphRAG-Bench (2506.05690)**.
- **2026 conflict-aware-memory cluster:** NeuSymMS (2605.17596); SLM-V3 (2603.14588 — quote its 30-system "no formal mechanism" survey line); BeliefMem (2605.05583); Eywa (2605.30771); ontology-as-memory (2604.20795 — cite as unrealized proposal); Spectron (SurrealDB product page); GitOfThoughts (2606.14470 — **trap:** its own result is memory does NOT improve accuracy; cite only for auditability-at-parity); Memanto (2604.22085); Mem0-v3 append-only shift (repo issues #4536/#4896).
- **Agent memory:** Letta/MemGPT (2310.08560); A-Mem (2502.12110); HippoRAG (2405.14831); HippoRAG2 (2502.14802); Cognee; GraphRAG (2404.16130); RAPTOR (2401.18059); Generative Agents (2304.03442); Reflexion (2303.11366).
- **Self-evolving:** Kairos (OpenReview EN9VRTnZbK — workshop-tier, NORA@NeurIPS'25); **both SAGEs, disambiguated** (2605.30711 novelty gate; 2605.12061 graph-memory engine — unrelated groups, same acronym); MemEvolve (2512.18746); STOP (2310.02304); Gödel Agent (2410.04444); ADAS (2408.08435); Darwin Gödel Machine (2505.22954); Voyager (2305.16291); Self-Evolving survey (2508.07407).
- **Crossover/boundary line (for §3 of the paper):** GraphRAG-Bench (2506.05690 — the closest work; descriptive, no fitted law, no conflict axis); GraphRAG-Router (2604.16401); LDAR (2509.21865, ICLR 2026); LC-vs-RAG (2501.01880 — the model-tier axis); Self-Route (2407.16833); RAG-considerate scaling laws (2604.00715 — fitted-law methodology precedent).
- **Neuro-symbolic/KR:** Logic-LM; RDFox/DRed (scaling concession); LogicRAG/"You Don't Need Pre-built Graphs for RAG" (AAAI-26, 2508.06105); CLAUSE (2509.21035); K-ON, TrustUQA (AAAI-25), Logical-SAGE (AAAI-26) as in-venue comparables; HermiT-over-LLM-outputs (2504.07640).
- **Ontology learning:** LLMs4OL — **method paper is 2307.16648 (ISWC 2023); 2409.10146 is the challenge overview — cite each for the right claim**; CQbyCQ; NeOn-GPT; ATLAS.
- **Benchmarks/metrics:** LongMemEval (2410.10813); BEAM (2510.27246, ICLR 2026); ConflictBank (2408.12076); WikiContradict (2406.13805); STALE (2605.06527); Selective-QA (2605.30087); Supersede (2606.27472); Memora (2604.20006, ACL 2026 Findings); MemSyco-Bench (2607.01071); ALCE (OpenReview bxFwIn0wZ0 / 2305.14627); LoCoMo (2402.17753) + Penfield audit (blog-grade).

**Integrity gate — SATISFIED 2026-07-11** (`docs/prior-art-validation.md`): every ID above verified live; zero hallucinations; the Kumiho DL-omission quote confirmed verbatim. **Standing rule: re-run the novelty/citation scans monthly and in the week before any submission** — the five closest threats all appeared within an 8-week window.

---

## 7. Paper Narrative

### Title
**Primary:** *"When Does Verifiable Memory Earn Its Cost? Contradiction-Preserving Reasoning Memory for LLM Agents."*
**Fallback A (benchmark-forward):** *"Surfacing Conflicts Instead of Averaging Them: A Benchmark and Method for Contradiction-Aware Agent Memory."*
**Fallback B (if conflict slice underperforms):** *"The Crossover: Locating When Structured Memory Beats In-Context Retrieval for LLM Agents."*
Banned from title/abstract/figures: *self-improving schema, autoresearch, compounding, sharpens itself, Predicate, MCP, OWL*.

### Abstract (drop-in draft)
> LLM agents increasingly rely on external memory, but which architecture is worth its cost remains unsettled. We first establish, honestly, that for general single-user recall a five-line k-hop retrieval neighbourhood with in-context reasoning matches or beats a deterministic OWL 2 RL reasoning memory at a fraction of the cost — a negative result we treat as a boundary to map, not hide. We then locate and characterize the regime where this reverses: as the density of conflicting, superseded, and mutually-exclusive facts grows, flat and vector memories (Mem0, Zep/Graphiti, A-Mem, HippoRAG2) — *including when explicitly prompted to surface disagreement* — increasingly return a stale or silently averaged answer, while a memory carrying per-triple provenance and deterministic contradiction rules surfaces the conflict, defeats superseded beliefs, and cites both sources. We contribute (i) a *predictive* crossover boundary, validated held-out across domains and model tiers; (ii) CONFLICT-BENCH, a rigorously-scored contradiction/knowledge-update benchmark with controlled conflict density; and (iii) neighbourhood-scoped reasoning, delivering deterministic detection at retrieval-level cost. We report contradiction-detection precision/recall, wrong-answer-avoidance under a false-positive penalty, correct-abstention, and independently-checkable derivation soundness. Our claim is not that structured memory recalls better; it is that on a precisely identified, predictable slice it is the only option that is auditable, reproducible, and does not average away contradictions.

### Section outline (7 content pages, AAAI two-column)
- **§1 Intro (~1p):** the question; the honest negative result up front; the reversal; three contributions; money figure teased.
- **§2 Related Work (~0.75p, dense):** four clusters (adding the 2026 conflict-aware-memory cluster); Kumiho/TOKI/MRMS/Eywa/GraphRAG-Bench/"You-Don't-Need-Graphs" engaged by name; Huang/Kambhampati reframed as support; the properties × systems table carries the argument.
- **§3 The Crossover (~1.5p):** formalize the regime; negative result as a controlled experiment; the *predictive* boundary + held-out validation.
- **§4 Method (~1.25p):** neighbourhood-scoped contradiction-preserving reasoning + the completeness characterization; scoped materialization framed as *applying* magic-sets (cite, don't claim novel).
- **§5 CONFLICT-BENCH (~0.75p):** construction, controlled variables, false-positive & real-corpus slices, why LoCoMo alone is insufficient.
- **§6 Experiments (~1.5p):** model matrix, fair baselines incl. conflict-aware-prompted arm + schema-symmetric baselines, per-ability tables, money figure.
- **§7 Limitations & Scope (~0.5p):** self-improving schema scoped OUT explicitly; temporal conceded as parity-with-Zep; where flat wins.

Cut ruthlessly: no MCP-tool architecture diagram, no OWL-rule catalog in body (appendix only).

### The money figure (Fig. 1, page 1–2)
Two stacked panels, shared x-axis = conflict/staleness density (0→high), **frontier model held fixed**.
- **Top panel** (y = wrong-answer-avoidance): Predicate roughly flat-high; Mem0, Zep, A-Mem, flat-retrieved, **and the conflict-aware-prompted baseline** decline as density rises. Annotate the crossover point.
- **Bottom panel** (y = token+latency cost, log): neighbourhood-scoped Predicate riding the flat-retrieved constant ~1.6k-token line, *not* the O(n²) curve — retires the cost objection in the same figure.

### Supporting figures/tables (keep to ~3 figs + 3 tables)
- **Fig. 2:** honest crossover / phase diagram (accuracy vs fact-count/hop-depth/distractor), flat-dominant region shaded — the conceded negative result as a predictive map.
- **Table 1:** baseline matrix on LongMemEval + BEAM, per-ability; bold Predicate wins ONLY on knowledge-update/abstention/contradiction; show parity/loss elsewhere.
- **Table 2:** what only a deterministic layer scores (contradiction P/R, FP-penalized avoidance, abstention, independently-checked derivation soundness, decision-relevant variance).
- **Fig. 3:** a worked `kg_explain` proof object for one conflict case.
- **Table 3:** model-strength sweep — the edge persists (or the honest report if it shrinks).

### Claims made / avoided
**Made:** (1) flat matches structure on general recall at lower cost; (2) an identified, predictable high-conflict regime where retrieval baselines return stale/averaged answers and Predicate holds; (3) contradiction detection + abstention + checkable derivation are measurable structural properties baselines lack; (4) scoped reasoning delivers these at retrieval cost; (5) the advantage persists across model tiers. Each maps to a figure/table *in* the submission.
**Avoided:** graph-recalls-better; self-improving-schema-as-capability; scalability (unless E2 lands); raw-LoCoMo SOTA; "new category never benchmarked against retrieval."

---

## 8. Reviewer Rebuttal Prep

Every objection below is answered by an experiment **already in the PDF** (the 2,500-char rebuttal is pure signposting to figures/tables).

| # | Top objection (from red team) | Pre-planned answer / where it lives |
|---|---|---|
| 1 | **Scoping destroys the completeness that is the whole point** (all 3 reviewers) | §4 locality proof for same-subject functional/disjoint conflicts + reported scoped-vs-full recall cliff (Table). We scope the "guarantee" claim to local conflicts explicitly; we do not claim both constant cost and global completeness. |
| 2 | **Baseline is a strawman — averaging is a prompt choice** (R#3 blocker) | The conflict-aware-prompted arm over the same neighbourhood is a headline baseline (Fig. 1). We decompose the win into retrieval-of-both-facts vs detection-given-both-facts; the paper rests on the latter. |
| 3 | **Information asymmetry — Predicate is handed the TBox** (R#2 blocker) | Schema-symmetric baselines: constraints injected into baseline context. Edge reported both ways; end-to-end extraction P/R + count of hand-authored axioms reported (Table). |
| 4 | **Benchmark tuned until baseline fails / synthetic** | Pre-registered difficulty function; full IV sweep incl. low-density loss region; real-corpus slice (WikiContradict/ConflictBank); external-validity measurement of real conflict density. |
| 5 | **Metrics only Predicate can emit are tautological; proof-check is circular** | Independent OWL-RL reasoner as checker (prover≠verifier); auditability redefined against ground-truth source correctness; determinism demoted unless shown to flip conflict outcomes. |
| 6 | **Edge is a weak-Haiku artifact; vanishes at frontier** | Table 3 model-strength sweep run *first* (Phase 0), reported in-paper; if it shrinks, we pivoted to crossover framing (Plan B) rather than dressing a null. |
| 7 | **Real baselines crippled by your harness** | Reproduced each baseline's own published number + the Mem0g≈Mem0 control as harness validation; both default and matched-backend configs reported; adapters + raw outputs released. |
| 8 | **r11 disjoint is a no-op in code** | Implemented as a firing rule with an isolating ablation (E2c), or all disjoint claims dropped and thesis rests on r08+r20. |
| 9 | **Temporal is parity-with-Zep dressed as a win** | Temporal positioned as an expected-parity control; the win is confined to co-current logical conflict + checkable-derivation kind-difference, with a last-write-wins + Zep baseline in the temporal table. |
| 10 | **Composition-only novelty is thin for main track** | The *predictive, held-out-validated crossover boundary* is the elevated scientific object + a small scoped-closure soundness/completeness result; scoped materialization explicitly cited as known technique. |
| 11 | **Abstention-happy metric wins by construction** | Full FP-penalty sweep showing curve dominance + a downstream task-utility metric where abstention has opportunity cost. |
| 12 | **Self-improving schema is bait-and-switch** | Banned from title/abstract/contributions; one clearly-labelled future-work sentence: "usage-gated evolution of the *ontology itself*, as opposed to evolving write policies [SAGE 2605.12061] or gating instance-level admission [SAGE 2605.30711]," citing EvolveMem/Kairos/MemEvolve. |
| 13 | **"The bottleneck is assembly, not storage — deterministic max(serial) already wins"** (2606.01435) | The mandatory max-serial/LWW arm (§4.3) + a dedicated CONFLICT-BENCH slice of *entailed, non-temporal* exclusivity (disjointness through inferred chains, co-current values with no ordering signal) where serial order is provably uninformative; report where the cheap recipe wins (temporal updates) and where only inference can flag. |
| 14 | **"A learned router IS a predictive boundary"** (GraphRAG-Router 2604.16401) | A router is per-deployment, opaque, and non-transferable; the fitted law names its variables (conflict density × hop depth × tier × co-retrieval probability) and is validated held-out on an unseen domain AND model tier (§3 table). We cite routers as the engineering consumers of exactly such a law. |

---

## 9. Timeline, Go/No-Go Gate, and Plan B

**Two-track plan. Do NOT register an AAAI-27 abstract** (a registered-then-withdrawn or desk-rejected abstract burns credibility).

### Track 1 — this cycle (stepping stones, packaging of work already done)
- AAAI-27 **workshop** (NeSy / agent-memory / LLM-reasoning; workshop papers est. ~late Oct 2026 per the AAAI-26 cycle) — plants a citable priority stake against the fast-moving conflict-aware cluster (TOKI/MRMS/Spectron).
- AAAI-27 **2-page Demo** (est. ~mid-Sep 2026) — working tool, low bar.

### Track 2 — the marquee (5-month evidence sprint)

| Window | Milestone | Owner deliverable |
|---|---|---|
| **Week 0** (by 2026-07-14) | Lock venue decision; commit to fused thesis; kill AAAI-27 main track in writing. | Shared burn-down doc. |
| **Weeks 1–3** (→~08-01) **Phase 0** | E1 (harness + model matrix) ∥ E2 (reasoner cost fix + E2c r11). Run the existing org three-way across the matrix immediately. | **Gate 1 (eng):** is reasoner cost within ~2× of flat-retrieved at scale? If NO → cut all scalability language, reallocate to conflict suite. |
| **Weeks 4–8** (→~09-05) **Phase 1** | E6 CONFLICT-BENCH + E3 real baselines + LongMemEval/BEAM, per-ability, ≥5 seeds, CIs, the conflict-aware-prompted + schema-symmetric arms. | **⟵ GATE 2 (the go/no-go).** |
| **Weeks 9–12** **Phase 2** | Auditability (independent checker), temporal control, MemConflict white-box, package benchmark. **Gate 3:** self-improvement BUILD-OR-**CUT** (default cut). | Reviewer-demanded experiments locked in. |
| **Weeks 13–16** **Phase 4a** | Write 7-page paper + reproducibility checklist; double-blind hygiene. | Submission-ready draft. |
| **Weeks 17–18** **Phase 4b** | Internal red-team: 3 reviewers own the 15 pre-mortem objections, score Strong-Accept…Strong-Reject; every FATAL/SEVERE must have an in-paper answer. | Rebuttal template. |
| **Early Dec 2026** | Submit to **Plan-B archival venue.** | Banked reviews + publication. |
| **Dec 2026 – Jun 2027** | Incorporate reviews; add ≥1 real non-synthetic corpus; expand matrix. | AAAI-28 hardening. |
| **~Jul 2027** | **AAAI-28** abstract + full paper (KRR primary). | Marquee submission. |

### GATE 2 — the binding go/no-go (end of Week 8, ~2026-09-05)
- **GO-FOR-AAAI** only if Predicate shows a **statistically significant win on contradiction-detection P/R and wrong-answer-avoidance over ALL of (a) a strong-model conflict-aware-prompted flat baseline, (b) at least Mem0 + Zep/Graphiti, AND (c) the deterministic max-serial/LWW arm on the entailed-exclusivity slice**, on CONFLICT-BENCH and LongMemEval knowledge-update, robust across ≥2 model tiers, **surviving schema-symmetric baselines**.
- **MARGINAL** (beats naive flat but ties real KG systems / ties the conflict-aware-prompted arm): pivot to the **crossover-characterization runner-up thesis**, target an archival Plan-B venue, not AAAI.
- **FAIL** (no regime where structure wins at frontier strength): publish the honest negative characterization at NeSy/ISWC/NeurIPS-E&D (the renamed Evaluations & Datasets track); AAAI off the table this cycle.
- **Binding — no "we'll fix it in writing."**

### Plan B venues (in priority order; dates verified/estimated 2026-07-11)
1. **ESWC 2027** research + resource track — **abstract gate est. ~late Nov 2026** (a week before the ~early-Dec full deadline; plan the writing schedule to the November date). The embedded benchmark suits the resource track; semantic-web audience rewards OWL provenance. **Front-runner.**
2. **COLM 2027** (est. ~late Mar 2027).
3. **KR 2027** (est. ~Feb 2027) / **NeSy 2027** (est. ~Jun 2027), or **NeurIPS 2027 "Evaluations & Datasets" track** (the D&B track was renamed in 2026; NeurIPS 2027 is in Europe, est. ~early May 2027) — natural home for CONFLICT-BENCH if the paper degrades to benchmark-only, and the target of the two-paper split's benchmark half in the GO case.

Sequence venues so review windows don't overlap (all four majors verified to forbid concurrent archival submission; all explicitly allow arXiv + non-archival workshops, so Track 1 and preprinting are safe).

---

## 10. Prioritized P0 / P1 / P2 Action Checklist

### P0 — start now, unblock everything (Weeks 0–3)
- [ ] **Lock the fused thesis in writing**; ban "graph recalls better," "self-improving schema" from all paper artifacts (Week 0).
- [ ] **E1:** unattended multi-model harness (≥4 tiers, pinned model/temp/seed, ≥5 runs), replacing the hand-driven flow.
- [ ] **E2a+E2b:** semi-naive + neighbourhood-scoped materialization; **ship the completeness characterization with it**.
- [ ] **E2c:** implement r11 as a firing rule OR drop all disjoint-class claims.
- [ ] Run the org three-way across the model matrix immediately (cheapest, highest-information experiment) → feeds Gate 1 & Gate 2 pilot.
- [ ] **E3:** real-baseline harness (Mem0/Mem0g, Zep/Graphiti minimum) with identical backend + version lockfile.
- [ ] **E4:** LongMemEval + BEAM (2510.27246) + MemConflict + MemoryAgentBench-FactConsolidation (pin v1) + MetaQA-as-RDF loaders.
- [x] **Verify post-cutoff citations** — DONE 2026-07-11 (`docs/prior-art-validation.md`): zero hallucinations, Kumiho quote verbatim, claim rewording + new must-cites applied to §3/§6.
- [ ] **Standing:** re-run the novelty/citation scans monthly and in the week before any submission (the TOKI/MRMS/Spectron cluster appeared inside 8 weeks).

### P1 — the evidence body (Weeks 4–16)
- [ ] **E6 CONFLICT-BENCH** with pre-registered difficulty function, false-positive slice, independent gold labels, real-corpus slice.
- [ ] Add the **conflict-aware-prompted** arm and **schema-symmetric** baselines (the two blockers), plus the **deterministic max-serial/LWW arm** (the third blocker, from 2606.01435 — see §4.3 and §8 #13).
- [ ] Reproduce each baseline's own published number + the Mem0g≈Mem0 control (harness validation).
- [ ] **E5:** differentiator metrics via independent OWL-RL checker; FP-penalty sweep + risk-coverage curves; decision-relevant determinism only.
- [ ] End-to-end extraction P/R + hand-authored-axiom count (extractor-quality ablation).
- [ ] Rule ablations (r08/r11/r20/r21) + scope ablations.
- [ ] Fit + **held-out-validate the predictive crossover boundary** across domains/tiers (the elevated contribution).
- [ ] Temporal as a **control** (last-write-wins + Zep baselines); confine wins to co-current logical conflict.
- [ ] **E7 / Gate 3:** cut self-improvement to one future-work sentence (default).
- [ ] Write 7-page paper + money figure + reproducibility checklist; double-blind hygiene.
- [ ] Internal red-team against the 15 pre-mortem objections.
- [ ] Submit Track 1 workshop + demo (Aug–Oct, parallel).
- [ ] Submit to Plan-B archival venue (early Dec).

### P2 — hardening / next cycle (Weeks 9+ and Dec–Jun)
- [ ] **E8:** LUBM/OWL2Bench scaling curve — only after E2, only if scalability is claimed.
- [ ] **E9:** reproducibility packaging (`make evidence`, raw outputs, AAAI checklist).
- [ ] Add ≥1 real non-synthetic corpus (replayed coding-agent transcripts on Predicate's home turf, or S2ORC/OpenAlex citation-graph slice).
- [ ] Coding-agent memory external-validity domain (SWE-style multi-session task-completion metric).
- [ ] Only if a monotone compounding effect is de-risked in a spike: build + measure the self-improvement loop with gate-signal ablation for AAAI-28.

---

**Bottom line for the team:** the artifact's honest negative result is not the obstacle — it is the paper. Commit to the fused conflict-surfacing + predictive-crossover thesis, bake every red-team fix into the *submission* (not the rebuttal), treat Gate 2 as binding, bank a Plan-B publication this winter, and aim the hardened paper at AAAI-28. The three blockers that will otherwise sink us regardless of how good the numbers look are: (1) scoping-vs-completeness, (2) the conflict-aware-prompted baseline, and (3) schema symmetry. Solve those three and the borderline paper becomes a defensible one.
---

# ADDENDUM — Citation-Integrity Audit (2026-07-11, web-verified)

Every load-bearing citation was verified against arXiv / OpenReview / GitHub by a web-grounded
audit agent. Corrections below OVERRIDE the body text wherever they conflict.

## Verdict table (Tier 1 — load-bearing)

| Item | Verdict | Correction to apply |
|---|---|---|
| **Kumiho** (arXiv 2603.17244) | CONFIRMED | Quote is real but phrase precisely: Kumiho sidesteps DL **to keep AGM-revision compliance** (cites Flouris et al. impossibility) — it does not claim DL reasoning is useless. Soften "won LoCoMo" → "self-reported SOTA on LoCoMo retrieval categories (0.447 F1, n=1,540; single-author vendor preprint)". Usage-gating confirmed absent — our differentiator stands. |
| **EvolveMem** (arXiv 2605.13941) | **MISCHARACTERIZED** | It evolves the **retrieval configuration** (fusion weights, context budgets, answer styles) via an LLM diagnosis loop; the memory taxonomy is six FIXED categories. "Schema" appears nowhere. Its own first-claim: "first memory framework that autonomously evolves its retrieval infrastructure." **It does NOT own the self-improving-schema concept — §1/§3/§6's "EvolveMem already named the concept" is wrong. The TBox-evolution angle is more open than the plan assumed.** Still cite as adjacent read-side evolution. |
| **Kairos** (OpenReview EN9VRTnZbK, NORA@NeurIPS'25 oral) | CONFIRMED | Precision: it gates **ABox-level graph consolidation** on validated reasoning (+ Hebbian strengthen/decay) — not TBox/schema growth. Workshop-scale. Bonus quotable finding: "novelty and correctness are orthogonal dimensions that degrade when averaged." |
| **SAGE** | CONFLATED — two papers | 2605.30711 = "SAGE: A Novelty Gate for Efficient Memory Evolution" (write-side novelty gate, beats Mem0 on LoCoMo, no schema evolution). The "self-evolving agent" phrasing belongs to a DIFFERENT paper: 2605.12061 "SAGE: A Self-Evolving Agentic Graph-Memory Engine". Cite both, distinctly. |
| **MemConflict** (arXiv 2605.20926) | CONFIRMED | All claimed properties hold (dynamic/static/conditional conflicts; white-box separates answer-correctness from gold-support retrieval). |
| **BEAM** | CONFIRMED — real ID: **arXiv 2510.27246, ICLR 2026** | Gift for the motivation section: contradiction-resolution is 1 of 10 abilities and scores are **near zero at every context tier including 100K**. |
| **GitOfThoughts** (arXiv 2606.14470) | CONFIRMED — with a trap | Its headline result: memory does **NOT** improve accuracy across 5 substrates; it argues for git purely on auditability at accuracy parity. Never cite it as evidence versioned memory improves performance — cite it as convergent support for auditability-not-accuracy positioning. |
| **"You Don't Need Pre-built Graphs for RAG"** | CONFIRMED | = LogicRAG, AAAI-26 proceedings (Vol 40 No 36 pp 30270-30277), arXiv 2508.06105. |
| **Mem0g** (inside arXiv 2504.19413) | CONFIRMED | LLM ADD/UPDATE/DELETE/NOOP conflict resolution = destructive overwrite (our exact contrast). Control result holds: LoCoMo single-hop Mem0 67.13 vs Mem0g 65.71; overall J 66.88 vs 68.44. |

Tier 2: 19/20 IDs verified exactly (Zep 2501.13956, Mem0 2504.19413, LongMemEval 2410.10813,
HippoRAG 2405.14831, HippoRAG2 2502.14802, A-Mem 2502.12110, MemGPT 2310.08560, GraphRAG
2404.16130, RAPTOR 2401.18059, STOP 2310.02304, Gödel Agent 2410.04444, ADAS 2408.08435, DGM
2505.22954, LLM-Modulo 2402.01817, Huang 2310.01798, ConflictBank 2408.12076, WikiContradict
2406.13805, LoCoMo 2402.17753, ALCE 2305.14627). **One flag:** 2409.10146 is the LLMs4OL-2024
*challenge overview*; the original LLMs4OL method paper is **2307.16648 (ISWC 2023)** — cite the
right one for the right claim.

## NEW novelty threats the plan missed (examine before claiming any "first")

1. **TOKI** (arXiv 2606.06240, Jun 2026) — "A Bitemporal Operator Algebra for Contradiction
   Resolution in LLM-Agent Persistent Memory." The closest direct threat to the
   contradiction-handling claim. Must read and differentiate: TOKI *resolves* via bitemporal
   algebra; we *preserve + surface + cite both* with deterministic OWL detection. Verify that
   distinction survives a full read.
2. **Eywa** (arXiv 2605.30771) — "Provenance-Grounded Long-Term Memory for AI Agents." Directly
   overlaps the per-triple-provenance differentiator. Must read before any provenance-first claim.
3. **Ontology-as-memory** (arXiv 2604.20795, Apr 2026) — "Automatic Ontology Construction Using
   LLMs as an External Layer of Memory, Verification, and Planning." Closest existing work to
   "OWL-backed agent memory"; must-address in related work.
4. **MemEvolve** (arXiv 2512.18746) — "Meta-Evolution of Agent Memory Systems"; plus MemSkill
   (2602.02474), AutoMem (2607.01224), HeLa-Mem (2604.16839), MemSyco-Bench (2607.01071 —
   sycophantic overwrites = our "static conflict" case). The self-evolving-memory space is
   crowded; the schema/TBox angle still looks open but needs explicit differentiation from
   MemEvolve.

## Strategic deltas from this audit

- **Novelty position improved:** the body text's strongest stated threat (EvolveMem owning
  schema-evolution) is void. TBox-level usage-gated evolution remains unclaimed — but it is still
  unmeasured in our artifact, so it stays future-work for this cycle (Gate 3 unchanged).
- **Motivation strengthened:** BEAM (ICLR 2026) shows contradiction-resolution ≈ 0 across all
  context sizes — the field-level version of our pilot finding. Lead the motivation with it.
- **Two reads required before the abstract is drafted:** TOKI and Eywa. If either preempts the
  "preserve + cite both + deterministic detection" composition, the §3 claim wording must adapt.

---

# ADDENDUM 2 — Full Prior-Art & Novelty Validation (2026-07-11, six-agent sweep)

A second, broader validation ran the same day (six agents: citation verification ×2,
adversarial landscape audit, conflict-thesis novelty scan, crossover novelty scan, venue CFP
verification). **Full report: `docs/prior-art-validation.md`.** It corroborates Addendum 1 and
adds the following, which OVERRIDE/extend the body text:

1. **TOKI, Eywa, ontology-as-memory, SAGE-2605.12061 reads — ALL RESOLVED (claim survives;
   details in `prior-art-validation.md` §3a).** TOKI: deterministic but definitional detection
   (same s+p, different o, Allen-overlap), elects winners — not ontological inference. Eywa
   (2605.30771): per-fact provenance + deterministic plumbing but NO contradiction detection,
   no logic, winner-elected lifecycle → **per-fact provenance is table stakes; claim it only
   as a component, never standalone.** Ontology-as-memory (2604.20795): *proposes* OWL/SHACL
   validation over LLM-built memory but gate-and-reject semantics (inverse of
   preserve-and-surface), nothing implemented/measured, whitepaper-grade → cite as the
   proposal we realize and invert. SAGE 2605.12061 (distinct from the 2605.30711 novelty
   gate — disambiguate the acronym): evolves write policies/reader weights, not schema; no
   conflict handling. Defensible core = the P2+P3+P5 conjunction (reasoner-DERIVED conflicts,
   preserve-and-co-surface with no winner, checkable derivation over provenanced triples).
2. **The claim wording must change** — "first deterministic contradiction detection" is now
   falsifiable (TOKI; NeuSymMS 2605.17596 = CLIPS-rules detection but retracts the loser;
   SLM-V3 2603.14588 = zero-LLM geometric detection). Use the five-property composition:
   deterministic + ontology-grounded logical semantics (conflicts derivable through inference
   chains) + preserve-and-co-surface (no winner election) + per-triple provenance +
   machine-checkable derivation. No system or paper has the composition.
3. **New closest-neighbour cluster (May–Jul 2026) for §6's table:** MRMS 2607.04617 ("conflict
   preservation, not resolution" — closest design thesis), TOKI 2606.06240, Don't-Ask-Freshness
   2606.01435, NeuSymMS 2605.17596, SLM-V3 2603.14588, BeliefMem 2605.05583, STALE 2605.06527,
   Supersede 2606.27472 (owns "supersession" terminology), Selective-QA 2605.30087,
   **Spectron (SurrealDB, preview)** — a shipping preserve-and-surface product with per-fact
   provenance but LLM-detected; the nearest commercial neighbor, watch it.
4. **New mandatory rebuttal rows:** (a) 2606.01435's "the bottleneck is assembly, not storage"
   (max(serial) beats LLM pipelines by +10.8 on FactConsolidation) — answer: serial-number
   determinism cannot catch entailed, non-temporal exclusivity; this needs an experiment.
   (b) "A learned router IS a predictive boundary" (GraphRAG-Router 2604.16401) — answer:
   routers are per-deployment and opaque; a law names variables and transfers across
   domain/tier.
5. **Crossover-law status: unclaimed.** Closest = GraphRAG-Bench 2506.05690 (descriptive
   guidelines, no fitted law, no conflict axis, RAG-not-memory). The conflict-density axis of
   any crossover analysis is unclaimed anywhere. Negative result now externally corroborated:
   MemoryAgentBench (2507.05257, ICLR 2026) FactConsolidation — flat BM25 48% vs Zep/Graphiti
   7%, Mem0 18%; multi-hop conflict ≤7% for all 22 systems. (Version trap: v1 abstract lists
   "conflict resolution"; the Jun-2026 revision renamed it "selective forgetting" — pin v1.)
6. **CONFLICT-BENCH scope confirmed:** "first memory-conflict benchmark" is dead (MemConflict,
   STALE, BEAM slices). Unclaimed and verified: conflict density + supersession-chain depth as
   manipulated IVs, detection P/R, false-positive slice, provenance-citation scoring. Reuse
   MemConflict/BEAM/STALE/Selective-QA/MemoryAgentBench as external instruments.
7. **Landscape audit (shipping systems):** Zep, Mem0, Letta, Cognee, HippoRAG2, A-Mem, LangMem,
   OpenAI Dreaming V3, Anthropic memory tool, MemOS, Supermemory, Hindsight — all LLM-judged,
   last-write-wins, or nothing. Cognee runs NO reasoner (extraction-time fuzzy type-grounding
   only). **Mem0 v3 (2026) moved to append-only with NO conflict resolution** (repo issues
   #4536/#4896) — production systems are abandoning write-time conflict handling; use as
   motivation. SLM-V3's 30-system survey quote ("no formal mechanism for detecting
   contradictions") is citable motivation too.
8. **Venues verified:** AAAI-27 abstract 2026-07-21 CONFIRMED (skip stands); NeurIPS D&B renamed
   **"Evaluations & Datasets"** (2026), NeurIPS 2027 in Europe; ICLR 2027 ~Sep 2026 (est.),
   ICML 2027 ~Jan 2027 (est., Position track alive through 2026); ESWC 2027 abstract gate ~late
   Nov 2026 (a week earlier than the plan's Dec assumption); dual-submission rules at all four
   majors allow arXiv + non-archival workshops → two-paper split (benchmark → NeurIPS E&D,
   method → AAAI-28) is legal.
9. **Re-scan cadence:** five closest threats appeared within ~8 weeks. Re-run novelty scans
   monthly and in the week before any submission.
