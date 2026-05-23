import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { kgConfigSet, kgConfigGet } from '../../src/tools/kg-config.js';

const client = getAdapter();

describe('kg-config scale-gate-triples', () => {
  beforeEach(async () => {
    await client.update(`DROP SILENT GRAPH <kg:meta>`);
    await client.update(`CREATE SILENT GRAPH <kg:meta>`);
  });

  it('round-trips a numeric value', async () => {
    const set = await kgConfigSet(client, { key: 'scale-gate-triples', value: 50000 });
    expect(set).toEqual({ ok: true, key: 'scale-gate-triples', value: 50000 });
    const got = await kgConfigGet(client, { key: 'scale-gate-triples' });
    expect(got).toEqual({ key: 'scale-gate-triples', value: 50000 });
  });

  it('rejects a non-numeric value', async () => {
    const set = await kgConfigSet(client, { key: 'scale-gate-triples', value: 'big' as unknown as number });
    expect(set.ok).toBe(false);
  });

  it('all-config round-trip includes scale-gate-triples', async () => {
    await kgConfigSet(client, { key: 'scale-gate-triples', value: 50000 });
    const got = await kgConfigGet(client, {});
    expect(got.config!['scale-gate-triples']).toBe(50000);
  });

  it('rejects a non-integer (float) value', async () => {
    const setFloat = await kgConfigSet(client, { key: 'scale-gate-triples', value: 3.7 });
    expect(setFloat.ok).toBe(false);
    const setNeg = await kgConfigSet(client, { key: 'scale-gate-triples', value: -5 });
    expect(setNeg.ok).toBe(false);
  });
});
