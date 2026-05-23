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
});
