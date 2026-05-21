import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgAssert } from '../src/tools/kg-assert.js';

describe('kgAssert object-shape guard', () => {
  it('throws a teaching error when object is a bare string', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    const bad = {
      subject: 'urn:s', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: 'urn:o' as unknown as { type: 'uri'; value: string },
      source: 'test', confidence: 0.9, method: 'manual',
    };
    await expect(kgAssert(client, bad)).rejects.toThrow(/object must be \{type:/);
  });
});
