/**
 * Pinned-model flat runner with COMPLETE raw logging (publication plan §10
 * "replace in-session frontier agents with pinned APIs and complete raw logs";
 * §9 "publish all prompts, raw responses, versions, seeds, token counts, and
 * failures").
 *
 * Same measurement loop shape as src/flat-auto.ts (tasks -> provider ->
 * parseFlatAnswer -> score vs the Tier-1 deterministic reference), but every
 * single HTTP attempt — request body verbatim, response body verbatim, retries,
 * network failures, latency, token usage, provider request ids — is persisted
 * under results/raw/<runId>/, and every scoreboard row carries a rawRef
 * {runId, seq} pointing at the exact call that produced it.
 *
 * Usage (storage env is REQUIRED — the eval store must be the in-process wasm
 * backend, not the developer's on-disk daemon):
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     ANTHROPIC_API_KEY=sk-... \
 *     tsx src/pinned/flat-pinned-cli.ts conflict-xr-small --arm flat-all \
 *       --models anthropic:claude-haiku-4-5-20251001@weak --runs 3
 *
 *   # CI / no network / no key: canned deterministic MockProvider, full raw-log tree
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     tsx src/pinned/flat-pinned-cli.ts conflict-xr-small --arm flat-retrieved --dry-run
 *
 * Flags:
 *   --arm flat-all|flat-retrieved   (required) whole-KB context vs per-question k-hop retrieval
 *   --models <csv>                  model specs "vendor:model@tier" (default: the flat-auto ladder)
 *   --runs N                        runs per model (default 1)
 *   --hops K                        retrieval ball radius for flat-retrieved (default 2)
 *   --max-questions N               cap the task list (smoke runs)
 *   --dry-run                       MockProvider: canned deterministic answers, zero network
 *
 * Exit codes: 0 ok; 1 usage error; 2 missing API key (message names the env var).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildFlatPrompt, buildFlatTasks, scoreFlat, type FlatAnswerValue, type FlatTask } from '../rigs/flat-baseline.js';
import { buildRetrievedTasks } from '../rigs/flat-retrieved.js';
import { runTier1 } from '../rigs/tier1-deterministic.js';
import { loadQuestions } from '../questions.js';
import { parseFlatAnswer } from '../flat-auto.js';
import { parseModelSpec, makeProvider, DEFAULT_LADDER, type ModelProvider } from '../model-provider.js';
import { RawLogWriter, fixtureSha256, gitSha, sha256Hex, type RunManifest } from './raw-log.js';
import { PinnedProvider, MockProvider } from './pinned-provider.js';

// Keep these three constants in sync with src/flat-auto.ts (not exported there;
// this runner must not modify that file).
const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 8 }, research: { episodes: 8 }, coding: { episodes: 3 },
  'conflict-d05': { episodes: 2 }, 'conflict-d20': { episodes: 2 }, 'conflict-d50': { episodes: 2 },
  'conflict-xr-small': { episodes: 2 }, 'conflict-xr-scale': { episodes: 2 },
};
const CONFLICT_RULES = new Set(['r08', 'r11', 'r20', 'r21']);
const SYSTEM = 'You are a precise, deterministic reasoning engine. Follow the instructions exactly and output only the requested JSON — no prose, no code fences.';

type FlatArm = 'flat-all' | 'flat-retrieved';

export interface PinnedCellRow {
  runId: string;
  timestamp: string;
  domain: string;
  arm: FlatArm;
  model: string;
  tier: string;
  run: number;
  questionId: string;
  isConflict: boolean;
  parsed: boolean;
  flatF1: number;
  t1F1: number;
  reasonerAdvantage: number;
  /** Pointer into results/raw/<runId>/NNNN.json: the final logged attempt for this question. */
  rawRef: { runId: string; seq: number } | null;
}

export interface PinnedRunOptions {
  domain: string;
  arm: FlatArm;
  modelsCsv?: string;
  runs: number;
  hops: number;
  maxQuestions?: number;
  dryRun: boolean;
  /** Results base dir (default <package>/results). Tests point this at a temp dir. */
  resultsDir?: string;
  /** argv recorded in the manifest (default process.argv.slice(2)). */
  cliArgv?: string[];
}

function pkgRoot(): string {
  return join(import.meta.dirname, '..', '..');
}

