import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { probeScaling } from '../src/soundness/scaling-probe.js';

describe('scaling-probe', () => {
  it('records latency + iterations at each size (no threshold)', async () => {
    const rows = await probeScaling(getAdapter(), [10, 50]);
    expect(rows.map((r) => r.triples)).toEqual([10, 50]);
    for (const r of rows) {
      expect(r.materializeMs).toBeGreaterThanOrEqual(0);
      expect(r.iterations).toBeGreaterThanOrEqual(1);
    }
  }, 30_000);
});
