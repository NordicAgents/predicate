# Scale experiment — does the reasoner-graph beat flat in-context recall as the graph grows?

The decisive question for Predicate: its whole reason to exist is the regime where
**flat in-context recall collapses** (too many facts to fit or to find) while the
**structured graph + exact reasoner holds**. This experiment generates realistic org
trees of increasing size and measures all three approaches.

Generator: `src/scale/generate-org.ts` (deterministic balanced reporting tree, branching 4,
bounded depth so transitive closure stays near-linear — not a pathological chain).
Sweep: `src/scale/sweep.ts` / `pnpm --filter predicate-eval scale <sizes...>`.

## Deterministic sweep (reasoner correctness + latency + flat-context size)

| people | ABox triples | inferred | materialize | Tier-1 accuracy | flat tokens (est) |
|---|---|---|---|---|---|
| 25   | 74    | 129    | 4.8 s  | 1.00 | 1.6 k |
| 100  | 299   | 684    | 8.2 s  | 1.00 | 6 k   |
| 400  | 1,199 | 3,502  | 33 s   | 1.00 | 24 k  |
| 1000 | 2,999 | 10,102 | 94 s   | 1.00 | 59 k  |

## What it shows

1. **The reasoner stays exactly correct at every scale** (Tier-1 accuracy 1.00). The
   structured-reasoning claim holds — given a correct query, the materialized closure is right.

2. **But materialization is brutally slow, even on realistic (non-chain) structure.**
   94 seconds to materialize a 1,000-person org of only ~3,000 ABox triples. Growth from
   100→1000 people (10×) took 8 s→94 s (~11×) — roughly linear here but at an
   enormous constant, and the earlier subclass-chain probe showed true O(n²) on adversarial
   shapes. **A "memory that grows with use" cannot pay 90+ seconds per refresh at 3k facts.**
   This is the dominant practical problem, and it bites long before context limits do.

3. **Flat in-context does NOT hit a size wall in the range that matters.** At 1,000 people the
   entire TBox+ABox is ~59 k tokens — comfortably inside a 200 k context window. The
   "flat can't fit" crossover is only ~3–4 k people (~200 k tokens). So for any graph the
   *reasoner can actually materialize in acceptable time*, **flat in-context still fits.**

## The uncomfortable implication

The two limits are on the wrong sides of each other. Predicate's value requires
`flat collapses` to happen at a smaller scale than `reasoner becomes unusable`. The data so
far shows the opposite: the **reasoner becomes painfully slow (~3 k triples) well before flat
in-context stops fitting (~tens of k triples)**. Unless the reasoner gets dramatically faster
(semi-naive / incremental materialization), there may be no scale band where Predicate is both
*correct-and-fast* AND *flat has already failed*.

## Flat ACCURACY at scale (live LLM anchors) — the decisive datapoint

Fitting ≠ answering, so we measured flat **accuracy** with a live model (Claude Haiku, the same
weak/cheap model used for Tier 2) on generated transitive-chain questions. Helper:
`src/scale/flat-anchor.ts`. The model reads the full TBox+ABox in context and answers in JSON,
no engine.

| scale | facts | context | flat accuracy (Haiku) | Tier-1 (reasoner) |
|---|---|---|---|---|
| N=100  | 299   | ~6 k tok  | **1.00** (4/4 chains exact) | 1.00 |
| N=1000 | ~3 k  | ~59 k tok | **1.00** (6/6 chains exact, up to 5 hops) | 1.00 |

**Flat in-context did NOT collapse.** A cheap model walked 5-hop transitive chains through
~3,000 facts with perfect accuracy in one ~40 s call — tying the reasoner — with no graph, no
SPARQL, no materialization. (The flat 0.65 seen earlier at 8 facts was mostly an ambiguous
question wording, not scale; with a clear question the model is exact.)

## Conclusion

On this benchmark, **at every scale where Predicate's reasoner is usable, flat in-context recall
ties it (1.00) while being simpler and not slower.** The reasoner is correct but its
materialization is the bottleneck (94 s at 3 k triples); flat stays both feasible (≤59 k tokens)
and exact across the same range. There is no observed scale band where Predicate's reasoning
apparatus beats just putting the facts in the model's context.

