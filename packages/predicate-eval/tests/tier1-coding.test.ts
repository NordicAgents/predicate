import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from '../src/rigs/tier1-deterministic.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'coding');

describe('tier1 coding run', () => {
  it('accuracy rises across episodes and reasoning lift is positive', async () => {
    const rows = await runTier1(getAdapter(), 'coding', DIR, 3);
    const on = rows.filter((r) => r.inference === 'on').sort((a, b) => a.episode - b.episode);

    const finalOn = on[on.length - 1]!;
    expect(on[0]!.accuracy).toBeLessThan(finalOn.accuracy);
    expect(finalOn.accuracy).toBe(1);
    expect(finalOn.lift!).toBeGreaterThan(0.2);  // conservative: golden reads abox ∪ inferred

    for (let i = 1; i < on.length; i++) {
      expect(on[i]!.accuracy).toBeGreaterThanOrEqual(on[i - 1]!.accuracy);
    }
    for (const qid of Object.keys(on[0]!.perQuestion)) {
      for (let i = 1; i < on.length; i++) {
        expect(on[i]!.perQuestion[qid]!).toBeGreaterThanOrEqual(on[i - 1]!.perQuestion[qid]! - 1e-9);
      }
    }
  }, 30_000);
});
