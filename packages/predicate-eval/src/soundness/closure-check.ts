import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import { seedProvenance } from '../provenance.js';

const NS = 'http://ex/sound#';
const P = `${NS}rel`;

export interface ClosureResult { missing: string[]; extra: string[]; }

/** Build a chain n0->...->nk over a transitive property, materialize, diff against the reference closure. */
export async function checkTransitiveClosure(
  client: StorageAdapter, k: number,
): Promise<ClosureResult> {
  for (const g of ['kg:tbox', 'kg:abox', 'kg:inferred', 'kg:provenance']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.loadTurtle(
    `<${P}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#TransitiveProperty> .`,
    'kg:tbox');
  const lines: string[] = [];
  for (let i = 0; i < k; i++) lines.push(`<${NS}n${i}> <${P}> <${NS}n${i + 1}> .`);
  await client.loadTurtle(lines.join('\n'), 'kg:abox');
  await seedProvenance(client);

  await new FusekiConstructAdapter(client).materialize({
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5,
  });

  // Reference closure: n_i -> n_j for all j > i
  const reference = new Set<string>();
  for (let i = 0; i <= k; i++) for (let j = i + 1; j <= k; j++) reference.add(`${i}->${j}`);

  const r = await client.select(
    `SELECT ?s ?o WHERE { { GRAPH <kg:abox> { ?s <${P}> ?o } } UNION { GRAPH <kg:inferred> { ?s <${P}> ?o } } }`);
  const got = new Set<string>();
  for (const b of r.results.bindings) {
    const s = b.s!.value.replace(`${NS}n`, ''); const o = b.o!.value.replace(`${NS}n`, '');
    got.add(`${s}->${o}`);
  }
  const missing = [...reference].filter((x) => !got.has(x));
  const extra = [...got].filter((x) => !reference.has(x));
  return { missing, extra };
}
