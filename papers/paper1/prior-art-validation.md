# Prior-Art Validation Report — 2026-07-11

> **How this was produced.** Six parallel research agents with live web search (arXiv,
> Semantic Scholar, OpenReview, GitHub, product docs), each returning structured verdicts
> with URL evidence: (1) competitor-system citation verification, (2) benchmark citation
> verification + benchmark novelty scan, (3) memory-system landscape audit (adversarial:
> tried to falsify our differentiator), (4) conflict-surfacing thesis novelty scan,
> (5) crossover-study novelty scan, (6) venue CFP verification.
> This validates and amends `docs/aaai-strategy.md` (its citation-integrity warning is
> now resolved — see §1).
>
> **Reconciliation note.** A separate single-agent citation audit ran the same day in a
> parallel session (Addendum 1 in `aaai-strategy.md`). The two agree everywhere they
> overlap. Findings unique to that audit, folded in below: the **SAGE conflation** (two
> distinct papers: 2605.30711 novelty gate vs 2605.12061 self-evolving graph-memory
> engine); **Eywa** (2605.30771, provenance-grounded memory); **ontology-as-memory**
> (2604.20795); **GitOfThoughts** (2606.14470 — trap: its own result is that memory does
> NOT improve accuracy; cite only for auditability-at-parity); the **MemEvolve cluster**
> (2512.18746, MemSkill 2602.02474, AutoMem 2607.01224, HeLa-Mem 2604.16839); and the
> **LLMs4OL ID flag** (2409.10146 is the challenge overview; the method paper is
> 2307.16648, ISWC 2023). Eywa, ontology-as-memory, and SAGE-2605.12061 deep-reads were
> dispatched 2026-07-11 — see §3a.

---

## 0. Executive verdict

| Question | Answer |
|---|---|
| Are the strategy doc's citations real? | **Yes — all of them.** Zero hallucinated references. Every checked ID (Kumiho, EvolveMem, Kairos, SAGE, MemConflict, Zep, Mem0, LongMemEval, LoCoMo, ConflictBank, WikiContradict, LLM-Modulo, Huang et al., LogicRAG/AAAI-26) resolves to a real paper at the claimed ID. Four claims need *corrections* (§1). |
| Is the fused thesis (conflict-surfacing + predictive crossover) already published? | **No — still unclaimed as of 2026-07-11, but the window is closing fast.** Five near-misses appeared May–Jul 2026 (§3). No PREEMPTS-CORE found by any scan. |
| Is a CONFLICT-BENCH equivalent already published? | **Partially.** "First memory-conflict benchmark" is dead (MemConflict, STALE, BEAM slices exist). The specific IV combination — conflict density + supersession-chain depth as *manipulated variables*, detection P/R, false-positive slice, provenance scoring — is verified unclaimed (§4). |
| Is the predictive crossover law already published? | **No.** The question is recognized and descriptively answered (GraphRAG-Bench); nobody has fitted + held-out-validated an interpretable boundary. The conflict-density axis of any crossover analysis is completely unclaimed (§5). |
| What can we REUSE instead of building? | Substantial list — see §2. The negative result is now externally corroborated and no longer needs heavy in-house proving. |
| Do the venue-plan dates hold? | **All confirmed or cycle-consistent.** AAAI-27 abstract = 2026-07-21 (10 days away; plan correctly skips it). One rename: NeurIPS D&B track is now **"Evaluations & Datasets"** (§7). |

---

## 1. Citation integrity: verified, with four corrections

All six load-bearing competitor citations CONFIRMED at claimed IDs. Corrections to apply in `aaai-strategy.md`:

