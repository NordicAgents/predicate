import { describe, it, expect } from 'vitest';
import { FusekiConstructAdapter } from '../src/index.js';

describe('FusekiConstructAdapter', () => {
  it('exposes the ReasonerAdapter contract', () => {
    const adapter = new FusekiConstructAdapter({} as never);
    expect(typeof adapter.materialize).toBe('function');
    expect(typeof adapter.validate).toBe('function');
    expect(typeof adapter.explain).toBe('function');
  });
});
