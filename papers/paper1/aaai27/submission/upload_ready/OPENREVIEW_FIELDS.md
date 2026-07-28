# OpenReview fields

This is an operator copy/paste aid. Do **not** upload this file as
supplementary material.

The title and abstract below match the final `paper.tex`. Re-sync them after
any manuscript edit.

## Title

Conflict-Complete Retrieval: Returning Checkable Contradictions from Bounded Agent Memory

## Abstract

An agent cannot act on a contradiction that memory retrieval does not expose.
We define *conflict completeness*: for every query-relevant conflict, a
retrieval policy returns at least one complete, source-grounded witness that a
sound checker can verify from the context alone. We show that every fixed-hop
policy based only on IRI adjacency fails this property on a simple
literal-keyed construction. We then implement a Conflict Witness Index (CWI)
that incrementally maintains key-induced record equivalence and returns one
shortest witness per conflict. Controlled evaluation covers 252 instances,
including 132 conflicts, with same-record, direct-key, key-chain, hierarchy,
and time/scope cases. Exact maintained, exact on-demand, and adaptive exact
retrieval return 2--12 witness triples. Direct key-aware retrieval is nearly as
compact for non-chain cases, but requires 91--95 triples on two- and three-link
chains; BM25, dense, and hybrid retrieval require up to the whole
336--440-triple stores there. On a deterministic 100,000-record workload, CWI
uses 1.893 index writes per source triple and processes a 100-query batch in
0.67 ms median over 11 measured repetitions. Detection itself is a standard
exact key join, not a contribution. All claims are limited to synthetic data
with an oracle schema; the result is a retrieval contract and cost study, not
evidence of real-world conflict prevalence.

## TL;DR

We define conflict completeness for bounded agent-memory retrieval, prove a
fixed-hop boundary for IRI-only neighborhoods, and show that a maintained
witness index returns 2--12-triple checkable contradictions across 252
synthetic instances while making explicit the cost, schema, and
external-validity limits.

## Human-entered fields

- Authors and order: **confirm in OpenReview**
- Topics/subject areas: **select and freeze in OpenReview**
- Conflicts: **complete for every author**
- Concurrent-submission declaration: **author attestation required**
- Ethics declaration: **author attestation required**
- Generative-AI disclosure approval: **author attestation required**
- Prior abstract registration: **must already exist for this paper**
