import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runTier1 } from '../src/rigs/tier1-deterministic.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('tier1 org run', () => {
  it('compounds to full accuracy across 8 episodes with positive reasoning lift', async () => {
    const rows = await runTier1(getAdapter(), 'org', DIR, 8);
    const on = rows.filter((r) => r.inference === 'on').sort((a, b) => a.episode - b.episode);

    // 8 questions spanning r03 / r04 / r01 / r06 / disjointness / conflict / recall.
    expect(Object.keys(on[0]!.perQuestion).length).toBe(8);

    // Compounding: rises from a low start to full accuracy as facts are captured.
    const finalOn = on[on.length - 1]!;
    expect(on[0]!.accuracy).toBeLessThan(0.4);
    expect(finalOn.accuracy).toBe(1);
    expect(finalOn.lift!).toBeGreaterThan(0.5);  // reasoning earns its keep

    // Overall accuracy is monotonic non-decreasing.
    for (let i = 1; i < on.length; i++) {
      expect(on[i]!.accuracy).toBeGreaterThanOrEqual(on[i - 1]!.accuracy);
    }

    // Every individual question is non-decreasing too — guards against a rising
    // aggregate masking a question whose score regresses (the q03 lesson).
    for (const qid of Object.keys(on[0]!.perQuestion)) {
      for (let i = 1; i < on.length; i++) {
        expect(on[i]!.perQuestion[qid]!).toBeGreaterThanOrEqual(on[i - 1]!.perQuestion[qid]! - 1e-9);
      }
    }
  }, 60_000);
});
