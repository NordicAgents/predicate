import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import { applyEpisodeTriples } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import { countTriples } from '../metrics.js';
import { scoreSet } from '../scorer.js';
import { generateOrg } from './generate-org.js';

/**
 * Two-arm comparison on the SAME generated org, for the transitive
 * "management chain" questions:
 *
 *   A. materialize — run the 21-rule fixpoint to fill kg:inferred (timed),
 *      then read the closure (today's Predicate path).
 *   B. query-time  — no fixpoint at all; answer each question with a SPARQL
 *      property path (reportsTo+) evaluated against kg:abox on demand.
 *
 * Both arms answer the identical questions against the identical facts, so
 * the question is purely: does B match A's accuracy, and at what fraction of
 * the cost? This is the apples-to-apples test the kg:inferred-only golden
 * query in the original sweep could not give.
 */
export interface CompareRow {
  people: number;
  aboxTriples: number;
  // Arm A: materialize + read closure
  materializeMs: number;
  materializeAcc: number;
  // Arm B: query-time property path, no materialization
  queryTimeMs: number;     // total wall time to answer ALL questions via property paths
  queryTimeAcc: number;
  answersMatch: boolean;   // did the two arms return the same answer set per question?
}

const GRAPHS = ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:provenance'] as const;

function worldTtl(): string {
  return readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'org', 'world.ttl'), 'utf8');
}

function bindingSet(bindings: Array<Record<string, { value: string }>>): Set<string> {
  return new Set(bindings.map((b) => Object.values(b)[0]!.value));
}

export async function sweepCompare(
  client: StorageAdapter, sizes: number[], seed = 1,
): Promise<CompareRow[]> {
  const world = worldTtl();
  const adapter = new FusekiConstructAdapter(client);
  const rows: CompareRow[] = [];

  for (const people of sizes) {
    const g = generateOrg({ people, branching: 4, teams: 8, questions: 12, seed });
    for (const graph of GRAPHS) {
      await client.update(`DROP SILENT GRAPH <${graph}>`);
      await client.update(`CREATE SILENT GRAPH <${graph}>`);
    }
    await client.loadTurtle(world, 'kg:tbox');
    await applyEpisodeTriples(client, g.triples);
    await seedProvenance(client);

    // --- Arm B FIRST: query-time, before kg:inferred exists, so it cannot
    //     accidentally read a materialized closure. ---
    const bAnswers: Set<string>[] = [];
    const tB = Date.now();
    for (const q of g.questions) {
      const r = await client.select(q.goldenPropertyPath!); // org chain questions always set this
      bAnswers.push(bindingSet(r.results.bindings));
    }
    const queryTimeMs = Date.now() - tB;

    // --- Arm A: materialize (timed), then read the closure. ---
    const tA = Date.now();
    await adapter.materialize({
      tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
    });
    const materializeMs = Date.now() - tA;

    let aSum = 0, bSum = 0;
    let allMatch = true;
    for (let i = 0; i < g.questions.length; i++) {
      const q = g.questions[i]!;
      const expected = new Set((q.expected as { values: string[] }).values);
      const a = bindingSet((await client.select(q.goldenSparql)).results.bindings);
      const b = bAnswers[i]!;
      aSum += scoreSet(expected, a).f1;
      bSum += scoreSet(expected, b).f1;
      if (a.size !== b.size || [...a].some((v) => !b.has(v))) allMatch = false;
    }
    const n = g.questions.length || 1;

    rows.push({
      people,
      aboxTriples: await countTriples(client, 'kg:abox'),
      materializeMs,
      materializeAcc: aSum / n,
      queryTimeMs,
      queryTimeAcc: bSum / n,
      answersMatch: allMatch,
    });
  }
  return rows;
}

export function renderCompare(rows: CompareRow[]): string {
  const lines = [
    'people  abox   | A:materialize_ms  A:acc | B:querytime_ms  B:acc | speedup  match',
  ];
  for (const r of rows) {
    const speedup = r.queryTimeMs > 0 ? (r.materializeMs / r.queryTimeMs).toFixed(0) + '×' : 'n/a';
    lines.push(
      `${String(r.people).padEnd(7)} ${String(r.aboxTriples).padEnd(6)} | ` +
      `${String(r.materializeMs).padEnd(17)} ${r.materializeAcc.toFixed(2).padEnd(5)} | ` +
      `${String(r.queryTimeMs).padEnd(15)} ${r.queryTimeAcc.toFixed(2).padEnd(5)} | ` +
      `${speedup.padEnd(8)} ${r.answersMatch ? 'yes' : 'NO'}`,
    );
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { getAdapter } = await import('predicate-mcp/src/storage/index.js');
  const sizes = process.argv.slice(2).map(Number).filter((x) => Number.isFinite(x) && x > 0);
  sweepCompare(getAdapter(), sizes.length ? sizes : [25, 100, 400, 1000])
    .then((rows) => { console.log(renderCompare(rows)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
