# C1 chain-depth probe — does the witness index's winning regime occur in the wild?

**Date run:** 2026-07-17
**Status:** EXPLORATORY (continues pre-registration Amendment A2.7; hypothesis-generating, never
confirmatory). No benchmark instance is mined; aggregates only.
**Script:** `c1-osv-chain-depth-probe.mjs` (node builtins only)

## Why this probe exists

The A2.7 probe grouped OSV records by a **single shared CVE alias** and reported that 80.7% of
CVE-keyed groups hold ≥ 2 independently authored records. That establishes cross-record
co-reference — but only at **chain depth m = 1**, because grouping by one alias makes every pair
m = 1 *by construction*.

m = 1 is precisely the regime where the witness index earns nothing. On the benchmark's m = 1
families, `key-aware@1` retrieval is already witness-complete at **8 context triples** against CWI's
**6** (1.3×), while CWI pays ~1.9× write amplification for the privilege. The measured CWI advantage
lives entirely at **m ≥ 2**, where a neighbourhood policy must either miss (k < m ⇒ 0 recall) or buy
the whole radius-m ball.

So the live external-validity question was never "do records co-refer?" (answered: yes) but **"do
co-referent records require a chain of ≥ 2 key hops?"** OSV records carry multiple aliases (CVE-,
GHSA-, PYSEC-, MAL-, …), so A may share a CVE with B, B a GHSA with C, and A and C share nothing —
an m = 2 chain that only a union-find over *all* aliases can see.

## Snapshot

| Field | Value |
|---|---|
| Source | `https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip` |
| Snapshot identity | `Last-Modified: Fri, 17 Jul 2026 11:53:29 GMT`, 31,848,518 bytes |
| Extraction | 24,331 records, 32,371 distinct identifiers |
| Note | **A different snapshot from A2.7's** (`2026-07-13`, 23,137 records). The two probes' rates are therefore not directly comparable; this one measures a new quantity. |

Identifier types: PYSEC 16,733 · GHSA 12,285 · CVE 12,155 · MAL 11,572 · BIT 2,664 · SNYK 672 ·
CGA 611 · GO 33 · RUSTSEC 27 · others < 10.

## Results

| Quantity | Value |
|---|---|
| Connected components (~K classes over all aliases) | 17,891 |
| Multi-record components | 5,248 |
| **Components containing any chain (m ≥ 2)** | **16 (0.30%)** |
| Co-referent record pairs at **m = 1** | **8,170 (99.5%)** |
| Co-referent record pairs at **m ≥ 2** | **43 (0.52%)** |
| Disagreeing pairs at m = 1 | 3,428 |
| **Disagreeing pairs at m ≥ 2** | **36 (1.04% of all disagreements)** |
| **Maximum chain depth observed** | **2** |

Disagreement density by depth:

| m | comparable pairs | disagreeing | rate |
|---|---|---|---|
| 1 | 7,126 | 3,428 | 48.1% |
| 2 | 38 | 36 | **94.7%** |

## Reading (committed to before the run, and honoured)

1. **The witness index's winning regime does not materially occur in this domain.** 99.5% of
   co-referent pairs share a key *directly*. The probe's pre-committed reading was: *"If disagreeing
   pairs are overwhelmingly m = 1, then in this domain `key-aware@1` retrieval is witness-complete at
   ~8 triples and the witness index earns nothing. That is falsification-clause-2 shaped and should
   be reported as such, not explained away."* It is m = 1 at 99.0% of disagreements. **Reported as
   such.**

2. **Falsification clause 2 is engaged in spirit, not in letter.** Clause 2 asks whether
   *literal/lexical/dense* retrieval matches key-aware, degenerating "index the witness-connecting
   relation" into "index everything shared". The measured failure is the neighbouring one, which no
   clause named: **`key-aware@1` matches CWI** at m = 1, degenerating "index the witness" into
   "index the one key everyone already shares". The registration did not anticipate this failure
   mode; recording that gap is part of the finding.

3. **What survives, and it is not nothing.** Prop. 3's regime *does* occur at scale: at m = 1 the two
   records are co-referent only through a shared key **literal**, so IRI-adjacency retrieval has no
   path between them and is conflict-incomplete on 99.5% of these pairs. The paper's thesis — *you
   must index the relation that connects witnesses* — is **vindicated**; what fails is the claim that
   a bespoke witness index is the way to do it. In this domain the minimal sufficient implementation
   of that thesis is **key-aware retrieval**, not CWI.

4. **`conflict-chain-m3` has no real-world analogue here.** No pair at m ≥ 3 exists anywhere in the
   slice. The m = 3 fixture tests a store shape this domain never produces.

5. **The chain regime is rare but strikingly conflict-dense.** Where chains do occur, 94.7% of
   comparable pairs disagree, against 48.1% at m = 1. Two independently authored records that agree
   tend to get merged under a common alias; those that disagree apparently do not. This is
   hypothesis-generating only (n = 38) and must not be reported as a rate.

## Consequence for the paper and for Gate B

- **Gate B condition 5(c)** asks whether a realistic domain reproduces *the cross-record mechanism*.
  It does — 5,248 multi-record components, IRI-unreachable through key literals. 5(c) is about the
  mechanism, not about chain depth, and this probe does not settle it (the A5.1 semantic annotation
  does).
- **The CWI-over-`key-aware` argument has no empirical object in C1.** Any paper claim that witness
  indexing beats neighbourhood retrieval must either (a) rest on a domain where chains are common —
  none is yet identified — or (b) be dropped in favour of the claim the data supports: *index the key
  relation; IRI adjacency is the wrong index.*
- **The remaining live CWI argument is the fixed-k dilemma**, and it weakens under this result: if a
  deployment knows m = 1 dominates, k = 1 is safe and cheap. The 29.7× fixed-k premium assumed one
  k must cover m ∈ {1,2,3}; this slice says m = 1 covers 99.5%.
- C2 (clinical-trial versions) and C3 (scholarly records) may have different depth profiles —
  versioned records chain through revision identifiers in a way advisories do not. Running this same
  probe there costs minutes and is the obvious next step before any Gate-B decision.
