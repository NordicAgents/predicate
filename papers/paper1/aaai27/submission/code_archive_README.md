# Anonymous AAAI-27 code and data artifact

This reviewer artifact supports the paper **“Conflict-Complete Retrieval:
Returning Checkable Contradictions from Bounded Agent Memory.”**

It contains the implementation, deterministic synthetic fixtures, focused
tests, and frozen paper-facing results for the Conflict Witness Index (CWI),
exact and on-demand comparators, sparse/dense retrieval comparisons, and the
scale ledger. It also contains the built-in-only external topology-audit
script and its frozen report.

## Scope and exclusions

The confirmatory results use synthetic fixtures and an oracle schema. The
external DBLP--Google Scholar analysis is exploratory and audits topology only;
unequal year strings are not treated as independently adjudicated semantic
conflicts.

The archive excludes repository history, internal planning documents,
installed dependencies, compiled output, caches, credentials, service launch
wrappers, and hosted-reader runs that the paper explicitly excludes from
confirmatory evidence. Dense re-execution requires separately obtaining the
cited third-party encoder weights; the frozen dense outputs and pinned Python
environment are included for auditability.

For double-blind review, the project-owned RDF namespace is replaced
consistently across source, fixtures, and frozen textual outputs by the
reserved namespace `https://example.org/anonymous-predicate/`. This
name-only substitution changes no graph structure, label, measurement, or
scientific value. Third-party dataset and dependency links remain intact.

The anonymous review package itself grants no public-release license. License
selection for a publication release remains an author decision.

## Environment

- Node.js 20 or newer (the reported experiments used Node.js 22.17.1)
- Corepack with pnpm 9
- Python 3.11 and `uv` only for optional dense-baseline re-execution

Install JavaScript dependencies from the archive root:

```bash
corepack pnpm install --frozen-lockfile
```

The install can print a non-fatal warning that the `predicate-mcp` executable
target is absent. The paper-facing commands do not use that executable, and
its compiled `dist/` target is intentionally excluded from this source
archive. Dependency installation still completes successfully.

## Focused verification

Run the 57 focused tests covering the paper-facing maintained index, exact and
on-demand witnesses, retrieval policies, instance scoring, scaling, and
controlled conflict fixtures:

```bash
corepack pnpm --filter predicate-eval test -- --run \
  tests/cwi.test.ts \
  tests/exact-baselines.test.ts \
  tests/ondemand-witness.test.ts \
  tests/adaptive-key-witness.test.ts \
  tests/retrieval-policies.test.ts \
  tests/instances.test.ts \
  tests/scale-ledger.test.ts \
  tests/conflict-bench.test.ts \
  tests/conflict-xr.test.ts
```

Type-check the evaluation package:

```bash
corepack pnpm --filter predicate-eval typecheck
```

Verify every shipped payload digest:

```bash
sha256sum -c MANIFEST.sha256
```

## Representative regeneration

The following commands regenerate representative result files in
`packages/predicate-eval/results/`. Run them in a disposable copy if you want
to retain the frozen outputs unchanged.

```bash
corepack pnpm --filter predicate-eval cwi conflict-d20
corepack pnpm --filter predicate-eval exact conflict-d20 --system key-join-x
corepack pnpm --filter predicate-eval ondemand-witness conflict-d20
corepack pnpm --filter predicate-eval adaptive-key-witness conflict-chain-m3
corepack pnpm --filter predicate-eval retrieval-policies conflict-d20
corepack pnpm --filter predicate-eval scale-ledger --sizes 300
```

Timing values are machine-dependent and are not expected to reproduce byte for
byte. Deterministic labels, witnesses, confusion counts, fixture identifiers,
and integrity hashes should agree.

## Layout

- `packages/predicate-eval/src/cwi/`: maintained Conflict Witness Index
- `packages/predicate-eval/src/exact/`: exact key/equivalence comparators
- `packages/predicate-eval/src/ondemand/`: on-demand and adaptive witnesses
- `packages/predicate-eval/src/rigs/`: retrieval-policy evaluation
- `packages/predicate-eval/src/scale-ledger/`: scaling protocol
- `packages/predicate-eval/fixtures/`: deterministic synthetic data
- `packages/predicate-eval/results/`: frozen paper-facing outputs
- `packages/predicate-eval/tests/`: implementation and claim-boundary tests
- `external_audit/`: exploratory topology-audit script and frozen report
- `MANIFEST.sha256`: payload integrity manifest
