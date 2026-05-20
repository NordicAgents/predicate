import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';

import { kgConfigGet, kgConfigSet } from '../../src/tools/kg-config.js';

const client = getAdapter();

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:meta>`);
  await client.update(`CREATE SILENT GRAPH <kg:meta>`);
}

describe('kg_config', () => {
  beforeEach(reset);

  it('set then get round-trips a boolean key', async () => {
    const setRes = await kgConfigSet(client, { key: 'schema-learning', value: false });
    expect(setRes.ok).toBe(true);
    const getRes = await kgConfigGet(client, { key: 'schema-learning' });
    expect(getRes.value).toBe(false);
  });

  it('set then get round-trips a string key', async () => {
    await kgConfigSet(client, { key: 'init-ontology', value: 'foaf' });
    const r = await kgConfigGet(client, { key: 'init-ontology' });
    expect(r.value).toBe('foaf');
  });

  it('rejects unknown keys', async () => {
    const r = await kgConfigSet(client, { key: 'bogus', value: 'x' } as never);
    expect(r.ok).toBe(false);
    expect((r as { error?: string }).error).toMatch(/unknown key/i);
  });

  it('rejects wrong value type for schema-learning (must be boolean)', async () => {
    const r = await kgConfigSet(client, { key: 'schema-learning', value: 'yes' as never });
    expect(r.ok).toBe(false);
    expect((r as { error?: string }).error).toMatch(/boolean/);
  });

  it('get with no key returns the full config object', async () => {
    await kgConfigSet(client, { key: 'schema-learning', value: true });
    await kgConfigSet(client, { key: 'init-ontology', value: 'codebase' });
    const r = await kgConfigGet(client, {});
    expect(r.config).toEqual({
      schemaLearningEnabled: true,
      initOntology: 'codebase',
    });
  });

  it('get of absent key returns value: null', async () => {
    const r = await kgConfigGet(client, { key: 'schema-learning' });
    expect(r.value).toBeNull();
  });
});
