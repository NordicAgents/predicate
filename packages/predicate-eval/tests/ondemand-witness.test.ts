import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveInstances } from '../src/exact/instances.js';
import { runOnDemandWitness } from '../src/ondemand/run-ondemand-witness-cli.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('on-demand exact witness baseline', () => {
  it.each(['conflict-xr-small', 'conflict-chain-m2', 'conflict-tausig'])(
    '%s returns one complete canonical witness per conflict without maintained state',
    (domain) => {
      const dir = join(fixtures, domain);
      const instances = deriveInstances(domain, dir);
      const rows = runOnDemandWitness(domain, dir);
      expect(rows).toHaveLength(instances.length);
      for (const inst of instances.filter((item) => item.isConflict)) {
        const row = rows.find((item) => item.instanceId === inst.id);
        expect(row?.flagged, inst.id).toBe(true);
        expect(new Set(row?.witness), inst.id).toEqual(new Set(inst.goldWitness));
        expect(row?.extra.amortized).toBe(false);
        expect(row?.extra.contextTriples).toBe(inst.goldWitness.length);
      }
    },
  );
});
