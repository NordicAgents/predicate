# EVIDENCE-MANIFEST — frozen mechanism-v0 evidence contract

Status: Phase-0 deliverable (publication plan §"Create a clean experiment
manifest and one-command evidence build"). This file is the contract between
the paper's claims and the bytes on disk.

## 1. The frozen-evidence contract

- **Two snapshot tags.** `evidence-snapshot-2026-07-12` (commit `3b63c1e`) is
  the PRE-sprint freeze: it pins the pilot-era evidence (flat-multimodel runs,
  Mem0 logs, archived ctx/parser variants) and contains none of the sprint's
  artifacts. **`phase0-evidence-2026-07-13`** is placed on the commit that
  lands the Phase-0 evidence sprint (this document, the instance-level
  contract, all exact/retrieval/reasoner artifacts, and the raw-log trees).
  Every headline number cited in a paper1 draft must be traceable to an
  evidence file at `phase0-evidence-2026-07-13` (or at a later, explicitly
  declared successor snapshot tag). Pre-registration §9.1's start gate is
  satisfied only from that landing commit onward.
- **The citation rule.** Headline numbers may only be cited from files that
  `./scripts/build-evidence.sh` reproduces from the frozen fixtures — plus, for
  pinned-LLM arms only, from committed raw logs under
  `packages/predicate-eval/results/raw/<runId>/`, which are frozen by commit
  (they cannot be rebuilt without network + keys) and must always be cited
  together with their `runId`. Numbers from in-session agents, scratch runs,
  or files not in the inventory below are not citable.
- **mechanism-v0 is frozen.** The conflict fixtures and their generators are a
  matched pair: stage `fixtures` of the build regenerates all fixtures into a
  temp directory and hard-fails unless the result is byte-identical to the
  committed fixtures (`diff -r`, excluding the derived `instances.json`). Any
  intentional change to fixtures or generators requires a reviewed commit and
  a new snapshot tag.

## 2. What mechanism-v0 contains

Fixtures live under `packages/predicate-eval/fixtures/<domain>/` with layout
`world.ttl` (TBox Turtle), `episodes/e01.jsonl`, `episodes/e02.jsonl` (one
`{"s","p","o","lit"?}` JSON per line), `oracle.json`, `questions.json`, plus
the derived `instances.json` (rebuilt deterministically by the build).

| domain | design | planted conflicts | benign probes | instances |
|---|---|---|---|---|
| `conflict-d20` | v1 same-subject (40 persons, ns `http://ex/cb#`) | 8 | 2 duplicate reassertions, 2 multi-valued additions, 2 shared-object subjects | 14 |
| `conflict-xr-small` | v2 cross-record (60 persons, key `cb2:email`, ns `http://ex/cb2#`) | 12 record pairs | 3 benign co-referent pairs, 1 shared-office pair | 16 |
| `conflict-xr-scale` | v2 cross-record (300 persons) | 60 record pairs | 3 benign co-referent pairs, 1 shared-office pair | 64 |

Mechanism under study: `owl:hasKey (cb2:email)` on `cb2:PersonRecord`,
single-valued properties declared `a j:SingleValued`
(`j = https://industriagents.com/predicate/judgment#`), and the reasoner chain
r14 (shared key literal → `owl:sameAs`) → r23 (sameAs-propagate SingleValued
values) → r22 (2 distinct values → both pair members typed `j:ValueConflict` +
`j:conflictOn`). All materialization sits behind the provenance gate
(`seedProvenance`; closure requires RDF-star confidence ≥ 0.5 on
`kg:provenance`).

Deterministic generators: `src/conflict/generate.ts` (v1, seed `0xc0ffee`) and
`src/conflict/generate-v2.ts` (v2, seed `0xbadc0de`), both `mulberry32`-seeded
with no wall-clock or unseeded randomness.

## 3. The one command

```sh
./scripts/build-evidence.sh            # from repo root: fixtures + deterministic + summary
```

The script exports `PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory:`
(the in-process store; never a developer daemon). Filters:

```sh
./scripts/build-evidence.sh --stage fixtures                     # drift check only
./scripts/build-evidence.sh --stage deterministic --domain conflict-xr-small
./scripts/build-evidence.sh --stage summary                      # re-hash existing outputs
```

Per domain, stage `deterministic` runs: instance-manifest build → tier-1 eval →
exact baselines (`key-join` + `sparql-groupby`) → retrieval-policy sweep
(`iri-bfs`, `literal-aware`, `key-aware` × hops 1–4) → reasoner instance arm
(r14r23r22) → instance-level scoring across all PredictionRow files. Stage
`summary` writes `papers/paper1/evidence/summary-<gitsha12>[-dirty].json` with
sha256 + row count for every produced file and prints the inventory table.

Equivalent single-CLI invocations (all from `packages/predicate-eval`, all with
the env above): `pnpm run instances-manifest <d>`, `pnpm run eval <d>`,
`pnpm run exact <d> --system both`, `pnpm run retrieval-policies <d> --hops 1,2,3,4`,
`pnpm run instances-reasoner <d>`,
`pnpm run instances-score <d> <prediction-files...>`, and (LLM, not part of the
build) `pnpm run flat-pinned <d> --arm flat-all|flat-retrieved ...`.

## 4. Results-file inventory and schemas

All paths relative to `packages/predicate-eval/` unless noted.

### 4.1 Rebuilt by this script (citable)

| path | schema | producer |
|---|---|---|
| `fixtures/<d>/instances.json` | `InstanceRecord[]` | `src/instances/build-manifest-cli.ts` |
| `results/exact/exact-key-join.<d>.jsonl` | `PredictionRow` per line | `src/exact/run-exact-cli.ts` |
| `results/exact/sparql-groupby.<d>.jsonl` | `PredictionRow` per line | `src/exact/run-exact-cli.ts` |
| `results/retrieval/retrieval.<d>.jsonl` | `PredictionRow` per line (one per policy × hops × instance) | `src/rigs/retrieval-policies-cli.ts` |
| `results/instances/reasoner-r14r23r22.<d>.jsonl` | `PredictionRow` per line | `src/instances/reasoner-arm-cli.ts` |
| `results/instances/summary.<d>.json` | `{domain, instanceCount, byKind, systems: SystemScore[]}` | `src/instances/score-cli.ts` |
| `results/scoreboard.jsonl` | `ScoreRow` per line (append-only) | `src/eval.ts` (tier-1) |
| `papers/paper1/evidence/summary-<sha>.json` (repo-relative) | build summary, §4.3 | `scripts/lib/evidence-summary.mjs` |

**`InstanceRecord`** (`src/instances/types.ts`; id conventions
`<domain>#pair-pNNN` v2 conflict pair, `<domain>#subject-pNN` v1 conflict,
`<domain>#benign-coreference-pNNN`, `<domain>#benign-shared-value-…`,
`<domain>#benign-duplicate-pNN`, `<domain>#benign-multivalued-pNN`):

```ts
{ id, domain, kind: 'conflict'|'benign-coreference'|'benign-shared-value'|'benign-duplicate'|'benign-multivalued',
  subjects: string[],            // 1 record IRI (v1) or 2 (v2)
  key: string|null,              // shared key literal (v2 email)
  predicate: string|null,        // predicate under test
  goldValues: string[],
  goldWitness: string[],         // triple ids "s|p|o"
  isConflict: boolean }
```

**`PredictionRow`** (`src/instances/types.ts` = `src/exact/contract.ts` =
`src/rigs/retrieval-policies.ts` — the cross-agent contract):

```ts
{ instanceId, domain,
  system,                        // "reasoner-r14r23r22" | "exact-key-join" | "sparql-groupby" | "retrieval:<policy>@<hops>"
  flagged: boolean,              // system claims a conflict on this instance
  values: string[], witness: string[],   // witness = triple ids the system can cite
  costMs: number,
  extra: Record<string, unknown> }       // per-system diagnostics, see below
```

`extra` per system — reasoner: `{iterations, inferredCount, subjectsFlagged}`;
exact: `{phaseMs:{setup,detect}, triples, subjects, singleValuedProps}`;
retrieval: `{policy, hops, ballNodes, contextTriples, contextBytes, seededOn}`
(worst-case-seed semantics: each subject seeds its own ball; the reported
values/witness come from the worst seed, and `flagged` requires every
goldWitness triple retrievable from every seed).

**Retrieval matrix**: the policy × hops table (witness-complete rate,
mean/max context triples, mean context bytes, mean ball nodes) printed by
`retrieval-policies-cli` is a *view* over `retrieval.<d>.jsonl`; cite the
JSONL, reproduce the matrix by re-running the CLI.

**`SystemScore`** (`src/instances/score-cli.ts`):

```ts
{ system, rows, missing,
  conflict: { tp, fp, fn, tn, precision, recall, f1 },
  bothValueRecall: number|null,  // conflicts where BOTH gold values survive
  witnessRecall: number|null,    // mean goldWitness coverage over conflicts
  meanCostMs: number|null,
  perKind: Record<kind, { n, flagged, missing }> }
```

**`ScoreRow`** (`src/eval-types.ts`, tier-1 deterministic eval):

```ts
{ runId, timestamp, domain, tier: 'tier1'|'tier2', episode,
  inference: 'on'|'off', accuracy, lift?, perQuestion: Record<qid, f1>,
  boundedness: { triples, inferred, unusedConceptRatio, materializeMs },
  hostModel? }
```

### 4.2 Frozen by commit, not rebuildable (LLM arms — cite with runId)

| path | schema |
|---|---|
| `results/raw/<runId>/NNNN.json` | `RawCallEntry` — one file per HTTP attempt |
| `results/raw/<runId>/manifest.json` | `RunManifest` |
| `results/flat-pinned.<d>.<arm>.jsonl` | `PinnedCellRow` per line |
| `results/flat-multimodel.<d>.<arm>.jsonl` (+ `.meta.json`) | `CellRow` per line (legacy in-session runner; superseded by pinned) |

Raw-log tree: `runId = <domain>-pinned-<arm>-<epochMs>`; `NNNN.json` files are
sequence-numbered attempts `{seq, timestamp, vendor, model, request:{url, body,
headers:'REDACTED'}, response?:{status, body, latencyMs, usage?, requestId?},
error?}` (request headers never persisted; all bytes scrubbed against known
API-key env vars). `manifest.json` = `{runId, startedAt, gitSha, domain, arm,
models, runs, hops, temperature, seedPolicy, fixtureSha256, promptSha256,
cliArgv, env:{backend, storePath, baseUrlHost}, dryRun}`.

**`CellRow` / `PinnedCellRow`** (`src/flat-auto.ts` / `src/pinned/flat-pinned-cli.ts`):

```ts
{ runId, timestamp, domain, arm: 'flat-all'|'flat-retrieved', model, tier, run,
  questionId, isConflict, parsed, flatF1, t1F1, reasonerAdvantage,
  rawRef: { runId, seq } | null }   // PinnedCellRow only: pointer into results/raw
```

### 4.3 Build summary schema

`papers/paper1/evidence/summary-<gitsha12>[-dirty].json`:

```ts
{ generatedAt, gitSha, gitDirty, node, pnpm,
  env: { PREDICATE_BACKEND, PREDICATE_STORE_PATH },
  domains: string[],
  files: [{ path, kind, appendOnly?, bytes, rows, sha256 }] }
```

## 5. Determinism boundaries

- **Byte-stable across rebuilds:** everything under `fixtures/` (enforced), and
  `fixtures/<d>/instances.json` (pure oracle transform).
- **Decision-stable, timing-variable:** all `PredictionRow` files. `flagged`,
  `values`, `witness`, `system`, `instanceId` are deterministic;
  `costMs`/`extra.phaseMs` are wall-clock and change every run — so file
  sha256s in the build summary differ between builds while every scored number
  (P/R/F1, both-value recall, witness recall, witness-complete rates, context
  sizes) is reproduced exactly.
- **Append-only:** `results/scoreboard.jsonl` gains fresh tier-1 `ScoreRow`s
  (new `runId`/`timestamp`) on every build; cite per-run rows, not the file.
- **Not rebuildable:** `results/raw/` and the pinned/multimodel scoreboards
  (network + API keys + live models); frozen by commit.

## 6. Known cross-arm caveats (accepted, documented)

- ~~Exact-arm per-subject shared-office probes vs the canonical pair
  instance~~ — RECONCILED in the landing commit: the exact arm now emits the
  canonical paired instance (`…#benign-shared-value-p048-p006` convention) and
  `missing=0` for every system on every domain. The instance scorer
  additionally prints a loud warning whenever `missing>0`, so manifest-id
  drift can no longer be silently scored as un-flagged.
- Tier-1 accuracy (`results/scoreboard.jsonl`) verifies implementation
  behavior against golden SPARQL over the system's own materialization; per
  the publication plan it must NOT be cited as evidence of superiority —
  headline claims come from the instance-level scoreboards and their exact /
  retrieval baselines.
