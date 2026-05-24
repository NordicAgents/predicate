import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { historySweep } from '../src/scale/history-sweep.js';

describe('history sweep (single user, growing capture)', () => {
  it('reasoner stays exact; flat-all grows with noise while retrieval stays ~constant', async () => {
    const rows = await historySweep(getAdapter(), [10, 200], 60);
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.reasonerAccuracy).toBe(1);
    // flat-all context grows with accumulated sessions (noise)...
    expect(rows[1]!.flatAllTokensEst).toBeGreaterThan(rows[0]!.flatAllTokensEst * 2);
    // ...but the retrieved neighbourhood size is unchanged by how much noise piled up.
    expect(rows[1]!.retrievedTriplesAvg).toBe(rows[0]!.retrievedTriplesAvg);
  }, 120_000);
});
