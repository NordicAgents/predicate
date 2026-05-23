import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgMaintain } from '../src/tools/kg-maintain.js';
import { kgStats } from '../src/tools/kg-stats.js';

describe('materialization latency metric', () => {
  it('records a MaterializationCompleted event so kg_stats P95 is populated', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.update('CREATE SILENT GRAPH <kg:meta>');
    await kgMaintain(client, {});
    const r = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:meta> { ?e a pred:MaterializationCompleted } }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);

    const stats = await kgStats(client);
    expect(stats.materializationLatencyMsP95).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(stats.materializationLatencyMsP95)).toBe(true);
  });
});
