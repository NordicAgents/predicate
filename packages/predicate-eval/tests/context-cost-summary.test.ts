import { describe, expect, it } from 'vitest';
import { buildContextCostSummary } from '../src/instances/context-cost-summary-cli.js';

describe('paper context-cost summary', () => {
  it('reports complete triple and UTF-8 byte costs for every family', () => {
    const result = buildContextCostSummary();
    expect(result.families).toHaveLength(8);
    const d20 = result.families.find((family) => family.family === 'D20')!;
    expect(d20.storeTriples).toBe(133);
    const chain3 = result.families.find((family) => family.family === 'Chain-3')!;
    expect(chain3.exactWitness.triples).toEqual({ mean: 12, max: 12 });
    expect(chain3.keyAware.triples).toEqual({ mean: 91.3, max: 112 });
    for (const family of result.families) {
      expect(family.conflicts).toBeGreaterThan(0);
      for (const system of [
        family.exactWitness,
        family.keyAware,
        family.bm25,
        family.dense,
        family.hybrid,
      ]) {
        expect(system.triples.mean).toBeGreaterThan(0);
        expect(system.bytes.mean).toBeGreaterThan(0);
        expect(system.bytes.max).toBeGreaterThanOrEqual(system.bytes.mean);
      }
    }
  });
});
