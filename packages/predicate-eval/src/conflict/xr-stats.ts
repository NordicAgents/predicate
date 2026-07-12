import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { writeXrFixture, XR_VARIANTS, SEED_V2 } from './generate-v2.js';
import { runTier1 } from '../rigs/tier1-deterministic.js';
import { ballFor, ballContext, buildRetrievedTasks } from '../rigs/flat-retrieved.js';
import { buildFlatTasks } from '../rigs/flat-baseline.js';
import type { FlatTask } from '../rigs/flat-baseline.js';

/**
 * Statistical hardening runner for CONFLICT-BENCH v2 (the xr fixtures).
 *
 * The committed pilot (papers/paper1/EXPERIMENT-LOG.md, Pilot C) is a single
 * fixture at SEED_V2. This runner re-generates the fixture at MULTIPLE seeds
 * and, per seed:
 *
 *   1. reasoner reference — runTier1, expecting inference-ON accuracy 1.0 at
 *      every seed (any deviation is recorded as an anomaly, never hidden);
 *   2. deterministic k-sweep — for every co-referent pair in the oracle,
 *      compute the k-hop retrieval ball from EACH member and record whether
 *      the twin record is inside it, plus the context cost of the ball
 *      (triple lines / characters). Benign co-referent pairs run through the
 *      same mechanism as a sanity signal;
 *   3. blind prompt files for the flat-all and flat-retrieved (hops=2) arms —
 *      KB/retrieved facts + question text ONLY: no oracle info, no pair
 *      lists, no experiment framing (leakage rules).
 *
 * Everything lands under --out (default results/xr-pilot), which is added to
 * results/.gitignore if nothing covers it yet. Fixture generation is fully
 * seed-determined; wall-clock only enters the output via an explicit --stamp.
 *
 *   pnpm --filter predicate-eval xr-stats -- \
 *     --seeds 11,23,37,42,59 --hops 1,2,3,4 --variant conflict-xr-small \
 *     [--out results/xr-pilot] [--stamp 2026-07-11T00:00:00Z]
 *
 * With --variant conflict-xr-scale the run uses the single default SEED_V2
 * (300 persons); --seeds is ignored for that variant.
 */

const PKG_ROOT = join(import.meta.dirname, '..', '..');

// ---------------------------------------------------------------------------
// Seeded bootstrap (exported for the scorer).
// ---------------------------------------------------------------------------

/** Same PRNG the fixture generator uses (generate-v2.ts). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BootstrapCI { mean: number; lo95: number; hi95: number }

/** Seeded percentile bootstrap over the mean: deterministic for a given (values, resamples, seed). */
export function bootstrapCI(values: number[], resamples = 10_000, seed = 7): BootstrapCI {
  if (values.length === 0) return { mean: NaN, lo95: NaN, hi95: NaN };
  const rand = mulberry32(seed);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const means = new Array<number>(resamples);
  for (let r = 0; r < resamples; r++) {
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[Math.floor(rand() * values.length)]!;
    means[r] = s / values.length;
  }
  means.sort((a, b) => a - b);
  return {
    mean,
    lo95: means[Math.floor(0.025 * (resamples - 1))]!,
    hi95: means[Math.ceil(0.975 * (resamples - 1))]!,
  };
}

// ---------------------------------------------------------------------------
// Result shapes.
// ---------------------------------------------------------------------------

export interface Tier1Summary {
  seed: number;
  domain: string;
  /** Final-episode inference-ON accuracy (expected 1.0 at every seed). */
  onAccuracy: number;
  onPerQuestion: Record<string, number>;
  /** Final-episode inference-OFF accuracy and the conflict-slice questions. */
  offAccuracy: number;
  offConflictSlice: Record<string, number>;
  /** Non-null when onAccuracy deviates from 1.0 — reported, never hidden. */
  anomaly: string | null;
}

export type ProbeDirection = 'from-s2' | 'from-s1';
export type PairKind = 'conflicted' | 'benign';

export interface PairProbe {
  seed: number;
  k: number;
  direction: ProbeDirection;
  kind: PairKind;
  seedRecord: string;
  twin: string;
  twinInBall: boolean;
  ballNodes: number;
  ballTriples: number;
  contextChars: number;
}

