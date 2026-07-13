/**
 * Load-scale maintenance ledger (pre-registration Amendment A4.2, hypothesis
 * H11). Regenerates the registered COST-ONLY strata — deterministic v2/xr
 * topology from generateXrFixture, mulberry32 seed 0x5ca1eab1e, default sizes
 * persons in {300, 1000, 3000, 10000} — into fresh tmp dirs (strata are NOT
 * committed; the sha256 of the canonical fixture JSON, recorded BEFORE any
 * file is written, is the stratum's identity) and measures, single-run
 * wall-clock per size:
 *
 *   - exact-key-join / exact-key-join-x / sparql-groupby end-to-end totalMs;
 *   - reasoner-r14r23r22 materialization for sizes <= 1000 persons ONLY, in
 *     a SPAWNED child process (reasoner-worker.ts) under the registered
 *     300 s kill timer — a timeout is recorded as the string "timeout", never
 *     a number; larger sizes as "skipped-per-A4.2";
 *   - CWI maintenance ledger (ingestMs, update amplification = insertWrites /
 *     sourceTriples, index entries) plus query latency p50/p95 over the
 *     registered deterministic sample: the FIRST 50 conflicted persons by
 *     person index (oracle.coreference order — the generator emits conflicted
 *     entries sorted ascending), each pair seeded from BOTH records; every
 *     sampled query must return exactly one conflict (missing / spurious
 *     counts recorded).
 *
 * Emits results/scale/scale-ledger.json with the three registered H11 clause
 * checks. Strata carry NO detection-accuracy claims and add NO instances to
 * the benchmark (A4.2).
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     tsx src/scale-ledger/scale-ledger-cli.ts [--sizes 300,1000,3000,10000]
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { generateXrFixture, writeXrFixture, type XrFixture } from '../conflict/generate-v2.js';
import { runKeyJoin } from '../exact/key-join.js';
import { runKeyJoinX } from '../exact/key-join-x.js';
import { runSparqlGroupBy } from '../exact/sparql-groupby.js';
import { parseTBoxSchema } from '../exact/tbox.js';
import { readAllEpisodes } from '../exact/triple-index.js';
import { ConflictWitnessIndex } from '../cwi/index.js';

/** A4.2 registered constants. */
export const SCALE_SEED = 0x5ca1eab1e;
export const SCALE_SEED_HEX = '0x5ca1eab1e';
export const DEFAULT_SIZES = [300, 1000, 3000, 10000] as const;
const REASONER_PERSON_CAP = 1000;
const REASONER_TIMEOUT_MS = 300_000;
const QUERY_SAMPLE_PERSONS = 50;

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const TSX_BIN = join(PKG_ROOT, 'node_modules', '.bin', 'tsx');
const WORKER = join(import.meta.dirname, 'reasoner-worker.ts');

export interface ReasonerCell {
  /** 'timeout' = killed at 300 s (A4.2); 'skipped-per-A4.2' = persons > 1000; 'skipped' = disabled by opts (tests only). */
  materializeMs: number | 'timeout' | 'skipped-per-A4.2' | 'skipped';
  iterations?: number;
  inferredCount?: number;
}

export interface SizeRow {
  persons: number;
  triples: number;
  sha256: string;
  systems: {
    exactKeyJoinMs: number;
    exactKeyJoinXMs: number;
    /** null only when opts.skipSparql (tests); the registered run always measures it. */
    sparqlGroupbyMs: number | null;
    reasoner: ReasonerCell;
  };
  cwi: {
    ingestMs: number;
    updateAmplification: number;
    indexEntries: number;
    queryMsP50: number;
    queryMsP95: number;
    queryMsTotal: number;
    sampledPersons: number;
    sampledQueries: number;
    sampledMissing: number;
    sampledSpurious: number;
  };
}

export interface ScaleLedger {
  registration: 'A4.2';
  seed: string;
  sizes: SizeRow[];
  h11: {
    /** Flat-amplification clause: amp(p10000) <= 2 * amp(p300); null when either size absent. */
    ampFlat: { p300: number | null; p10000: number | null; pass: boolean | null };
    queryP50UnderOneMsEverywhere: boolean;
    ingestWithinTenXOfJoinX: boolean;
    pass: boolean | null;
  };
  note: string;
}

export interface ScaleLedgerOpts {
  /** Skip the store-backed sparql-groupby baseline (tests only; needs no env). */
  skipSparql?: boolean;
  /** Skip the reasoner child process entirely (tests only). */
  skipReasoner?: boolean;
}

