import { describe, it, expect, beforeEach } from 'vitest';
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
});
