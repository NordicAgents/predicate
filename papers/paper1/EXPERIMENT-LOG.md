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
