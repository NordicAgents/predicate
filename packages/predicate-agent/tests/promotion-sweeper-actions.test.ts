import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';

const client = new SparqlClient(loadConfig());
const C = 'https://predicate.dev/codebase';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
});

afterAll(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
});

describe('PromotionSweeper.promoteById', () => {
  it('promotes a proposal regardless of useCount and tags the event with the supplied actor', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#userApprovedProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'user-test' });

    const sweeper = new PromotionSweeper(client, { useThreshold: 999 });
    const result = await sweeper.promoteById(id, { actor: 'user-approve' });
    expect(result.outcome).toBe('promoted');

    const events = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?actor WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaPromoted ; pred:actor ?actor ; pred:goal <${id}> .
        }
      }
    `);
    expect(events.results.bindings[0]!['actor']!.value).toBe('user-approve');
  });
});

describe('PromotionSweeper.rejectById', () => {
  it('removes the proposal and tags the event with the supplied actor + reason', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#userRejectedProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'user-test' });

    const sweeper = new PromotionSweeper(client);
    const result = await sweeper.rejectById(id, {
      actor: 'user-reject',
      reason: 'rejected via dashboard',
    });
    expect(result.outcome).toBe('rejected-expired');

    const stillThere = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:tbox-staging> { <${id}> a pred:Proposal } }
    `);
    expect(stillThere).toBe(false);

    const events = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?actor ?payload WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaRejected ; pred:actor ?actor ; pred:goal <${id}> ; pred:payload ?payload .
        }
      }
    `);
    const b = events.results.bindings[0]!;
    expect(b['actor']!.value).toBe('user-reject');
    expect(JSON.parse(b['payload']!.value)).toEqual({ reason: 'rejected via dashboard' });
  });

  it('returns "rejected-expired" with reason="proposal not found" for unknown IRIs', async () => {
    const sweeper = new PromotionSweeper(client);
    const result = await sweeper.rejectById('urn:predicate:proposal:nope', {
      actor: 'user-reject', reason: 'x',
    });
    expect(result.reason).toBe('proposal not found');
  });
});
