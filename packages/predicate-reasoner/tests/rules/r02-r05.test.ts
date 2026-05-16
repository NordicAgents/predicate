import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);
const adapter = new FusekiConstructAdapter(client);

const T = 'kg:tbox-test-r2-5';
const A = 'kg:abox-test-r2-5';
const I = 'kg:inferred-test-r2-5';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function withProv(s: string, p: string, o: string, conf: number): Promise<void> {
  await client.update(`
    PREFIX pred: <https://predicate.dev/meta#>
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
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT DATA { GRAPH <${T}> {
      ex:owns      rdfs:subPropertyOf ex:possesses .
      ex:possesses rdfs:subPropertyOf ex:relatesTo .
      ex:ancestor  a owl:TransitiveProperty .
      ex:parentOf  owl:inverseOf       ex:childOf .
      ex:grandparentOf owl:propertyChainAxiom
        ( ex:parentOf ex:parentOf ) .
    } }
  `);
});

beforeEach(() => reset(I));

const M = (): Promise<unknown> => adapter.materialize({
  tboxGraph: T, aboxGraphs: [A], targetGraph: I, closureCutoff: 0.5,
});

describe('rules 2–5', () => {
  it('r02: subPropertyOf is transitive across the chain', async () => {
    await M();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:owns rdfs:subPropertyOf ex:relatesTo } }
    `);
    expect(ok).toBe(true);
  });

  it('r03: TransitiveProperty closes a 3-step chain', async () => {
    await withProv('<https://ex/a>', '<https://ex/ancestor>', '<https://ex/b>', 1);
    await withProv('<https://ex/b>', '<https://ex/ancestor>', '<https://ex/c>', 1);
    await withProv('<https://ex/c>', '<https://ex/ancestor>', '<https://ex/d>', 1);
    await M();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:a ex:ancestor ex:d } }
    `);
    expect(ok).toBe(true);
  });

  it('r04: inverseOf materializes the reverse direction', async () => {
    await withProv('<https://ex/m>', '<https://ex/parentOf>', '<https://ex/n>', 1);
    await M();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:n ex:childOf ex:m } }
    `);
    expect(ok).toBe(true);
  });

  it('r05: 2-step property chain materializes; 3-step does not', async () => {
    await withProv('<https://ex/g>', '<https://ex/parentOf>', '<https://ex/p>', 1);
    await withProv('<https://ex/p>', '<https://ex/parentOf>', '<https://ex/c>', 1);
    await withProv('<https://ex/c>', '<https://ex/parentOf>', '<https://ex/x>', 1);
    await M();
    const ok2 = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:g ex:grandparentOf ex:c } }
    `);
    expect(ok2).toBe(true);
    const ok3 = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:g ex:grandparentOf ex:x } }
    `);
    expect(ok3).toBe(false);
  });

  it('r03: a low-confidence premise is excluded from closure input', async () => {
    await withProv('<https://ex/lo1>', '<https://ex/ancestor>', '<https://ex/lo2>', 0.3);
    await withProv('<https://ex/lo2>', '<https://ex/ancestor>', '<https://ex/lo3>', 1);
    await M();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:lo1 ex:ancestor ex:lo3 } }
    `);
    expect(ok).toBe(false);
  });

  it('r16: subPropertyOf propagates the relation to the superproperty', async () => {
    // TBox already has: ex:owns rdfs:subPropertyOf ex:possesses (set in beforeAll)
    await withProv('<https://ex/alice>', '<https://ex/owns>', '<https://ex/widget>', 1);
    await M();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:alice ex:possesses ex:widget } }
    `);
    expect(ok).toBe(true);
  });
});
