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

## 2026-07-13 — Phase-1 kickoff: Gate A decided, A2 registration, Gate-B fixtures land, all four hypotheses in registered direction

**Gate A decision (recorded in `gate-a-analysis.md` §6).** Option 1 — proceed REFRAMED
(method paper on conflict-complete retrieval under bounded context, AAAI-28/KRR shape)
toward Gate B (2026-09-30), under binding conditions 5(a)–(c); researcher decision,
2026-07-13. The mechanism-v0 store-side detection story stays a closed null result.

**Environment note.** Work moved to a new linux host (node v22.17.1, pnpm 9.0.0,
oxigraph-wasm `:memory:`). Clean checkout: full build + 535-test suite green;
`scripts/build-evidence.sh` reproduced every mechanism-v0 decision value exactly
before any new work began.

**Registration before runs (Amendment A2).** The phase1-v3 fixture family, the
`InstanceKind` extension (`benign-temporal`, `benign-scoped`), the extended exact
baseline `exact-key-join-x` (Prop. 4 full fragment: per-(class,key,value) buckets +
union-find ~K closure + τ/σ overlap partitioning implementing F3's side conditions),
and hypotheses H6/H7/H8 + the H3 operationalization were committed (`0d55ffb`) BEFORE
any generator or system code existed. H6.i and H6.iv are marked mechanism checks
(guaranteed by construction); H3/H6.iii/H7/H8 were genuinely forward-looking.
Also corrected: chain-witness cardinality |W| = 3m+3, not 4m+2 (A2.5).

**Fixtures (generator `src/conflict/generate-v3.ts`, seed 0x5eedca7, drift-checked).**
`conflict-chain-m2` (40 chains, 10 conflicted, |W|=9), `conflict-chain-m3` (24/6, |W|=12)
— sparse intermediates carry two `cb3:email` values, no constrained value, no IRI object;
`conflict-h3-nk1`/`-nk3` — v2 twin mechanism + 1 vs 3 non-key shared literals;
`conflict-tausig` — record-level `validFrom/validTo/sourceScope` (12 conflict /
12 benign-temporal / 12 benign-scoped / 24 benign-coreference). One shared v3 instance
derivation (`src/instances/v3.ts`) used by manifest, exact, and retrieval arms — id
drift across producers is impossible by construction. 26 new tests; full workspace
suite 561 passed + 15 skipped.

**Numbers (committed artifacts; `results/instances/summary.<d>.json`,
`results/instances/phase1-verdicts.json`). All four registered hypotheses PASS:**

- **H6 (chain depth).** Single-join detectors: recall 0, FP 0 on both chain fixtures
  (structural). `exact-key-join-x` and `reasoner-r14r23r22`: P=R=1.000 on both.
  `key-aware@k` witness-complete rate flips exactly at k=m: [0,1,1,1] on m2,
  [0,0,1,1] on m3 — the completeness budget grows with chain length. `iri-bfs@k` is
  0/10 and 0/6 at EVERY k (isolated intermediates; no hop budget recovers them) —
  a stronger empirical face of Prop. 3 than mechanism-v0's k=4-whole-store escape.
- **H7 (τ/σ).** All three τ/σ-blind detectors flag 12/12 benign-temporal AND 12/12
  benign-scoped (precision 0.333 at recall 1.000). `exact-key-join-x`: P=R=1.000,
  zero benign flags.
- **H3 (now testable, PASS).** literal-aware@1 vs key-aware@1 mean context premium
  over conflict instances: 7.0× triples / 2.5× bytes at nk=1 → 20.6× / 6.4× at nk=3
  (monotone in non-key shared literals, as registered); largest on the
  benign-shared-value probes (10× / 28×); both policies remain witness-complete at
  k=1 (H2 carries over).
- **H8 (cost, single-run wall-clock).** `exact-key-join-x` end-to-end 1.0–5.4 ms on
  every fixture: within 1.21× of the plain join on mechanism-v0, and 27–708× cheaper
  than reasoner materialization everywhere both are accurate (chain-m2 1.9 ms vs
  428 ms; tausig 3.0 ms vs 603 ms; xr-scale 5.4 ms vs 3,826 ms).

**Honest read.** Gate-B conditions 5(a) and 5(b) now EXIST as artifacts, and the runs
land exactly where the registered predictions put them. Two consequences must be
stated plainly. (1) The reasoner earns generality parity on the deeper fragment
(Prop. 2 exercised at m≥2 for the first time) but never a cost edge: the extended
exact baseline is complete AND cheapest everywhere tested — the first conjunct of
gate falsification clause 3 is TRUE on synthetic data. Store-side detection remains a
solved, cheap problem at every depth tested; no paper claim may rest on it. The
method contribution must live where the separations live: the RETRIEVAL side
(H6.iii/iv, H3 premiums, B-bounded completeness), i.e., CWI as a retrieval index
competing on witness-completeness per context budget, not as a detector. Clause 3's
second conjunct (flag-pointer variants dominating within budget) is the open Phase-1
question. (2) The τ/σ result cuts both ways: it separates the extended baseline from
ALL currently implemented store-side systems including our own reasoner chain — r22
does not implement the ≬ side condition and over-flags exactly like the plain join.
An r22-τσ extension is now a measured TODO, not a claimed capability.

**Gate C preview (condition 5(c); EXPLORATORY, A2.7).** OSV PyPI bulk export
(snapshot Last-Modified 2026-07-13 07:54:02 GMT, 23,137 records, raw data not
committed): 80.7% of the 5,649 CVE-keyed groups have ≥2 co-referent records — the
cross-record mechanism is the NORM in this domain; 13.3% of severity-comparable
groups disagree on severity; 48.4% of range-comparable groups disagree on affected
ranges (syntactic upper bound; Phase-2 annotation adjudicates semantics). Script +
report: `papers/paper1/probes/`. Prop. 3's store shape is not vacuous in the wild.

**Still open.** Pinned frontier-model runs (keys unavailable on this host — unchanged);
r22 τ/σ extension; CWI-as-retrieval-index implementation + update/query cost ledger
(Gate B core); Phase-2 annotation probes for C1 semantics.

**Provenance note (2026-07-13, post-tag).** The Phase-0 tags
`evidence-snapshot-2026-07-12` and `phase0-evidence-2026-07-13` cited in the frozen
docs were never pushed from the previous machine and did not survive the device
switch. They were recreated on this host at their documented commits (`3b63c1e` and
`f6c828a` respectively — the latter is the tip of the four-commit Phase-0 landing and
matches `origin/paper1-evidence-sprint`). Recommendation: push branch + tags so
snapshot tags can no longer be lost with a device.

## 2026-07-13 — Phase-1 method arm: CWI lands; H9/H10 PASS; clause-3 adopts the strict witness contract

**Registration (Amendment A3, commit `c7af341`).** The incremental Conflict Witness
Index, its three retrieval-contract variants (witness/pointer/flag, Def. 3.3 Remark 1),
the maintenance-ledger outputs, hypotheses H9/H10, and the pre-committed clause-3
adjudication rule (5× byte-overhead threshold) were all committed BEFORE any CWI code
existed. Branch + all evidence tags pushed to origin first (device-loss lesson).

**Implementation (`src/cwi/`, 17 new tests; eval suite 152 green; lint clean).**
Pure-TS incremental index: per-(class,key,value) buckets + union-find ~K maintenance,
class-granular conflict re-evaluation on every touching insert (late τ/σ annotations
retract — tested), minimal witness assembly by shortest record–bucket–record path.
Cross-engine equality with `exact-key-join-x` is test-enforced on all eight domains;
insertion-order robustness tested (values→keys→types reaches the same fixpoint).
Formal doc gains Prop. 5 (soundness via Props 1–2/4 equivalence; witness-sized
retrieval; class-bounded maintenance) with the honest reading that the data structure
itself claims no novelty (A3.6).

**Numbers (`results/instances/phase1-verdicts.json`, `results/cwi/*`).**

- **H9 PASS.** `cwi-witness`: P=R=1.0, witnessRecall 1.0, zero spurious conflicts on
  ALL eight domains; mean returned context EXACTLY the gold |W| everywhere (2.0 d20 /
  6.0 pairs / 9.0 m2 / 12.0 m3 / 10.0 tausig); strictly smaller than the minimal
  witness-complete key-aware ball on every cross-record domain — and m-INDEPENDENT:
  9 vs 94.6 ball triples at m=2, 12 vs 91.3 at m=3 (the ball pays the hop radius, the
  witness does not). Detection sets identical to `exact-key-join-x` everywhere.
- **H10 PASS (single-run wall-clock, disclosed).** Update amplification 1.25–2.30 index
  writes per source assertion, scale-flat (xr-small 1.904 → xr-scale 1.895); query p50
  0.6–13 µs, m-independent (m2 0.6 µs, m3 1.0 µs); ingest+all-queries total 0.73–1.46×
  the one-shot `exact-key-join-x` run per domain — the price of incrementality is ~zero
  at fixture scale, and on the two largest fixtures CWI is CHEAPER end-to-end because
  queries stop re-scanning the store.
- **Clause-3 adjudication (pre-committed rule A3.5): STRICT FORM ADOPTED.** Mean
  witness/pointer byte ratio ranges 0.78–3.08× (max 3.08 on chain-m3), under the 5×
  threshold on every domain: whole machine-checkable witnesses cost at most ~3× a bare
  pointer and 479–957 bytes absolute. The flag-pointer weaker variants do NOT dominate;
  falsification clause 3's second conjunct FAILS to close the gap. Combined with A2's
  first-conjunct finding, the record now reads: store-side detection is solved and
  cheap (join), but a budget-bounded consumer that must SEE the premises is served
  witness-sized context only by witness indexing — neighbourhood retrieval pays
  ball-sized budgets that grow with chain depth and shared literals.

**Honest read.** This is the Gate-B core result on synthetic data: a Pareto point —
identical accuracy to the best exact detector, witness-exact context (vs 8–95-triple
balls), ~2× write amplification, µs queries. Caveats stand: fixture scale is tiny
(≤1,689 triples; ledger constants are not load-tested), all wall-clock numbers are
single-run, fixtures are synthetic (Gate C / Phase 2 owns external validity), and the
d20 pointer ratio 0.78 shows the pointer form can be BIGGER than tiny witnesses (ids
carry full IRIs) — pointer encodings matter and are disclosed. Gate B still requires
the realistic-domain reproduction (5(c) full probe) and the formal write-up hardening.

## 2026-07-13 — Phase-1 evidence hardening: B-curves (registered primary metric), load-scale ledger (H11), τ/σ-aware reasoner (H12)

**Registration (Amendment A4, commit `ba92687`) before any code.** Four A4-registered
deliverables, built by a multi-agent workflow (four implementation lanes, each with an
adversarial verifier that independently re-ran the code) and landed after verification.
Three lanes were verifier-CONFIRMED; the reasoner-tau verifier died on a session limit,
so its arm was verified by hand instead (H12 reproduced on all 8 domains, frozen-file
integrity confirmed, and a bespoke 7-case interval/scope boundary probe — including the
[from,to) adjacency case the fixture omits — all pass).

**B-bounded completeness curves (A4.1 — the §4.3 primary metric, finally an artifact).**
`src/instances/bcurves-cli.ts` → `results/curves/bcurves.<domain>.json` for all 8
domains, over the registered triples/bytes grids, emitting BOTH the primary Def-5.3
truncation reading (WCR at context ≤ B over ALL conflicts) and the §4.3-literal
conditional rate with its n (interpretation fixed in A4.1 before computation). The curves
make the phase diagram explicit, e.g. conflict-chain-m2: cwi-witness reaches 1.0 at a
triples budget of 10 (witness = 9 triples), key-aware@2 is 0.0 at B=50 and 1.0 only at
B=100 (its ball is ~95 triples), and iri-bfs is 0.0 across the entire grid to whole-store.

**Load-scale ledger (A4.2, H11 — the maintenance-cost story at scale). H11 PASS.**
Cost-only strata (v2/xr topology, seed 0x5ca1eab1e, persons 300/1k/3k/10k = 1.7k–56k
triples), regenerated at measurement time and NOT committed (sha256 of each stratum
recorded instead). Single-run wall-clock, disclosed run-variable:

| persons | triples | exact-key-join-x | sparql | reasoner | CWI ingest | CWI amp | CWI query p50 |
|---|---|---|---|---|---|---|---|
| 300 | 1,689 | 4.4 ms | 39 ms | 3,852 ms | 2.6 ms | 1.895 | 6 µs |
| 1,000 | 5,609 | 11.4 ms | 33 ms | 40,571 ms | 8.3 ms | 1.894 | 5 µs |
| 3,000 | 16,809 | 35.5 ms | 90 ms | skipped (>1k cap) | 15.1 ms | 1.893 | 7 µs |
| 10,000 | 56,009 | 119.7 ms | 308 ms | skipped | 52.6 ms | 1.893 | 8 µs |

The headline: CWI update amplification is **dead-flat at ~1.89 across a 33× size
increase**, query p50 stays 5–8 µs, and CWI ingest at 56k triples (52.6 ms) is actually
CHEAPER than the one-shot exact-key-join-x detector (119.7 ms) — while the reasoner is
superlinear (3.85 s → 40.6 s for a 3.3× data increase) and uncomputable past a few
thousand triples. This is the "update/query complexity vs full materialization" evidence
the plan's Phase 1 demanded, and it hardens the CWI Pareto claim against the obvious
scale objection. Caveat: 56k triples is still modest; single-machine, single-run.

**τ/σ-aware reasoner (A4.3, H12 — closing the reasoner's own registered gap). H12 PASS.**
New rules `r22t`/`r23t` (in predicate-reasoner, deliberately NOT in the default RULES
array; the frozen blind chain is untouched — its H7 over-flagging is a registered
result): r23t propagates single-valued values across owl:sameAs carrying the SOURCE
record's τ/σ forward as RDF-star annotations (chained propagation preserves the ORIGINAL
endpoint's annotations, not an intermediate's), and r22t gates the ValueConflict on
F3's side conditions — τ-interval overlap ([from,to), end-exclusive) and σ
equality-or-absence. The new `reasoner-tau` arm scores **P=R=1 with zero flags on all 24
τ-or-σ benign negatives** on conflict-tausig (where the blind reasoner scored P=0.333,
H7), and is flagged-set-IDENTICAL to the blind arm on every τ/σ-free domain — the
extension changes nothing where annotations are absent. Predicate's own system now
matches its formal spec (F3) in the annotated fragment; the H7 gap was a missing rule,
now filled, and honestly dated as a Phase-1 addition rather than retrofitted into the
frozen arm. reasoner package 70/70 tests, eval 172/172; both suites green.

**C1 annotation harness (A4.4, exploratory).** Deterministic stratified sampler over the
OSV probe's group classifications (100 range-disagree / 50 severity-disagree / 50 both /
100 controls), annotation guide with the label taxonomy and decision rules, and a
Cohen's-κ agreement/adjudication script — under papers/paper1/probes/c1-annotation/.
Produces no confirmatory numbers; sampler outputs embed licensed OSV text and are written
OUTSIDE the repo (only aggregate κ/rates are ever committable, via a future amendment).
This is the tooling for the human annotation pass that converts the A2.7 syntactic
disagreement rate (48.4%) into the semantic contradiction rate Gate C needs.

**Where this leaves Gate B.** Conditions 5(a)/5(b) fixtures exist and separate as
registered (A2); the CWI method delivers witness-sized conflict-complete retrieval at
flat amplification and µs queries that hold to 56k triples (A3 + H11); the strict witness
contract is adopted (clause-3); and the reasoner now honors its τ/σ spec (H12). Remaining
for Gate B (2026-09-30): the full realistic-domain reproduction (C1 semantic annotation
via the new harness — needs human annotators), larger-scale ledger if a reviewer wants it,
and the formal write-up. Pinned frontier-model runs remain blocked on an API key.
