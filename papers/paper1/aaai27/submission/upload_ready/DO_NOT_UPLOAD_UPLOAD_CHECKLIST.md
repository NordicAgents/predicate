# AAAI-27 upload checklist

This file, `OPENREVIEW_FIELDS.md`, and `SHA256SUMS.txt` are operator notes.
Do **not** upload them to OpenReview.

## Upload mapping

1. Upload `01_main_anonymous.pdf` as the main paper.
2. Upload `02_reproducibility_checklist.pdf` in the designated checklist field.
3. Upload `03_supplement_anonymous.pdf` as the supplementary document.
4. Upload `04_code_data_anonymous.zip` as the code/data package.
5. Do not upload Markdown notes, checksums, TeX sources, logs, or repository
   history.

## Automatically verified on 2026-07-28

- Main paper: 6 US-Letter pages; content and references share page 6.
- Supplement: 4 US-Letter pages.
- Reproducibility checklist: 3 US-Letter pages with every real answer slot
  completed. The unchanged instructions still display the phrase
  `Type your response here` as an example.
- All PDFs: PDF 1.7, unencrypted, embedded Type 1 fonts, no Type 3 or
  unembedded fonts, zero embedded files, and no author/title/subject/keyword
  metadata.
- Build logs: no LaTeX errors, overfull boxes, undefined citations, undefined
  references, or incomplete conditionals. Underfull-box notices remain
  cosmetic.
- Text scans: no author names, home paths, institution/account identifiers,
  acknowledgments, or web links.
- Main paper and supplement display `Anonymous submission` on page 1.
- Code/data ZIP: 376 regular-file members, deterministic timestamps, no hidden
  member, no symlink, no repository history, no installed dependency, no
  compiled output, and no identity-pattern hit.
- The author-owned repository link is excluded and the project-owned RDF
  namespace is consistently replaced by the reserved
  `https://example.org/anonymous-predicate/` namespace; third-party dependency
  and dataset links remain intact.
- Clean extracted archive: offline dependency installation completed; all 64
  focused tests passed; the evaluation package type-check passed; every
  `MANIFEST.sha256` entry verified.
- The manuscript contains a generative-AI-use disclosure.

## Required author checks before pressing Submit

- [ ] An abstract for this exact paper was registered by the July 21 deadline.
- [ ] The final title/abstract do not violate the no-substantial-change rule.
- [ ] Every author approves the exact paper, supplement, checklist answers,
  title, abstract, TL;DR, topics, author list, and author order.
- [ ] Every author profile, conflict, and reviewer-availability requirement is
  complete.
- [ ] No overlapping work is under concurrent archival review and the
  author-specific submission limit is satisfied.
- [ ] The ethics declaration is accurate.
- [ ] The AI-use disclosure is accurate and approved by every author.
- [ ] The public-release license decision, intentionally marked `partial` in
  the checklist, is acceptable to every author.
- [ ] The live form accepts the ZIP size.

## After upload

- [ ] Download and open every uploaded file.
- [ ] Confirm the downloaded main paper has 6 pages and displays
  `Anonymous submission`.
- [ ] Verify the four downloaded files against `SHA256SUMS.txt`.
- [ ] Recheck all OpenReview fields and save the submission confirmation/ID.

Run the local checksum check from this directory:

```bash
sha256sum -c SHA256SUMS.txt
```
