# Paper 1 — Experiment Log

Append-only. Every entry: date, setup, numbers, honest read. This is the evidence trail
for the fused conflict-surfacing + predictive-crossover thesis (see `aaai-strategy.md`).

---

## 2026-07-11 — Pilot A: org three-way across model strength (key-free, in-session frontier subagents)

**Setup.** Org fixture (8 facts / 8 questions, final episode). Flat arm = full TBox+ABox
in context, model answers directly (`flat emit/score org`). Reasoner reference = Tier 1
golden SPARQL. Frontier tier = 3 blind in-session subagents (identical answers across
all 3 → treated as deterministic at this scale).

**Result.** Reasoner 1.00 on 8/8. Frontier flat 0.88 (7/8), missing ONLY org-q02
(functional-conflict). Conflict slice:

| question | rule | reasoner | frontier flat | advantage |
|---|---|---|---|---|
| org-q06 (disjoint classes) | r11 | 1.00 | 1.00 | **0.00** |
| org-q02 (two managers) | (r22 now) | 1.00 | 0.00 | 1.00 → **artifact** |

**Honest read.** The org-q02 "win" was an information-asymmetry artifact: `reportsTo`
was never declared single-valued, so the flat model reasonably declined to call two
managers a conflict. Adding one sentence of schema to the prompt → the model flags it.
Under information symmetry, the conflict edge at this scale is ~0. Prompted the r22 rule
(domain-level `j:SingleValued` conflicts) and the schema-symmetry protocol.

## 2026-07-11 — Engine numbers (E2a semi-naive fixpoint), this machine

Subclass-chain materialization, embedded in-memory oxigraph, full RULES:

| chain | naive (old) | semi-naive (new) | iterations |
|---|---|---|---|
| 100 | 431 ms | **126 ms** | 3 |
| 200 | 3,972 ms | **625 ms** | 3 |
| 500 | ~400 s (documented SCALE-FINDINGS env) | **8.5 s** (~47×) | 3 |
| 1000 | infeasible (WASM crash) | **65 s** | 3 |

Identical least fixpoint proven vs the preserved naive engine (5-seed random-world
equivalence property test + adversarial verifier probe). Notable: pure semi-naive
delta-joins bought only ~2× on transitive chains (cost = join-row enumeration, not
guards); the win came from routing r01/r02 through oxigraph's native property-path
evaluator over a lean work graph. r03/r05 (variable predicates) keep doubling
delta-joins. oxigraph 0.5.8 WASM dies on ~40M-row joins and dense path queries —
the lean-work-graph design is what keeps 1000-chains feasible.

## 2026-07-11 — Pilot B: CONFLICT-BENCH v1 density sweep (key-free, schema-symmetric flat-ALL arm)

**Setup.** CONFLICT-BENCH v1: 40 persons, ~120 base facts, planted same-subject
conflicts on `j:SingleValued` properties at densities d ∈ {0.05, 0.20, 0.50} (2/8/20
subjects), FP near-miss slice (duplicate re-assertions, multi-valued second values,
cross-subject shared values). Schema symmetry BY CONSTRUCTION: single/multi-valued
semantics stated in `world.ttl` rdfs:comments, which the flat context embeds verbatim.
Flat arm = one blind frontier in-session subagent per density, full KB in context.
Reasoner = Tier 1 golden SPARQL over materialized `j:ValueConflict` flags (r22).

**Result: PERFECT TIE at every density.**

| density | reasoner | frontier flat | advantage |
|---|---|---|---|
| 0.05 | 1.00 | 1.00 | 0.00 |
| 0.20 | 1.00 | 1.00 | 0.00 |
| 0.50 | 1.00 | 1.00 | 0.00 |

Including the 20-subject enumeration at d=0.50 (perfect precision AND recall) and zero
false positives on every near-miss probe.

**Honest read (the decisive one).** In the fits-in-context regime, SAME-SUBJECT
conflict detection with schema-in-context is *solved* by a frontier model at any
density. The structural edge does not live there. Remaining hypothesis space:

1. **Cross-subject conflicts that require inference to even see** — co-referent records
   (`owl:hasKey` → `sameAs`) holding conflicting values on *different IRIs*, connected
   only by a shared key literal. Graph-local retrieval around one record never reaches
   the other (literals are not BFS-traversable); keyed inference fires regardless of
   graph distance. → CONFLICT-BENCH v2's design center.
