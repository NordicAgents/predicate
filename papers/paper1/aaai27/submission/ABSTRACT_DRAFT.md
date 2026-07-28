# AAAI-27 OpenReview text

## Title

Conflict-Complete Retrieval: Checkable Contradictions under a Context Budget

## Abstract

An agent cannot act on a contradiction that memory retrieval does not expose.
We define *conflict completeness*: for every query-relevant conflict, a
retrieval policy returns at least one complete, source-grounded witness that a
sound checker can verify from the context alone. We characterize the exact
budget-feasibility boundary by the minimum joint union of one witness per
conflict; when its selected union exceeds the budget, our system reports
overflow rather than silently returning incomplete evidence. We also show
that every fixed-hop policy based only on IRI adjacency fails conflict
completeness on a literal-keyed construction. A Conflict Witness Index (CWI)
incrementally maintains key-induced record equivalence and returns one
shortest witness per conflict. Controlled evaluation covers 252 instances
with 132 conflicts, plus 12 multi-conflict queries. Shared premises reduce a
32-conflict joint certificate from 192 to 68 triples, whereas 32 disjoint
conflicts require all 192. Exact maintained, exact on-demand, and adaptive
exact retrieval return the same 2--12 triples per individual conflict; learned
baselines require up to whole 336--440-triple stores on key chains. All
confirmatory data are synthetic with an oracle schema: this is a retrieval
contract and cost study, not evidence of real-world conflict prevalence.

## TL;DR

We define conflict completeness, prove the exact joint-budget boundary, and
make maintained retrieval return either every checkable conflict witness or
explicit overflow, with controlled evidence for premise sharing and disjoint
conflicts.
