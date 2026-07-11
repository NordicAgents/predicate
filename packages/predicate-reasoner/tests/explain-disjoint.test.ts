import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from '../src/index.js';

// explain()'s backward queries hardcode kg:abox / kg:inferred / kg:tbox / kg:provenance,
// so a kg_explain test must set up the conflict in those canonical graphs (see
// explain-conflict.test.ts for the r21 analogue).
const client = getAdapter();
const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const adapter = new FusekiConstructAdapter(client);

beforeAll(async () => {
  for (const g of ['kg:abox', 'kg:inferred', 'kg:provenance']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.update(`
    PREFIX ex:  <https://ex/>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT DATA { GRAPH <kg:tbox> { ex:Cat owl:disjointWith ex:Dog } }
  `);
  for (const cls of ['https://ex/Cat', 'https://ex/Dog']) {
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:abox>       { <https://ex/snowball> <${RDF_TYPE}> <${cls}> . }
        GRAPH <kg:provenance> { << <https://ex/snowball> <${RDF_TYPE}> <${cls}> >> pred:confidence "1"^^xsd:decimal . }
      }
    `);
  }
  await adapter.materialize({ tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5 });
});

describe('kg_explain on a materialized disjoint-class conflict (r11)', () => {
  it('reconstructs the conflict from its two rdf:type premises', async () => {
    const trace = await adapter.explain({ s: 'https://ex/snowball', p: RDF_TYPE, o: `${J}DisjointClassConflict` });
    expect(trace).not.toBeNull();
    const premiseObjs = trace!.derivation
      .flatMap((s) => s.premises)
      .map((q) => (typeof q.o === 'string' ? q.o : q.o.value));
    expect(premiseObjs).toContain('https://ex/Cat');
    expect(premiseObjs).toContain('https://ex/Dog');
  });
});
