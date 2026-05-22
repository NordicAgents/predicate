import { describe, it, expect, afterEach } from 'vitest';
import { DefaultOxigraphAdapter } from '../../src/storage/oxigraph-default.js';

describe('DefaultOxigraphAdapter fallback', () => {
  afterEach(() => { delete process.env.PREDICATE_OXIGRAPH_FORCE_UNAVAILABLE; });

  it('falls back to the in-process WASM store when native is unavailable', async () => {
    process.env.PREDICATE_OXIGRAPH_FORCE_UNAVAILABLE = '1';
    const a = new DefaultOxigraphAdapter({ storePath: ':memory:' });
    await a.ready();
    expect(a.activeBackend()).toBe('oxigraph-wasm');
    await a.update(`INSERT DATA { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`);
    expect(await a.ask(`ASK { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`)).toBe(true);
    await a.close();
  });
});