function baseUrlHosts(providers: ModelProvider[]): Record<string, string> {
  const hosts: Record<string, string> = {};
  for (const p of providers) {
    if (p.spec.vendor === 'anthropic') hosts.anthropic = 'api.anthropic.com';
    else {
      try {
        hosts.openai = new URL(process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').host;
      } catch {
        hosts.openai = 'invalid-OPENAI_BASE_URL';
      }
    }
  }
  return hosts;
}

export async function runPinned(
  client: StorageAdapter,
  opts: PinnedRunOptions,
): Promise<{ rows: PinnedCellRow[]; writer: RawLogWriter; scoreboardFile: string; manifest: RunManifest }> {
  const cfg = DOMAINS[opts.domain];
  if (!cfg) throw new Error(`unknown domain: ${opts.domain}`);
  const dir = join(pkgRoot(), 'fixtures', opts.domain);
  const episodes = cfg.episodes;
  const resultsDir = opts.resultsDir ?? join(pkgRoot(), 'results');

  const runId = `${opts.domain}-pinned-${opts.arm}-${Date.now()}`;
  const writer = new RawLogWriter(join(resultsDir, 'raw'), runId);

  const specs = (opts.modelsCsv ?? DEFAULT_LADDER.join(','))
    .split(',').map((s) => s.trim()).filter(Boolean).map(parseModelSpec);
  const providers: PinnedProvider[] = specs.map((spec) =>
    opts.dryRun ? new MockProvider(spec, writer) : new PinnedProvider(makeProvider(spec), writer),
  );

  const questions = loadQuestions(dir);
  const conflictIds = new Set(
    questions.filter((q) => q.type === 'conflict' || q.rule_under_test.some((r) => CONFLICT_RULES.has(r))).map((q) => q.id),
  );

  // Build tasks BEFORE Tier1 touches (and resets) the store — same order as flat-auto.
  let tasks: FlatTask[] = opts.arm === 'flat-retrieved'
    ? await buildRetrievedTasks(client, opts.domain, dir, episodes, opts.hops)
    : await buildFlatTasks(client, opts.domain, dir, episodes);
  if (opts.maxQuestions && opts.maxQuestions > 0) tasks = tasks.slice(0, opts.maxQuestions);
  const taskIds = new Set(tasks.map((t) => t.id));

  // Deterministic Tier-1 reasoner reference (constant across models). runTier1
  // seeds provenance internally after loading kg:abox, satisfying the closure
  // gate before any materialization.
  const t1rows = await runTier1(client, opts.domain, dir, episodes);
  const t1final = t1rows.find((r) => r.inference === 'on' && r.episode === episodes);
  if (!t1final) throw new Error(`Tier 1 produced no final row for "${opts.domain}".`);
  const t1 = new Map(Object.entries(t1final.perQuestion));

  // Manifest first — if the model loop dies mid-run, the raw tree is still interpretable.
  const promptSha256: Record<string, string> = {};
  for (const t of tasks) promptSha256[t.id] = sha256Hex(buildFlatPrompt(t));
  const manifest: RunManifest = {
    runId,
    startedAt: new Date().toISOString(),
    gitSha: gitSha(pkgRoot()),
    domain: opts.domain,
    arm: opts.arm,
    models: specs.map((s) => s.spec),
    runs: opts.runs,
    hops: opts.arm === 'flat-retrieved' ? opts.hops : null,
    temperature: 0,
    seedPolicy: 'seed=run-index (1..runs); honored by OpenAI chat completions, ignored by Anthropic messages',
    fixtureSha256: fixtureSha256(dir),
    promptSha256,
    cliArgv: opts.cliArgv ?? process.argv.slice(2),
    env: {
      backend: process.env.PREDICATE_BACKEND ?? null,
      storePath: process.env.PREDICATE_STORE_PATH ?? null,
      baseUrlHost: baseUrlHosts(providers),
    },
    dryRun: opts.dryRun,
  };
  writer.writeManifest(manifest);

  const scoreboardFile = join(resultsDir, `flat-pinned.${opts.domain}.${opts.arm}.jsonl`);
  mkdirSync(dirname(scoreboardFile), { recursive: true });

  const rows: PinnedCellRow[] = [];
  for (const provider of providers) {
    process.stderr.write(`\n>>> ${provider.spec.spec} (tier=${provider.spec.tier}, arm=${opts.arm}, dryRun=${opts.dryRun})\n`);
    const ts = new Date().toISOString();
    for (let run = 1; run <= opts.runs; run++) {
      const answers = new Map<string, FlatAnswerValue>();
      const rawSeqByTask = new Map<string, number>();
      for (const task of tasks) {
        let parsed: FlatAnswerValue | null = null;
        try {
          const text = await provider.complete({
            system: SYSTEM, prompt: buildFlatPrompt(task), maxTokens: 1024, temperature: 0, seed: run,
          });
          parsed = parseFlatAnswer(text);
        } catch (e) {
          process.stderr.write(`  [${provider.spec.label} run ${run}] ${task.id} FAILED: ${String(e)}\n`);
        }
        // writer.lastSeq is the final attempt logged for this completion
        // (success, HTTP error, or network failure) — the loop is sequential.
        if (writer.lastSeq > 0) rawSeqByTask.set(task.id, writer.lastSeq);
        if (parsed !== null) answers.set(task.id, parsed);
      }
      const scored = scoreFlat(opts.domain, dir, episodes, answers).filter((s) => taskIds.has(s.questionId));
      for (const s of scored) {
        const t1F1 = t1.get(s.questionId) ?? 0;
        const seq = rawSeqByTask.get(s.questionId);
        const row: PinnedCellRow = {
          runId, timestamp: ts, domain: opts.domain, arm: opts.arm,
          model: provider.spec.spec, tier: provider.spec.tier, run,
          questionId: s.questionId, isConflict: conflictIds.has(s.questionId), parsed: s.parsed,
          flatF1: s.f1, t1F1, reasonerAdvantage: t1F1 - s.f1,
          rawRef: seq === undefined ? null : { runId, seq },
        };
        rows.push(row);
        appendFileSync(scoreboardFile, JSON.stringify(row) + '\n');
      }
      process.stderr.write(`  [${provider.spec.label}] run ${run}/${opts.runs} done (${answers.size}/${tasks.length} parsed)\n`);
    }
  }
  return { rows, writer, scoreboardFile, manifest };
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

function summarize(rows: PinnedCellRow[], writer: RawLogWriter, scoreboardFile: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`raw log:    ${writer.runDir} (${writer.lastSeq} calls + manifest.json)`);
  lines.push(`scoreboard: ${scoreboardFile} (+${rows.length} rows, each with rawRef)`);
  lines.push('');
  lines.push(['model'.padEnd(38), 'parsed'.padEnd(8), 'flatF1'.padEnd(8), 't1F1'.padEnd(8), 'adv(all)'.padEnd(9), 'adv(conflict)'].join(' '));
  for (const m of [...new Set(rows.map((r) => r.model))]) {
    const rs = rows.filter((r) => r.model === m);
    const conflict = rs.filter((r) => r.isConflict);
    lines.push([
      m.padEnd(38),
      `${rs.filter((r) => r.parsed).length}/${rs.length}`.padEnd(8),
      mean(rs.map((r) => r.flatF1)).toFixed(2).padEnd(8),
      mean(rs.map((r) => r.t1F1)).toFixed(2).padEnd(8),
      mean(rs.map((r) => r.reasonerAdvantage)).toFixed(2).padEnd(9),
      mean(conflict.map((r) => r.reasonerAdvantage)).toFixed(2),
    ].join(' '));
  }
  return lines.join('\n');
}

function parseArgs(argv: string[]): PinnedRunOptions | { usageError: string } {
  const [domain] = argv;
  if (!domain || !DOMAINS[domain]) {
    return { usageError: `usage: flat-pinned-cli <${Object.keys(DOMAINS).join('|')}> --arm flat-all|flat-retrieved [--models a,b,c] [--runs N] [--hops K] [--max-questions N] [--dry-run]` };
  }
  let arm: FlatArm | undefined;
  let modelsCsv: string | undefined;
  let runs = 1;
  let hops = 2;
  let maxQuestions: number | undefined;
  let dryRun = false;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--arm') {
      const v = argv[++i];
      if (v !== 'flat-all' && v !== 'flat-retrieved') return { usageError: `--arm must be flat-all or flat-retrieved (got "${v}")` };
      arm = v;
    } else if (a === '--models') modelsCsv = argv[++i];
    else if (a === '--runs') runs = Number(argv[++i]);
    else if (a === '--hops') hops = Number(argv[++i]);
    else if (a === '--max-questions') maxQuestions = Number(argv[++i]);
    else if (a === '--dry-run') dryRun = true;
    else return { usageError: `unknown flag: ${a}` };
  }
  if (!arm) return { usageError: 'missing required --arm flat-all|flat-retrieved' };
  if (!Number.isFinite(runs) || runs < 1) return { usageError: '--runs must be a positive integer' };
  if (!Number.isFinite(hops) || hops < 1) return { usageError: '--hops must be a positive integer' };
  return { domain, arm, modelsCsv, runs, hops, maxQuestions, dryRun };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const parsed = parseArgs(process.argv.slice(2));
  if ('usageError' in parsed) {
    console.error(parsed.usageError);
    process.exit(1);
  }
  if (!parsed.dryRun) {
    // Fail fast with an actionable one-liner BEFORE building tasks / running Tier1.
    const specs = (parsed.modelsCsv ?? DEFAULT_LADDER.join(',')).split(',').map((s) => s.trim()).filter(Boolean).map(parseModelSpec);
    const missing = specs.map(makeProvider).filter((p) => !p.isAvailable());
    if (missing.length) {
      const envs = [...new Set(missing.map((p) => p.keyEnv))].join(' and ');
      console.error(`error: ${envs} not set — export ${envs} (needed by ${missing.map((p) => p.spec.spec).join(', ')}) or pass --dry-run`);
      process.exit(2);
    }
  }
  runPinned(getAdapter(), parsed)
    .then(({ rows, writer, scoreboardFile }) => console.log(summarize(rows, writer, scoreboardFile)))
    .catch((e) => { console.error(e); process.exit(1); });
}
