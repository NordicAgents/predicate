import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import type { SchemaDelta } from '../src/types.js';

const client = getAdapter();
const proposer = new SchemaProposer(client);

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta']) await reset(g);
});

describe('SchemaProposer', () => {
  const C = 'https://predicate.dev/codebase';

  const addServiceDelta: SchemaDelta = {
    kind: 'add-class',
    add: [{
      s: `${C}#Service`,
      p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
    }, {
      s: `${C}#Service`,
      p: 'http://www.w3.org/2000/01/rdf-schema#label',
      o: { type: 'literal', value: 'Service' },
    }],
  };

  it('writes delta triples to kg:tbox-staging tagged with proposal id', async () => {
    const id = await proposer.propose(addServiceDelta, {
      justification: 'needed for service ownership goal',
    });
    expect(id).toMatch(/^urn:predicate:proposal:P-/);

    const ok = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> {
        <${C}#Service> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .
      } }
    `);
    expect(ok).toBe(true);

    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <kg:tbox-staging> {
          << <${C}#Service> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> >>
            pred:proposalId <${id}> .
        }
      }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);
  });

  it('writes a proposal-meta record into kg:tbox-staging', async () => {
    const id = await proposer.propose(addServiceDelta, {
      justification: 'because of goal G-123',
      motivatingGoal: `${C}/goals/G-123`,
    });
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?just ?goal ?expires WHERE {
        GRAPH <kg:tbox-staging> {
          <${id}> pred:justification ?just ;
                  pred:motivatingGoal ?goal ;
                  pred:expiresAt ?expires .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
    expect(r.results.bindings[0]!.just!.value).toBe('because of goal G-123');
  });

  it('emits a pred:SchemaProposed event in kg:meta', async () => {
    const id = await proposer.propose(addServiceDelta, { justification: 'x' });
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?e WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaProposed ;
             pred:goal <${id}> .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
  });

  it('handles refine-class deltas with a parent IRI', async () => {
    const delta: SchemaDelta = {
      kind: 'refine-class',
      parent: `${C}#Service`,
      add: [{
        s: `${C}#PaymentService`,
        p: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
        o: { type: 'uri', value: `${C}#Service` },
      }],
    };
    const id = await proposer.propose(delta, { justification: 'split services' });
    expect(id).toMatch(/^urn:predicate:proposal:/);
    const ok = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:tbox-staging> { <${id}> pred:parent <${C}#Service> } }
    `);
    expect(ok).toBe(true);
  });

  it('handles breaking deltas with a migration string', async () => {
    const delta: SchemaDelta = {
      kind: 'breaking',
      remove: [{
        s: `${C}#oldProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
      add: [{
        s: `${C}#newProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
      migration: 'DELETE { ?s <https://predicate.dev/codebase#oldProp> ?o } INSERT { ?s <https://predicate.dev/codebase#newProp> ?o } WHERE { ?s <https://predicate.dev/codebase#oldProp> ?o }',
    };
    const id = await proposer.propose(delta, { justification: 'rename' });
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?m WHERE { GRAPH <kg:tbox-staging> { <${id}> pred:migration ?m } }
    `);
    expect(r.results.bindings[0]!.m!.value).toContain('INSERT');
  });
});
