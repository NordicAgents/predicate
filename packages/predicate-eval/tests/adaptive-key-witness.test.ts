import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveInstances } from '../src/exact/instances.js';
import { runAdaptiveKeyWitness } from '../src/ondemand/run-adaptive-key-witness-cli.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('adaptive key witness baseline', () => {
  it.each([
    ['conflict-xr-small', 1],
    ['conflict-chain-m2', 2],
    ['conflict-chain-m3', 3],
  ] as const)('%s stops at the required key depth %i', async (domain, depth) => {
    const dir = join(fixtures, domain);
    const instances = deriveInstances(domain, dir);
    const rows = await runAdaptiveKeyWitness(domain, dir, 4);
    for (const inst of instances.filter((item) => item.isConflict)) {
      const row = rows.find((item) => item.instanceId === inst.id);
      expect(row?.flagged, inst.id).toBe(true);
      expect(row?.extra.searchDepth, inst.id).toBe(depth);
      expect(new Set(row?.witness), inst.id).toEqual(new Set(inst.goldWitness));
    }
  });
});
