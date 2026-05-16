import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../src/index.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);
const adapter = new FusekiConstructAdapter(client);

const M_TBOX = 'kg:tbox-test-fp';
const M_INF  = 'kg:inferred-test-fp';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  await reset(M_TBOX);
  await client.update(`
    PREFIX ex: <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT DATA { GRAPH <${M_TBOX}> {
      ex:Dog     rdfs:subClassOf ex:Mammal .
      ex:Mammal  rdfs:subClassOf ex:Animal .
      ex:Animal  rdfs:subClassOf ex:LivingThing .
      ex:LivingThing rdfs:subClassOf ex:Thing .
    } }
  `);
});

beforeEach(() => reset(M_INF));

describe('FusekiConstructAdapter.materialize', () => {
  it('computes the full transitive closure of a 4-step chain', async () => {
    const r = await adapter.materialize({
      tboxGraph: M_TBOX,
      aboxGraphs: [],
      targetGraph: M_INF,
      closureCutoff: 0.5,
    });
    expect(r.iterations).toBeGreaterThan(1);
    expect(r.iterations).toBeLessThanOrEqual(10);
    expect(r.inferredCount).toBeGreaterThan(0);

    const reached = await client.ask(`
      PREFIX ex:   <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${M_INF}> { ex:Dog rdfs:subClassOf ex:Thing } }
    `);
    expect(reached).toBe(true);
  });

  it('hard-fails if fixpoint does not converge within 10 iterations', async () => {
    // Force a synthetic blow-up by injecting an artificial growing chain.
    // Use a stub rule that always inserts a fresh-named triple.
    const fakeAdapter = new FusekiConstructAdapter(client);
    (fakeAdapter as unknown as { __rules: unknown }).__rules = [
      {
        id: 'stub-divergent',
        name: 'always-adds',
        insertWhere: (c: { inferredGraph: string }) => `
          INSERT DATA { GRAPH <${c.inferredGraph}> {
            <urn:gen:${Math.random()}> <urn:p> <urn:o> .
          } }
        `,
      },
    ];
    await expect(
      fakeAdapter.materialize({
        tboxGraph: M_TBOX, aboxGraphs: [], targetGraph: M_INF, closureCutoff: 0.5,
      }),
    ).rejects.toThrow(/fixpoint did not converge/i);
  });
});
