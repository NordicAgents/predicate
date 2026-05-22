import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAdapter, _resetAdapterCache } from '../../src/storage/factory.js';
import { FusekiAdapter } from '../../src/storage/fuseki.js';

describe('getAdapter', () => {
  beforeEach(() => {
    _resetAdapterCache();
    delete process.env.PREDICATE_BACKEND;
  });

  it('returns FusekiAdapter when PREDICATE_BACKEND=fuseki', () => {
    process.env.PREDICATE_BACKEND = 'fuseki';
    const a = getAdapter();
    expect(a).toBeInstanceOf(FusekiAdapter);
  });

  it('throws a clear error for unknown backend', () => {
    process.env.PREDICATE_BACKEND = 'sqlite';
    expect(() => getAdapter()).toThrow(/unknown PREDICATE_BACKEND/);
  });

  it('returns OxigraphAdapter by default (no env var set)', () => {
    // beforeEach already deletes PREDICATE_BACKEND.
    const a = getAdapter();
    expect(a.constructor.name).toBe('OxigraphAdapter');
  });
});

describe('factory backend selection', () => {
  afterEach(() => {
    _resetAdapterCache();
    delete process.env.PREDICATE_BACKEND;
    delete process.env.PREDICATE_STORE_PATH;
  });

  it('oxigraph-wasm selects the in-process WASM adapter', () => {
    process.env.PREDICATE_BACKEND = 'oxigraph-wasm';
    process.env.PREDICATE_STORE_PATH = ':memory:';
    const a = getAdapter();
    expect(a.constructor.name).toBe('OxigraphAdapter');
  });
});