2. **Scale + retrieval mediation** — flat-all overflows context / degrades; the
   operationally-shipped arm is retrieval (the repo's own SCALE-FINDINGS conclusion),
   and retrieval-mediated flat structurally misses (1).
3. **Real-system ingest pipelines** (Mem0 LLM ADD/UPDATE/DELETE, Zep invalidation) —
   destructive resolution at WRITE time; the edge vs LLM-memory-writes, not vs flat
   context. → E3.

**Gate-2 implication.** The easy versions of the thesis are dead (good — a reviewer
would have killed them for us). The claim MUST be staked on (1)+(2)+(3), with the
schema-symmetric strong-model flat arm always reported.

## 2026-07-11 — Pilot C: CONFLICT-BENCH v2 cross-record pilot (key-free, frontier in-session subagents)

**Setup.** conflict-xr-small: 60 persons, 12 conflicted record-pairs co-referent ONLY
via a shared email literal; session-2 records sparse (share NO IRI object with their
twin). Three arms, all schema-symmetric (world.ttl states the key + single-valued
semantics): reasoner (Tier 1 golden over materialized flags; chain r14 hasKey→sameAs,
r23 value propagation, r22 flag), flat-ALL (whole KB in context, 28KB), and
flat-RETRIEVED (k=2 IRI-frontier ball around each question's named record — the arm a
practitioner ships at scale, per SCALE-FINDINGS). A DETERMINISTIC test proves the twin
record is outside every k<=2 ball (literals are not traversable edges).

**Result (scored through the harness):**

| arm | aggregate | q02/q03 planted | q01 enumeration | q06 both-values | FP probes |
|---|---|---|---|---|---|
| reasoner | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 |
| flat-ALL | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| flat-RETRIEVED | **0.58** | **0.00** | 0.00 | **0.67** | 1.00 |

The retrieved arm's own reasoning transcript states the mechanism: "only one record
with email p002@ex.com … no conflicting office visible." It scored 1.0 on everything
retrieval CAN see — the 0.42 gap is pure structural miss, not model weakness. q06's
0.67 is the quantified "confidently returns one value, silently missing the conflict"
failure (also its inference-OFF Tier-1 value: 2/3, by construction).

**Honest read.** First measured cell where structure wins under full information
symmetry against a frontier model: key-mediated cross-record conflicts are invisible
to graph-local retrieval at any k below the (deterministically characterized) reach,
while keyed inference is graph-distance-independent. Flat-ALL still ties — at 60
persons everything fits in 28KB; the flat-ALL boundary needs the scale sweep
(conflict-xr-scale at 300 persons ships committed; 10^4+ and/or distractor-pressure
sweeps are the follow-up). The claim this supports today: **structure > retrieval-
mediated flat on cross-record conflicts at ANY store size; structure = flat-all only
while the whole store fits (and at 10-100x the token cost).** Next: k-sweep
(retrieval cost grows with k while the reasoner's is flat), xr-scale run, n>=5 seeds,
multi-tier models, then the Mem0/Zep ingest arms (E3).

**Infrastructure note.** Evening slowdowns (10-100x) were traced to the default
backend auto-spawning a native oxigraph daemon over .predicate/store, silently
switching all test processes from per-process :memory: WASM stores to one shared
on-disk RocksDB store. Test configs now pin oxigraph-wasm + :memory: (hermetic);
r23 also gained delta variants. All 412 tests green in ~35s total.

## 2026-07-11 — Pilot D: Mem0 ingest arm (E3), conflict-d20 — the write-time destruction, measured

**Setup.** Mem0 OSS classic 1.0.11 (the two-phase ADD/UPDATE/DELETE pipeline described
in arXiv 2504.19413) with local Ollama (qwen3.5, nomic-embed-text), fully key-free.
All 135 conflict-d20 facts rendered to natural language and add()ed in episode order;
every memory operation the LLM chose captured to an ops log; verdicts computed from
the full final store + recorded search() views against the oracle's 8 planted
same-subject conflicts. Version note (itself a finding): mem0ai 2.0.11's OSS add() is
ADDITIVE-ONLY — the V3 pipeline ships the update prompt but never calls it — so the
destructive behavior the literature describes exists only in classic <=1.x; 2.x
appends both values but never flags disagreement (a second failure mode of the same
bar, queued as a secondary arm).

**Result (8 planted conflicts):**

| verdict | count |
|---|---|
| preserved-both (the bar) | **0** |
| silently-resolved-to-one | **7** |
| lost-both | 1 |

Direction of resolution is ARBITRARY: the stale value won 3/7, the new value 4/7 —
not even consistent last-write-wins. One additional ingest-fidelity loss was captured
mid-run (a fact silently dropped via a NONE decision). Cost note: ~26s/fact through
the local-LLM write pipeline (~59 min for 135 facts) vs milliseconds for kgAssert.

**Honest read.** The three-arm contrast is now measured end to end on the same
fixtures: Predicate detects, preserves BOTH values, flags, and cites (1.00);
retrieval-mediated flat is structurally blind to cross-record conflicts (0.58,
Pilot C); Mem0's write-time LLM destroys the conflict before any reader can see it
(0/8 preserved). Caveats for the paper version: local-model extractor (a frontier
extractor may resolve "better" but the failure is architectural — the pipeline's job
is to pick, and nothing surfaces the discard); n=1 run; classic-version arm (2.x arm
= preserved-but-never-surfaced, to be measured). Zep/Graphiti arm blocked on Docker.
conflict-xr-small (cross-record, email-keyed) chains next: the question is whether
LLM extraction even LINKS two records sharing a key.

## 2026-07-11 — Pilot E: statistical hardening — multi-seed, k-sweep, xr-scale (16-agent workflow)

**Setup.** New `xr-stats` runner (committed; adversarially verified incl. independent
reproduction, prompt-leakage checks, oracle-enumeration and CI-math audits). Five
independent conflict-xr-small worlds (seeds 11/23/37/42/59; different planted pairs
per seed) + conflict-xr-scale (300 persons). Per seed: Tier1 reference, deterministic
k-sweep over EVERY co-referent pair (60 conflicted + 15 benign pairs small; 60 + 3 at
scale, both directions), and blind frontier arms (flat-all, flat-retrieved k=2) —
12 blind LLM runs total, scored through the harness. Seeded 10k-resample bootstrap.

**Result: exact replication at 5/5 seeds and at 5x scale — zero across-seed variance.**

| arm | aggregate | conflict slice (q01/q02/q03/q06) | FP | recall |
|---|---|---|---|---|
| reasoner | 1.000 (all seeds + scale) | 1.000 | 1.000 | 1.000 |
| flat-ALL | 1.000 [1.000, 1.000] | 1.000 | 1.000 | 1.000 |
| flat-RETRIEVED (k=2) | **0.583 [0.583, 0.583]** | **0.167** (q01/q02/q03 = 0.000; q06 = 0.667 partial) | 1.000 | 1.000 |

CIs are degenerate point intervals — the honest framing is "identical outcome at 5/5
independent seeds", not an estimated interval. Definitional note vs Pilot C's "0.00 on
the conflict slice": with q06 included the slice mean is 0.167, because q06's F1 gives
2/3 partial credit for confidently returning ONE of two conflicting values (P=1, R=0.5)
— the quantified silent-miss, not a partial success.

**The cost-of-reach curve (deterministic, all pairs, both directions):**

| k | twin reach (small & scale) | ball as % of whole store (small) | (scale) |
|---|---|---|---|
| 1 | 0.000 | ~1% | ~0.3% |
| 2 | 0.000 | 19–29% | 20–31% |
| 3 | 0.000 (plateau: no odd-length shortcut) | = k2 | = k2 |
| 4 | **1.000** | **82–91%** | **89–98%** |

Benign co-referent pairs reach at k=2 (shared office IRI) — mechanistic sanity for the
sweep. The paper sentence this licenses: **hop-bounded retrieval is conflict-blind up
to k=3, and closing the gap at k=4 costs ~the whole store — a cost that converges to
100% as the store grows** (89–98% at 5x scale vs 82–91%). Keyed inference is
graph-distance-independent at constant cost. Bonus cost nuance, honestly reported: the
shipped k=2 retrieved PROMPTS are larger than flat-all's (per-question context
duplication, 69KB vs 29KB small; 292KB vs 133KB scale) — retrieval saves per-question
tokens only when questions don't share neighbourhoods.

**Caveats.** Frontier tier only (multi-tier sweep pending); xr-scale n=1; flat-all
still ties at 133KB (its collapse point needs 10^4+ stores or measured long-context
degradation — future sweep); q06 partial-credit definition should be foregrounded in
the paper's metric section.

## 2026-07-12 — Pilot D2: Mem0 classic on the CROSS-RECORD slice (conflict-xr-small)

**Setup.** Same harness as Pilot D; all 345 xr-small facts ingested in episode order
(~26s/fact, nohup-supervised). Verdicts at two levels: per record (24 = 12 pairs x 2)
and per co-referent pair, including an explicit linkage probe (did ANY memory connect
the two records / bridge the shared email?).

**Result.**

| level | preserved-both | silently-resolved | lost-both | linked |
|---|---|---|---|---|
| per record (24) | **0** | 19 | 5 | — |
| per pair (12 conflicted) | 7* | 5 | — | **0/12** |

*The pair-level "preserved-both" is NOT conflict preservation: `linked: false` on
every pair — `cross_record_linked_memories` and `email_bridge_memories` empty
everywhere. **Mem0 never performed entity resolution on the shared email key.** The
7 "preserved" pairs are two disconnected memory fragments each holding one value;
no reader surface connects them, so a subject query returns one value arbitrarily.

**Honest read.** On cross-record conflicts Mem0's failure is more fundamental than
destructive resolution: the conflict is never REPRESENTABLE because co-reference is
never established — architecturally the same blindness as hop-bounded retrieval
(Pilot C/E), now measured at the write pipeline. The mechanism table is complete:
retrieval cannot REACH the second record; Mem0 cannot LINK it (and destroys
same-subject conflicts it can see); Predicate's r14 keys them deterministically and
r22/r23 surface the conflict with both values cited. Caveat: local qwen3.5 extractor
— a frontier extractor might link some pairs; the counter is that nothing in the
pipeline ASKS for co-reference: there is no key semantics anywhere in its schema.

## 2026-07-12 — Pilot F: the flat-all collapse sweep is COST-shaped (p1000/p2000)

**Setup.** xr-stats gained --persons N (committed): same generator, store sizes 1000
and 2000 persons (5.2k / 10.4k triples; flat-all prompts 435KB / 871KB). Deterministic
part per size: Tier1 reference + k=2 reach over every conflicted pair; blind frontier
flat-all arm via in-session subagent (systematic chunked reading required).

**Result.**

| size | triples | reasoner | flat-all | retrieval reach (k=2) | frontier read cost |
|---|---|---|---|---|---|
| p1000 | 5.2k | 1.000 | **1.000** | 0.000 (200 pairs) | 339k tokens, ~6 min |
| p2000 | 10.4k | 1.000 | **1.000** | 0.000 (400 pairs) | **77k tokens** — pattern-inference, not reading |

Flat-all does NOT collapse on accuracy in the readable regime — including perfect
800-IRI enumeration at p2000. But the two rows expose the real boundary: at p1000 the
model read everything (339k tokens); at p2000 it STOPPED READING and inferred the
regularity (i%5 office assignment) from samples — correct here only because synthetic
fixtures are regular. Real stores are not; the shortcut does not transfer. The honest
claim: **flat-all's failure mode is cost and verification-honesty, not raw accuracy —
linear token burn per query (and per-query re-reading) vs the reasoner's constant-cost
query over an amortized closure — until the context ceiling makes it structural.**
p4000 (21k triples) was abandoned: the deterministic sweep itself memory-thrashed this
machine (9.2GB swap) — an incidental datum about in-memory whole-store processing at
scale. Largest completed deterministic point: 10.4k triples.

**Also this morning (chained, partially disk-blocked and re-run):** Mem0-2.x additive
arm on d20: 1/8 preserved / 4 silently-resolved / 3 lost-both — "additive-only" still
destroys, the loss just moves into EXTRACTION infidelity. Local-tier sweep first pass
exposed a scoring artifact (gemma4 answers {"answer": "<iri>"} — bare string; strict
parser scored it 0/8): parseFlatAnswer now accepts singleton strings so the tier
comparison measures capability, not JSON-shape compliance; first-pass runs archived,
all six cells re-running with the fair parser.

## 2026-07-12 — Pilot G: model-tier matrix under FAIR measurement (ctx-32k + lenient parser)

**Setup.** Local tiers via Ollama with three artifacts controlled (each measured
before being fixed — see archives): runtime num_ctx (default 2048 truncates every
flat prompt regardless of model capability → ctx-32k manifest variants), thinking
budget through the /v1 endpoint, bare-string JSON answers (parser now lenient).
qwen3.5 9.7B = weak, gemma4 e4b = mid, in-session frontier subagents = frontier,
runs=1 per cell (local-tier variance sweep pending). 5/6 local cells completed;
gemma4/d20 skipped by the disk guard (machine constraint, below).

**Result — conflict-xr-small (aggregate / conflict slice):**

| tier | flat-all | flat-retrieved (k=2) | reasoner |
|---|---|---|---|
| weak (qwen3.5) | 0.125 / 0.000 | 0.000 / 0.000 | **1.000** |
| mid (gemma4) | 0.375 / 0.250 | 0.250 / 0.000 | **1.000** |
| frontier | 1.000 / 1.000 | 0.583 / 0.167 | **1.000** |

(d20 flat-all: weak 0.125/0.000; mid cell pending. Weak-tier parse rates remain
2-4/8 even at 32k ctx — and qwen3.5 fails a bare 16k-token needle WITH full
context: genuine long-context failure, separate from the config artifact.)

**Honest read.** The reasoner column is CONSTANT — the derivation chain does not
know or care what model reads its output. The flat columns are steeply
model-bound: weak tier cannot use the KB at all (even direct recall fails), mid
tier finds fragments, frontier saturates the readable regime. The retrieved
column shows the structural ceiling: even the frontier caps at 0.583 because no
capability can read what retrieval never fetched. Paper sentence: **model
strength moves the flat baseline toward the reasoner's constant; nothing moves
the retrieval-mediated baseline past its structural ceiling; and the reasoner
needs no model strength at all.** Caveats: n=1 per local cell; two local models
only; "tier" conflates size/family/training — frontier-lab weak models pending
API access.

**Machine-constraint note (affects what remains).** This host's disk oscillates
at 0-4GB free (460GB, 99% full baseline; Ollama load + swap does the rest). The
disk-guarded chain (baselines/run_salvage2.sh, idempotent) completed 5/6 tier
cells and still holds three steps queued: gemma4/d20, Mem0-2.x xr resume (343
facts), Graphiti both fixtures (fully staged: Neo4j 5.26 up, harness
synthetic-tested). One command re-runs exactly the missing steps once space
frees: `nohup caffeinate -is bash baselines/run_salvage2.sh &`.

## 2026-07-12/13 — Phase-0 evidence sprint: instance-level contract, exact baselines, retrieval policies, Gate A

**Setup.** Multi-agent implementation sprint executing plan §11 Phase 0 + §14 actions 1–9
(orchestrated workflows; adversarially verified by independent code-review, claims-audit,
and reproducibility agents). New measurement contract: per-conflict `instances.json`
manifests (12/60 cross-record pairs + benign negatives; 8 same-subject for d20),
PredictionRow JSONL per system, instance scorer (`src/instances/score-cli.ts`). Systems:
`exact-key-join` (pure-JS hash join, no store), `sparql-groupby` (one `GROUP BY key HAVING
COUNT(DISTINCT v)>1` per single-valued property), `reasoner-r14r23r22` (the 3-rule chain
only, via `runFixpoint`), retrieval policies `iri-bfs`/`literal-aware`/`key-aware` at
hops 1–4 scored by witness-containment (worst-case seed). One-command rebuild:
`scripts/build-evidence.sh` (fixtures byte-drift check; decision values reproduce exactly,
timings vary). Env: oxigraph-wasm `:memory:`, no LLM in any confirmatory arm.

**Numbers (committed artifacts; `results/instances/summary.<domain>.json`).**
Detection is a perfect three-way tie: P=R=F1=1.000, both-value recall 1.0, witness recall
1.0, zero benign FPs, all three systems, all three fixtures (8/8, 12/12, 60/60). Cost is
not a tie: key-join cold end-to-end 1.4/1.6/5.0 ms vs SPARQL 45.7/49.7/72.1 ms vs reasoner
materialize 55.6/276.0/6244.5 ms (~1,250× at 1,689 triples). Retrieval crossover:
iri-bfs 0/12 and 0/60 witness-complete at k≤3; at k=4 completes only by returning the
whole store (345/1,689 triples = flat-all); literal-aware and key-aware complete at k=1
with ~8-triple (~2 KB) contexts. literal≡key on these fixtures (email is the only
literal; verified per-seed set equality) → H3 untestable on mechanism-v0. H1/H2/H4/H5
all in the registered direction (pre-registration.md + Amendment A1 timing disclosure:
drafted same-day as the runs; deterministic rerun = confirmatory record).

**Honest read.** Gate A fires on its literal terms: on mechanism-v0 the OWL chain has no
advantage in accuracy (tie), cost (join wins by orders of magnitude), or guarantee (Prop 4:
the exercised subfragment is a textbook O(n+out) join). The store-side detection story is
a closed null result (pre-committed via H4/§9.6). What survives is the retrieval-boundary
result — the empirical face of Prop 3: bounded-hop IRI-only retrieval cannot be
conflict-complete for key-literal-connected records at any usable budget, while indexing
the witness-connecting relation buys completeness at ~2 KB. Recommendation in
`gate-a-analysis.md`: reframe per plan §5 (retrieval policy as the research object,
reasoner demoted to one witness-indexing implementation), with pivot-to-benchmark as the
standing alternative; human decision pending. Caveats: synthetic constructed fixtures;
single-run timings; pinned-LLM arms built (full raw logging, dry-run verified) but
unexecuted — no API keys on this host.
