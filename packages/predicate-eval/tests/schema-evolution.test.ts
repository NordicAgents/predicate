import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { SchemaProposer } from 'predicate-agent/src/index.js';
import { kgMaintain } from 'predicate-mcp/src/tools/kg-maintain.js';

const client = new SparqlClient(loadConfig());
const C = 'https://predicate.dev/codebase';
const propIri = `${C}#owns_evol`;

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
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:abox-archive']) {
    await reset(g);
  }
});

afterAll(async () => {
  // Tidy up: remove any promoted triple to leave the seed TBox unmodified
  await client.update(`
    DELETE WHERE { GRAPH <kg:tbox> {
      <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                   <http://www.w3.org/2002/07/owl#ObjectProperty>
    } }
  `);
});

describe('end-to-end schema evolution', () => {
  it('proposes → uses 3x → maintain promotes', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: propIri,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'service ownership' });

    for (let i = 0; i < 3; i++) {
      await recordUsage(`SELECT ?x WHERE { ?x <${propIri}> ?y }`);
    }

    const result = await kgMaintain(client, { useThreshold: 3 });
    const decision = result.sweeper!.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('promoted');
    expect(decision?.turtleFile).toBeDefined();
    expect(existsSync(decision!.turtleFile!)).toBe(true);

    const inTbox = await client.ask(`
      ASK { GRAPH <kg:tbox> {
        <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                     <http://www.w3.org/2002/07/owl#ObjectProperty>
      } }
    `);
    expect(inTbox).toBe(true);

    rmSync(decision!.turtleFile!);
  });
});
