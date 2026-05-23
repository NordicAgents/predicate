import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { checkTransitiveClosure } from '../src/soundness/closure-check.js';

describe('closure-check', () => {
  it('reasoner transitive closure matches the reference on a length-5 chain', async () => {
    const res = await checkTransitiveClosure(getAdapter(), 5);
    expect(res.missing).toEqual([]);
    expect(res.extra).toEqual([]);
  }, 20_000);
});