**This does not kill the idea — it sharply narrows where it can win.** Predicate's remaining
justifications, none of which this benchmark validated, are:
1. **The very-large-corpus regime** (≫ context window — tens/hundreds of thousands of facts from
   months of capture) where flat genuinely cannot fit. But that regime is currently *blocked by
   the reasoner's own O(n²)/slow materialization* — it can't reach those sizes either. Fixing
   materialization (semi-naive/incremental) is the prerequisite for this to even be testable.
2. **Qualitative guarantees flat can't give:** exact, deterministic, auditable answers with a
   provenance/derivation path (`kg_explain`). At equal accuracy these still matter for
   high-stakes or compliance use — but they are a different value proposition than "answers
   harder questions."
3. **Task types we didn't stress** (multi-source contradiction at scale, multi-constraint joins)
   where flat might degrade sooner than transitive chains do.

The honest headline: **the "reasoning graph beats in-context recall" thesis is not supported by
the data in the feasible range.** Predicate should either (a) re-pitch around exactness/audit/
provenance rather than capability, or (b) prove the large-corpus crossover — which first requires
making materialization fast enough to get there.

---

# The faithful single-user experiment (the one that matches how Predicate is used)

The org sweep above grew *entities* (people), which is unrealistic: Predicate is **single-user**
agent memory. The real axis is **facts accumulating for one developer over time** about a *fixed*
codebase. So: hold the codebase fixed (a 100-file dependency DAG — the signal that answers
"what does X depend on") and grow the **captured history** (per-session edit/command events — the
noise). Generator `src/scale/generate-codebase-history.ts`; three arms compared:
**(c) reasoner** (materialize + golden SPARQL), **(a) flat-all** (every fact in context),
**(b) flat-retrieved** (a dead-simple k-hop `dependsOn` neighbourhood, then the model in-context).

## Sweep (`pnpm --filter predicate-eval scale-history`)

| sessions | total facts | reasoner materialize | reasoner acc | flat-all tokens | retrieved facts | flat-retrieved tokens |
|---|---|---|---|---|---|---|
| 25  | 547   | 35 s   | 1.00 | 23 k  | 25 | **1.6 k** |
| 100 | 1,297 | 78 s   | 1.00 | 55 k  | 25 | **1.6 k** |
| 400 | 4,297 | **320 s (5.3 min)** | 1.00 | 182 k | 25 | **1.6 k** |

Live flat-retrieved accuracy anchor (Haiku, 400 sessions): **mean f1 = 0.98** (3/4 questions
perfect, including a 28-file transitive closure; one miss of one element).

## The verdict for the real use case

The answer to every "what does X depend on" question is **identical at 25 and at 400 sessions** —
the codebase didn't change, only the captured noise grew. Given that:

- **The reasoner is the WORST-scaling arm.** Its materialization explodes to **5+ minutes at ~4 k
  facts** because it re-processes all the accumulated edit/command noise it doesn't even need to
  answer the question. A "memory that grows with use" that pays minutes per refresh is unusable.
- **Flat-all** grows linearly toward the context ceiling (182 k tokens at 400 sessions) — it works
  for a while, then can't fit.
- **Flat-retrieved wins decisively.** A 5-line BFS pulls the dependency neighbourhood (~25 facts,
  **1.6 k tokens, constant forever** regardless of how much history piled up), and the model
  answers it at **0.98 accuracy** — matching the reasoner — instantly, with no graph, no SPARQL, no
  materialization.

**Conclusion for single-user agent memory:** the valuable architecture is **capture + cheap
retrieval of the relevant neighbourhood + the model reasoning in-context.** The OWL/SPARQL/
materialization reasoning layer — the heaviest, slowest part of Predicate — is not just unneeded
here, it actively *hurts*: its cost scales with total captured noise while the useful answer and
the retrieval cost stay constant. The reasoner's only remaining edge is exactness/determinism/
provenance (0.98 vs 1.00, plus an auditable derivation) — a real but narrow, niche-specific value,
not the general capability win the project was premised on.
