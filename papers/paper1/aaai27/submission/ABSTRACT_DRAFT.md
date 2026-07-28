# AAAI-27 OpenReview text

## Title

Conflict-Complete Retrieval: Checkable Contradictions under a Context Budget

## Abstract

An agent cannot act on a contradiction that memory retrieval does not expose.
We define *conflict completeness*: for every query-relevant conflict, a
retrieval policy returns at least one complete, source-grounded witness that a
sound checker can verify from the context alone. We characterize the exact
budget-feasibility boundary by the minimum joint union of one witness per
conflict. A capped exact selector realizes this boundary on tractable classes
and otherwise abstains rather than silently returning incomplete evidence. We
also show
that every fixed-hop policy based only on IRI adjacency fails conflict
completeness on a literal-keyed construction. A Conflict Witness Index (CWI)
incrementally maintains key-induced record equivalence and returns one
shortest witness per conflict. Evaluation covers 252 synthetic instances with
132 conflicts, 12 multi-conflict queries, and 136 semi-natural controls on
gold record-linkage topology. Shared premises reduce a
32-conflict joint certificate from 192 to 68 triples, whereas 32 disjoint
conflicts require all 192; on an alternative-path case, exact joint selection
reduces 33 triples to the proven optimum 27. Exact maintained, exact on-demand, and adaptive
exact retrieval return the same 2--12 triples per individual conflict; learned
baselines require up to whole 336--440-triple stores on key chains. All
semantic conflict labels are controlled and the schema is supplied: this is a
retrieval contract and cost study, not evidence of natural conflict prevalence.

## TL;DR

We define conflict completeness, realize its exact joint-budget boundary on
tractable classes, and test maintained retrieval on synthetic and
semi-natural controlled conflicts with a fair stateless workload comparison.
