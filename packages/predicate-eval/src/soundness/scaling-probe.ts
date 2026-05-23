import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';

const NS = 'http://ex/scale#';

export interface ScalingRow { triples: number; materializeMs: number; iterations: number; }

/** Build a subclass chain of `size` triples, materialize, record latency + iterations. Record-only. */
export async function probeScaling(
  client: StorageAdapter, sizes: number[],
): Promise<ScalingRow[]> {
  const rows: ScalingRow[] = [];
  for (const size of sizes) {
    for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred']) {
      await client.update(`DROP SILENT GRAPH <${g}>`);
      await client.update(`CREATE SILENT GRAPH <${g}>`);
    }
    const lines: string[] = [];
    for (let i = 0; i < size; i++) {
      lines.push(`<${NS}c${i}> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <${NS}c${i + 1}> .`);
    }
    await client.loadTurtle(lines.join('\n'), 'kg:tbox');
    const res = await new FusekiConstructAdapter(client).materialize({
      tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
    });
    rows.push({ triples: size, materializeMs: res.elapsedMs, iterations: res.iterations });
  }
  return rows;
}
