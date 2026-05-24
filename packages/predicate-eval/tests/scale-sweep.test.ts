import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { sweep } from '../src/scale/sweep.js';

describe('scale sweep', () => {
  it('reasoner stays exact on generated trees; metrics grow with size', async () => {
    const rows = await sweep(getAdapter(), [10, 40]);
    expect(rows.length).toBe(2);
    // The reasoner materializes the full management-chain closure correctly at both sizes.
    for (const r of rows) expect(r.tier1Accuracy).toBe(1);
    // ABox and flat-context both grow with the number of people.
    expect(rows[1]!.aboxTriples).toBeGreaterThan(rows[0]!.aboxTriples);
    expect(rows[1]!.flatTokensEst).toBeGreaterThan(rows[0]!.flatTokensEst);
  }, 60_000);
});
