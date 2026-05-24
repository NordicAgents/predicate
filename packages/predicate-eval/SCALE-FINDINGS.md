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