export interface KsweepRow {
  seed: number;
  k: number;
  direction: ProbeDirection;
  kind: PairKind;
  pairs: number;
  twinReachRate: number;
  meanBallNodes: number;
  meanBallTriples: number;
  meanContextChars: number;
}

export interface XrStatsResult {
  variant: string;
  seeds: number[];
  hops: number[];
  tier1: Tier1Summary[];
  ksweep: KsweepRow[];
  ksweepDetail: PairProbe[];
  generatedAt: string | null;
}

export interface XrStatsOptions {
  seeds: number[];
  hops: number[];
  variantName: string;
  outDir: string;
  /** Metadata timestamp; wall-clock is never read by this runner itself. */
  stamp?: string;
  /**
   * Custom store size for the flat-all collapse sweep (--persons N): overrides
   * XR_VARIANTS and names the variant conflict-xr-p<N>. Fixture domains become
   * xr-p<N>-s<seed> so different sizes at the same seed never collide.
   */
  personsOverride?: number;
}

interface OracleCorefPair { records: [string, string]; email: string; conflicted: boolean }

// ---------------------------------------------------------------------------
// Prompt rendering (LEAKAGE RULES: KB/retrieved facts + question text only).
// ---------------------------------------------------------------------------

const typeLabel = (t: FlatTask['type']): string => (t === 'boolean' ? 'yes/no' : 'list of IRIs');

export function renderFlatAllPrompt(tasks: FlatTask[]): string {
  return [
    '<knowledge-base>',
    tasks[0]?.context ?? '',
    '</knowledge-base>',
    '',
    'Questions:',
    ...tasks.map((t, i) => `${i + 1}. id=${t.id} (${typeLabel(t.type)}): ${t.questionText}`),
    '',
  ].join('\n');
}

export function renderRetrievedPrompt(tasks: FlatTask[]): string {
  return tasks
    .map((t, i) => [
      `## Question ${i + 1} — id=${t.id} (${typeLabel(t.type)})`,
      t.questionText,
      '',
      '<retrieved-context>',
      t.context,
      '</retrieved-context>',
      '',
    ].join('\n'))
    .join('\n');
}

const toJsonl = (tasks: FlatTask[]): string => tasks.map((t) => JSON.stringify(t)).join('\n') + '\n';

// ---------------------------------------------------------------------------
// Hygiene: keep run outputs out of git without touching committed results.
// ---------------------------------------------------------------------------

/** If outDir sits under results/ and no results/.gitignore line covers it, add one. */
export function ensureOutIgnored(outDir: string, pkgRoot: string = PKG_ROOT): void {
  const resultsDir = join(pkgRoot, 'results');
  const rel = relative(resultsDir, outDir);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return; // not under results/
  const seg = rel.split(sep)[0]!;
  const gi = join(resultsDir, '.gitignore');
  const lines = existsSync(gi)
    ? readFileSync(gi, 'utf8').split('\n').map((l) => l.trim())
    : [];
  if (lines.includes(seg) || lines.includes(`${seg}/`) || lines.includes(`/${seg}/`)) return;
  mkdirSync(resultsDir, { recursive: true });
  appendFileSync(gi, `${seg}/\n`);
}

// ---------------------------------------------------------------------------
// The runner.
// ---------------------------------------------------------------------------

const CONFLICT_SLICE = ['q01', 'q02', 'q03', 'q06'];

async function probePair(
  client: StorageAdapter, seed: number, k: number, pair: OracleCorefPair, direction: ProbeDirection,
): Promise<PairProbe> {
  const [s1, s2] = pair.records;
  const seedRecord = direction === 'from-s2' ? s2 : s1;
  const twin = direction === 'from-s2' ? s1 : s2;
  const ball = await ballFor(client, [seedRecord], k);
  const ctx = await ballContext(client, ball);
  return {
    seed, k, direction,
    kind: pair.conflicted ? 'conflicted' : 'benign',
    seedRecord, twin,
    twinInBall: ball.has(twin),
    ballNodes: ball.size,
    ballTriples: ctx === '' ? 0 : ctx.split('\n').length,
    contextChars: ctx.length,
  };
}