1. **Kumiho does NOT use git-versioning.** arXiv 2603.17244 is graph-native versioning (immutable revisions, mutable tag pointers) and explicitly positions *against* git-style versioning — the git reference in the paper is its characterization of **Letta**. The §3 positioning table row is wrong as written.
2. **Kumiho's DL-omission quote is verified verbatim** (the kill-move survives): *"a trade-off of expressiveness for tractability that avoids the Flouris et al. impossibility results for description logics."* Also confirmed: no usage-gating/schema content anywhere in the paper. But "won LoCoMo" must be qualified: it claims "highest reported score across the retrieval categories" (0.447 four-category token-F1), not universal SOTA.
3. **EvolveMem (2605.13941) evolves retrieval configurations, not schemas.** Its "self-evolving memory" co-evolves stored knowledge + retrieval mechanism via LLM failure-diagnosis of *system configs*. It owns the NAME, not the schema-evolution concept — Predicate's usage-gated schema lifecycle is less contested than the strategy doc assumed. (Adjacent: EvoMemBench, 2605.18421.)
4. **Kairos is a NeurIPS 2025 *workshop* paper** (NORA'25, OpenReview EN9VRTnZbK): validation-gated *Hebbian edge-weight consolidation*, not schema evolution. Workshop-tier evidence; cite accordingly. **SAGE (2605.30711)** confirmed: a vMF-density novelty gate as a pluggable write-control component, not a full self-evolving agent.

Other verifications: Mem0's graph variant is written **Mem0^g** in the paper (2504.19413); its paper-era conflict handling is verbatim LLM-judged ADD/UPDATE/DELETE/NOOP with destructive DELETE. The **LoCoMo 6.4% audit is real** — Penfield Labs, ~Feb 2026: 99/1,540 questions (6.4%) have wrong gold answers; the gpt-4o-mini judge accepted 62.81% of intentionally-wrong vague answers. It is a **blog + repo** (github.com/dial481/locomo-audit), not peer-reviewed — cite with that caveat. **BEAM** = arXiv 2510.27246, **ICLR 2026**, with named Contradiction Resolution + Abstention ability slices. **LogicRAG** ("You Don't Need Pre-Built Graphs for RAG") confirmed at AAAI-26 (2508.06105, DOI 10.1609/aaai.v40i36.40278) — a *method* paper (inference-time query-DAG decomposition); it does NOT map when graphs help, which leaves our slot open.

**New fact worth adding to the strategy doc:** Mem0 **v3 (2026) moved to append-only writes with NO conflict resolution at all** — semantic contradictions coexist as separate vectors (dedup = MD5 of fact string; corroborated by repo issues #4536/#4896). Production systems are *abandoning* write-time conflict handling, which strengthens our motivation.

---

## 2. Already published — reuse, don't rebuild

Directly answering "make sure these concepts are already published so we don't redo the work":

| Planned work | Already exists — reuse | What remains ours to build |
|---|---|---|
| Generic memory-conflict benchmark | **MemConflict** (2605.20926): controlled multi-session conflicts, white-box gold-memory retrieval scoring, 6 systems evaluated. **STALE** (2605.06527): stale-memory invalidation + premise-resistance probing. **BEAM** (2510.27246, ICLR 2026): contradiction-resolution + abstention slices at 10M-token scale. | CONFLICT-BENCH narrows to the unclaimed IV combination (§4) and uses these as external slices. |
| Abstention-under-conflict metrics | **Selective-QA testbed** (2605.30087): 34,560 instances, controlled distortions, selective-accuracy/coverage metrics. LongMemEval abstention slice. | Detection P/R + FP-penalty sweep + provenance-citation scoring (nobody has these). |
| Proving flat ≈/> graph on recall & conflicts | **MemoryAgentBench** (2507.05257, ICLR 2026), FactConsolidation: flat BM25 48% vs HippoRAG-v2 54%, Mem0 18%, **Zep/Graphiti 7%**; multi-hop conflict ≤7% for ALL 22 systems. GraphRAG-Bench (2506.05690): vanilla RAG matches graphs on simple retrieval. | Cite as external replication; run our own arm only for the controlled sweep. **Citation trap:** MemoryAgentBench v1 abstract lists "conflict resolution"; the Jun-2026 revision replaced it with "selective forgetting" — pin the version. |
| Deterministic-beats-LLM-judgment evidence | **"Don't Ask the LLM to Track Freshness"** (2606.01435): max(serial) beats LLM pipelines by +10.8 pts on FactConsolidation. | We must *rebut* its "the bottleneck is assembly, not storage" claim: serial-number determinism cannot catch entailed, non-temporal mutual exclusivity (multi-hop disjointness). This is now a mandatory experiment + rebuttal row. |
| Real-corpus conflict data | ConflictBank (2408.12076, NeurIPS 2024 D&B) + WikiContradict (2406.13805) — confirmed, and confirmed to be parametric-vs-context knowledge conflict, NOT agent memory (safe to use as adjacent real-corpus slices, exactly as planned). | Session-ized replay into memory systems. |
| "Fitted empirical law" methodology precedent | RAG-considerate pretraining scaling laws (2604.00715) — proves the fitted-law paper shape is publishable. | Our object (inference-time memory-architecture boundary) is different. |
| LLM-needs-external-verifier argument | LLM-Modulo (2402.01817, ICML 2024 spotlight) + Huang et al. (2310.01798, ICLR 2024) — both confirmed. **Nobody has applied it to memory belief adjudication.** | That application is ours. |

---

## 3. The new competitor cluster (May–Jul 2026) — must-cite, must-position

The conflict-aware-memory space went from empty to crowded in ~8 weeks. None preempts the core; each occupies 1–2 axes:

| System/paper | ID | What it does | Axis it occupies | Why the thesis survives |
|---|---|---|---|---|
| **MRMS** | 2607.04617 | "Conflict preservation, not resolution"; contradiction/supersession edges; 800-task self-built diagnostic | Closest on *design thesis* | No symbolic reasoner (relations asserted, not derived); suppresses superseded value; no checkable derivation; no regime analysis |
| **TOKI** | 2606.06240 | Bitemporal triples, K-semiring provenance; deterministic same-(s,p)-different-o + Allen-overlap detection; typed resolution operators; loser kept in audit row | Closest on *mechanics* | Detection is key-collision, not ontological inference; elects winners (resolution-oriented); research artifact, self-described underpowered comparison |
| **Don't-Ask-Freshness** | 2606.01435 | Deterministic max(serial) aggregation beats LLM conflict pipelines | Deterministic-beats-LLM beat | No logic, single winner, nothing surfaced; must be rebutted head-on (§2) |
| **NeuSymMS** | 2605.17596 | CLIPS rules + string similarity detect conflicts in enterprise platform | "Neuro-symbolic memory" branding | Latest-value-wins, RETRACTS loser; heuristic not logical semantics; "full quantitative evaluation left to future work" |
| **SLM-V3** | 2603.14588 | Zero-LLM geometric contradiction score (sheaf discrepancy, threshold 0.45); SUPERSEDES edges, history kept | Deterministic detection | Geometric heuristic, no logical semantics/derivation. Gift quote: surveyed 30+ systems, "no formal mechanism for detecting contradictions" |
| **Spectron** (SurrealDB) | product, preview | "Cross-provenance conflicts emit explicit uncertainty rather than silently picking a winner"; per-row source objects | Closest *shipping* preserve-and-surface | LLM-extraction pipeline, no evidence of deterministic detection, no ontology, lineage ≠ derivation. **Watch closely.** |
| **BeliefMem** | 2605.05583 | Surfaces competing candidates with probabilities (noisy-OR) | Preserve-and-surface | LLM-extracted, timestamps-only provenance, no code |
| **Supersede** | 2606.27472 | Names + quantifies the "supersession gap" (LongMemEval KU 92%→77%) | Owns "supersession" terminology | Diagnostic + RL environment, not controlled-IV benchmark |
| **MemSyco-Bench** | 2607.01071 | Memory-induced sycophancy incl. memory-vs-evidence conflicts | Adjacent eval | Different framing |
| **Memora** | 2604.20006 (ACL 2026 Findings) | FAMA metric penalizing stale-memory reliance | "Benchmarks over-reward recall" position | Cite and build on; do not claim this position as novel |

Landscape audit of shipping systems (Zep, Mem0, Letta, Cognee, HippoRAG2, A-Mem, LangMem, OpenAI memory "Dreaming V3", Anthropic memory tool, MemOS, Supermemory, Hindsight): **every one is LLM-judged, last-write-wins, or has no conflict handling at all.** Cognee's "RDF/OWL-backed" claim is extraction-time type grounding via fuzzy matching — **no reasoner is run**. OpenAI's Dreaming V3 silently rewrites memories and reduces the audit trail — usable as motivation.

**Required claim rewording** (the old phrasing is now falsifiable): replace *"first to do deterministic contradiction detection"* with the five-property composition — no system performs contradiction detection as **(1) deterministic, (2) ontology-grounded symbolic inference (conflicts derivable through inference chains), (3) with both values preserved AND co-surfaced as a first-class conflict object (no winner election), (4) per-triple provenance, (5) a machine-checkable derivation citing the asserted triples that produce the conflict.** Cite TOKI, NeuSymMS, SLM-V3, Spectron, Kumiho, BeliefMem, MRMS as the emerging cluster that each hit 1–2 axes. Add these as rows to the properties × systems table (§6 of strategy doc).

---

## 3a. Deep-reads of the three flagged unread threats (resolved 2026-07-11)

The parallel audit (Addendum 1) required reads of Eywa, ontology-as-memory, and the second
SAGE before drafting any claim. All three are now read from fetched arXiv text. **None
preempts the five-property composition.** The two real threats attack it from opposite
sides and cancel out:

- **Eywa (2605.30771, May 2026) — OVERLAPS-PARTIAL.** "Evidence before belief": immutable
  evidence rows, per-fact provenance links, four deterministic write-time validation gates,
  zero-LLM deterministic retrieval, active/superseded belief lifecycle whose superseded
  facts are *returned alongside* current ones for contradiction-intent queries. Strong on
  provenance (P4) and deterministic plumbing — but it has **no contradiction detection step
  at all**, no ontology/logic (conflict = same-slot value change it was told about), a
  winner-elected lifecycle rather than a first-class conflict object, and no derivations
  ("no explanation of why they conflict"). Consequence: **per-fact provenance is now table
  stakes — claim it only as a component of the composition, never standalone.**
- **Ontology-as-memory (2604.20795, Apr 2026, Salovsky & Gorshkova) — OVERLAPS-PARTIAL
  (conceptual only).** *Proposes* SHACL + OWL-reasoner validation (Jena/Pellet named as
  examples) over LLM-built agent memory, abstract claims "contradiction control" — the
  closest conceptual collision with P2. But semantics are **gate-and-reject** (failing
  facts quarantined to logs; conflicting values never co-resident — the inverse of P3),
  nothing is implemented or measured (no conflict metrics; only a Tower-of-Hanoi chart the
  authors call "descriptive evidence"), and the PDF carries machine-translation leftovers —
  whitepaper-grade. Position: cite it as the proposal; we are the first *realized and
  measured* version, with inverted preserve-and-surface semantics.
- **SAGE, the graph-memory engine (2605.12061, May 2026) — ADJACENT-CITE.** Confirmed
  distinct from the SAGE novelty gate (2605.30711); two unrelated groups, same acronym.
  It co-trains an LLM memory *writer* and a graph-foundation-model *reader* in alternating
  self-evolution rounds — evolves write policies and reader weights over a fixed triple
  vocabulary. No schema/TBox evolution, no conflict handling, document-level source anchors
  only. The usage-gated-TBox future-work sentence should read: "usage-gated evolution of
  the ontology itself, as opposed to evolving write policies [2605.12061] or gating
  instance-level admission [2605.30711]."

**Net effect on the claim:** the defensible core is the conjunction **P2+P3+P5** —
conflicts *derived* by a deterministic OWL 2 RL reasoner (including through inference
chains), materialized as first-class objects with both values preserved and no winner
elected, each carrying a machine-checkable derivation down to individually-provenanced
asserted triples. No paper found by any of the seven agents has any one of
P2-as-implemented, P3, or P5 — let alone the conjunction.

## 4. CONFLICT-BENCH novelty status

Verified unclaimed by any existing benchmark (checked against MemConflict, BEAM, STALE, Selective-QA, MemoryAgentBench, Memora, LongMemEval full text/abstracts):

- Conflict **density** as a manipulated independent variable — nobody has it
- Supersession-chain **depth** as a manipulated IV — nobody (Supersede controls length/size, not depth)
- Contradiction-detection **precision/recall** as a first-class metric — nobody (MemConflict's CRS is recognition-among-candidates)
- **False-positive slice** (apparent-but-not-real conflicts) — nobody (STALE's premise-resistance is adjacent)
- **Provenance-citation scoring** — nobody

Already covered elsewhere (adopt, don't claim): abstention (BEAM, LongMemEval, Selective-QA), premise rejection (STALE), white-box gold-support separation (MemConflict), conflict typology (MemConflict's dynamic/static/conditional).

**Framing:** "controlled psychometric IVs + detection-P/R + provenance scoring," never "first conflict benchmark."

---

## 5. Crossover-law novelty status

**Nobody has published a fitted, held-out-validated predictive boundary for structured-vs-flat memory.** The landscape:

- **GraphRAG-Bench** (2506.05690) — the single closest work and the one the related-work section lives or dies on. Asks literally our question, answers descriptively (graphs win at multi-hop/synthesis complexity; vanilla RAG matches on simple facts), explicitly fits no law, validates nothing held-out, has no conflict axis, and is RAG-over-corpora, not agent memory.
- **GraphRAG-Router** (2604.16401) — RL router choosing among GraphRAG variants + model sizes. Anticipated reviewer objection: *"a learned router IS a predictive boundary."* Preempt: a router is per-deployment, opaque, and doesn't transfer; a law names its variables and survives domain/tier transfer. Add as rebuttal row.
- Individual axes all occupied descriptively: hop depth (GraphRAG-Bench), distractors (LDAR, 2509.21865, ICLR 2026), model tier ("cheat-sheet effect": 2501.01880 — weak models gain from retrieval, strong models don't), conflict (MemoryAgentBench). **The composition + parameterization + held-out prediction is the novel object; the conflict-density axis is unclaimed anywhere.**
- The in-context-vs-symbolic equivalence boundary ("LLM over retrieved triples matches symbolic closure up to depth d / size n / conflict c") — **no direct preemption found**; one of our most defensible pieces.

The honest negative result is now externally corroborated (GraphRAG-Bench + MemoryAgentBench numbers), which converts it from contrarian concession to replicated fact — strictly good for the paper.

---

## 6. Changes required in `docs/aaai-strategy.md`

1. §Editor's-notes citation warning → resolved; point here. (Applied 2026-07-11.)
2. §3 positioning table, Kumiho row: "git-versioning" → "graph-native versioning (explicitly anti-git)". (Applied.)
3. §2: EvolveMem "owns the concept and the name" → "owns the name; evolves retrieval configs, not schemas". (Applied.)
4. Must-cite list: add MRMS, TOKI, Don't-Ask-Freshness, NeuSymMS, SLM-V3, Spectron, BeliefMem, STALE, Supersede, Selective-QA, MemoryAgentBench, GraphRAG-Bench, GraphRAG-Router, LDAR, Memora, MemSyco-Bench, Penfield LoCoMo audit (blog-grade), Mem0-v3 append-only shift.
5. Rebuttal table: add two rows — "assembly not storage" (2606.01435) and "a router is already a predictive boundary" (2604.16401).
6. Novelty claim (§3): adopt the five-property composition wording from §3 above.
7. Venue terminology: NeurIPS "Datasets & Benchmarks" → **"Evaluations & Datasets"** (renamed 2026); NeurIPS 2027 is in Europe.
8. **Re-scan cadence:** the five closest threats appeared within 8 weeks. Re-run the novelty scans monthly and mandatorily in the week before any submission.

## 7. Venue dates (verified 2026-07-11)

- **AAAI-27:** abstract **2026-07-21**, full 2026-07-28 (CONFIRMED — plan correctly skips main track). Workshop papers est. ~late Oct 2026; demo est. ~mid-Sep 2026 (both ESTIMATE from AAAI-26 cycle).
- **AAAI-28:** not announced; est. abstracts ~Jul 2027.
- **NeurIPS 2026:** deadlines passed (May 4/6). Track renamed "Evaluations & Datasets". **NeurIPS 2027: Europe**, est. ~early May 2027.
- **ICLR 2027:** West Coast North America; est. abstract ~Sep 19 2026, full ~Sep 24 2026 (not yet official).
- **ICML 2027:** announcement due Aug 2026; est. ~late Jan 2027. Position Paper track ran through 2026, same deadlines as main.
- **ESWC 2027:** est. abstract ~late Nov 2026 (one week before the ~early-Dec full deadline the plan assumed — tighten).
- **ISWC 2027** est. ~May 2027; **KR 2027** est. ~Feb 2027; **NeSy 2027** est. ~Jun 2027; **COLM 2027** est. ~late Mar 2027.
- **Dual-submission:** AAAI/NeurIPS/ICLR/ICML all confirmed to forbid concurrent archival submission and all explicitly allow arXiv + non-archival workshops → the workshop-stake + two-paper-split plan is legal everywhere.

## 8. Bottom line

The strategy survives validation almost fully intact — unusually, every citation was real. The thesis is **still unclaimed but urgent**: five adjacent papers landed May–Jul 2026, and one shipping product (Spectron) is one deterministic-reasoner away from the differentiator. The two cleanest pieces of unclaimed ground are (1) the **ontology-derived, machine-checkable conflict object** and (2) the **conflict-density axis / predictive crossover law** — exactly the fused thesis. The evidence sprint should start now; the window is measured in months, not years.

---

## Novelty refresh — 2026-07-12 (ActMem deep-read + rescan)

> **How this was produced.** Single adversarial agent, one day after the main sweep, tasked
> against the *proposed contribution* of `top-venue-publication-plan.md` §5 (formal
> conflict-completeness definition, Conflict Witness Index, minimal proof-witness retrieval
> under bounded context) rather than the shipped system. Two-pass: (1) deep-read of ActMem
> (abstract page + arXiv HTML full text), resolving plan §4 item 9; (2) fresh WebSearch
> rescan across eight phrasings: conflict-aware agent memory, contradiction detection in
> memory-augmented LLMs, knowledge-conflict benchmarks, temporal conflict/editing,
> entity-resolution-aware retrieval, inconsistency-tolerant QA, proof/witness-producing
> retrieval, certified/provable retrieval guarantees. Threat scale for this section:
> **HIGH** = overlaps the formal-guarantee-plus-witness contribution; **MEDIUM** = overlaps
> the benchmark or empirical framing; **LOW** = adjacent.

### R1. ActMem deep-read (arXiv 2603.00026) — threat downgraded to MEDIUM, benchmark axis only

**Bibliographic facts.** "ActMem: Bridging the Gap Between Memory Retrieval and Reasoning in
LLM Agents." Zhang, Sun, Yang, Jin, Zhang, Hu. v1 2026-02-04, **v2 2026-06-17** (paper nearly
doubled in size — actively maintained, almost certainly in review at an ML venue; expect a
published version to collide with our benchmark-related-work window). cs.CL/cs.AI/cs.IR.

**What it builds.** A four-stage LLM pipeline: (1) LLM fact extraction from dialogue into
atomic declarative facts (pronouns resolved, timestamps normalized); (2) incremental
embedding clustering (threshold 0.2); (3) a hybrid **causal-semantic KG** — nodes are
extracted facts, undirected semantic edges by cosine > 0.3, directed causal edges proposed
by an LLM and validated by a PMI score over LM likelihoods (kept if > 0.2); (4)
**counterfactual retrieval**: top-K vector retrieval, then an LLM counterfactual prompt
("if the user does q, what negative consequences might occur…"), then secondary retrieval
over graph neighbors (fixed K = 20 then 10).

**Conflict handling — the load-bearing finding.** The abstract's phrase "resolve potential
conflicts between past states and current intentions" is doing all the work. Verified
against the full text:

- **No conflict detection formalism at all.** No definition of conflict, no rules, no
  constraints, no keys. "Conflicts" are implicit constraint violations between a *stored
  past state* and a *current user intention*, surfaced by LLM commonsense/counterfactual
  reasoning (canonical example: user wants a Sago Palm; memory says user has a puppy; LLM
  world knowledge supplies the toxicity link).
- **No resolution policy** — no overwrite, supersede, preservation, or winner election;
  the "resolution" is a safety-aware natural-language reply.
- **No provenance, no timestamps used for conflict, no derivations returned.** The paper
  never tracks which edge or step produced a detected conflict.
- **Zero formal results.** Mathematical notation for the pipeline, an O(|F|·K) clustering
  remark, empirical ablations — no theorem, no soundness/completeness claim of any kind.
  Verified: the words are simply absent.
- Self-declared limitations: LLM extraction/causal errors propagate to the graph; higher
  token cost than compression baselines.

**Benchmark (the part that actually matters to us).** **ActMemEval**: 327 questions,
~67 sessions / ~120k tokens per sample; generated event chains (Gemini 3.1 Pro) validated
by a second LLM (Claude Sonnet 4.5), rendered into dialogues with noise sessions. Six
categories of *implicit-constraint* scenario (safety-health risk, feasibility limit,
time-space-procedure mismatch, access/availability gap, preference incompatibility,
benefit-reuse). Metrics: evidence recall + QA accuracy. Design signature: **mean
query-evidence similarity 0.232, deliberately engineered so similarity retrieval cannot
find the evidence** — the same "engineered against the baseline" pattern our plan flags as
reviewer objection §4.2, published anyway. Baselines: NaiveRAG, MemoryBank, Mem0, A-Mem,
SimpleMem, LightMem — all retrieval-flavored; no deterministic/symbolic arm, no SQL/SHACL
oracle, no key-aware retrieval.

**Differentiation — what we have that ActMem lacks:** a definition of conflict; a
deterministic, ontology-grounded detector; conflict objects with both values preserved;
per-triple provenance; machine-checkable derivations; any formal guarantee; conflicts
*between two stored assertions* at all (ActMem's conflicts are memory-vs-intention and
need world knowledge, not mutual exclusivity between records). **What ActMem has that we
must now cite/compare:** (1) it owns the "memory retrieval → reasoning-for-action"
benchmark framing, and its six categories overlap our planned downstream-decision tasks
(plan §7) — our benchmark section must cite ActMemEval and explicitly scope our tasks to
*witness-groundable* conflicts (both sides of the contradiction exist as stored assertions)
vs. their commonsense-groundable constraints, which our formal fragment intentionally does
NOT cover; this is exactly the boundary of the completeness guarantee and should be stated
as such, not hidden. (2) Its low-similarity design is precedent that hard-for-similarity
benchmarks publish — but also a warning that reviewers now recognize the pattern; our
key-aware/lexical/hybrid baseline battery (plan §8) is non-negotiable. (3) It is a sixth
member of the "structured memory + reasoning" cluster (with MRMS, TOKI, SLM-V3, Kumiho,
Mem0^g) for the properties × systems table: score it P1 ✗ (LLM end-to-end), P2 ✗ (no
detection), P3 ✗ (no conflict object), P4 ✗ (no provenance), P5 ✗ (no derivation).

**Verdict on plan §4 item 9:** resolved. ActMem does NOT preempt the formal contribution,
the CWI, or witness retrieval. It preempts nothing formal because it contains nothing
formal. Threat: **MEDIUM (benchmark framing only)**; must-cite.

### R2. Fresh scan table (hits not already in §1–§5 above)

| # | Work | ID / venue | One-line description | Threat |
|---|---|---|---|---|
| 1 | **ActMem** | 2603.00026, v2 Jun 2026 | LLM causal-semantic memory graph + counterfactual retrieval; ActMemEval implicit-constraint benchmark; zero formal content | **MEDIUM** (benchmark) |
| 2 | **ConflictRAG** | 2605.17301, May 2026 | Inter-document RAG conflicts: MLP+LLM detector (88.7% detection F1), Entropy-TOPSIS credibility *winner election*, CARS metric | **MEDIUM** — owns "conflict-detection F1" in RAG; forces rescoping of our §4 claim (see R4) |
| 3 | **TCR "Seeing through the Conflict"** | 2601.06842 | Parametric-vs-context conflict handling via contrastive encoders + soft prompt; reports conflict-detection F1 (+5–18) | **MEDIUM** (metric overlap; different conflict type) |
| 4 | **Faithful-reasoning conflict benchmark** | 2604.11209, SIGIR 2026 | Benchmark instantiating conflicts between textual and KG evidence; LLMs fail to pick reliable evidence | **MEDIUM** (benchmark; RAG-side, not memory) |
| 5 | **MemIR / provenance-role collapse** | 2605.25869, May 2026 | Typed memory atoms (evidence vs cue vs claim), claim-level factual authorization, provenance-scoped retrieval; eval on LoCoMo + BEAM | **MEDIUM** — further confirms per-fact provenance is table stakes (with Eywa); no conflict detection, no guarantees |
| 6 | **DeferMem** | 2605.22411 | RL-learned query-time distillation of a small sufficient evidence set for long-term memory QA | **MEDIUM** — empirical "minimal evidence" framing, learned & guarantee-free; cite as the learned counterpart to witness minimality |
| 7 | **Preferences over conflicting facts** | 2508.07742 | KR: rule-based preference specification + querying inconsistent KBs under preferred-repair semantics | **MEDIUM** (theory side; mandatory formal-section comparison, no LLM/retrieval/budget angle) |
| 8 | **open-ontologies** (fabio-rovai) | GitHub, v1.0 Jun 2026, 188★ | Rust MCP server: Oxigraph store, OWL2-DL tableaux + OWL-RL, SHACL, `dl_explain` explanations, lineage audit — **our exact stack, shipping** | **MEDIUM** (engineering lane, like Spectron: explanation-producing MCP reasoner exists in the wild; no memory semantics, no conflict objects, no benchmark, no paper) |
| 9 | ASP(Q) for inconsistent prioritized data | 2604.21603 | Classical repair computation via quantified ASP | LOW (theory, cite) |
| 10 | Inconsistent DBs via argumentation | 2605.03954 | Repairs ↔ argumentation-framework extensions with collective attacks | LOW (theory, cite) |
| 11 | Certified-RAG cluster | ReliabilityRAG 2509.23519; RobustRAG 2405.15556; C-RAG 2402.03181; 2508.01084 | Provable *robustness/security* guarantees for RAG under adversarial corruption | LOW — different property certified; pre-empt reviewer confusion: "formal guarantees for retrieval exist" ≠ conflict completeness |
| 12 | Temporal fact-conflict reproducibility | 2603.15892 | DYNAMICQA vs MULAN updateability claims don't generalize across construction choices | LOW (methodology caution for our temporal slice) |
| 13 | QA under temporal conflict | 2506.07270 | Evaluating/organizing evolving knowledge with LLMs | LOW |
| 14 | Explicit conflict resolution at inference | 2606.20245 | Navigating unreliable parametric vs contextual knowledge | LOW |
| 15 | Micro-Act | 2506.05278 | Actionable self-reasoning to mitigate RAG knowledge conflict | LOW |
| 16 | DynamicER | 2410.11494 | Entity-resolution of emerging mentions for RAG | LOW (occupies ER-aware-retrieval axis empirically; no conflict use) |
| 17 | Portable Agent Memory | 2605.11032 | Provenance-verified memory transfer protocol across agents | LOW |
| 18 | SSGM memory governance | 2603.11768 | Governance framework for evolving agent memory (drift risks) | LOW (motivation cite) |
| 19 | Evidence-tracing / execution-provenance survey | 2606.04990 | Survey: memory items as evidence with provenance chains incl. conflicts | LOW (must-cite framing survey) |
| 20 | Foundation-agent memory survey | 2602.06052 | "Second half" memory-mechanism survey; circulates the term **"implicit conflict"** (later observation invalidates earlier memory w/o explicit negation) | LOW (must-cite; adopt/attribute terminology) |
| 21 | CRDL / LLM-assisted incremental KG fusion | S2667305326000499 | Relational-constraint detection + LLM-based resolution during KG construction | LOW |
| 22 | ImplicitMemBench | 2604.08064 | Unconscious behavioral adaptation from memory | LOW |

**HIGH hits found: none.** No 2025–2026 work combines (a) a formal completeness/soundness
statement about *what a retrieval policy must return* with (b) conflict/witness objects and
(c) bounded context. The certified-RAG line is the only place "provable + retrieval"
co-occur, and it certifies robustness to adversarial passages, not conflict coverage.

### R3. The real adversarial pressure on the formal contribution (no single killer paper, but…)

The scan's most dangerous finding is not a new paper — it is that **every ingredient of the
§5 formal contribution has a classical name**, and a KR/DB reviewer will supply them:

- **"Conflict witness" ≈ justification / MinA** (axiom pinpointing, Horridge & Parsia line),
  **≈ minimal unsatisfiable subset (MUS)**, **≈ minimal conflict set** in model-based
  diagnosis (Reiter 1987), **≈ why-provenance witness basis** in the semiring framework
  (Green–Karvounarakis–Tannen) — TOKI already imports K-semirings into agent memory.
- **"Minimal proof DAG" ≈ proof extraction** in consequence-based reasoners (ELK et al.).
- **"Conflict completeness" of a store ≈** complete conflict enumeration in diagnosis;
  inconsistency-tolerant semantics (AR/IAR/brave) already define query answering over
  conflicting KBs, with 2508.07742 / 2604.21603 / 2605.03954 as live 2025–26 continuations.
- The CWI itself, per plan §5's own admission, may reduce to standard incremental view
  maintenance / incremental join over key-equivalence classes.

**Survival condition:** the paper must claim ONLY the bridge — *conflict completeness as a
property of a retrieval policy under a token/context budget* (whenever a witness relevant
to the query exists in the store, the policy returns enough of it for a sound detector,
within budget), plus the lower-bound result that retrievers not indexing the
witness-connecting relation cannot be conflict-complete (proved so far only for the
IRI-adjacency policy class — formal doc Prop. 3; the general form is a Phase-1 proof
obligation), plus the update/query cost study.
The definitions section must cite justifications, MUS, diagnosis, why-provenance, and
AR/IAR semantics as the raw material and say explicitly which composition is new. Verified
by search: **the phrases "conflict-complete retrieval", "conflict completeness" (in this
sense), and "conflict witness index" are unclaimed**; nobody has a completeness statement
about retrieval-for-detection under bounded context. If the paper instead claims the
witness *concept* or the index *data structure* as novel, it dies at the first KR reviewer.

### R4. Corrections this refresh forces in §4 above

The 2026-07-11 claim "contradiction-detection precision/recall as a first-class metric —
nobody" is now falsified as literally worded: **ConflictRAG (88.7% detection F1) and TCR
(+5–18 detection F1) both report it in the RAG setting.** Rescope to: "detection P/R over
*agent-memory stores* with provenance-witness-citation scoring — still nobody" (MemConflict
remains recognition-among-candidates; no memory benchmark scores whether the cited witness
is the correct one). The unclaimed IV list (density, chain depth, FP slice, provenance
scoring) survives unchanged.

### R5. Verdict

**The conflict-completeness + proof-witness framing survives, with three mandatory edits.**

1. **ActMem is not a preemption; it is a must-cite benchmark neighbor.** Add it to the
   properties table (✗ on all five), cite ActMemEval in the benchmark section, and use the
   memory-vs-intention / commonsense-conflict boundary to state what our guarantee
   deliberately excludes.
2. **Rescope the detection-metric novelty claim** per R4 before anything is drafted.
3. **Pin the formal novelty to the retrieval-policy bridge** per R3, with the classical
   lineage cited in the definitions, or the formal contribution will be reviewed as a
   renaming exercise.

Residual risks worth a standing watch: ActMem v3/camera-ready (benchmark slot), Spectron +
open-ontologies (engineering lane converging on deterministic-reasoner-with-explanations),
and the May–Jul 2026 cadence itself — re-run this scan monthly and before any submission,
as §6.8 already mandates.
