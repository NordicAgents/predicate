# Post-audit correction to the external-structure probes

This note supersedes the interpretations in
`c1-osv-chain-depth-report.md`, `c2-ctgov-chain-depth-report.md`, and the
corresponding paragraphs of the pre-rewrite AAAI manuscript. The original
aggregate files remain as an audit trail; they must not be cited as evidence
of real-world co-reference chain prevalence.

## C1 / OSV

The original chain probe joined records through `id`, `aliases`, and
`related`. This is incorrect under the OSV schema. OSV defines `aliases` as
symmetric and transitive identifiers for the same vulnerability, but defines
`related` as non-transitive and permits it to identify a similar but different
vulnerability. Treating `related` as an equality-generating key can therefore
manufacture equivalence classes and chain depths.

The corrected probe uses only each record's `id` and `aliases`. It reports
identifier/alias connectivity, not RDF graph reachability. Whether an
IRI-neighborhood retriever can traverse an identifier depends on how a memory
system serializes that field; the JSON source stores identifiers as strings,
but no RDF graph was built in this probe.

The syntactic severity/range disagreement counts remain exploratory upper
bounds. They are not semantic-conflict rates, and no completed independent
human annotation is available.

## C2 / ClinicalTrials.gov

The original probe treated NCT identifiers, organization protocol identifiers,
registry identifiers, and grant/funding numbers uniformly as entity keys.
That assumption is not valid. In particular, a grant or funding number may
support multiple distinct studies; sharing it does not establish that two NCT
records describe the same study. Consequently, the reported 14.0% chained-pair
share is an identifier-collision statistic under an over-broad key schema, not
a co-reference or conflict prevalence estimate.

Only obsolete/duplicate `NCTIdAlias` values have explicit redirect semantics
suitable for a conservative equivalence probe. A corrected ClinicalTrials
analysis would need a field-specific identity policy and adjudication of
candidate links. Until that work exists, C2 supplies no external-validity
claim for the paper.

## Submission consequence

The main paper must:

1. remove the “99.5% with no graph path” statement;
2. remove the ClinicalTrials 14.0% chain-prevalence statement;
3. describe OSV aggregates, if retained at all, as an exploratory
   alias-connectivity probe with no semantic-conflict or RDF-path claim; and
4. scope all confirmatory conclusions to synthetic fixtures with an oracle
   schema.
