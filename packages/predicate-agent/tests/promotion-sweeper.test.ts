import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';

const client = getAdapter();
const C = 'https://predicate.dev/codebase';

let promotedDir: string;

beforeAll(() => {
  promotedDir = mkdtempSync(join(tmpdir(), 'predicate-promoted-'));
  process.env['PREDICATE_PROMOTED_DIR'] = promotedDir;
});

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function recordUsage(sparql: string): Promise<void> {
  await client.update(`
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:usage> {
      <urn:test:usage:${Math.random().toString(36).slice(2, 8)}> a pred:Query ;
        pred:question "test" ;
        pred:sparql ${escapeLiteral(sparql)} ;
        pred:rowCount "1"^^xsd:integer ;
        pred:elapsedMs "1"^^xsd:integer ;
        pred:at "${new Date().toISOString()}"^^xsd:dateTime .
    } }
  `);
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
  delete process.env['PREDICATE_PROMOTED_DIR'];
  rmSync(promotedDir, { recursive: true, force: true });
});

describe('PromotionSweeper', () => {
  it('reports "awaiting" when usage gate not met', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#owns`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'goal' });

    const sweeper = new PromotionSweeper(client, { useThreshold: 3 });
    const result = await sweeper.run();
    const decision = result.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('awaiting');
  });

  it('rejects expired proposals with reason="expired"', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#dead`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'x', ttlDays: 0 });          // expires immediately

    await new Promise((r) => setTimeout(r, 50));

    const sweeper = new PromotionSweeper(client, { useThreshold: 3 });
    const result = await sweeper.run();
    const decision = result.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('rejected-expired');

    const stillThere = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> { <${id}> ?p ?o } }
    `);
    expect(stillThere).toBe(false);

    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?e WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaRejected ;
             pred:goal <${id}> .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
  });

  it('promotes a proposal that meets the usage gate and passes validation', async () => {
    const proposer = new SchemaProposer(client);
    const propIri = `${C}#owns_test`;
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: propIri,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'goal' });

    for (let i = 0; i < 3; i++) {
      await recordUsage(`SELECT ?x WHERE { ?x <${propIri}> ?y }`);
    }

    const sweeper = new PromotionSweeper(client, { useThreshold: 3 });
    const result = await sweeper.run();
    const decision = result.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('promoted');

    const inTbox = await client.ask(`
      ASK { GRAPH <kg:tbox> {
        <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                     <http://www.w3.org/2002/07/owl#ObjectProperty>
      } }
    `);
    expect(inTbox).toBe(true);

    const stillStaged = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> { <${id}> ?p ?o } }
    `);
    expect(stillStaged).toBe(false);

    expect(decision?.turtleFile).toBeDefined();
    expect(existsSync(decision!.turtleFile!)).toBe(true);

    const promoted = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:meta> { ?e a pred:SchemaPromoted ; pred:goal <${id}> } }
    `);
    expect(promoted).toBe(true);
    const advanced = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:meta> { ?e a pred:TBoxVersionAdvanced } }
    `);
    expect(advanced).toBe(true);

    // Clean up the promoted file
    if (decision?.turtleFile) rmSync(decision.turtleFile);
    // Remove the promoted triple from kg:tbox so subsequent tests see the seed unchanged
    await client.update(`
      DELETE WHERE { GRAPH <kg:tbox> {
        <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                     <http://www.w3.org/2002/07/owl#ObjectProperty>
      } }
    `);
  });
});
