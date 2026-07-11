import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const client = getAdapter();
const adapter = new FusekiConstructAdapter(client);
const J = 'https://industriagents.com/predicate/judgment#';
const T = 'kg:tbox-test-r23';
const A = 'kg:abox-test-r23';
const I = 'kg:inferred-test-r23';

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

/** Seed one person as two records sharing an email key, with given office values. */
async function seedRecordPair(tag: string, officeA: string, officeB: string): Promise<[string, string]> {
  const r1 = `<https://ex/rec1-${tag}>`;
  const r2 = `<https://ex/rec2-${tag}>`;
  for (const [rec, office] of [[r1, officeA], [r2, officeB]] as const) {
    await withProv(rec, '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/PersonRecord>');
    await withProv(rec, '<https://ex/email>', `"${tag}@ex.com"`);
    await withProv(rec, '<https://ex/office>', `<${office}>`);
  }
  return [r1, r2];
}

beforeAll(async () => {
  await reset(T);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX j:    <${J}>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT DATA { GRAPH <${T}> {
      ex:PersonRecord owl:hasKey ( ex:email ) .
      ex:office a j:SingleValued .
    } }
  `);
});
beforeEach(async () => { await reset(A); await reset(I); });

describe('r23 — cross-record conflicts via hasKey → sameAs → value propagation → r22', () => {
  it('two records sharing a key with DIFFERENT office values: both records get flagged j:ValueConflict', async () => {
    const [r1, r2] = await seedRecordPair('ana', 'https://ex/officeA', 'https://ex/officeB');
    await M();
    // r14 fired on the shared literal key …
    const coref = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { ${r1} owl:sameAs ${r2} } }
    `);
    expect(coref).toBe(true);
    // … r23 converged the values on each member …
    const propagated = await client.ask(`
      ASK { GRAPH <${I}> { ${r1} <https://ex/office> <https://ex/officeB> } }
    `);
    expect(propagated).toBe(true);
    // … and r22 flags BOTH members, preserving both values.
    for (const rec of [r1, r2]) {
      const flagged = await client.ask(`
        PREFIX j: <${J}>
        ASK { GRAPH <${I}> { ${rec} a j:ValueConflict ; j:conflictOn <https://ex/office> } }
      `);
      expect(flagged, `${rec} flagged`).toBe(true);
    }
    const bothPreserved = await client.ask(`
      ASK { GRAPH <${A}> { ${r1} <https://ex/office> <https://ex/officeA> . ${r2} <https://ex/office> <https://ex/officeB> } }
    `);
    expect(bothPreserved).toBe(true);
  });

  it('benign co-reference (same key, SAME office) yields sameAs but NO conflict flag', async () => {
    const [r1, r2] = await seedRecordPair('bo', 'https://ex/officeC', 'https://ex/officeC');
    await M();
    const coref = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { ${r1} owl:sameAs ${r2} } }
    `);
    expect(coref).toBe(true);
    const flagged = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { ${r1} a j:ValueConflict } }
    `);
    expect(flagged).toBe(false);
  });

  it('DIFFERENT keys with different offices: no sameAs, no propagation, no flag', async () => {
    await seedRecordPair('cara', 'https://ex/officeA', 'https://ex/officeA');
    // Two distinct people who happen to share an office value with each other.
    await withProv('<https://ex/rec1-dan>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/PersonRecord>');
    await withProv('<https://ex/rec1-dan>', '<https://ex/email>', '"dan@ex.com"');
    await withProv('<https://ex/rec1-dan>', '<https://ex/office>', '<https://ex/officeA>');
    await M();
    const anyConflict = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <${I}> { ?x a j:ValueConflict } }
    `);
    expect(anyConflict).toBe(false);
  });

  it('kg_explain reconstructs a propagated value from the sameAs premise + the source value', async () => {
    // explain() hardcodes canonical graphs — set the chain up in kg:abox/kg:tbox/kg:inferred.
    for (const g of ['kg:abox', 'kg:inferred', 'kg:provenance']) {
      await client.update(`DROP SILENT GRAPH <${g}>`);
      await client.update(`CREATE SILENT GRAPH <${g}>`);
    }
    await client.update(`
      PREFIX ex:  <https://ex/>
      PREFIX j:   <${J}>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <kg:tbox> {
        ex:PersonRecord owl:hasKey ( ex:email ) .
        ex:office a j:SingleValued .
      } }
    `);
    for (const [rec, office] of [['e1', 'officeA'], ['e2', 'officeB']] as const) {
      await client.update(`
        PREFIX pred: <https://industriagents.com/predicate/meta#>
        PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
        INSERT DATA {
          GRAPH <kg:abox> {
            <https://ex/${rec}> a <https://ex/PersonRecord> ;
              <https://ex/email> "ex@ex.com" ;
              <https://ex/office> <https://ex/${office}> .
          }
          GRAPH <kg:provenance> {
            << <https://ex/${rec}> <https://ex/office> <https://ex/${office}> >> pred:confidence "1"^^xsd:decimal .
            << <https://ex/${rec}> <https://ex/email> "ex@ex.com" >> pred:confidence "1"^^xsd:decimal .
            << <https://ex/${rec}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://ex/PersonRecord> >> pred:confidence "1"^^xsd:decimal .
          }
        }
      `);
    }
    await adapter.materialize({ tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5 });
    const trace = await adapter.explain({
      s: 'https://ex/e1', p: 'https://ex/office', o: 'https://ex/officeB',
    });
    expect(trace).not.toBeNull();
    const premiseStrs = trace!.derivation.flatMap((st) => st.premises)
      .map((q) => `${q.s} ${q.p} ${typeof q.o === 'string' ? q.o : q.o.value}`);
    expect(premiseStrs.some((s) => s.includes('sameAs'))).toBe(true);
    expect(premiseStrs.some((s) => s.includes('officeB'))).toBe(true);
  });
});
