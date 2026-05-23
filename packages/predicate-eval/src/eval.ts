import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from './rigs/tier1-deterministic.js';
import { appendScoreboard, renderCurve } from './report.js';
import type { ScoreRow } from './eval-types.js';

const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 8 },
  research: { episodes: 8 },
  coding: { episodes: 3 },
};

export async function runEval(
  client: StorageAdapter, domain: string, opts: { episodes?: number; write?: boolean } = {},
): Promise<{ rows: ScoreRow[]; curve: string }> {
  const cfg = DOMAINS[domain];
  if (!cfg) throw new Error(`unknown domain: ${domain}`);
  const dir = join(import.meta.dirname, '..', 'fixtures', domain);
  const rows = await runTier1(client, domain, dir, opts.episodes ?? cfg.episodes);
  if (opts.write !== false) appendScoreboard(rows);
  return { rows, curve: renderCurve(rows) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.argv[2] ?? 'org';
  runEval(getAdapter(), domain).then(({ curve }) => { console.log(curve); })
    .catch((e) => { console.error(e); process.exit(1); });
}
