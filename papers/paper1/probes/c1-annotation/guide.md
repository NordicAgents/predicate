# C1 semantic-annotation guide (OSV / PyPI, Amendment A4.4 — EXPLORATORY)

**Status.** This harness is registered as *exploratory tooling* in
`papers/paper1/pre-registration.md` Amendment A4.4 (continuing A2.7 and
`domain-selection.md` §6 C1 step 4). It produces **no confirmatory numbers**.
The semantic-disagreement rate it will eventually yield becomes citable
**only via a future pre-registration amendment** that registers the estimate's
confirmatory use before the adjudicated labels are analyzed for that purpose.

**Do not commit sampler outputs.** `sample.jsonl` embeds verbatim OSV record
text (severity and affected-range payloads), which carries per-source licenses
(`domain-selection.md` §5). All sampler and agreement outputs are written
outside the repository (default: the parent of the extracted OSV directory);
only aggregate statistics (counts, agreement, kappa) may ever be committed.

## Task definition

The prevalence probe (`../c1-osv-prevalence-probe.mjs`, A2.7) found that
CVE-keyed groups of OSV records frequently *syntactically* disagree on
severity or affected version ranges. Syntactic disagreement is what a
conflict detector flags; the open question for Gate C is how often it is a
**semantic contradiction** (two records genuinely asserting incompatible
facts) versus a benign representational, temporal, or scope artifact.

You annotate CVE groups: for each sampled group you see every member
record's id, `modified` date, verbatim `severity` payload, database-specific
severity label, and verbatim `affected` payload (in `sample.jsonl`; the CSV
row identifies the group by CVE id and stratum). Assign exactly **one** label
per group describing the *dominant* relationship among its members'
severity/affected claims.

## Labels and decision rules

- **`semantic-contradiction`** — Members make incompatible claims about the
  same fact in the same scope and epoch: e.g. one record says versions
  < 2.1.0 of package X are affected while another says < 1.9.0 with both
  current, or CVSS vectors of the same family that score materially
  different exploitability for the same flaw. Rule: if a downstream consumer
  acting on record 1 would make a decision record 2 says is wrong (and vice
  versa), and no rule below explains the difference away, label
  semantic-contradiction.

- **`representational-difference`** — The **same version set expressed
  differently**: e.g. one record uses range *events*
  (`introduced`/`fixed`) while the other enumerates the same versions
  explicitly, or equivalent CVSS vectors serialized with different metric
  order or version suffix. Rule: mentally normalize both payloads; if the
  denoted sets/scores coincide, the disagreement is representational only.

- **`temporal-supersession`** — One record **clearly supersedes** the other:
  it has a later `modified` date AND its content subsumes the older record's
  claims (e.g. the newer record extends the affected range after a botched
  fix, or corrects severity following rescoring). Rule: both a later
  modified date and content subsumption are required; a later date alone
  with disjoint content is not supersession.

- **`scope-difference`** — Both records are correct **in different
  ecosystems or artifacts**: e.g. one describes the PyPI wheel and the other
  a vendored copy or a different package/binary, so the differing ranges
  attach to different artifacts despite the shared CVE. Rule: check the
  `affected[].package` entries; if the differing signatures belong to
  genuinely different artifacts, label scope-difference.

- **`agree`** — No substantive disagreement: the members' comparable fields
  match (expected for the `no-disagreement` control stratum, but apply your
  own judgment — the automatic classifier can miss things in both
  directions).

- **`unsure`** — You cannot decide within the time budget, or the group
  needs external evidence (advisory pages, changelogs) to resolve.

**Tie-break policy.** If several labels apply, choose the *earliest* matching
label in this precedence order: `semantic-contradiction` >
`temporal-supersession` > `scope-difference` >
`representational-difference` > `agree`. That is: a genuine contradiction
wins over any benign explanation of *other* parts of the group, and among
benign explanations the more specific ones win. Use `unsure` rather than a
low-confidence guess — the adjudication pass exists to resolve those.

**Unsure policy.** `unsure` is a real label, not a skip: fill in a one-line
rationale saying what evidence was missing. Blank labels are treated as
*unannotated* and excluded (with a count) by `agreement.mjs`.

**Time budget.** 2–4 minutes per group (domain-selection C1(f)). If you
exceed 4 minutes, label `unsure` and move on.

## Strata (fixed BEFORE sampling)

Sampling frame: multi-record CVE groups from the extracted OSV PyPI slice,
classified by the probe's signature logic. Controls are groups comparable on
at least one field (severity or ranges) with no disagreement on any
comparable field. Sizes were fixed here before `sample-cli.mjs` was first
run; if a stratum has fewer candidates than its target, the sampler takes
all of them and prints a shortfall note that must be reported.

| Stratum | Definition (probe semantics) | Target n |
|---|---|---|
| `range-disagree-only` | range-disagree AND NOT severity-disagree | 100 |
| `severity-disagree-only` | severity-disagree AND NOT range-disagree | 50 |
| `both-disagree` | severity-disagree AND range-disagree | 50 |
| `no-disagreement` | comparable, no disagreement (controls) | 100 |

Selection is deterministic: candidate CVE ids sorted lexicographically, one
seeded Fisher–Yates shuffle per stratum (mulberry32, seed `0xc1a0`), first N
taken.

## Reproduction

```sh
# 1. Fetch and extract the OSV PyPI slice (record the Last-Modified header):
curl -sSL -o osv-pypi-all.zip \
  "https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip"
unzip -q osv-pypi-all.zip -d osv-pypi

# 2. Draw the stratified sample (outputs go OUTSIDE the repo; default is the
#    parent directory of osv-pypi):
node papers/paper1/probes/c1-annotation/sample-cli.mjs osv-pypi [output-dir]

# 3. Each annotator independently fills the `label` and `rationale` columns
#    of their copy (annotator-A.csv / annotator-B.csv), reading the group's
#    payloads from sample.jsonl. Do not discuss groups before both are done.

# 4. Compute agreement and the adjudication worksheet:
node papers/paper1/probes/c1-annotation/agreement.mjs \
  <dir>/annotator-A.csv <dir>/annotator-B.csv [output-dir]
# -> label distributions, raw agreement, Cohen's kappa, confusion matrix,
#    and adjudication.csv (disagreeing rows only) for the third-pass
#    adjudicator.
```

## File format

All CSVs use RFC4180-minimal quoting: a field is double-quoted iff it
contains a comma, double quote, CR, or LF; internal double quotes are
doubled. Rationales may therefore contain commas freely. `agreement.mjs`
parses exactly this dialect. Columns of the annotator files:
`cve, stratum, label, rationale` — edit only `label` and `rationale`; do not
reorder or remove rows.

## What this can and cannot support

The adjudicated labels estimate, per stratum, the fraction of syntactic
disagreements that are semantic contradictions vs. benign artifacts — a
Phase-2 / Gate-C *input* for density and oracle decisions. Under the current
registration this estimate is hypothesis-generating only; any confirmatory
claim (in the paper or elsewhere) requires a new dated amendment registering
the analysis before it is run on the adjudicated data (Amendment A4.4).
