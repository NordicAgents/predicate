import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import { applyEpisodeTriples } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import { countTriples } from '../metrics.js';
import { scoreSet } from '../scorer.js';
import { generateOrg } from './generate-org.js';

export interface SweepRow {
  people: number;
  aboxTriples: number;
  inferred: number;
  materializeMs: number;
  tier1Accuracy: number;     // golden SPARQL over the materialized closure — should stay ~1.0
  flatContextChars: number;  // TBox + serialized ABox = the flat-baseline prompt body
  flatTokensEst: number;     // ≈ chars / 4 — proxy for whether flat still fits a context window
}

const GRAPHS = ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:provenance'] as const;

function worldTtl(): string {
  return readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'org', 'world.ttl'), 'utf8');
}

/** Run the org generator at each size; materialize (timed) and record reasoner accuracy + flat-context growth. */
export async function sweep(
  client: StorageAdapter, sizes: number[], seed = 1,
): Promise<SweepRow[]> {
  const world = worldTtl();
  const adapter = new FusekiConstructAdapter(client);
  const rows: SweepRow[] = [];

  for (const people of sizes) {
    const g = generateOrg({ people, branching: 4, teams: 8, questions: 12, seed });
    for (const graph of GRAPHS) {
      await client.update(`DROP SILENT GRAPH <${graph}>`);
      await client.update(`CREATE SILENT GRAPH <${graph}>`);
    }
    await client.loadTurtle(world, 'kg:tbox');
    await applyEpisodeTriples(client, g.triples);
    await seedProvenance(client);

    const t0 = Date.now();
    await adapter.materialize({
      tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
    });
    const materializeMs = Date.now() - t0;

    let sum = 0;
    for (const q of g.questions) {
      const r = await client.select(q.goldenSparql);
      const got = new Set(r.results.bindings.map((b) => Object.values(b)[0]!.value));
      const expected = new Set((q.expected as { values: string[] }).values);
      sum += scoreSet(expected, got).f1;
    }
    const tier1Accuracy = g.questions.length ? sum / g.questions.length : 0;

    const aboxNt = await client.serializeGraph('kg:abox', 'nt');
    const flatContextChars = world.length + aboxNt.length;

    rows.push({
      people,
      aboxTriples: await countTriples(client, 'kg:abox'),
      inferred: await countTriples(client, 'kg:inferred'),
      materializeMs,
      tier1Accuracy,
      flatContextChars,
      flatTokensEst: Math.round(flatContextChars / 4),
    });
  }
  return rows;
}

export function renderSweep(rows: SweepRow[]): string {
  const lines = ['people  abox   inferred  materialize_ms  tier1_acc  flat_tokens_est'];
  for (const r of rows) {
    lines.push(
      `${String(r.people).padEnd(7)} ${String(r.aboxTriples).padEnd(6)} ` +
      `${String(r.inferred).padEnd(9)} ${String(r.materializeMs).padEnd(15)} ` +
      `${r.tier1Accuracy.toFixed(2).padEnd(10)} ${r.flatTokensEst}`,
    );
  }
  return lines.join('\n');
}
