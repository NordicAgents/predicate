import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { kgMaintain } from '../../src/tools/kg-maintain.js';
import { kgConfigSet } from '../../src/tools/kg-config.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

describe('kg_maintain scale-gate', () => {
  beforeEach(async () => {
    for (const g of ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage', 'kg:meta', 'kg:provenance', 'kg:tbox-staging']) {
      await reset(g);
    }
  });

  it('skips reaper+generalizer below threshold and emits MaintenanceSkipped', async () => {
    await kgConfigSet(client, { key: 'scale-gate-triples', value: 1000000 });
    const res = await kgMaintain(client, {});
    expect(res.tier).toBe('Seedling');
    expect(res.skipped).toBe(true);
    expect(res.archivedCount).toBe(0);
    const ev = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?e WHERE { GRAPH <kg:meta> { ?e a pred:MaintenanceSkipped } }`);
    expect(ev.results.bindings.length).toBe(1);
  });

  it('runs the shadow harness even in Seedling', async () => {
    await kgConfigSet(client, { key: 'scale-gate-triples', value: 1000000 });
    // Dates relative to now so the proposal stays un-expired (proposedAt today,
    // TTL 7d ahead); a hardcoded past expiry would let PromotionSweeper reap it
    // before the shadow harness runs, breaking this test after that date.
    const proposedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:tbox-staging> {
        <urn:p:s> a pred:Proposal ;
          pred:kind "add-class" ; pred:justification "j" ;
          pred:proposedAt "${proposedAt}"^^xsd:dateTime ;
          pred:expiresAt  "${expiresAt}"^^xsd:dateTime .
      } }`);
    await kgMaintain(client, {});
    const ev = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?e WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow } }`);
    expect(ev.results.bindings.length).toBe(1);
  });
});
