/**
 * E1 / Gate-2 pilot (AAAI plan §4.3, §9): unattended multi-model flat (Tier-0) runner.
 *
 * Runs the in-context "flat" baseline across a ladder of models (>=1 run each),
 * scores against the SAME oracle keys Tier1/Tier2 use, and reports the reasoner's
 * advantage over each model tier — with the CONTRADICTION slice broken out
 * separately, because that is the decisive signal for the whole AAAI reframe:
 *
 *   Does the reasoner's edge on the conflict questions SURVIVE a strong model,
 *   or does it collapse (meaning "schema-in-context suffices" and the thesis dies)?
 *
 * This is the cheapest, highest-information experiment named in the plan. Run it
 * first. If the conflict-slice advantage holds at the frontier tier → sprint.
 * If it evaporates → pivot to the crossover study at NeSy/ISWC/D&B.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm --filter predicate-eval flat-auto org
 *   ... flat-auto org --models anthropic:claude-haiku-4-5-20251001@weak,anthropic:claude-opus-4-8@frontier --runs 5
 *   OPENAI_API_KEY=sk-... ... flat-auto org --models openai:gpt-4o@frontier,anthropic:claude-opus-4-8@frontier
 *
 * Flags:
 *   --models <csv>   comma-separated model specs (default: weak/mid/frontier Anthropic ladder)
 *   --runs <n>       runs per model, for variance (default 3)
 *   --domain arg is positional: org | research | coding
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildFlatPrompt, buildFlatTasks, scoreFlat, type FlatAnswerValue, type FlatTask } from './rigs/flat-baseline.js';
import { runTier1 } from './rigs/tier1-deterministic.js';
import { loadQuestions } from './questions.js';
import { resolveModels, type ModelProvider } from './model-provider.js';

const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 8 }, research: { episodes: 8 }, coding: { episodes: 3 },
};

/** Rules whose questions are the "contradiction / knowledge-update" slice the reframe rests on. */
const CONFLICT_RULES = new Set(['r08', 'r11', 'r20', 'r21']);

const SYSTEM = 'You are a precise, deterministic reasoning engine. Follow the instructions exactly and output only the requested JSON — no prose, no code fences.';

function dirFor(domain: string): string {
  return join(import.meta.dirname, '..', 'fixtures', domain);
}

/** Robustly pull {"answer": ...} out of a model response (tolerates fences/prose). */
export function parseFlatAnswer(raw: string): FlatAnswerValue | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const attempt = (s: string): FlatAnswerValue | null => {
    try {
      const o: unknown = JSON.parse(s);
      if (o && typeof o === 'object' && 'answer' in o) {
        const a = (o as { answer: unknown }).answer;
        if (typeof a === 'boolean') return a;
        if (Array.isArray(a) && a.every((x) => typeof x === 'string')) return a as string[];
      }
    } catch { /* fall through */ }
    return null;
  };
  return attempt(cleaned) ?? (cleaned.match(/\{[\s\S]*\}/) ? attempt(cleaned.match(/\{[\s\S]*\}/)![0]) : null);
}

interface CellRow {
  runId: string;
  timestamp: string;
  domain: string;
  model: string;
  tier: string;
  run: number;
  questionId: string;
  isConflict: boolean;
  parsed: boolean;
  flatF1: number;
  t1F1: number;
  reasonerAdvantage: number;
}