function aggregateProbes(probes: PairProbe[]): KsweepRow[] {
  const groups = new Map<string, PairProbe[]>();
  for (const p of probes) {
    const key = `${p.seed} ${p.k} ${p.direction} ${p.kind}`;
    const g = groups.get(key);
    if (g) g.push(p); else groups.set(key, [p]);
  }
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rows: KsweepRow[] = [];
  for (const g of groups.values()) {
    const { seed, k, direction, kind } = g[0]!;
    rows.push({
      seed, k, direction, kind,
      pairs: g.length,
      twinReachRate: mean(g.map((p) => (p.twinInBall ? 1 : 0))),
      meanBallNodes: mean(g.map((p) => p.ballNodes)),
      meanBallTriples: mean(g.map((p) => p.ballTriples)),
      meanContextChars: mean(g.map((p) => p.contextChars)),
    });
  }
  const dirOrder: Record<ProbeDirection, number> = { 'from-s2': 0, 'from-s1': 1 };
  const kindOrder: Record<PairKind, number> = { conflicted: 0, benign: 1 };
  rows.sort((a, b) =>
    a.seed - b.seed || a.k - b.k || dirOrder[a.direction] - dirOrder[b.direction]
    || kindOrder[a.kind] - kindOrder[b.kind]);
  return rows;
}

