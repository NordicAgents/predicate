/**
 * Load-scale ledger reasoner worker (pre-registration Amendment A4.2, H11):
 * child process that runs the frozen r14 -> r23 -> r22 chain over ONE
 * generated scale stratum and prints {materializeMs, iterations,
 * inferredCount} JSON to stdout. It is SPAWNED (never imported) by
 * scale-ledger-cli.ts so the parent can enforce the registered 300 s
 * wall-clock kill timer without leaving a half-materialized store in its own
 * process. Load + provenance-seed + fixpoint are modelled on
 * src/instances/reasoner-arm-cli.ts; the per-instance PredictionRows are
 * deliberately absent — A4.2 strata are cost-only and carry NO
 * detection-accuracy claims.
 *
 *   PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory: \
 *     tsx src/scale-ledger/reasoner-worker.ts <fixture-dir>
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runFixpoint } from 'predicate-reasoner/src/fixpoint.js';
import { r14 } from 'predicate-reasoner/src/rules/r14-has-key.js';
import { r22 } from 'predicate-reasoner/src/rules/r22-value-conflict.js';
import { r23 } from 'predicate-reasoner/src/rules/r23-sameas-value-propagation.js';
import { readEpisode, applyEpisodeTriples } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';

const GRAPHS = ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:usage', 'kg:provenance'] as const;

async function main(dir: string | undefined): Promise<void> {
  if (!dir) {
    console.error('usage: tsx src/scale-ledger/reasoner-worker.ts <fixture-dir>');
    process.exit(1);
  }
  const client = getAdapter();
  for (const g of GRAPHS) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(readFileSync(join(dir, 'world.ttl'), 'utf8'), 'kg:tbox');
  const files = readdirSync(join(dir, 'episodes')).filter((f) => f.endsWith('.jsonl')).sort();
  for (const f of files) {
    await applyEpisodeTriples(client, readEpisode(join(dir, 'episodes', f)));
  }
  await seedProvenance(client);

  const t0 = performance.now();
  const { iterations, inferredCount } = await runFixpoint(client, [r14, r23, r22], {
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], inferredGraph: 'kg:inferred', closureCutoff: 0.5,
  });
  const materializeMs = performance.now() - t0;
  process.stdout.write(JSON.stringify({ materializeMs, iterations, inferredCount }) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv[2]).catch((e: unknown) => { console.error(e); process.exit(1); });
}
