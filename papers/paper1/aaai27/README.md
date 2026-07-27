# AAAI-format manuscript

**Conflict-Complete Retrieval: Returning Checkable Contradictions from Bounded Agent Memory**

## Current status

- `paper.pdf`: 6 pages total in the AAAI 2027 submission style.
- 5 pages contain the paper and the beginning of references; page 6 contains references only.
- Clean build: no LaTeX warnings, undefined citations/references, or overfull boxes.
- 13 cited bibliography entries, all resolved to primary publication metadata or a DOI-backed dataset record.
- The confirmatory paper contains no hosted-reader result and no unaudited real-data prevalence claim.

The manuscript fits the usual AAAI main-track limit of seven content pages plus references. The call for papers, not the Author Kit, is authoritative for the intended submission cycle.

## Files

| File | Role |
|---|---|
| `paper.tex` | Submission manuscript |
| `paper.bib` | Verified bibliography |
| `paper.pdf` | Compiled manuscript |
| `aaai2027.sty`, `aaai2027.bst` | Unmodified Author Kit style files |
| `ReproducibilityChecklist.tex` | Author Kit checklist; not currently included by the style |

The old reader figures remain in the directory for provenance but are not referenced by the corrected paper. Reader results are explicitly quarantined in `packages/predicate-eval/results/reader/README.md`.

## Build

```bash
podman run --rm -v "$PWD":/w:Z -w /w localhost/texlive-aaai:latest \
  sh -c 'pdflatex -interaction=nonstopmode paper.tex && bibtex paper && \
         pdflatex -interaction=nonstopmode paper.tex && \
         pdflatex -interaction=nonstopmode paper.tex'
```

## Evidence added in the publication audit

- Exact on-demand and adaptive exact witness baselines.
- BM25, pinned MiniLM dense retrieval, and reciprocal-rank-fusion baselines.
- Eight controlled families: 252 instances and 132 conflicts.
- Repeated scaling companion: 11 measured repetitions after one warm-up through 100,000 persons / 560,009 triples.
- Exploratory DBLP--Google Scholar topology audit with source hashes and explicit non-claims.
- Corrected formal contract: one complete witness per relevant conflict, distinct from proof-exhaustive completeness.

The main evidence files are under `packages/predicate-eval/results/{curves,cwi,dense,ondemand,retrieval,scale}`. The external audit is `../probes/dblp-scholar-topology-audit-2026-07-27.json`.

## Venue timing

Repository planning documents target AAAI-28. The recorded AAAI-27 abstract deadline was 2026-07-21, so this manuscript can be submitted to AAAI-27 only if an abstract was already registered. Otherwise it is prepared for the next eligible top-venue cycle; changing the venue requires updating the style and its current call requirements.
