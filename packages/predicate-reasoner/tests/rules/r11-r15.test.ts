import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const client = getAdapter();
const adapter = new FusekiConstructAdapter(client);
const T = 'kg:tbox-test-r11-15';
const A = 'kg:abox-test-r11-15';
const I = 'kg:inferred-test-r11-15';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function withProv(s: string, p: string, o: string, conf = 1): Promise<void> {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${A}>          { ${s} ${p} ${o} . }
      GRAPH <kg:provenance> { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

beforeAll(async () => {
  for (const g of [T, A]) await reset(g);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT DATA { GRAPH <${T}> {
      ex:Cat       owl:disjointWith    ex:Dog .
      ex:Person    owl:equivalentClass ex:Human .
      ex:owns      owl:equivalentProperty ex:has .
      ex:User      owl:hasKey ( ex:userId ) .
      ex:Animal    rdfs:subClassOf      ex:LivingThing .
    } }
  `);
});
beforeEach(() => reset(I));

const M = (): Promise<{ inconsistencies: Array<{ kind: string }> }> =>
  adapter.materialize({
    tboxGraph: T, aboxGraphs: [A], targetGraph: I, closureCutoff: 0.5,
  }) as Promise<{ inconsistencies: Array<{ kind: string }> }>;

describe('rules 11–15', () => {
  it('r11: cat-typed-as-dog is reported as a disjoint-class inconsistency', async () => {
    await withProv('<https://ex/snowball>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/Cat>');
    await withProv('<https://ex/snowball>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/Dog>');
    const r = await M();
    expect(r.inconsistencies.length).toBeGreaterThan(0);
    expect(r.inconsistencies[0]!.kind).toBe('disjoint-class');
  });

  it('r12: equivalentClass materializes both subClassOf directions', async () => {
    await M();
    const a = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:Person rdfs:subClassOf ex:Human } }
    `);
    const b = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:Human rdfs:subClassOf ex:Person } }
    `);
    expect(a && b).toBe(true);
  });

  it('r13: equivalentProperty materializes both subPropertyOf directions', async () => {
    await M();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:owns rdfs:subPropertyOf ex:has } }
    `);
    expect(ok).toBe(true);
  });

  it('r14: same userId on two User instances → sameAs', async () => {
    await withProv('<https://ex/u1>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/User>');
    await withProv('<https://ex/u2>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/User>');
    await withProv('<https://ex/u1>', '<https://ex/userId>', '"abc"');
    await withProv('<https://ex/u2>', '<https://ex/userId>', '"abc"');
    await M();
    const ok = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { <https://ex/u1> owl:sameAs <https://ex/u2> } }
    `);
    expect(ok).toBe(true);
  });

  it('r15: rdf:type propagates through subClassOf', async () => {
    await withProv('<https://ex/leo>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/Animal>');
    await M();
    const ok = await client.ask(`
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      ASK { GRAPH <${I}> { <https://ex/leo> rdf:type <https://ex/LivingThing> } }
    `);
    expect(ok).toBe(true);
  });
});
