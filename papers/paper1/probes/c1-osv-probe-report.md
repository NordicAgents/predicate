# Gate C preview probe — C1 vulnerability records (OSV, PyPI ecosystem)

**Date run:** 2026-07-13
**Status:** EXPLORATORY (pre-registration Amendment A2.7; hypothesis-generating, never confirmatory).
**Purpose:** Gate A condition 5(c) preview (`gate-a-analysis.md` §5): does at least one realistic
domain from `domain-selection.md` reproduce the cross-record mechanism — records co-referent
ONLY through a shared key, carrying independently authored, genuinely conflicting constrained
values? This is domain-selection §6 C1 step 4, run against the OSV bulk export instead of the
NVD API (no API key needed; the OSV slice already aggregates independently authored sources).

## Snapshot

| Field | Value |
|---|---|
| Source | `https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip` |
| Snapshot identity | `Last-Modified: Mon, 13 Jul 2026 07:54:02 GMT`, 29,383,901 bytes |
| Extraction | 23,137 JSON records (PYSEC-, GHSA-, and converted CVE-prefixed ids) |
| Script | `papers/paper1/probes/c1-osv-prevalence-probe.mjs` (node builtins only) |
| Raw data | NOT committed (per-source licenses, domain-selection §5); refetch with the commands in the script header |

## Results

| Quantity | Value |
|---|---|
| Records with ≥ 1 CVE alias | 10,882 / 23,137 |
| Distinct CVE keys | 5,649 |
| **CVE groups with ≥ 2 co-referent records** | **4,556 / 5,649 = 80.7%** |
| Severity-comparable multi-record groups (shared CVSS family or label) | 2,445 |
| — of which DISAGREE on severity | 324 = **13.3%** |
| Range-comparable multi-record groups (same package described by ≥ 2 records) | 4,533 |
| — of which DISAGREE on affected ranges | 2,196 = **48.4%** |

Machine-readable copy: the script prints the same numbers as JSON; the run above was archived
from the working session (values are reproducible from the same snapshot; a later snapshot will
shift them, which is why the snapshot identity is recorded).

## Reading (and the honest caveats)

1. **The mechanism reproduces.** In this domain, cross-record co-reference through a shared
   key literal (the CVE id — structurally the benchmark's `email`) is the NORM: 80.7% of
   CVE-keyed groups have at least two records, authored by different sources (GHSA, PYSEC,
   converted NVD). An IRI-neighbourhood retriever holding one record has no graph path to its
   co-keyed siblings — exactly the Prop. 3 store shape. Gate C's failure mode 1
   (`gate-a-analysis.md` §5, "the boundary is vacuous in the wild") is NOT triggered by C1 on
   this evidence.
2. **Genuinely conflicting constrained values exist at high prevalence.** 48.4% of comparable
   groups disagree on affected ranges, 13.3% on severity — consistent with Dong et al.
   (USENIX Sec 2019): "only 59.82% of the vulnerability reports/CVE summaries strictly match
   the standardized NVD entries."
3. **Caveat — syntactic vs semantic disagreement.** Range signatures are canonicalized
   event/version sets; some disagreements are representational (OSV itself notes GitHub tracks
   ranges "not representable in OSV format"). The 48.4% is therefore an UPPER bound on semantic
   contradiction; the Phase-2 annotation step (domain-selection §3.1(f), 300-pair sample, two
   annotators) adjudicates semantics before any benchmark density is fixed.
4. **Caveat — independence of authorship.** Some group members are format conversions of a
   common upstream (GHSA → PYSEC advisories); the severity/range payloads are still
   independently maintained fields in practice, but per-source lineage must be modeled in
   Phase 2 before treating disagreements as independent observations.
5. **No benchmark instances were mined from this probe** (held-out hygiene; aggregates only).

## Consequence for Gate B conditions

Condition 5(c) ("at least one domain demonstrably reproduces the cross-record mechanism") has a
positive PREVIEW on C1. It is satisfied for Gate B purposes once the Phase-2 annotation sample
confirms the semantic disagreement rate; this probe authorizes spending that annotation budget.
