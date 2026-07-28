/**
 * Fair retained-index versus fresh-exact workload comparison.
 *
 * The source snapshot and schema are generated and parsed before timing for
 * both methods. A workload consists of one batched insertion of the snapshot
 * followed by q conflict queries:
 *   - CWI pays one maintained-index ingestion plus q lookups;
 *   - on-demand exact retains no derived state and rebuilds its triple index,
 *     key closure, and conflict cells from the in-memory snapshot per query.
 *
 * Deterministic retained-state counts complement wall-clock distributions;
 * they are not presented as heap-byte measurements.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ConflictWitnessIndex } from '../cwi/index.js';
import { generateXrFixture } from '../conflict/generate-v2.js';
import { runKeyJoinXFromTriples } from '../exact/key-join-x.js';
import { parseTBoxSchema } from '../exact/tbox.js';
import { SCALE_SEED, SCALE_SEED_HEX, stratumSha256 } from './scale-ledger-cli.js';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const DEFAULT_SIZES = [300, 3000, 10_000];
const DEFAULT_QUERY_COUNTS = [1, 10, 100];
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

interface WorkloadCell {
  queries: number;
  cwiTotalMs: Distribution;
  onDemandTotalMs: Distribution;
  medianSpeedup: number;
  cwiLowerMedian: boolean;
}

interface WorkloadRow {
  persons: number;
  triples: number;
  sha256: string;
  sampledQueries: number;
  cwiRetained: {
    indexEntries: number;
    materializedConflicts: number;
    totalRetainedItems: number;
    retainedItemsPerSourceTriple: number;
  };
  cwiIngestMs: Distribution;
  cwiQueryBatchMs: Distribution;
  onDemandQueryMs: Distribution;
  breakEvenQueriesOnTestedGrid: number | null;
  workloads: WorkloadCell[];
  missing: number;
  spurious: number;
}

export interface MaintenanceWorkloadResult {
  kind: 'maintenance-versus-on-demand';
  seed: string;
  repetitions: number;
  warmupRuns: number;
  measurementBoundary: {
    common: string;
    cwi: string;
    onDemand: string;
    memory: string;
  };
  rows: WorkloadRow[];
}

const round = (x: number, digits = 3): number => Number(x.toFixed(digits));

function quantile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const h = (sorted.length - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (h - lo);
}

function distribution(xs: number[]): Distribution {
  return {
    median: round(quantile(xs, 0.5)),
    p25: round(quantile(xs, 0.25)),
    p75: round(quantile(xs, 0.75)),
    min: round(Math.min(...xs)),
    max: round(Math.max(...xs)),
    runs: xs.map((x) => round(x)),
  };
}

function positiveIntegers(csv: string, name: string): number[] {
  const values = csv.split(',').map(Number);
  if (values.length === 0 || values.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error(`${name} must be a comma-separated list of positive integers`);
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function argList(argv: string[], name: string, fallback: number[]): number[] {
  const i = argv.indexOf(name);
  return i < 0 ? fallback : positiveIntegers(argv[i + 1] ?? '', name);
}

function argInteger(argv: string[], name: string, fallback: number): number {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const value = Number(argv[i + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function runMaintenanceWorkload(
  sizes = DEFAULT_SIZES,
  queryCounts = DEFAULT_QUERY_COUNTS,
  repetitions = DEFAULT_REPETITIONS,
): MaintenanceWorkloadResult {
  if (sizes.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error('sizes must contain positive integers');
  }
  if (queryCounts.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error('queryCounts must contain positive integers');
  }
  if (!Number.isInteger(repetitions) || repetitions <= 0) {
    throw new Error('repetitions must be a positive integer');
  }
  const sortedQueryCounts = [...new Set(queryCounts)].sort((a, b) => a - b);
  const maximumQueries = Math.max(...sortedQueryCounts);
  if (maximumQueries > QUERY_SAMPLE_PERSONS * 2) {
    throw new Error(`query count exceeds deterministic ${QUERY_SAMPLE_PERSONS * 2}-query sample`);
  }

  const rows: WorkloadRow[] = [];
  for (const persons of sizes) {
    const domain = `maintenance-workload-p${persons}`;
    const fixture = generateXrFixture(domain, { persons }, SCALE_SEED);
    const schema = parseTBoxSchema(fixture.world);
    const triples = [...fixture.episode1, ...fixture.episode2];
    const seeds = fixture.oracle.coreference
      .filter((entry) => entry.conflicted)
      .slice(0, QUERY_SAMPLE_PERSONS)
      .flatMap((entry) => entry.records)
      .slice(0, maximumQueries);
    if (seeds.length < maximumQueries) {
      throw new Error(`${persons} persons yields only ${seeds.length} conflict queries`);
    }

    // One unrecorded warm-up of both execution paths.
    const warmIndex = new ConflictWitnessIndex(schema);
    for (const triple of triples) warmIndex.insert(triple);
    for (const seed of seeds) warmIndex.query(seed);
    runKeyJoinXFromTriples(schema, triples);

    const ingestRuns: number[] = [];
    const cwiBatchRuns: number[] = [];
    const onDemandMeanQueryRuns: number[] = [];
    const cwiTotals = new Map(sortedQueryCounts.map((q) => [q, [] as number[]]));
    const onDemandTotals = new Map(sortedQueryCounts.map((q) => [q, [] as number[]]));
    let retained: WorkloadRow['cwiRetained'] | null = null;
    let missing = 0;
    let spurious = 0;

    for (let repetition = 0; repetition < repetitions; repetition++) {
      const index = new ConflictWitnessIndex(schema);
      const ingestStarted = performance.now();
      for (const triple of triples) index.insert(triple);
      const ingestMs = performance.now() - ingestStarted;
      ingestRuns.push(ingestMs);
      const stats = index.stats();
      retained ??= {
        indexEntries: stats.indexEntries,
        materializedConflicts: stats.materializedConflicts,
        totalRetainedItems: stats.indexEntries + stats.materializedConflicts,
        retainedItemsPerSourceTriple: round(
          (stats.indexEntries + stats.materializedConflicts) / stats.sourceTriples,
          4,
        ),
      };

      const cwiPrefix: number[] = [];
      let cwiElapsed = 0;
      for (const seed of seeds) {
        const started = performance.now();
        const result = index.query(seed);
        cwiElapsed += performance.now() - started;
        cwiPrefix.push(cwiElapsed);
        if (result.conflicts.length === 0) missing++;
        if (result.conflicts.length > 1) spurious += result.conflicts.length - 1;
      }
      cwiBatchRuns.push(cwiElapsed);
      for (const q of sortedQueryCounts) cwiTotals.get(q)!.push(ingestMs + cwiPrefix[q - 1]!);

      const onDemandPrefix: number[] = [];
      let onDemandElapsed = 0;
      for (const seed of seeds) {
        const started = performance.now();
        const result = runKeyJoinXFromTriples(schema, triples);
        const relevant = result.detections.filter((detection) => detection.subjects.includes(seed));
        onDemandElapsed += performance.now() - started;
        onDemandPrefix.push(onDemandElapsed);
        if (relevant.length === 0) missing++;
        if (relevant.length > 1) spurious += relevant.length - 1;
      }
      onDemandMeanQueryRuns.push(onDemandElapsed / seeds.length);
      for (const q of sortedQueryCounts) onDemandTotals.get(q)!.push(onDemandPrefix[q - 1]!);
    }

    const workloads = sortedQueryCounts.map((queries): WorkloadCell => {
      const cwi = distribution(cwiTotals.get(queries)!);
      const onDemand = distribution(onDemandTotals.get(queries)!);
      return {
        queries,
        cwiTotalMs: cwi,
        onDemandTotalMs: onDemand,
        medianSpeedup: round(onDemand.median / cwi.median, 2),
        cwiLowerMedian: cwi.median < onDemand.median,
      };
    });
    rows.push({
      persons,
      triples: triples.length,
      sha256: stratumSha256(fixture),
      sampledQueries: maximumQueries,
      cwiRetained: retained!,
      cwiIngestMs: distribution(ingestRuns),
      cwiQueryBatchMs: distribution(cwiBatchRuns),
      onDemandQueryMs: distribution(onDemandMeanQueryRuns),
      breakEvenQueriesOnTestedGrid:
        workloads.find((cell) => cell.cwiLowerMedian)?.queries ?? null,
      workloads,
      missing,
      spurious,
    });
    console.error(
      `[maintenance-workload] persons=${persons} triples=${triples.length} `
      + `break-even=${rows.at(-1)!.breakEvenQueriesOnTestedGrid ?? 'none'} complete`,
    );
  }

  return {
    kind: 'maintenance-versus-on-demand',
    seed: SCALE_SEED_HEX,
    repetitions,
    warmupRuns: 1,
    measurementBoundary: {
      common: 'schema and source triples materialized in memory before timed regions',
      cwi: 'one full insertion batch plus q maintained-index lookups',
      onDemand: 'q fresh exact TripleIndex + key-closure + conflict-detection passes over the same in-memory triples',
      memory: 'deterministic retained derived-entry counts; not process heap bytes',
    },
    rows,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const result = runMaintenanceWorkload(
    argList(argv, '--sizes', DEFAULT_SIZES),
    argList(argv, '--query-counts', DEFAULT_QUERY_COUNTS),
    argInteger(argv, '--repetitions', DEFAULT_REPETITIONS),
  );
  const outDir = join(PKG_ROOT, 'results', 'workload');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'maintenance-vs-ondemand.json');
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
