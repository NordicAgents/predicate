import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildFlatTasks, scoreFlat, type FlatAnswerValue, type FlatRow } from './rigs/flat-baseline.js';
import { runTier1 } from './rigs/tier1-deterministic.js';

const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 8 }, research: { episodes: 8 }, coding: { episodes: 3 },
};

function dirFor(domain: string): string {
  return join(import.meta.dirname, '..', 'fixtures', domain);
}

export async function emitFlatTasks(
  client: StorageAdapter, domain: string, dir: string, episodes: number, outFile: string,
): Promise<number> {
  const tasks = await buildFlatTasks(client, domain, dir, episodes);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
  return tasks.length;
}

function isFlatAnswer(x: unknown): x is { id: string; answer: FlatAnswerValue } {
  if (typeof x !== 'object' || x === null) return false;
  const a = x as Record<string, unknown>;
  if (typeof a.id !== 'string') return false;
  return typeof a.answer === 'boolean'
    || (Array.isArray(a.answer) && a.answer.every((v) => typeof v === 'string'));
}

/** Score flat answers and report the flat-vs-Tier1 gap (reasoner's advantage over in-context recall). */
export async function scoreFlatAnswers(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
  answersFile: string, scoreboardFile: string,
): Promise<{ gap: number; summary: string; rows: FlatRow[] }> {
  const answers = new Map<string, FlatAnswerValue>();
  for (const line of readFileSync(answersFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const obj: unknown = JSON.parse(line);
    if (isFlatAnswer(obj)) answers.set(obj.id, obj.answer);
  }
  const rows = scoreFlat(domain, dir, episodes, answers);

  const t1rows = await runTier1(client, domain, dir, episodes);
  const t1final = t1rows.find((r) => r.inference === 'on' && r.episode === episodes);
  if (!t1final) throw new Error(`Tier 1 produced no final row for "${domain}" at episode ${episodes}.`);
  const tier1Final = new Map(Object.entries(t1final.perQuestion));

  mkdirSync(dirname(scoreboardFile), { recursive: true });
  for (const r of rows) appendFileSync(scoreboardFile, JSON.stringify(r) + '\n');

  const lines = [`Flat (in-context) vs Tier1 (reasoner) — ${domain}`, 'question            t1    flat  gap   parsed'];
  for (const r of rows) {
    const t1 = tier1Final.get(r.questionId) ?? 0;
    lines.push(
      `${r.questionId.padEnd(18)} ${t1.toFixed(2)}  ${r.f1.toFixed(2)}  ${(t1 - r.f1).toFixed(2)}  ${r.parsed ? 'ok' : 'MISSING'}`,
    );
  }
  const n = rows.length || 1;
  const t1mean = rows.reduce((a, r) => a + (tier1Final.get(r.questionId) ?? 0), 0) / n;
  const flatMean = rows.reduce((a, r) => a + r.f1, 0) / n;
  const gap = t1mean - flatMean;
  lines.push(`aggregate: t1=${t1mean.toFixed(2)} flat=${flatMean.toFixed(2)} reasoner_advantage=${gap.toFixed(2)}`);
  return { gap, summary: lines.join('\n'), rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, domain, file] = process.argv.slice(2);
  const cfg = DOMAINS[domain ?? ''];
  if (!cmd || !cfg) { console.error('usage: flat emit <domain> | flat score <domain> <answersFile>'); process.exit(1); }
  const dir = dirFor(domain!);
  if (cmd === 'emit') {
    const out = join(import.meta.dirname, '..', 'results', `flat-tasks.${domain}.jsonl`);
    emitFlatTasks(getAdapter(), domain!, dir, cfg.episodes, out)
      .then((n) => console.log(`wrote ${n} flat tasks to ${out}`))
      .catch((e) => { console.error(e); process.exit(1); });
  } else if (cmd === 'score') {
    if (!file) { console.error('score needs an answers file'); process.exit(1); }
    const sb = join(import.meta.dirname, '..', 'results', 'flat-scoreboard.jsonl');
    scoreFlatAnswers(getAdapter(), domain!, dir, cfg.episodes, file, sb)
      .then(({ summary }) => console.log(summary))
      .catch((e) => { console.error(e); process.exit(1); });
  } else { console.error(`unknown command: ${cmd}`); process.exit(1); }
}
