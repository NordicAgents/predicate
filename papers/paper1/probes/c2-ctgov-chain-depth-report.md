# C2 chain-depth probe — clinical-trial registry records (ClinicalTrials.gov)

**Date run:** 2026-07-22
**Status:** EXPLORATORY (continues Amendment A2.7's terms; hypothesis-generating, never confirmatory).
No benchmark instance mined; aggregates only.
**Script:** `c2-ctgov-chain-depth-probe.mjs` (node builtins only, API v2, no key required)

## Why this probe exists

The C1/OSV probe (2026-07-17) found **99.5%** of co-referent record pairs share a key *directly*
(m = 1) and **no pair at m ≥ 3 anywhere**. Since CWI's measured advantage over `key-aware@1` lives
entirely at m ≥ 2, that result said the witness index earns nothing in C1 — and raised the obvious
question of whether C1 is representative. C2 is the natural contrast: trial registrations carry an NCT
number *plus* sponsor protocol ids, NIH grant numbers, EudraCT numbers, CTIS ids, and retired NCT
aliases, so records can chain A —sponsor-id— B —grant— C without A and C sharing anything.

## Sample

| Field | Value |
|---|---|
| Source | ClinicalTrials.gov API v2 `/studies` |
| Fetched | 2026-07-22 |
| Records | 40,245 over 40 pages × 1,000 |
| Sampling | **Convenience sample** — API default order, not random. No registry-wide rate is claimed. |
| Fields | NCTId, NCTIdAlias, OrgStudyIdInfo, SecondaryIdInfo |
| Normalization | trim + uppercase, namespaced by id type, min length 4, stop-list for `NA`/`PENDING`/… (declared in the script header **before** the run) |

Identifier types: NCT 40,245 · ORG 39,517 · OTHER 3,337 · NIH 2,452 · SEC 2,199 · REGISTRY 1,284 ·
EUDRACT_NUMBER 1,214 · OTHER_GRANT 739 · CTIS 142 · AHRQ 16 · FDA 5.

## Results, beside C1

| Quantity | **C2 (trials)** | C1 (vulnerabilities) |
|---|---|---|
| Records | 40,245 | 24,331 |
| Components | 39,452 | 17,891 |
| Multi-record components | **190 (0.5%)** | 5,248 (29.3%) |
| Components containing a chain | 9 | 16 |
| Co-referent pairs at m = 1 | 1,380 (86.0%) | 8,170 (99.5%) |
| **Co-referent pairs at m ≥ 2** | **225 (14.0%)** | 43 (0.52%) |
| Pairs at m = 3 | **3** | 0 |
| **Max depth observed** | **3** | 2 |

Components skipped as too large for pairwise enumeration: 1 (148 records) — its pairs are **excluded**
from every count above, so the m ≥ 2 share is if anything conservative.

## Reading

1. **The chain regime does occur — 27× more often here than in C1.** 14.0% of co-referent pairs
   require ≥ 2 key hops, against 0.52% in vulnerabilities. This is the first evidence that CWI's
   winning regime is not an artifact of the fixtures. The C1 conclusion ("the witness index earns
   nothing") is therefore **domain-specific, not general** — which is exactly what a single-domain
   probe could not tell us and why this one was worth running.

2. **`conflict-chain-m3` now has a real-world analogue.** C1 had no pair at m ≥ 3, making the m = 3
   fixture look like a store shape reality never produces. C2 has three. Rare, but non-empty.

3. **The counter-current: co-reference itself is far rarer here.** Only 0.5% of components are
   multi-record, against 29.3% in C1. So C2 trades a common mechanism with flat depth (C1) for a rare
   mechanism with real depth. Neither domain gives both, and the honest combined statement is: *the
   cross-record mechanism is common in vulnerability records but almost never chained; it is
   uncommon in trial registrations but chains a seventh of the time when it occurs.*

4. **This probe does NOT measure conflict.** The C1 probe could compare severity and affected-range
   payloads within a group. The trial analogue — whether co-referent records actually *disagree* — lives
   in per-version record history, for which there is **no API v2 endpoint** (domain-selection §C2(a);
   the `cthist` package scrapes Record History pages). So C2 establishes that the *structure* exists,
   not that it carries contradictions. **The structural claim must not be reported as a conflict rate.**
   Closing that gap is a Phase-2 task requiring version-history retrieval.

5. **Sampling caveat, stated plainly.** API default order is not random, and 40,245 of ~540,000
   registered studies is under 8%. Nothing here estimates a registry-wide rate; the claim is
   existential — the m ≥ 2 structure occurs at a materially non-zero rate in a large real sample — and
   that claim is robust to the sampling because it is a lower bound on occurrence.

## Consequence for the paper

- §4.4 and §6 should now say that chain prevalence is **domain-dependent and measured**: ~0.5% in
  vulnerability records, ~14% in trial registrations. The abstract's current framing (chains are 0.5%,
  citing C1 alone) is **too pessimistic** and must be updated to carry both numbers.
- The fixed-k dilemma has an empirical home: in a domain where 14% of co-referent pairs are chained,
  choosing k = 1 silently misses one pair in seven, and choosing k = 3 buys the radius-3 ball on every
  query (29.7× the witness cost across our families).
- Gate C's "≥ 2 realistic domains reproduce the failure mechanism" is now better evidenced
  *structurally* — but C2's conflict dimension is unmeasured, so C2 cannot yet be counted toward Gate C
  on the same footing as C1. The C1 semantic annotation (A5.1) remains the binding path.
