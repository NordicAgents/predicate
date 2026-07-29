# AAAI-27 submission rules and build checklist

**Conference:** AAAI 2027 Main Technical Track
**Last checked:** 2026-07-28
**Scope:** Main paper, reproducibility checklist, supplementary PDF, and
anonymous code/data archive

This checklist is adapted for the Predicate paper from the supplied submission
rules. The official pages were rechecked on 2026-07-28:

- Main-track call:
  <https://aaai.org/conference/aaai/aaai-27/main-technical-track-call/>
- Submission instructions:
  <https://aaai.org/conference/aaai/aaai-27/submission-instructions/>
- Supplementary-material rules:
  <https://aaai.org/conference/aaai/aaai-27/supplementary-material/>
- Publication policies:
  <https://aaai.org/aaai-publications/aaai-publication-policies-guidelines/>

## 1. Deadlines and eligibility

- [ ] An abstract for this paper was registered by **July 21, 2026 at 23:59
  UTC-12**. Without that registration, AAAI-27 will not accept the full paper.
- [ ] Main paper and completed checklist are submitted by **July 28, 2026 at
  23:59 UTC-12** (**July 29 at 13:59 CEST**).
- [ ] Supplement and code/data archive are submitted by **July 31, 2026 at
  23:59 UTC-12** (**August 1 at 13:59 CEST**).
- [ ] Do not modify the main paper after its deadline.

## 2. Main-paper format

- [x] Official unmodified AAAI-27 style and bibliography files are used.
- [x] PDF page size is US Letter (612 by 792 points).
- [x] The paper is no more than 7 content pages and 9 pages total.
- [x] Pages after page 7, if any, contain references only.
- [x] The PDF is self-contained and does not depend on the supplement.
- [x] Fonts are embedded Type 1 or TrueType; no Type 3 fonts.
- [x] The PDF is unencrypted and has no embedded files.
- [ ] Authors visually inspect the first and last page of the final PDF.

Current source: `papers/paper1/aaai27/paper.tex`.

## 3. Double-blind anonymity

- [x] Submission mode is enabled.
- [x] The source author is `Anonymous Submission`; affiliations are empty.
- [x] No acknowledgments, author names, affiliations, accounts, home paths, or
  author-owned web links occur in an upload deliverable.
- [x] PDF metadata has no author, title, subject, or keyword value.
- [x] Supplement and code archive are scanned in addition to the main paper.
- [x] ZIP member names and contents are scanned for identifying strings.
- [ ] Authors confirm that the manuscript title and distinctive project terms
  do not reveal an author-owned public preprint or repository.

## 4. Claims and scientific wording

- [x] The exact detector is explicitly not claimed as a contribution.
- [x] Fixed-hop incompleteness is limited to non-type IRI adjacency;
  `rdf:type`-traversing policies are explicitly excluded.
- [x] Core claims use deterministic synthetic fixtures; the semi-natural leg
  preserves gold linkage topology and natural attributes but injects
  controlled labels and makes no natural-prevalence claim.
- [x] DBLP--Google Scholar lexical disagreements are not treated as semantic
  conflict labels; the controlled predicate and supplied schema are explicit.
- [x] The cross-system workload gives incremental, cached-snapshot, and fresh
  exact arms the same parsed source snapshot and reports retained state,
  measurement boundaries, and repetitions.
- [x] Joint-budget feasibility, overflow behavior, and witness-sharing limits
  are stated and tested explicitly.
- [x] Exact joint selection distinguishes proven infeasibility from capped
  search and returns no partial context on abstention.
- [x] Negative results, exclusions, and limitations are retained.

## 5. References and attribution

- [x] Every cited key resolves in the final bibliography.
- [x] No undefined citation or reference warning occurs in the final log.
- [x] Central prior-art statements cite primary publications.
- [x] No AI system is listed as an author or scientific source.
- [ ] Authors confirm that no uncited self-overlap or required anonymous
  self-citation exists.

## 6. Generative-AI policy

- [x] The manuscript includes a generative-AI-use disclosure.
- [x] The disclosure states that human authors verified the text, proofs,
  citations, code, and results and accept responsibility.
- [ ] Every author approves that disclosure and confirms it remains accurate.

Current disclosure:

> Generative AI tools assisted with language editing, software and proof
> review, claim-falsification checks, and submission-compliance auditing. The
> authors verified all text, proofs, citations, code, and results, take
> responsibility for the complete submission, and list no AI system as an
> author or source.

## 7. Ethics and submission integrity

- [ ] Authors attest that there is no plagiarism, fabrication, falsification,
  duplicate or near-duplicate submission, hidden reviewer instruction, prompt
  injection, confidential data, or improperly licensed data.
- [ ] Authors confirm all concurrent-submission and overlap declarations.
- [ ] Every author approves the final author list and order.
- [ ] Every author has a complete OpenReview profile and conflicts.
- [ ] The author-specific submission limit and reviewer-availability
  requirements are satisfied.

Repository inspection cannot certify these author-only items.

## 8. Reproducibility checklist

- [x] Every `Type your response here` placeholder is replaced.
- [x] Answers distinguish complete, partial, no, and not-applicable support.
- [x] The checklist does not promise an unapproved publication license.
- [x] The checklist is compiled and uploaded separately from the main paper.
- [ ] Authors review and approve every final answer.

Current source: `papers/paper1/aaai27/ReproducibilityChecklist.tex`.

## 9. Supplementary PDF

