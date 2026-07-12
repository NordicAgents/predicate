// evidence-summary.mjs — stage "summary" of scripts/build-evidence.sh.
//
// Collects every evidence file the deterministic stage produces for the given
// domains, verifies each exists, computes sha256 + byte size + row count, and
// writes a single machine-readable summary JSON plus a human-readable table on
// stdout. Node builtins only; no third-party dependencies.
//
//   node scripts/lib/evidence-summary.mjs \
//     --repo-root /path/to/repo --git-sha <sha> --dirty 0|1 \
//     --node-version v22.x --pnpm-version 9.x \
//     --domains conflict-d20,conflict-xr-small --out papers/paper1/evidence/summary-<sha>.json

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (!k?.startsWith('--') || v === undefined) {
      console.error(`bad argument pair: ${k} ${v}`);
      process.exit(1);
    }
    args[k.slice(2)] = v;
  }
  for (const req of ['repo-root', 'git-sha', 'dirty', 'node-version', 'pnpm-version', 'domains', 'out']) {
    if (!(req in args)) {
      console.error(`missing required argument: --${req}`);
      process.exit(1);
    }
  }
  return args;
}

const EVAL = 'packages/predicate-eval';

/** Evidence files (repo-relative) produced by the deterministic stage for one domain. */
function filesForDomain(d) {
  return [
    { path: `${EVAL}/fixtures/${d}/instances.json`, kind: 'instance-manifest' },
    { path: `${EVAL}/results/exact/exact-key-join.${d}.jsonl`, kind: 'prediction-rows' },
    { path: `${EVAL}/results/exact/sparql-groupby.${d}.jsonl`, kind: 'prediction-rows' },
    { path: `${EVAL}/results/retrieval/retrieval.${d}.jsonl`, kind: 'prediction-rows' },
    { path: `${EVAL}/results/instances/reasoner-r14r23r22.${d}.jsonl`, kind: 'prediction-rows' },
    { path: `${EVAL}/results/instances/summary.${d}.json`, kind: 'instance-scoreboard' },
  ];
}

/** Shared (cross-domain) evidence files. */
const SHARED_FILES = [
  // Tier-1 ScoreRows: APPEND-ONLY across builds (each build adds rows with
  // fresh runIds/timestamps) — row count grows, sha256 changes by design.
  { path: `${EVAL}/results/scoreboard.jsonl`, kind: 'tier1-scorerows', appendOnly: true },
];

function rowCount(absPath, content) {
  if (absPath.endsWith('.jsonl')) {
    return content.split('\n').filter((l) => l.trim().length > 0).length;
  }
  if (absPath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content.toString('utf8'));
      if (Array.isArray(parsed)) return parsed.length;
      if (parsed && Array.isArray(parsed.systems)) return parsed.systems.length;
    } catch {
      /* fall through */
    }
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = args['repo-root'];
  const domains = args.domains.split(',').map((s) => s.trim()).filter(Boolean);

  const wanted = [...domains.flatMap(filesForDomain), ...SHARED_FILES];
  const missing = wanted.filter((f) => !existsSync(join(repoRoot, f.path)));
  if (missing.length > 0) {
    console.error('SUMMARY FAILED — expected evidence files are missing (run the deterministic stage first):');
    for (const f of missing) console.error(`  ${f.path}`);
    process.exit(1);
  }

  const files = wanted.map((f) => {
    const abs = join(repoRoot, f.path);
    const buf = readFileSync(abs);
    return {
      path: f.path,
      kind: f.kind,
      ...(f.appendOnly ? { appendOnly: true } : {}),
      bytes: statSync(abs).size,
      rows: rowCount(abs, buf.toString('utf8')),
      sha256: createHash('sha256').update(buf).digest('hex'),
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    gitSha: args['git-sha'],
    gitDirty: args.dirty === '1',
    // Stages executed by the invocation that wrote this summary; a summary
    // whose stagesRun omits 'fixtures'/'deterministic' certifies pre-existing
    // on-disk results, not a fresh build.
    stagesRun: (args['stages-run'] ?? '').split(',').filter(Boolean),
    node: args['node-version'],
    pnpm: args['pnpm-version'],
    env: {
      PREDICATE_BACKEND: process.env.PREDICATE_BACKEND ?? null,
      PREDICATE_STORE_PATH: process.env.PREDICATE_STORE_PATH ?? null,
    },
    domains,
    files,
  };

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(summary, null, 2) + '\n');

  // Human-readable table.
  const wPath = Math.max(...files.map((f) => f.path.length), 4);
  console.log(`evidence summary — git ${args['git-sha'].slice(0, 12)}${summary.gitDirty ? ' (DIRTY)' : ''}`);
  console.log(`${'path'.padEnd(wPath)}  ${'rows'.padStart(5)}  ${'bytes'.padStart(9)}  sha256(12)`);
  for (const f of files) {
    console.log(
      `${f.path.padEnd(wPath)}  ${String(f.rows ?? '-').padStart(5)}  ${String(f.bytes).padStart(9)}  ${f.sha256.slice(0, 12)}${f.appendOnly ? '  [append-only]' : ''}`,
    );
  }
  console.log(`\nwrote ${args.out}`);
}

main();