/** Canonical stratum identity (A4.2): hash of the generated fixture JSON, never of files on disk. */
export function stratumSha256(fx: XrFixture): string {
  return createHash('sha256')
    .update(JSON.stringify({ world: fx.world, episode1: fx.episode1, episode2: fx.episode2, oracle: fx.oracle }))
    .digest('hex');
}

const round = (x: number, digits: number): number => Number(x.toFixed(digits));

const percentile = (xs: number[], q: number): number => {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};

/** Run reasoner-worker.ts on the stratum dir under the registered 300 s kill timer. */
function runReasonerWorker(dir: string): Promise<ReasonerCell> {
  return new Promise((resolve, reject) => {
    // detached:true makes the child a process-group leader so the kill timer
    // can SIGKILL the WHOLE group (-pid): the tsx CLI re-spawns node as a
    // grandchild, and killing only the wrapper would orphan the actual
    // reasoner process AND leave the stdout pipe open (so 'close' — and the
    // timeout result — would wait for the orphan to finish, unbounded).
    const child = spawn(TSX_BIN, [WORKER, dir], {
      cwd: PKG_ROOT,
      env: { ...process.env, PREDICATE_BACKEND: 'oxigraph-wasm', PREDICATE_STORE_PATH: ':memory:' },
      stdio: ['ignore', 'pipe', 'inherit'],
      detached: true,
    });
    let out = '';
    let timedOut = false;
    const killTree = (): void => {
      try { process.kill(-(child.pid ?? 0), 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    };
    const timer = setTimeout(() => { timedOut = true; killTree(); }, REASONER_TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) { resolve({ materializeMs: 'timeout' }); return; }
      if (code !== 0) { reject(new Error(`reasoner worker exited with code ${String(code)}`)); return; }
      const parsed = JSON.parse(out) as { materializeMs: number; iterations: number; inferredCount: number };
      resolve({
        materializeMs: round(parsed.materializeMs, 2),
        iterations: parsed.iterations,
        inferredCount: parsed.inferredCount,
      });
    });
  });
}

