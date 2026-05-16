import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { r01 } from '../../src/rules/r01-subclassof-transitivity.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

const ruleCfg = {
  tboxGraph: 'kg:tbox-test-r01',
  aboxGraphs: ['kg:abox-test-r01'],
  inferredGraph: 'kg:inferred-test-r01',
  closureCutoff: 0.5,
};

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  await reset(ruleCfg.tboxGraph);
  await reset(ruleCfg.inferredGraph);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT DATA { GRAPH <${ruleCfg.tboxGraph}> {
      ex:Animal  rdfs:subClassOf ex:LivingThing .
      ex:Mammal  rdfs:subClassOf ex:Animal .
      ex:Dog     rdfs:subClassOf ex:Mammal .
    } }
  `);
});

beforeEach(() => reset(ruleCfg.inferredGraph));

describe('Rule 1: rdfs:subClassOf transitivity', () => {
  it('infers Dog ⊑ Animal after one application', async () => {
    await client.update(r01.insertWhere(ruleCfg));
    const r = await client.select(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?b WHERE { GRAPH <${ruleCfg.inferredGraph}> { ex:Dog rdfs:subClassOf ?b } }
    `);
    const inferred = r.results.bindings.map((b) => b.b!.value);
    expect(inferred).toContain('https://ex/Animal');
  });

  it('does not infer reflexive triples', async () => {
    await client.update(r01.insertWhere(ruleCfg));
    const r = await client.select(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <${ruleCfg.inferredGraph}> { ?x rdfs:subClassOf ?x }
      }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(0);
  });

  it('is idempotent — repeated applications converge (fixpoint)', async () => {
    // Run until fixpoint (chain needs 2 passes to fully close)
    await client.update(r01.insertWhere(ruleCfg));
    await client.update(r01.insertWhere(ruleCfg));
    const before = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${ruleCfg.inferredGraph}> { ?s ?p ?o } }`,
    );
    // Third application should add nothing
    await client.update(r01.insertWhere(ruleCfg));
    const after = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${ruleCfg.inferredGraph}> { ?s ?p ?o } }`,
    );
    expect(after.results.bindings[0]!.n!.value).toBe(before.results.bindings[0]!.n!.value);
  });
});
