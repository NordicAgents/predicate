import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildTier2Tasks } from './rigs/tier2-tasks.js';
import { scoreTier2 } from './rigs/tier2-score.js';
import { runTier1 } from './rigs/tier1-deterministic.js';
import { tier1VsTier2 } from './tier2-report.js';
import { isTier2Answer } from './tier2-types.js';

const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 8 }, research: { episodes: 8 }, coding: { episodes: 3 },
};

function dirFor(domain: string): string {
  return join(import.meta.dirname, '..', 'fixtures', domain);
}

export async function emitTasks(
  client: StorageAdapter, domain: string, dir: string, episodes: number, outFile: string,
): Promise<number> {
  const tasks = await buildTier2Tasks(client, domain, dir, episodes);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
  return tasks.length;
}

export async function scoreAnswers(
  client: StorageAdapter, domain: string, dir: string, episodes: number,
  answersFile: string, scoreboardFile: string,
): Promise<{ gap: number; summary: string }> {
  const answers = new Map<string, string>();
  for (const line of readFileSync(answersFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const obj = JSON.parse(line);
    if (isTier2Answer(obj)) answers.set(obj.id, obj.sparql);
  }
  const rows = await scoreTier2(client, domain, dir, episodes, answers);

  const t1rows = await runTier1(client, domain, dir, episodes);
  const t1final = t1rows.filter((r) => r.inference === 'on' && r.episode === episodes)[0]!;
  const tier1Final = new Map(Object.entries(t1final.perQuestion));

  mkdirSync(dirname(scoreboardFile), { recursive: true });
  for (const r of rows) appendFileSync(scoreboardFile, JSON.stringify(r) + '\n');

  const summary = tier1VsTier2(domain, rows, tier1Final);
  const n = rows.length || 1;
  const gap = [...tier1Final.values()].reduce((a, b) => a + b, 0) / n
    - rows.reduce((a, r) => a + r.f1, 0) / n;
  return { gap, summary };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, domain, file] = process.argv.slice(2);
  const cfg = DOMAINS[domain ?? ''];
  if (!cmd || !cfg) { console.error('usage: tier2 emit <domain> | tier2 score <domain> <answersFile>'); process.exit(1); }
  const dir = dirFor(domain!);
  if (cmd === 'emit') {
    const out = join(import.meta.dirname, '..', 'results', `tier2-tasks.${domain}.jsonl`);
    emitTasks(getAdapter(), domain!, dir, cfg.episodes, out)
      .then((n) => console.log(`wrote ${n} tasks to ${out}`))
      .catch((e) => { console.error(e); process.exit(1); });
  } else if (cmd === 'score') {
    if (!file) { console.error('score needs an answers file'); process.exit(1); }
    const sb = join(import.meta.dirname, '..', 'results', 'tier2-scoreboard.jsonl');
    scoreAnswers(getAdapter(), domain!, dir, cfg.episodes, file, sb)
      .then(({ summary }) => console.log(summary))
      .catch((e) => { console.error(e); process.exit(1); });
  } else { console.error(`unknown command: ${cmd}`); process.exit(1); }
}
