import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../src/index.js';

const client = new SparqlClient(loadConfig());
const adapter = new FusekiConstructAdapter(client);
const T = 'kg:tbox-test-validate';
const S = 'kg:staging-test-validate';
const A = 'kg:abox-test-validate';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  for (const g of [T, S, A]) await reset(g);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT DATA {
      GRAPH <${T}> {
        ex:Cat a owl:Class .
        ex:Dog a owl:Class .
        ex:Cat owl:disjointWith ex:Dog .
      }
      GRAPH <${A}> {
        ex:fluffy rdf:type ex:Cat .
      }
    }
  `);
});
beforeEach(() => reset(S));

describe('FusekiConstructAdapter.validate', () => {
  it('returns ok=true when the staged delta introduces no conflict', async () => {
    await client.update(`
      PREFIX ex:   <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX owl:  <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <${S}> {
        ex:Persian a owl:Class ; rdfs:subClassOf ex:Cat .
      } }
    `);
    const r = await adapter.validate({ tboxGraph: T, stagingGraph: S, aboxSample: A });
    expect(r.ok).toBe(true);
  });

  it('rejects a delta that makes an existing class unsatisfiable', async () => {
    // Staging a triple that would make Cat ⊑ Dog (a disjoint class)
    await client.update(`
      PREFIX ex:   <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      INSERT DATA { GRAPH <${S}> {
        ex:Cat rdfs:subClassOf ex:Dog .
      } }
    `);
    const r = await adapter.validate({ tboxGraph: T, stagingGraph: S, aboxSample: A });
    expect(r.ok).toBe(false);
  });
});
