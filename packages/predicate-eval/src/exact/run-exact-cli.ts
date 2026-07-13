import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { deriveInstances } from './instances.js';
import { runKeyJoin, type ExactRunResult } from './key-join.js';
import { runKeyJoinX } from './key-join-x.js';
import { runSparqlGroupBy } from './sparql-groupby.js';
import { buildPredictionRows, type ExactScore } from './predict.js';
import type { PredictionRow } from './contract.js';

/**
 * Exact/non-LLM baselines runner (publication plan §8): does a plain hash
 * join or one SPARQL GROUP BY per property already solve CONFLICT-BENCH?
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     tsx src/exact/run-exact-cli.ts <domain> [--system key-join|sparql-groupby|both]
 *
 * Writes results/exact/<system>.<domain>.jsonl (one PredictionRow per
 * instance) and prints instance-level TP/FP/FN + P/R/F1 + wall-clock.
 */

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const SYSTEMS = {
  'key-join': 'exact-key-join',
  'sparql-groupby': 'sparql-groupby',
  'key-join-x': 'exact-key-join-x',
} as const;
type SystemArg = keyof typeof SYSTEMS;

function writeRows(outFile: string, rows: PredictionRow[]): void {
  mkdirSync(join(PKG_ROOT, 'results', 'exact'), { recursive: true });
  writeFileSync(outFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

const fmt = (n: number, d = 3): string => n.toFixed(d);

function report(score: ExactScore, res: ExactRunResult, outFile: string): void {
  const s = score;
  console.log(
    `${s.domain.padEnd(20)} ${s.system.padEnd(16)} inst=${String(s.instances).padEnd(3)} `
    + `TP=${String(s.tp).padEnd(3)} FP=${String(s.fp).padEnd(2)} FN=${String(s.fn).padEnd(2)} `
    + `P=${fmt(s.precision)} R=${fmt(s.recall)} F1=${fmt(s.f1)} `
    + `setup=${fmt(res.timings.setupMs)}ms detect=${fmt(res.timings.detectMs)}ms total=${fmt(res.timings.totalMs)}ms`,
  );
  const slices = Object.entries(s.fpBySlice);
  console.log(
    `  benign-slice FPs: ${slices.length === 0 ? 'none' : slices.map(([k, v]) => `${k}=${v}`).join(' ')}`
    + ` | spurious detections: ${s.spuriousDetections}`
    + ` | triples=${res.stats.triples} subjects=${res.stats.subjects}`
    + (res.stats.classes !== null ? ` classes=${res.stats.classes}` : ''),
  );
  if (s.precision === 1 && s.recall === 1 && s.spuriousDetections === 0) {
    console.log('  expectation: PERFECT (P=R=1, no spurious detections)');
  } else {
    console.log('  expectation VIOLATED: this baseline is NOT perfect here — report honestly.');
  }
  console.log(`  wrote ${outFile}`);
}

async function main(): Promise<void> {
  const [domain, ...rest] = process.argv.slice(2);
  const sysArg = rest[0] === '--system' ? rest[1] : 'both';
  if (!domain || (sysArg !== 'both' && sysArg !== 'all' && !(sysArg! in SYSTEMS))) {
    console.error('usage: tsx src/exact/run-exact-cli.ts <domain> [--system key-join|sparql-groupby|key-join-x|both|all]');
    process.exit(1);
  }
  const dir = join(PKG_ROOT, 'fixtures', domain);
  const instances = deriveInstances(domain, dir);
  const selected: SystemArg[] = sysArg === 'both'
    ? ['key-join', 'sparql-groupby']
    : sysArg === 'all'
      ? ['key-join', 'sparql-groupby', 'key-join-x']
      : [sysArg as SystemArg];

  for (const which of selected) {
    const system = SYSTEMS[which];
    const res: ExactRunResult = which === 'key-join'
      ? runKeyJoin(dir)
      : which === 'key-join-x'
        ? runKeyJoinX(dir)
        : await runSparqlGroupBy(getAdapter(), dir);
    const { rows, score } = buildPredictionRows({
      instances, detections: res.detections, index: res.index, system,
      totalMs: res.timings.totalMs,
      extraBase: {
        phaseMs: {
          setup: Number(res.timings.setupMs.toFixed(3)),
          detect: Number(res.timings.detectMs.toFixed(3)),
        },
        triples: res.stats.triples,
        subjects: res.stats.subjects,
        singleValuedProps: res.stats.singleValuedProps,
      },
    });
    const outFile = join(PKG_ROOT, 'results', 'exact', `${system}.${domain}.jsonl`);
    writeRows(outFile, rows);
    report(score, res, outFile);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