- [x] The supplement is anonymous and separately compiled.
- [x] It contains expanded proofs, assumptions, protocols, and limitations.
- [x] It does not contain an author-owned web link.
- [x] It does not replace an essential main-paper argument.
- [x] Its notation, fixture counts, and claims agree with the main paper.

Current source: `papers/paper1/aaai27/supplement.tex`.

## 10. Anonymous code/data ZIP

- [x] The ZIP has a reviewer-facing root `README.md`.
- [x] Exact setup, focused test, regeneration, and integrity commands are given.
- [x] Required focused source, fixtures, frozen results, and tests are present.
- [x] Repository history, hidden files, caches, compiled output, raw hosted
  reader logs, credentials, and internal planning documents are excluded.
- [x] The archive contains no symlink.
- [x] Member paths and textual contents are scanned for identity and home paths.
- [x] A `MANIFEST.sha256` covers every payload member.
- [ ] Confirm that the live OpenReview form accepts the final ZIP size.

Rebuild from the repository root:

```bash
python3 papers/paper1/aaai27/submission/make_anonymous_archive.py
```

## 11. Build the three PDFs

From `papers/paper1/aaai27/`:

```bash
podman run --rm \
  -v "$PWD:/work:Z" -w /work localhost/texlive-aaai:latest \
  sh -lc 'latexmk -pdf -interaction=nonstopmode -halt-on-error paper.tex &&
          latexmk -pdf -interaction=nonstopmode -halt-on-error supplement.tex &&
          latexmk -pdf -interaction=nonstopmode -halt-on-error ReproducibilityChecklist.tex'
```

Required outputs:

- `paper.pdf`
- `supplement.pdf`
- `ReproducibilityChecklist.pdf`

## 12. Automated PDF checks

```bash
manuscript=papers/paper1/aaai27
for pdf in paper supplement ReproducibilityChecklist; do
  pdfinfo "$manuscript/$pdf.pdf"
  pdffonts "$manuscript/$pdf.pdf"
  pdfdetach -list "$manuscript/$pdf.pdf"
done

rg -n \
  'Overfull|LaTeX Error|undefined references|Citation.*undefined|Warning.*undefined' \
  "$manuscript/paper.log" \
  "$manuscript/supplement.log" \
  "$manuscript/ReproducibilityChecklist.log"
```

The final `rg` command must print nothing. Each PDF must be US Letter,
unencrypted, use embedded Type 1 or TrueType fonts, and have zero embedded
files.

Anonymity scan:

```bash
scan_dir=$(mktemp -d)
for pdf in paper supplement ReproducibilityChecklist; do
  pdftotext "papers/paper1/aaai27/$pdf.pdf" "$scan_dir/$pdf.txt"
done
rg -ni \
  'Midhun|Xavier|Jolly|/home/|principled-bestofk|CINECA|Leonardo|mxavier0|AIFAC|aerobase|Acknowledg(e)?ments' \
  "$scan_dir"
```

Expected result: no output.

## 13. Scientific and repository verification

Minimum focused gate:

```bash
pnpm --filter predicate-eval test -- --run \
  tests/cwi.test.ts \
  tests/cwi-budget.test.ts \
  tests/exact-baselines.test.ts \
  tests/ondemand-witness.test.ts \
  tests/adaptive-key-witness.test.ts \
  tests/retrieval-policies.test.ts \
  tests/context-cost-summary.test.ts \
  tests/instances.test.ts \
  tests/maintenance-workload.test.ts \
  tests/scale-ledger.test.ts \
  tests/conflict-bench.test.ts \
  tests/conflict-xr.test.ts
pnpm --filter predicate-eval typecheck
git diff --check
```

Do not report a command as passing unless it completed successfully. Record
any failure or interrupted check.

## 14. OpenReview fields

- [x] The operator copy of title and abstract matches the final TeX source.
- [x] The TL;DR is conservative and does not exceed the evidence.
- [ ] Authors confirm the exact title and abstract match the previously
  registered abstract sufficiently to satisfy the no-substantial-change rule.
- [ ] Authors select and freeze topics.
- [ ] Authors verify the author list, order, conflicts, concurrent-submission
  declaration, ethics declaration, and generative-AI disclosure.

Operator copy: `upload_ready/OPENREVIEW_FIELDS.md`.

## 15. Upload mapping

Upload only these four artifacts from `submission/upload_ready/`:

1. `01_main_anonymous.pdf` — main-paper field.
2. `02_reproducibility_checklist.pdf` — checklist field.
3. `03_supplement_anonymous.pdf` — supplementary-document field.
4. `04_code_data_anonymous.zip` — code/data field.

Do **not** upload:

- `SUBMISSION_RULES.md`;
- `DO_NOT_UPLOAD_UPLOAD_CHECKLIST.md`;
- `OPENREVIEW_FIELDS.md`;
- `SHA256SUMS.txt`;
- TeX sources, logs, repository history, or any other local file.

## 16. Final pre-submit gate

- [ ] Rebuild all four deliverables from the final source.
- [ ] Rerun all submission-specific checks.
- [ ] Regenerate the upload-ready directory and `SHA256SUMS.txt`.
- [ ] Open and visually inspect the first and last page of each PDF.
- [ ] Complete every author-only attestation above.
- [ ] Upload the four mapped artifacts.
- [ ] Download every artifact from OpenReview and open it.
- [ ] Verify downloaded files against `SHA256SUMS.txt`.
- [ ] Recheck all OpenReview fields and save the submission ID/confirmation.
