import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgStats } from 'predicate-mcp/src/tools/kg-stats.js';

export async function stats(): Promise<number> {
  const client = new SparqlClient(loadConfig());
  const s = await kgStats(client);
  const rows: [string, string | number][] = [
    ['triples', s.triples],
    ['abox', s.abox],
    ['inferred', s.inferred],
    ['tbox', s.tbox],
    ['classes', s.classes],
    ['inferredRatio', s.inferredRatio.toFixed(3)],
    ['unusedConceptRatio', s.unusedConceptRatio.toFixed(3)],
    ['materializationLatencyMsP95', s.materializationLatencyMsP95],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) {
    console.log(`${k.padEnd(width)}  ${v}`);
  }
  return 0;
}
