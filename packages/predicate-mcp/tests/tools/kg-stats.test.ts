import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';

import { kgStats } from '../../src/tools/kg-stats.js';
import { withCodebaseTBox } from '../fixtures/with-codebase.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => { await withCodebaseTBox(client); });
beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:inferred']) await reset(g);
});

describe('kg_stats', () => {
  it('returns counts that reflect what is in the graphs', async () => {
    await client.update(`
      INSERT DATA {
        GRAPH <kg:abox>     { <urn:a> <urn:p> <urn:b> . <urn:c> <urn:p> <urn:d> . }
        GRAPH <kg:inferred> { <urn:a> <urn:q> <urn:e> . }
      }
    `);
    const s = await kgStats(client);
    expect(s.abox).toBe(2);
    expect(s.inferred).toBe(1);
    expect(s.tbox).toBeGreaterThan(0);
    expect(s.triples).toBe(s.abox + s.inferred + s.tbox);
  });

  it('inferredRatio is 0 when no inferred triples exist', async () => {
    await client.update(`INSERT DATA { GRAPH <kg:abox> { <urn:x> <urn:p> <urn:y> } }`);
    const s = await kgStats(client);
    expect(s.inferred).toBe(0);
    expect(s.inferredRatio).toBe(0);
  });

  it('inferredRatio is between 0 and 1 when both graphs have data', async () => {
    await client.update(`
      INSERT DATA {
        GRAPH <kg:abox>     { <urn:a> <urn:p> <urn:b> }
        GRAPH <kg:inferred> { <urn:c> <urn:q> <urn:d> . <urn:e> <urn:q> <urn:f> }
      }
    `);
    const s = await kgStats(client);
    expect(s.inferredRatio).toBeGreaterThan(0);
    expect(s.inferredRatio).toBeLessThanOrEqual(1);
  });

  it('classes counts owl:Class declarations in kg:tbox', async () => {
    const s = await kgStats(client);
    expect(s.classes).toBeGreaterThan(0);
  });

  it('unusedConceptRatio is 1 when no abox classes match tbox classes', async () => {
    const s = await kgStats(client);
    expect(s.unusedConceptRatio).toBe(1);
  });

  it('unusedConceptRatio drops when an abox instance is typed as a tbox class', async () => {
    await client.update(`
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX c:   <https://industriagents.com/predicate/codebase#>
      INSERT DATA { GRAPH <kg:abox> { <urn:x> rdf:type c:File } }
    `);
    const s = await kgStats(client);
    expect(s.unusedConceptRatio).toBeLessThan(1);
  });

  it('materializationLatencyMsP95 is 0 when no MaterializationCompleted events exist', async () => {
    const s = await kgStats(client);
    expect(s.materializationLatencyMsP95).toBe(0);
  });

  it('reports the current scale tier and demote/promote ratio', async () => {
    const stats = await kgStats(getAdapter());
    expect(['Seedling', 'Active']).toContain(stats.tier);
    expect(typeof stats.scaleGateTriples).toBe('number');
    expect(typeof stats.demotePromoteRatio).toBe('number');
  });
});
