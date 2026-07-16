/**
 * Reader arm runner (pre-registration Amendment A5.2).
 *
 * Does an LLM reading EXACTLY what a retrieval policy returned detect the
 * conflict — and when it cannot, what does it do instead?
 *
 * One (domain x model) shard per process, BY DESIGN: PinnedProvider swaps
 * globalThis.fetch for the duration of each completion to capture raw logs, so
 * it is explicitly not safe under concurrent complete() calls. Concurrency
 * therefore lives in the driver (one child process per shard), never inside a
 * provider. Each shard writes its own raw-log tree and its own rows file.
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     tsx src/reader/run-reader-cli.ts conflict-xr-small \
 *       --model openai:z-ai/glm-5.2@a --runs 3
 *
 *   # no key / no network: canned deterministic MockProvider, full raw-log tree
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     tsx src/reader/run-reader-cli.ts conflict-xr-small --dry-run
 *
 * Flags:
 *   --model <spec>      "vendor:model@tier" (default: the A5.2.6 roster head)
 *   --runs N            repeats per cell (REGISTERED = 3; overriding is a
 *                       deviation and the runner says so loudly)
 *   --max-instances N   smoke runs only; recorded in the manifest
 *   --dry-run           MockProvider, zero network
 *   --resume            skip cells already present in the rows file
 *
 * Exit codes: 0 ok; 1 usage/error; 2 missing API key.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadDomainForRetrieval } from '../rigs/retrieval-policies.js';
import { makeProvider, parseModelSpec } from '../model-provider.js';
import { PinnedProvider, MockProvider } from '../pinned/pinned-provider.js';
import { RawLogWriter, fixtureSha256, gitSha, type RunManifest } from '../pinned/raw-log.js';
import type { InstanceRecord, PredictionRow } from '../instances/types.js';
import { CONTEXT_SOURCES, buildAllContexts, type BuiltContext } from './context-sources.js';
import {
  READER_SYSTEM, buildQ1Prompt, buildQ2Prompt, parseQ1, parseQ2, promptSha256, type Q2Outcome,
} from './prompts.js';

/** A5.2.5: registered repeats per cell. Not a default to be tuned — a registration. */
const REGISTERED_RUNS = 3;
/** A5.2.6 roster head. */
const DEFAULT_MODEL = 'openai:z-ai/glm-5.2@a';
const MAX_TOKENS = 1024;

const PKG_ROOT = join(import.meta.dirname, '..', '..');

export interface ReaderOptions {
  domain: string;
  model: string;
  runs: number;
  maxInstances?: number;
  dryRun: boolean;
  resume: boolean;
  resultsDir?: string;
}

/** Filesystem-safe slug for a model spec: "openai:z-ai/glm-5.2" -> "z-ai_glm-5.2". */
const modelSlug = (spec: string): string =>
  spec.replace(/^[^:]+:/, '').replace(/[^A-Za-z0-9._-]/g, '_');

function readInstances(domain: string): InstanceRecord[] {
  const file = join(PKG_ROOT, 'fixtures', domain, 'instances.json');
  return JSON.parse(readFileSync(file, 'utf8')) as InstanceRecord[];
}

/** Cells already written, keyed instanceId::source::run — for --resume. */
function completedCells(file: string): Set<string> {
  if (!existsSync(file)) return new Set();
  const done = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as PredictionRow;
      const e = r.extra as { contextSource?: string; run?: number };
      done.add(`${r.instanceId}::${e.contextSource}::${e.run}`);
    } catch { /* a torn final line is re-run, never trusted */ }
  }
  return done;
}

