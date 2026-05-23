import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from '../src/rigs/tier1-deterministic.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'coding');

describe('tier1 coding run', () => {
  it('accuracy rises across episodes and reasoning lift is positive', async () => {
    const rows = await runTier1(getAdapter(), 'coding', DIR, 3);
    const on = rows.filter((r) => r.inference === 'on').sort((a, b) => a.episode - b.episode);
expect(on[0]!.accuracy).toBeLessThan(on[on.length - 1]!.accuracy);
    expect(on[on.length - 1]!.lift!).toBeGreaterThan(0);
    expect(on[on.length - 1]!.accuracy).toBeGreaterThan(0.5);
    for (let i = 1; i < on.length; i++) {
      expect(on[i]!.accuracy).toBeGreaterThanOrEqual(on[i - 1]!.accuracy);
    }
  }, 30_000);
});
