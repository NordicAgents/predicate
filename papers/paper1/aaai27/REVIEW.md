# Internal AAAI-style review after final reviewer-driven revision

## Recommendation

**Score: 8/10 — accept.**

**Confidence: 4/5.**

The revision addresses the verified theorem error and the two principal
evidence concerns. The graph result now applies precisely to non-`rdf:type`
IRI adjacency and explicitly excludes type-traversing graphs. The workload
compares incremental CWI, a batch-built cached exact snapshot, and fully fresh
exact computation over identical parsed stores. UTF-8 evidence costs now
complement logical triple counts. Exact joint selection still realizes the
formal budget boundary on exhaustive runs and distinguishes infeasibility from
capped search.

## Decisive strengths

1. **Exact boundary is operational.** A four-conflict alternative-path case
   contains 20 candidate witnesses: independent shortest selection uses 33
   triples, exact selection proves the 27-triple optimum, and 26 is proven
   infeasible.
2. **Correctly scoped graph boundary.** The proof and implementation both
   exclude `rdf:type` traversal; the paper states why the result would not hold
   for a graph that links records through their common class.
3. **Fair systems comparison.** All three workload arms receive identical
   in-memory triples. At 1,689 triples cached exact is faster; at 16,809 and
   56,009 triples CWI is about 2x faster across the tested query counts. This
   scale-dependent result is more credible than a universal maintenance claim.
4. **Improved external mechanics.** The semi-natural study uses 68
   component-disjoint DBLP--Scholar gold-linked pairs at depths 1--4, retains
   natural attributes as distractors, and pairs every controlled positive with
   an agreement negative; all 136 outcomes are correct.
5. **Strong reproducibility.** The anonymous artifact includes source,
   dependency locks, frozen results, digests, 65 focused tests, and a generated
   triples/bytes table.
6. **Calibrated claims.** The paper still makes no natural conflict-prevalence
   claim and exposes exponential joint search, quadratic class-local
   materialization, retained state, and missing production features.

## Remaining limitations

1. The semi-natural predicate and schema are controlled rather than
   independently annotated natural semantic conflicts.
2. Exact joint selection can safely abstain at its exponential path/search
   caps; it is not a polynomial solution to the NP-complete problem.
3. The workload is single-process insertion-batch/read-many and does not cover
   deletion, concurrent or interleaved updates, persistence, or heap bytes.

These are now explicit scope limitations rather than missing evidence for the
paper's central formal and mechanism claims.
