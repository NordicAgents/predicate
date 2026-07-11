import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const client = getAdapter();
const adapter = new FusekiConstructAdapter(client);
const J = 'https://industriagents.com/predicate/judgment#';
const T = 'kg:tbox-test-r22';
const A = 'kg:abox-test-r22';
const I = 'kg:inferred-test-r22';

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
const M = (): Promise<unknown> =>
  adapter.materialize({ tboxGraph: T, aboxGraphs: [A], targetGraph: I, closureCutoff: 0.5 });

beforeAll(async () => {
  await reset(T);
  await client.update(`
    PREFIX ex: <https://ex/>
    PREFIX j:  <${J}>
    INSERT DATA { GRAPH <${T}> {
      ex:reportsTo a j:SingleValued .
      ex:office    a j:SingleValued .
      ex:memberOf  a <http://www.w3.org/2002/07/owl#ObjectProperty> .
      j:settledAs  a j:ConflictFunctionalProperty .
    } }
  `);
});
beforeEach(async () => { await reset(A); await reset(I); });

describe('r22 — domain-level single-valued conflict', () => {
  it('two values on a j:SingleValued property materialize a j:ValueConflict flag', async () => {
    await withProv('<https://ex/lee>', '<https://ex/reportsTo>', '<https://ex/omar>');
    await withProv('<https://ex/lee>', '<https://ex/reportsTo>', '<https://ex/nadia>');
    await M();
    const flagged = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { <https://ex/lee> a j:ValueConflict ; j:conflictOn <https://ex/reportsTo> } }
    `);
    expect(flagged).toBe(true);
    // Contradiction-PRESERVING: both value triples remain; nothing merged.
    const preserved = await client.ask(`
      ASK { GRAPH <${A}> { <https://ex/lee> <https://ex/reportsTo> <https://ex/omar> , <https://ex/nadia> } }
    `);
    expect(preserved).toBe(true);
    const merged = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { <https://ex/omar> owl:sameAs <https://ex/nadia> } }
    `);
    expect(merged).toBe(false);
  });

  it('conflicting LITERAL values fire too (office "B12" vs "C3")', async () => {
    await withProv('<https://ex/lee>', '<https://ex/office>', '"B12"');
    await withProv('<https://ex/lee>', '<https://ex/office>', '"C3"');
    await M();
    const flagged = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { <https://ex/lee> a j:ValueConflict ; j:conflictOn <https://ex/office> } }
    `);
    expect(flagged).toBe(true);
  });

  it('single value → no flag; two values on an UNMARKED property → no flag', async () => {
    await withProv('<https://ex/ana>', '<https://ex/reportsTo>', '<https://ex/omar>');
    await withProv('<https://ex/ana>', '<https://ex/memberOf>', '<https://ex/payments>');
    await withProv('<https://ex/ana>', '<https://ex/memberOf>', '<https://ex/platform>');
    await M();
    const flagged = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { <https://ex/ana> a j:ValueConflict } }
    `);
    expect(flagged).toBe(false);
  });

  it('does NOT fire on j:ConflictFunctionalProperty (judgment-layer separation — that is r21, supersession-aware)', async () => {
    await withProv('<https://ex/jd1>', `<${J}settledAs>`, '<https://ex/optA>');
    await withProv('<https://ex/jd1>', `<${J}settledAs>`, '<https://ex/optB>');
    await M();
    const flagged = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { <https://ex/jd1> a j:ValueConflict } }
    `);
    expect(flagged).toBe(false);
  });

  it('sub-cutoff confidence values are excluded from conflict detection (closure gate)', async () => {
    // Fresh IRIs: kg:provenance is keyed by triple content and persists across
    // tests in this file, so reusing lee/omar/nadia would inherit the conf=1
    // annotations inserted by earlier tests.
    await withProv('<https://ex/kim>', '<https://ex/reportsTo>', '<https://ex/ravi>', 1);
    await withProv('<https://ex/kim>', '<https://ex/reportsTo>', '<https://ex/sana>', 0.2);
    await M();
    const flagged = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { <https://ex/kim> a j:ValueConflict } }
    `);
    expect(flagged).toBe(false);
  });
});
