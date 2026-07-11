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
