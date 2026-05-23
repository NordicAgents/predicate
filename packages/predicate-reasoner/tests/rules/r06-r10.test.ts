import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const client = getAdapter();
const adapter = new FusekiConstructAdapter(client);

const T = 'kg:tbox-test-r6-10';
const A = 'kg:abox-test-r6-10';
const I = 'kg:inferred-test-r6-10';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function withProv(s: string, p: string, o: string, conf = 1): Promise<void> {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${A}>             { ${s} ${p} ${o} . }
      GRAPH <kg:provenance>    { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

beforeAll(async () => {
  for (const g of [T, A]) await reset(g);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    INSERT DATA { GRAPH <${T}> {
      ex:authoredBy   rdfs:domain ex:Article ; rdfs:range ex:Person .
      ex:capital      a owl:FunctionalProperty .
      ex:email        a owl:InverseFunctionalProperty .
      ex:siblingOf    a owl:SymmetricProperty .
    } }
  `);
});
beforeEach(() => reset(I));

const M = (): Promise<unknown> => adapter.materialize({
  tboxGraph: T, aboxGraphs: [A], targetGraph: I, closureCutoff: 0.5,
});

describe('rules 6–10', () => {
  it('r06+r07: domain/range type inference', async () => {
    await withProv('<https://ex/post1>', '<https://ex/authoredBy>', '<https://ex/alice>');
    await M();
    const types = await client.select(`
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?t WHERE { GRAPH <${I}> { <https://ex/post1> rdf:type ?t } }
    `);
    expect(types.results.bindings.map((b) => b.t!.value)).toContain('https://ex/Article');
    const personType = await client.ask(`
      ASK { GRAPH <${I}> { <https://ex/alice>
            <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
            <https://ex/Person> } }
    `);
    expect(personType).toBe(true);
  });

  it('r08: two values for a FunctionalProperty produce sameAs', async () => {
    await withProv('<https://ex/fr>', '<https://ex/capital>', '<https://ex/paris1>');
    await withProv('<https://ex/fr>', '<https://ex/capital>', '<https://ex/paris2>');
    await M();
    const ok = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> {
        <https://ex/paris1> owl:sameAs <https://ex/paris2> }
      }
    `);
    expect(ok).toBe(true);
  });

  it('r09: shared object on InverseFunctionalProperty produces sameAs on subjects', async () => {
    await withProv('<https://ex/alice>', '<https://ex/email>', '"a@x.io"');
    await withProv('<https://ex/al>',    '<https://ex/email>', '"a@x.io"');
    await M();
    const ok = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { <https://ex/al> owl:sameAs <https://ex/alice> } }
    `);
    expect(ok).toBe(true);
  });

  it('r10: SymmetricProperty materializes the inverse direction', async () => {
    await withProv('<https://ex/al>', '<https://ex/siblingOf>', '<https://ex/bob>');
    await M();
    const ok = await client.ask(`
      ASK { GRAPH <${I}> { <https://ex/bob> <https://ex/siblingOf> <https://ex/al> } }
    `);
    expect(ok).toBe(true);
  });
});
