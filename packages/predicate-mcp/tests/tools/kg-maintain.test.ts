import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgMaintain } from '../../src/tools/kg-maintain.js';
import { SchemaProposer } from 'predicate-agent/src/index.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:provenance', 'kg:abox-archive', 'kg:meta', 'kg:usage']) {
    await reset(g);
  }
  // Note: we INSERT directly to kg:abox bypassing kg_assert for fixture speed,
  // sidestepping the TBox-membership check that would reject 'urn:test:p'.
});

afterAll(async () => {
  // Leave graphs empty; subsequent test files reseed as needed.
  for (const g of ['kg:abox', 'kg:provenance', 'kg:abox-archive', 'kg:meta', 'kg:usage']) {
    await reset(g);
  }
});

async function seedStaleLowConfidence(): Promise<void> {
  const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  await client.update(`
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <kg:abox> {
        <urn:test:stale> <urn:test:p> <urn:test:o> .
      }
      GRAPH <kg:provenance> {
        << <urn:test:stale> <urn:test:p> <urn:test:o> >>
          pred:confidence "0.3"^^xsd:decimal ;
          pred:timestamp  "${old}"^^xsd:dateTime ;
          pred:source     "test" ;
          pred:method     "test" .
      }
    }
  `);
}

describe('kg_maintain (thin reaper)', () => {
  it('archives a stale low-confidence triple', async () => {
    await seedStaleLowConfidence();
    const r = await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    expect(r.archivedCount).toBe(1);
    const inAbox = await client.ask(`
      ASK { GRAPH <kg:abox> { <urn:test:stale> <urn:test:p> <urn:test:o> } }
    `);
    expect(inAbox).toBe(false);
    const inArchive = await client.ask(`
      ASK { GRAPH <kg:abox-archive> { <urn:test:stale> <urn:test:p> <urn:test:o> } }
    `);
    expect(inArchive).toBe(true);
  });

  it('emits a MaintenanceRun event in kg:meta', async () => {
    await seedStaleLowConfidence();
    await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?e ?archived WHERE {
        GRAPH <kg:meta> {
          ?e a pred:MaintenanceRun ;
             pred:payload ?archived .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
  });

  it('leaves a fresh high-confidence triple untouched', async () => {
    await client.update(`
      PREFIX pred: <https://predicate.dev/meta#>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:abox> { <urn:test:fresh> <urn:test:p> <urn:test:o> }
        GRAPH <kg:provenance> {
          << <urn:test:fresh> <urn:test:p> <urn:test:o> >>
            pred:confidence "0.9"^^xsd:decimal ;
            pred:timestamp  "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:source "x" ; pred:method "x" .
        }
      }
    `);
    const r = await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    expect(r.archivedCount).toBe(0);
  });
});

describe('kg_maintain runs the promotion sweeper', () => {
  it('reports sweeper decisions alongside reaper output', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: 'https://predicate.dev/codebase#tempProp',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'maintain test' });

    const result = await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    expect(result.sweeper).toBeDefined();
    expect(result.sweeper!.decisions.find((d) => d.proposalId === id)?.outcome).toBe('awaiting');

    // Cleanup
    await client.update(`DROP SILENT GRAPH <kg:tbox-staging>`);
    await client.update(`CREATE SILENT GRAPH <kg:tbox-staging>`);
  });
});
