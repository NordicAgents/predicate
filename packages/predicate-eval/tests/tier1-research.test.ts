import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from '../src/rigs/tier1-deterministic.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'research');

describe('tier1 research run', () => {
  it('compounds across 8 episodes with positive reasoning lift', async () => {
    const rows = await runTier1(getAdapter(), 'research', DIR, 8);
    const on = rows.filter((r) => r.inference === 'on').sort((a, b) => a.episode - b.episode);

    // 8 questions: r03 transitive x2, r04 inverse, r06 domain, r07 range,
    // supersession, contradiction, direct-recall baseline.
    expect(Object.keys(on[0]!.perQuestion).length).toBe(8);

    const finalOn = on[on.length - 1]!;
    expect(on[0]!.accuracy).toBeLessThan(0.5);
    // Reaches full accuracy: golden queries read abox ∪ inferred, so transitive
    // influencedBy answers combine the base edge (abox) with the derived closure
    // (inferred). Lift is conservative — what inference adds beyond raw recall.
    expect(finalOn.accuracy).toBe(1);
    expect(finalOn.lift!).toBeGreaterThan(0.4);

    // Overall accuracy monotonic non-decreasing.
    for (let i = 1; i < on.length; i++) {
      expect(on[i]!.accuracy).toBeGreaterThanOrEqual(on[i - 1]!.accuracy);
    }
    // Every individual question non-decreasing (guards masked regressions).
    for (const qid of Object.keys(on[0]!.perQuestion)) {
      for (let i = 1; i < on.length; i++) {
        expect(on[i]!.perQuestion[qid]!).toBeGreaterThanOrEqual(on[i - 1]!.perQuestion[qid]! - 1e-9);
      }
    }
  }, 60_000);
});
