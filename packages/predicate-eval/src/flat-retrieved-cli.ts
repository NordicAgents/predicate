import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildRetrievedTasks } from './rigs/flat-retrieved.js';
import { scoreFlatAnswers } from './flat.js';

/**
 * CLI for the retrieval-mediated flat arm (see rigs/flat-retrieved.ts).
 *
 *   pnpm --filter predicate-eval flat-retrieved emit  <domain> [--hops N]
 *   pnpm --filter predicate-eval flat-retrieved score <domain> <answersFile>
 *
 * Emit writes one task per question with a k-hop-scoped context (default
 * hops=2) to results/flatr-tasks.<domain>.jsonl. Scoring reuses the flat
 * scorer — the answer keys are arm-agnostic — and appends to
 * results/flatr-scoreboard.jsonl.
 */

const DOMAINS: Record<string, { episodes: number }> = {
  org: { episodes: 8 }, research: { episodes: 8 }, coding: { episodes: 3 },
  'conflict-d05': { episodes: 2 }, 'conflict-d20': { episodes: 2 }, 'conflict-d50': { episodes: 2 },
  'conflict-xr-small': { episodes: 2 }, 'conflict-xr-scale': { episodes: 2 },
};

function dirFor(domain: string): string {
  return join(import.meta.dirname, '..', 'fixtures', domain);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const [cmd, domain] = args;
  const cfg = DOMAINS[domain ?? ''];
  if (!cmd || !cfg) {
    console.error('usage: flat-retrieved emit <domain> [--hops N] | flat-retrieved score <domain> <answersFile>');
    process.exit(1);
  }
  const dir = dirFor(domain!);
  if (cmd === 'emit') {
    const hopsIdx = args.indexOf('--hops');
    const hops = hopsIdx >= 0 ? Number(args[hopsIdx + 1]) : 2;
    const out = join(import.meta.dirname, '..', 'results', `flatr-tasks.${domain}.jsonl`);
    buildRetrievedTasks(getAdapter(), domain!, dir, cfg.episodes, hops)
      .then((tasks) => {
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
        console.log(`wrote ${tasks.length} retrieval-scoped tasks (hops=${hops}) to ${out}`);
      })
      .catch((e) => { console.error(e); process.exit(1); });
  } else if (cmd === 'score') {
    const file = args[2];
    if (!file) { console.error('score needs an answers file'); process.exit(1); }
    const sb = join(import.meta.dirname, '..', 'results', 'flatr-scoreboard.jsonl');
    scoreFlatAnswers(getAdapter(), domain!, dir, cfg.episodes, file, sb)
      .then(({ summary }) => console.log(summary.replace('Flat (in-context)', 'Flat-RETRIEVED (k-hop)')))
      .catch((e) => { console.error(e); process.exit(1); });
  } else {
    console.error(`unknown command: ${cmd}`);
    process.exit(1);
  }
}