async function runOneModel(
  provider: ModelProvider, tasks: FlatTask[], domain: string, dir: string, episodes: number,
  runs: number, t1: Map<string, number>, conflictIds: Set<string>, scoreboardFile: string,
): Promise<CellRow[]> {
  const rows: CellRow[] = [];
  const runId = `${domain}-flatauto-${provider.spec.model}-${Date.now()}`;
  const ts = new Date().toISOString();
  for (let run = 1; run <= runs; run++) {
    const answers = new Map<string, FlatAnswerValue>();
    for (const task of tasks) {
      let parsed: FlatAnswerValue | null = null;
      try {
        const text = await provider.complete({ system: SYSTEM, prompt: buildFlatPrompt(task), maxTokens: 1024, temperature: 0, seed: run });
        parsed = parseFlatAnswer(text);
      } catch (e) {
        process.stderr.write(`  [${provider.spec.label} run ${run}] ${task.id} FAILED: ${String(e)}\n`);
      }
      if (parsed !== null) answers.set(task.id, parsed);
    }
    const scored = scoreFlat(domain, dir, episodes, answers);
    for (const s of scored) {
      const t1F1 = t1.get(s.questionId) ?? 0;
      const row: CellRow = {
        runId, timestamp: ts, domain, model: provider.spec.spec, tier: provider.spec.tier, run,
        questionId: s.questionId, isConflict: conflictIds.has(s.questionId), parsed: s.parsed,
        flatF1: s.f1, t1F1, reasonerAdvantage: t1F1 - s.f1,
      };
      rows.push(row);
      appendFileSync(scoreboardFile, JSON.stringify(row) + '\n');
    }
    process.stderr.write(`  [${provider.spec.label}] run ${run}/${runs} done (${answers.size}/${tasks.length} parsed)\n`);
  }
  return rows;
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

function report(all: CellRow[], t1: Map<string, number>, conflictIds: Set<string>, questionIds: string[]): string {
  const models = [...new Set(all.map((r) => r.model))];
  const lines: string[] = [];
  lines.push('');
  lines.push('=== Flat (in-context) vs Tier1 (reasoner), by model — mean F1 over runs ===');
  lines.push(`(★ = contradiction slice: rules ${[...CONFLICT_RULES].join('/')})`);
  const header = ['question'.padEnd(10), 't1'.padEnd(5), ...models.map((m) => m.replace(/^anthropic:|^openai:/, '').slice(0, 14).padEnd(15))].join(' ');
  lines.push(header);
  for (const qid of questionIds) {
    const star = conflictIds.has(qid) ? '★' : ' ';
    const cells = models.map((m) => {
      const rs = all.filter((r) => r.model === m && r.questionId === qid);
      return mean(rs.map((r) => r.flatF1)).toFixed(2).padEnd(15);
    });
    lines.push([`${star}${qid}`.padEnd(10), (t1.get(qid) ?? 0).toFixed(2).padEnd(5), ...cells].join(' '));
  }
  lines.push('');
  lines.push('=== Reasoner advantage (t1 − flat), by model — LOWER as model strengthens = thesis weakening ===');
  lines.push(['slice'.padEnd(20), ...models.map((m) => m.replace(/^anthropic:|^openai:/, '').slice(0, 14).padEnd(15))].join(' '));
  const advFor = (m: string, ids: string[]): number => {
    const rs = all.filter((r) => r.model === m && ids.includes(r.questionId));
    return mean(rs.map((r) => r.reasonerAdvantage));
  };
  const conflictArr = [...conflictIds];
  const nonConflict = questionIds.filter((q) => !conflictIds.has(q));
  lines.push(['ALL questions'.padEnd(20), ...models.map((m) => advFor(m, questionIds).toFixed(2).padEnd(15))].join(' '));
  lines.push(['★ CONFLICT slice'.padEnd(20), ...models.map((m) => advFor(m, conflictArr).toFixed(2).padEnd(15))].join(' '));
  lines.push(['  non-conflict'.padEnd(20), ...models.map((m) => advFor(m, nonConflict).toFixed(2).padEnd(15))].join(' '));
  lines.push('');
  lines.push('GATE-2 PILOT READ: if "★ CONFLICT slice" advantage stays high (≳0.3) at the frontier');
  lines.push('model, the reframe holds → sprint. If it trends to ~0, the structural edge is a weak-model');
  lines.push('artifact → pivot to the crossover study (see docs/aaai-strategy.md §9).');
  return lines.join('\n');
}

export async function runMultiModel(
  client: StorageAdapter, domain: string, providers: ModelProvider[], runs: number,
): Promise<{ summary: string; rows: CellRow[] }> {
  const cfg = DOMAINS[domain];
  if (!cfg) throw new Error(`unknown domain: ${domain}`);
  const dir = dirFor(domain);
  const episodes = cfg.episodes;

  const questions = loadQuestions(dir);
  const questionIds = questions.map((q) => q.id);
  const conflictIds = new Set(
    questions.filter((q) => q.type === 'conflict' || q.rule_under_test.some((r) => CONFLICT_RULES.has(r))).map((q) => q.id),
  );

  // Build flat tasks (captures TBox+ABox context as a string) BEFORE Tier1 touches the store.
  const tasks = await buildFlatTasks(client, domain, dir, episodes);

  // Deterministic reasoner reference (constant across models).
  const t1rows = await runTier1(client, domain, dir, episodes);
  const t1final = t1rows.find((r) => r.inference === 'on' && r.episode === episodes);
  if (!t1final) throw new Error(`Tier 1 produced no final row for "${domain}".`);
  const t1 = new Map(Object.entries(t1final.perQuestion));

  const scoreboardFile = join(import.meta.dirname, '..', 'results', `flat-multimodel.${domain}.jsonl`);
  mkdirSync(dirname(scoreboardFile), { recursive: true });

  const all: CellRow[] = [];
  for (const p of providers) {
    process.stderr.write(`\n>>> ${p.spec.spec} (tier=${p.spec.tier})\n`);
    all.push(...await runOneModel(p, tasks, domain, dir, episodes, runs, t1, conflictIds, scoreboardFile));
  }

  const runMeta = { domain, runs, models: providers.map((p) => p.spec.spec), scoreboardFile };
  writeFileSync(join(dirname(scoreboardFile), `flat-multimodel.${domain}.meta.json`), JSON.stringify(runMeta, null, 2));
  return { summary: report(all, t1, conflictIds, questionIds), rows: all };
}

function parseArgs(argv: string[]): { domain: string; models?: string; runs: number } {
  const [domain] = argv;
  let models: string | undefined;
  let runs = 3;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--models') models = argv[++i];
    else if (argv[i] === '--runs') runs = Number(argv[++i]);
  }
  return { domain: domain ?? '', models, runs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { domain, models, runs } = parseArgs(process.argv.slice(2));
  if (!DOMAINS[domain]) {
    console.error('usage: flat-auto <org|research|coding> [--models a,b,c] [--runs N]');
    process.exit(1);
  }
  const providers = resolveModels(models);
  const unavailable = providers.filter((p) => !p.isAvailable());
  if (unavailable.length) {
    const envs = [...new Set(unavailable.map((p) => p.keyEnv))];
    console.error(`Missing API key(s): set ${envs.join(' and ')} in the environment.`);
    console.error(`Models needing a key: ${unavailable.map((p) => p.spec.spec).join(', ')}`);
    process.exit(1);
  }
  runMultiModel(getAdapter(), domain, providers, runs)
    .then(({ summary }) => console.log(summary))
    .catch((e) => { console.error(e); process.exit(1); });
}
