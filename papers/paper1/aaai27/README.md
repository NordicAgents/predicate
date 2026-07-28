# AAAI-format manuscript

**Conflict-Complete Retrieval: Checkable Contradictions under a Context Budget**

## Current status

- `paper.pdf`: 6 pages total in the AAAI 2027 submission style.
- Content ends at the top of page 6; references begin immediately afterward.
- `supplement.pdf`: 3 anonymous pages of expanded proofs, protocol, and artifact scope.
- `ReproducibilityChecklist.pdf`: 3 pages with every answer slot completed.
- Clean build: no LaTeX errors, undefined citations/references, or overfull boxes.
- 13 cited bibliography entries, all resolved to primary publication metadata or a DOI-backed dataset record.
- The confirmatory paper contains no hosted-reader result and no unaudited real-data prevalence claim.
- `submission/upload_ready/` contains the four mapped OpenReview artifacts,
  operator notes, and verified SHA-256 checksums.

The manuscript fits the usual AAAI main-track limit of seven content pages plus references. The call for papers, not the Author Kit, is authoritative for the intended submission cycle.

## Files

| File | Role |
|---|---|
| `paper.tex` | Submission manuscript |
| `paper.bib` | Verified bibliography |
| `paper.pdf` | Compiled manuscript |
| `supplement.tex`, `supplement.pdf` | Anonymous supplementary document |
| `aaai2027.sty`, `aaai2027.bst` | Unmodified Author Kit style files |
| `ReproducibilityChecklist.tex`, `ReproducibilityChecklist.pdf` | Completed standalone Author Kit checklist |
| `submission/SUBMISSION_RULES.md` | AAAI-27 compliance and author-attestation checklist |
| `submission/upload_ready/` | Final upload mapping and deliverables |

The old reader figures remain in the directory for provenance but are not referenced by the corrected paper. Reader results are explicitly quarantined in `packages/predicate-eval/results/reader/README.md`.

## Build

```bash
podman run --rm -v "$PWD":/work:Z -w /work localhost/texlive-aaai:latest \
  sh -lc 'latexmk -pdf -interaction=nonstopmode -halt-on-error paper.tex &&
          latexmk -pdf -interaction=nonstopmode -halt-on-error supplement.tex &&
          latexmk -pdf -interaction=nonstopmode -halt-on-error ReproducibilityChecklist.tex'
```

Rebuild the anonymous code/data archive from the repository root:

```bash
python3 papers/paper1/aaai27/submission/make_anonymous_archive.py
```

## Evidence added in the publication audit

- Exact on-demand and adaptive exact witness baselines.
- BM25, pinned MiniLM dense retrieval, and reciprocal-rank-fusion baselines.
- Eight controlled families: 252 instances and 132 conflicts.
- Twelve multi-conflict queries with exact shared/disjoint joint-budget costs.
- Large-equivalence-class stress through 32,640 materialized conflict pairs.
- Repeated scaling companion: 11 measured repetitions after one warm-up through 100,000 persons / 560,009 triples.
- Exploratory DBLP--Google Scholar topology audit with source hashes and explicit non-claims.
- Exact fixed-budget feasibility boundary and explicit non-partial overflow behavior.
- Corrected formal contract: one complete witness per relevant conflict, distinct from proof-exhaustive completeness.

The main evidence files are under `packages/predicate-eval/results/{budget,curves,cwi,dense,ondemand,retrieval,scale}`. The external audit is `../probes/dblp-scholar-topology-audit-2026-07-27.json`.

## Venue timing

Repository planning documents target AAAI-28. The recorded AAAI-27 abstract deadline was 2026-07-21, so this manuscript can be submitted to AAAI-27 only if an abstract was already registered. Otherwise it is prepared for the next eligible top-venue cycle; changing the venue requires updating the style and its current call requirements.