export async function runReader(client: StorageAdapter, opts: ReaderOptions): Promise<{ rows: number; file: string; complete: boolean; transportFailures: number }> {
  const dir = join(PKG_ROOT, 'fixtures', opts.domain);
  const resultsDir = opts.resultsDir ?? join(PKG_ROOT, 'results');
  const spec = parseModelSpec(opts.model);

  let instances = readInstances(opts.domain);
  if (opts.maxInstances && opts.maxInstances > 0) instances = instances.slice(0, opts.maxInstances);

  // Store must be loaded before contexts can be grown.
  const { schema } = await loadDomainForRetrieval(client, dir);
  process.stderr.write(`[${opts.domain}] building ${CONTEXT_SOURCES.length} contexts x ${instances.length} instances...\n`);
  const contexts = await buildAllContexts(client, PKG_ROOT, opts.domain, instances);

  const runId = `${opts.domain}-reader-${modelSlug(spec.spec)}-${Date.now()}`;
  const writer = new RawLogWriter(join(resultsDir, 'raw'), runId);
  const provider = opts.dryRun
    ? new MockProvider(spec, writer)
    : new PinnedProvider(makeProvider(spec), writer);

  const outDir = join(resultsDir, 'reader');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `reader.${opts.domain}.${modelSlug(spec.spec)}.jsonl`);
  const done = opts.resume ? completedCells(outFile) : new Set<string>();
  if (done.size > 0) process.stderr.write(`[${opts.domain}] --resume: skipping ${done.size} completed cells\n`);

  // Manifest first: if the loop dies mid-run the raw tree stays interpretable.
  const hashes: Record<string, string> = {};
  for (const inst of instances) {
    const c = contexts.get(inst.id)!;
    for (const src of CONTEXT_SOURCES) {
      const ctx = c.get(src.name)!;
      const seed = ctx.seed ?? inst.subjects[0]!;
      hashes[`${inst.id}::${src.name}::q1`] = promptSha256(buildQ1Prompt(schema, ctx.facts, inst, seed));
      if (inst.isConflict) {
        hashes[`${inst.id}::${src.name}::q2`] = promptSha256(buildQ2Prompt(schema, ctx.facts, inst, seed));
      }
    }
  }
  const manifest: RunManifest & Record<string, unknown> = {
    runId,
    startedAt: new Date().toISOString(),
    gitSha: gitSha(PKG_ROOT),
    domain: opts.domain,
    arm: 'reader',
    models: [spec.spec],
    runs: opts.runs,
    hops: null,
    temperature: 0,
    seedPolicy: 'seed = run index (1..runs); honored by OpenAI-compatible chat completions',
    fixtureSha256: fixtureSha256(dir),
    promptSha256: hashes,
    cliArgv: process.argv.slice(2),
    env: {
      backend: process.env.PREDICATE_BACKEND ?? null,
      storePath: process.env.PREDICATE_STORE_PATH ?? null,
      baseUrlHost: {
        openai: (() => {
          try { return new URL(process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').host; }
          catch { return 'invalid-OPENAI_BASE_URL'; }
        })(),
      },
    },
    dryRun: opts.dryRun,
    contextSources: CONTEXT_SOURCES.map((s) => s.name),
    registeredRuns: REGISTERED_RUNS,
    runsDeviation: opts.runs !== REGISTERED_RUNS,
    maxInstances: opts.maxInstances ?? null,
  };
  writer.writeManifest(manifest);

  let written = 0;
  let transportFailures = 0;
  for (let run = 1; run <= opts.runs; run++) {
    for (const inst of instances) {
      const c = contexts.get(inst.id)!;
      for (const src of CONTEXT_SOURCES) {
        const cellKey = `${inst.id}::${src.name}::${run}`;
        if (done.has(cellKey)) continue;
        const ctx: BuiltContext = c.get(src.name)!;
        const seed = ctx.seed ?? inst.subjects[0]!;

        // --- Q1: detection (every instance) ---
        const t0 = performance.now();
        let q1text = '';
        let q1err: string | null = null;
        try {
          q1text = await provider.complete({
            system: READER_SYSTEM, prompt: buildQ1Prompt(schema, ctx.facts, inst, seed),
            maxTokens: MAX_TOKENS, temperature: 0, seed: run,
          });
        } catch (e) { q1err = String(e); }
        const q1seq = writer.lastSeq;
        const q1 = q1err === null ? parseQ1(q1text) : null;
        const costMs = performance.now() - t0;

        // A TRANSPORT failure (429 / 503 / timeout / network, retries already
        // exhausted inside the provider) is NOT a reader failure and NOT a
        // parse failure. §6 makes PARSE failures misses; writing an unanswered
        // call as `flagged: false` would fabricate a miss — and on a throttled
        // endpoint it would fabricate precisely the negative H13a predicts.
        // Leave the cell UNWRITTEN so --resume retries it against a live
        // endpoint. Never zero-fill a question nobody was asked.
        if (q1err !== null) {
          transportFailures++;
          process.stderr.write(`  [transport] ${inst.id} ${src.name} run ${run} — cell left unwritten: ${q1err.slice(0, 90)}\n`);
          continue;
        }

        // --- Q2: silent-selection probe (conflict instances only) ---
        let q2Outcome: Q2Outcome | null = null;
        let q2Values: string[] = [];
        let q2seq: number | null = null;
        if (inst.isConflict) {
          let q2text = '';
          try {
            q2text = await provider.complete({
              system: READER_SYSTEM, prompt: buildQ2Prompt(schema, ctx.facts, inst, seed),
              maxTokens: MAX_TOKENS, temperature: 0, seed: run,
            });
            q2seq = writer.lastSeq;
            const p = parseQ2(q2text);
            q2Outcome = p.outcome;
            q2Values = p.values;
          } catch (e) {
            // Same rule: an unanswered Q2 is not an `unparseable` reader
            // outcome. Drop the whole cell rather than record half of it.
            transportFailures++;
            process.stderr.write(`  [transport] ${inst.id} ${src.name} run ${run} q2 — cell left unwritten: ${String(e).slice(0, 90)}\n`);
            continue;
          }
        }

        // §6: a parse failure or a dead call is an UNFLAGGED prediction (a miss
        // on a conflict instance), never a dropped row.
        const row: PredictionRow = {
          instanceId: inst.id,
          domain: opts.domain,
          system: `reader:${src.name}`,
          flagged: q1?.flagged ?? false,
          values: q1?.values ?? [],
          witness: [], // A5.2.8: a reader cites no triple ids; witnessRecall is undefined here.
          costMs: Math.round(costMs * 100) / 100,
          extra: {
            contextSource: src.name,
            policy: src.policy ?? src.kind,
            hops: src.hops ?? null,
            model: spec.spec,
            tier: spec.tier,
            run,
            seededOn: ctx.seed,
            contextTriples: ctx.contextTriples,
            contextBytes: ctx.contextBytes,
            witnessComplete: ctx.witnessComplete,
            goldValuesPresent: ctx.goldValuesPresent,
            q1Parsed: q1 !== null,
            q1Error: q1err,
            q2Outcome,
            q2Values,
            rawRef: { runId, q1Seq: q1seq, q2Seq: q2seq },
          },
        };
        appendFileSync(outFile, JSON.stringify(row) + '\n');
        written++;
      }
      if (written % 40 === 0) {
        process.stderr.write(`[${opts.domain}/${spec.label}] run ${run}/${opts.runs} — ${written} rows\n`);
      }
    }
  }
  const expected = opts.runs * instances.length * CONTEXT_SOURCES.length;
  const have = completedCells(outFile).size;
  process.stderr.write(
    `[${opts.domain}/${spec.label}] done — ${written} rows this pass, ${have}/${expected} cells complete`
    + (transportFailures > 0 ? `, ${transportFailures} cells left unwritten (transport)\n` : '\n'),
  );
  if (have < expected) {
    // Loud, because a silently short arm is how a throttled endpoint turns into
    // a wrong result. Incompleteness must be reported, never zero-filled.
    process.stderr.write(
      `[${opts.domain}/${spec.label}] INCOMPLETE: ${expected - have} cells still unrun — re-invoke with --resume.\n`,
    );
  }
  return { rows: written, file: outFile, complete: have === expected, transportFailures };
}

function parseArgs(argv: string[]): ReaderOptions | { usageError: string } {
  const [domain] = argv;
  if (!domain) return { usageError: 'usage: run-reader-cli <domain> [--model spec] [--runs N] [--max-instances N] [--dry-run] [--resume]' };
  let model = DEFAULT_MODEL;
  let runs = REGISTERED_RUNS;
  let maxInstances: number | undefined;
  let dryRun = false;
  let resume = false;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--model') model = argv[++i]!;
    else if (a === '--runs') runs = Number(argv[++i]);
    else if (a === '--max-instances') maxInstances = Number(argv[++i]);
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--resume') resume = true;
    else return { usageError: `unknown flag: ${a}` };
  }
  if (!Number.isFinite(runs) || runs < 1) return { usageError: '--runs must be a positive integer' };
  return { domain, model, runs, maxInstances, dryRun, resume };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const parsed = parseArgs(process.argv.slice(2));
  if ('usageError' in parsed) { console.error(parsed.usageError); process.exit(1); }
  if (parsed.runs !== REGISTERED_RUNS) {
    console.error(
      `WARNING: --runs ${parsed.runs} deviates from the REGISTERED ${REGISTERED_RUNS} (Amendment A5.2.5, §9 rule 4).\n`
      + '         Registered runs are fixed before the first repeat and are not extendable.\n'
      + '         This run is a DEVIATION and is marked as such in its manifest.',
    );
  }
  if (!parsed.dryRun) {
    const p = makeProvider(parseModelSpec(parsed.model));
    if (!p.isAvailable()) {
      console.error(`error: ${p.keyEnv} not set — export ${p.keyEnv} (needed by ${parsed.model}) or pass --dry-run`);
      process.exit(2);
    }
  }
  runReader(getAdapter(), parsed)
    .then(({ rows, file }) => console.log(`${rows} rows -> ${file}`))
    .catch((e: unknown) => { console.error(e); process.exit(1); });
}