async function measureSize(persons: number, opts: ScaleLedgerOpts): Promise<SizeRow> {
  const domain = `scale-xr-p${persons}`;
  const fx = generateXrFixture(domain, { persons }, SCALE_SEED);
  // Identity BEFORE any file exists: the stratum is defined by its JSON, not by a dir.
  const sha256 = stratumSha256(fx);
  const triples = fx.episode1.length + fx.episode2.length;

  const dir = mkdtempSync(join(tmpdir(), `scale-ledger-p${persons}-`));
  try {
    writeXrFixture(dir, domain, { persons }, SCALE_SEED);

    console.error(`[scale-ledger] persons=${persons} triples=${triples} sha256=${sha256.slice(0, 12)}… generated`);
    const exactKeyJoinMs = round(runKeyJoin(dir).timings.totalMs, 2);
    const exactKeyJoinXMs = round(runKeyJoinX(dir).timings.totalMs, 2);
    console.error(`[scale-ledger] persons=${persons} key-join=${exactKeyJoinMs}ms key-join-x=${exactKeyJoinXMs}ms`);

    let sparqlGroupbyMs: number | null = null;
    if (opts.skipSparql !== true) {
      sparqlGroupbyMs = round((await runSparqlGroupBy(getAdapter(), dir)).timings.totalMs, 2);
      console.error(`[scale-ledger] persons=${persons} sparql-groupby=${sparqlGroupbyMs}ms`);
    }

    let reasoner: ReasonerCell;
    if (opts.skipReasoner === true) reasoner = { materializeMs: 'skipped' };
    else if (persons > REASONER_PERSON_CAP) reasoner = { materializeMs: 'skipped-per-A4.2' };
    else {
      console.error(`[scale-ledger] persons=${persons} reasoner child running (cap ${REASONER_TIMEOUT_MS / 1000}s)…`);
      reasoner = await runReasonerWorker(dir);
      console.error(`[scale-ledger] persons=${persons} reasoner=${JSON.stringify(reasoner)}`);
    }

    // CWI maintenance ledger over the episode stream in file order.
    const schema = parseTBoxSchema(readFileSync(join(dir, 'world.ttl'), 'utf8'));
    const sourceTriples = readAllEpisodes(dir);
    const t0 = performance.now();
    const index = new ConflictWitnessIndex(schema);
    for (const t of sourceTriples) index.insert(t);
    const ingestMs = performance.now() - t0;
    const stats = index.stats();

    // Registered deterministic query sample: first 50 conflicted persons by
    // index (oracle.coreference array order), seeding BOTH records of each pair.
    const sampled = fx.oracle.coreference.filter((c) => c.conflicted).slice(0, QUERY_SAMPLE_PERSONS);
    const queryMs: number[] = [];
    let missing = 0;
    let spurious = 0;
    for (const entry of sampled) {
      for (const seed of entry.records) {
        const q0 = performance.now();
        const res = index.query(seed);
        queryMs.push(performance.now() - q0);
        const n = res.conflicts.length;
        if (n === 0) missing++;
        if (n > 1) spurious += n - 1;
      }
    }

    const row: SizeRow = {
      persons, triples, sha256,
      systems: { exactKeyJoinMs, exactKeyJoinXMs, sparqlGroupbyMs, reasoner },
      cwi: {
        ingestMs: round(ingestMs, 3),
        updateAmplification: round(stats.insertWrites / stats.sourceTriples, 3),
        indexEntries: stats.indexEntries,
        queryMsP50: round(percentile(queryMs, 0.5), 4),
        queryMsP95: round(percentile(queryMs, 0.95), 4),
        queryMsTotal: round(queryMs.reduce((a, b) => a + b, 0), 4),
        sampledPersons: sampled.length,
        sampledQueries: queryMs.length,
        sampledMissing: missing,
        sampledSpurious: spurious,
      },
    };
    console.error(
      `[scale-ledger] persons=${persons} cwi ingest=${row.cwi.ingestMs}ms amp=${row.cwi.updateAmplification} `
      + `entries=${row.cwi.indexEntries} qP50=${row.cwi.queryMsP50}ms qP95=${row.cwi.queryMsP95}ms `
      + `missing=${missing} spurious=${spurious}`,
    );
    return row;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function runScaleLedger(sizes: number[], opts: ScaleLedgerOpts = {}): Promise<ScaleLedger> {
  const rows: SizeRow[] = [];
  for (const persons of sizes) rows.push(await measureSize(persons, opts));

  const amp = (persons: number): number | null =>
    rows.find((r) => r.persons === persons)?.cwi.updateAmplification ?? null;
  const p300 = amp(300);
  const p10000 = amp(10000);
  const ampPass = p300 !== null && p10000 !== null ? p10000 <= 2 * p300 : null;
  const queryP50UnderOneMsEverywhere = rows.every((r) => r.cwi.queryMsP50 < 1);
  const ingestWithinTenXOfJoinX = rows.every((r) => r.cwi.ingestMs <= 10 * r.systems.exactKeyJoinXMs);

  return {
    registration: 'A4.2',
    seed: SCALE_SEED_HEX,
    sizes: rows,
    h11: {
      ampFlat: { p300, p10000, pass: ampPass },
      queryP50UnderOneMsEverywhere,
      ingestWithinTenXOfJoinX,
      pass: ampPass === null ? null : ampPass && queryP50UnderOneMsEverywhere && ingestWithinTenXOfJoinX,
    },
    note: 'single-run wall-clock; sha256 and counts deterministic',
  };
}

function parseSizes(argv: string[]): number[] {
  const i = argv.indexOf('--sizes');
  if (i < 0) return [...DEFAULT_SIZES];
  const arg = argv[i + 1];
  if (arg === undefined) throw new Error('usage: tsx src/scale-ledger/scale-ledger-cli.ts [--sizes 300,1000,3000,10000]');
  const sizes = arg.split(',').map((s) => Number(s.trim()));
  if (sizes.length === 0 || sizes.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error(`--sizes must be a comma list of positive integers, got "${arg}"`);
  }
  return sizes;
}

async function main(): Promise<void> {
  const sizes = parseSizes(process.argv.slice(2));
  const ledger = await runScaleLedger(sizes);
  const outDir = join(PKG_ROOT, 'results', 'scale');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, 'scale-ledger.json');
  writeFileSync(out, JSON.stringify(ledger, null, 2) + '\n');
  console.log(
    `scale-ledger: sizes ${sizes.join(',')} | h11 ampFlat=${String(ledger.h11.ampFlat.pass)} `
    + `qP50<1ms=${String(ledger.h11.queryP50UnderOneMsEverywhere)} ingest<=10x=${String(ledger.h11.ingestWithinTenXOfJoinX)} `
    + `pass=${String(ledger.h11.pass)}`,
  );
  console.log(`wrote ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