export async function runXrStats(client: StorageAdapter, opts: XrStatsOptions): Promise<XrStatsResult> {
  const variant = opts.personsOverride !== undefined
    ? { persons: opts.personsOverride }
    : XR_VARIANTS[opts.variantName];
  if (!variant) {
    throw new Error(`unknown variant ${opts.variantName}; expected one of ${Object.keys(XR_VARIANTS).join(', ')}`);
  }
  const { seeds, hops, outDir } = opts;
  ensureOutIgnored(outDir);
  mkdirSync(join(outDir, 'fixtures'), { recursive: true });
  mkdirSync(join(outDir, 'prompts'), { recursive: true });
  mkdirSync(join(outDir, 'tasks'), { recursive: true });

  const tier1: Tier1Summary[] = [];
  const ksweepDetail: PairProbe[] = [];

  for (const seed of seeds) {
    const domain = opts.personsOverride !== undefined
      ? `xr-p${opts.personsOverride}-s${seed}`
      : `xr-s${seed}`;
    const dir = join(outDir, 'fixtures', domain);

    // 1. Generate + persist the fixture so scoring can replay it later.
    writeXrFixture(dir, domain, variant, seed);

    // 2. Reasoner reference.
    const rows = await runTier1(client, domain, dir, 2);
    const finalOn = rows.find((r) => r.episode === 2 && r.inference === 'on')!;
    const finalOff = rows.find((r) => r.episode === 2 && r.inference === 'off')!;
    const offConflictSlice: Record<string, number> = {};
    for (const q of CONFLICT_SLICE) {
      const id = `${domain}-${q}`;
      offConflictSlice[id] = finalOff.perQuestion?.[id] ?? 0;
    }
    tier1.push({
      seed, domain,
      onAccuracy: finalOn.accuracy,
      onPerQuestion: finalOn.perQuestion ?? {},
      offAccuracy: finalOff.accuracy,
      offConflictSlice,
      anomaly: finalOn.accuracy === 1
        ? null
        : `inference-ON accuracy ${finalOn.accuracy} != 1.0 at seed ${seed}`,
    });

    // 4a. Blind prompts — flat-all (shared full-KB context).
    const flatTasks = await buildFlatTasks(client, domain, dir, 2);
    writeFileSync(join(outDir, 'tasks', `${domain}-flat-all.jsonl`), toJsonl(flatTasks));
    writeFileSync(join(outDir, 'prompts', `${domain}-flat-all.txt`), renderFlatAllPrompt(flatTasks));

    // 4b. Blind prompts — flat-retrieved at hops=2 (the shipped configuration).
    const retrievedTasks = await buildRetrievedTasks(client, domain, dir, 2, 2);
    writeFileSync(join(outDir, 'tasks', `${domain}-flat-retrieved.jsonl`), toJsonl(retrievedTasks));
    writeFileSync(join(outDir, 'prompts', `${domain}-flat-retrieved.txt`), renderRetrievedPrompt(retrievedTasks));

    // 3. Deterministic k-sweep. buildRetrievedTasks left kg:abox holding both
    // episodes, which is exactly the state the balls are computed over.
    const oracle = JSON.parse(readFileSync(join(dir, 'oracle.json'), 'utf8')) as {
      coreference: OracleCorefPair[];
    };
    for (const k of hops) {
      for (const pair of oracle.coreference) {
        for (const direction of ['from-s2', 'from-s1'] as const) {
          ksweepDetail.push(await probePair(client, seed, k, pair, direction));
        }
      }
    }
  }

  const result: XrStatsResult = {
    variant: opts.variantName,
    seeds,
    hops,
    tier1,
    ksweep: aggregateProbes(ksweepDetail),
    ksweepDetail,
    generatedAt: opts.stamp ?? null,
  };
  writeFileSync(
    join(outDir, `xr-stats.${opts.variantName}.json`),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

function argOf(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function parseNums(raw: string, flag: string): number[] {
  const ns = raw.split(',').map((s) => Number(s.trim()));
  if (ns.length === 0 || ns.some((n) => !Number.isFinite(n))) {
    throw new Error(`${flag} must be a comma-separated list of numbers, got "${raw}"`);
  }
  return ns;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const personsArg = argOf(args, '--persons');
  const personsOverride = personsArg !== undefined ? Number(personsArg) : undefined;
  if (personsOverride !== undefined && (!Number.isInteger(personsOverride) || personsOverride < 10)) {
    throw new Error(`--persons must be an integer >= 10, got "${personsArg}"`);
  }
  const variantName = personsOverride !== undefined
    ? `conflict-xr-p${personsOverride}`
    : (argOf(args, '--variant') ?? 'conflict-xr-small');
  if (personsOverride === undefined && !XR_VARIANTS[variantName]) {
    throw new Error(`unknown --variant ${variantName}; expected one of ${Object.keys(XR_VARIANTS).join(', ')}`);
  }
  // The scale variant and --persons collapse-sweep sizes run the single
  // default seed by design; --seeds still overrides for --persons runs.
  const seeds = variantName === 'conflict-xr-scale'
    ? [SEED_V2]
    : parseNums(argOf(args, '--seeds') ?? (personsOverride !== undefined ? String(SEED_V2) : '11,23,37,42,59'), '--seeds');
  const hops = parseNums(argOf(args, '--hops') ?? '1,2,3,4', '--hops');
  const outArg = argOf(args, '--out') ?? join('results', 'xr-pilot');
  const outDir = isAbsolute(outArg) ? outArg : join(PKG_ROOT, outArg);
  const stamp = argOf(args, '--stamp');

  const res = await runXrStats(getAdapter(), { seeds, hops, variantName, outDir, stamp, personsOverride });

  for (const t of res.tier1) {
    const flag = t.anomaly ? `  ANOMALY: ${t.anomaly}` : '';
    console.log(`tier1 ${t.domain}: ON=${t.onAccuracy.toFixed(3)} OFF=${t.offAccuracy.toFixed(3)}${flag}`);
  }
  for (const kind of ['conflicted', 'benign'] as const) {
    for (const k of hops) {
      for (const direction of ['from-s2', 'from-s1'] as const) {
        const rows = res.ksweep.filter((r) => r.kind === kind && r.k === k && r.direction === direction);
        if (rows.length === 0) continue;
        const ci = bootstrapCI(rows.map((r) => r.twinReachRate));
        console.log(
          `ksweep ${kind} k=${k} ${direction}: reach mean=${ci.mean.toFixed(3)} `
          + `[${ci.lo95.toFixed(3)}, ${ci.hi95.toFixed(3)}] over ${rows.length} seed(s), `
          + `meanTriples=${(rows.reduce((a, r) => a + r.meanBallTriples, 0) / rows.length).toFixed(1)}`,
        );
      }
    }
  }
  console.log(`wrote ${join(outDir, `xr-stats.${variantName}.json`)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
