import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import type { EpisodeTriple } from '../episode-runner.js';
import { applyEpisodeTriples } from '../episode-runner.js';
import { seedProvenance } from '../provenance.js';
import { scoreSet } from '../scorer.js';
import { generateCodebaseHistory } from './generate-codebase-history.js';
import { neighborhood } from './retrieval.js';

const DEP = 'https://industriagents.com/predicate/codebase#dependsOn';
const GRAPHS = ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:provenance'] as const;

export interface HistRow {
  sessions: number;
  totalTriples: number;
  signalTriples: number;
  materializeMs: number;
  reasonerAccuracy: number;       // golden SPARQL over materialized closure
  flatAllTokensEst: number;       // TBox + EVERY fact in context
  retrievedTriplesAvg: number;    // avg neighbourhood size per question
  flatRetrievedTokensEst: number; // TBox + the retrieved subset only
}

function ntChars(triples: EpisodeTriple[]): number {
  let n = 0;
  for (const t of triples) n += t.s.length + t.p.length + t.o.length + 6;
  return n;
}

function codingWorld(): string {
  return readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'coding', 'world.ttl'), 'utf8');
}

/** Fixed codebase (files), growing captured history (sessions). Measure all three arms' cost+accuracy. */
export async function historySweep(
  client: StorageAdapter, sessionCounts: number[], files = 100, seed = 1,
): Promise<HistRow[]> {
  const world = codingWorld();
  const worldChars = world.length;
  const adapter = new FusekiConstructAdapter(client);
  const rows: HistRow[] = [];

  for (const sessions of sessionCounts) {
    const g = generateCodebaseHistory({ files, depsPerFile: 2, sessions, questions: 12, seed });
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
    let retrievedTotal = 0;
    for (const q of g.questions) {
      const r = await client.select(q.goldenSparql);
      const got = new Set(r.results.bindings.map((b) => Object.values(b)[0]!.value));
      const expected = new Set((q.expected as { values: string[] }).values);
      sum += scoreSet(expected, got).f1;
      const seedFile = `https://industriagents.com/predicate/codebase/${q.text.match(/f\d+\.ts/)![0]}`;
      retrievedTotal += neighborhood(g.triples, [seedFile], [DEP], 50).length;
    }
    const reasonerAccuracy = g.questions.length ? sum / g.questions.length : 0;
    const retrievedTriplesAvg = g.questions.length ? retrievedTotal / g.questions.length : 0;

    rows.push({
      sessions,
      totalTriples: g.triples.length,
      signalTriples: g.signalTriples,
      materializeMs,
      reasonerAccuracy,
      flatAllTokensEst: Math.round((worldChars + ntChars(g.triples)) / 4),
      retrievedTriplesAvg: Math.round(retrievedTriplesAvg),
      flatRetrievedTokensEst: Math.round((worldChars + retrievedTriplesAvg * 80) / 4),
    });
  }
  return rows;
}

export function renderHistory(rows: HistRow[]): string {
  const lines = ['sessions  total_facts  materialize_ms  reasoner_acc  flat_all_tokens  retrieved_avg  flat_retr_tokens'];
  for (const r of rows) {
    lines.push(
      `${String(r.sessions).padEnd(9)} ${String(r.totalTriples).padEnd(12)} ` +
      `${String(r.materializeMs).padEnd(15)} ${r.reasonerAccuracy.toFixed(2).padEnd(13)} ` +
      `${String(r.flatAllTokensEst).padEnd(16)} ${String(r.retrievedTriplesAvg).padEnd(14)} ${r.flatRetrievedTokensEst}`,
    );
  }
  return lines.join('\n');
}
