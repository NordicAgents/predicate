/**
 * Repeated timing companion to the registered single-run scale ledger.
 *
 * This is deliberately a separate artifact: it does not alter A4.2, its
 * deterministic counts, or its reasoner/SPARQL cells. Each size is generated
 * once, followed by one unrecorded warm-up and repeated measurements of:
 *   - exact-key-join-x end-to-end (including its file read/setup);
 *   - CWI ingestion from already parsed triples;
 *   - 100 maintained-index queries (the same deterministic conflict sample).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ConflictWitnessIndex } from '../cwi/index.js';
import { generateXrFixture, writeXrFixture } from '../conflict/generate-v2.js';
import { runKeyJoinX } from '../exact/key-join-x.js';
import { parseTBoxSchema } from '../exact/tbox.js';
import { readAllEpisodes } from '../exact/triple-index.js';
import { SCALE_SEED, SCALE_SEED_HEX, stratumSha256 } from './scale-ledger-cli.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const DEFAULT_SIZES = [300, 1000, 3000, 10000, 100000];
const DEFAULT_REPETITIONS = 11;
const QUERY_SAMPLE_PERSONS = 50;

interface Distribution {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  runs: number[];
}

const round = (x: number, digits = 4): number => Number(x.toFixed(digits));

function quantile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const h = (sorted.length - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (h - lo);
}

function distribution(xs: number[]): Distribution {
  return {
    median: round(quantile(xs, 0.5), 3),
    p25: round(quantile(xs, 0.25), 3),
    p75: round(quantile(xs, 0.75), 3),
    min: round(Math.min(...xs), 3),
    max: round(Math.max(...xs), 3),
    runs: xs.map((x) => round(x, 3)),
  };
}

function parseNumberArg(argv: string[], name: string, fallback: number): number {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const value = Number(argv[i + 1]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function parseSizes(argv: string[]): number[] {
  const i = argv.indexOf('--sizes');
  if (i < 0) return DEFAULT_SIZES;
  const sizes = (argv[i + 1] ?? '').split(',').map(Number);
  if (sizes.length === 0 || sizes.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error('--sizes must be a comma-separated list of positive integers');
  }
  return sizes;
}

function timeIngest(
  schema: ReturnType<typeof parseTBoxSchema>,
  triples: ReturnType<typeof readAllEpisodes>,
): { ms: number; index: ConflictWitnessIndex } {
  const index = new ConflictWitnessIndex(schema);
  const start = performance.now();
  for (const triple of triples) index.insert(triple);
  return { ms: performance.now() - start, index };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const sizes = parseSizes(argv);
  const repetitions = parseNumberArg(argv, '--repetitions', DEFAULT_REPETITIONS);
  const rows = [];

  for (const persons of sizes) {
    const domain = `scale-repeat-p${persons}`;
    const fixture = generateXrFixture(domain, { persons }, SCALE_SEED);
    const dir = mkdtempSync(join(tmpdir(), `scale-repeat-p${persons}-`));
    try {
      writeXrFixture(dir, domain, { persons }, SCALE_SEED);
      const schema = parseTBoxSchema(readFileSync(join(dir, 'world.ttl'), 'utf8'));
      const triples = readAllEpisodes(dir);
      const sampled = fixture.oracle.coreference
        .filter((entry) => entry.conflicted)
        .slice(0, QUERY_SAMPLE_PERSONS);

      // Warm filesystem/JIT paths once; do not record.
      runKeyJoinX(dir);
      timeIngest(schema, triples);

      const joinRuns: number[] = [];
      const ingestRuns: number[] = [];
      const queryBatchRuns: number[] = [];
      let missing = 0;
      let spurious = 0;

      for (let repetition = 0; repetition < repetitions; repetition++) {
        joinRuns.push(runKeyJoinX(dir).timings.totalMs);
        const ingested = timeIngest(schema, triples);
        ingestRuns.push(ingested.ms);

        const queryStart = performance.now();
        for (const entry of sampled) {
          for (const seed of entry.records) {
            const result = ingested.index.query(seed);
            if (result.conflicts.length === 0) missing++;
            if (result.conflicts.length > 1) spurious += result.conflicts.length - 1;
          }
        }
        queryBatchRuns.push(performance.now() - queryStart);
      }

      rows.push({
        persons,
        triples: triples.length,
        sha256: stratumSha256(fixture),
        exactKeyJoinXMs: distribution(joinRuns),
        cwiIngestMs: distribution(ingestRuns),
        cwiQueryBatch100Ms: distribution(queryBatchRuns),
        sampledQueriesPerRun: sampled.length * 2,
        missing,
        spurious,
      });
      console.error(`[scale-repeated] persons=${persons} repetitions=${repetitions} complete`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const output = {
    kind: 'repeated-scale-companion',
    seed: SCALE_SEED_HEX,
    repetitions,
    warmupRuns: 1,
    host: {
      hostnameSha256: createHash('sha256').update(hostname()).digest('hex'),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
    },
    measurementBoundary: {
      exactKeyJoinX: 'end-to-end function timing including fixture file read/setup',
      cwiIngest: 'index construction from triples parsed before the timed region',
      cwiQueryBatch100: '100 maintained-index queries; result checking inside timed region',
    },
    rows,
  };
  const outDir = join(PKG_ROOT, 'results', 'scale');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'scale-repeated.json');
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
