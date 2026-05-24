import { describe, it, expect } from 'vitest';
import { isTier2Answer } from '../src/tier2-types.js';

describe('tier2-types', () => {
  it('isTier2Answer accepts a well-formed answer', () => {
    expect(isTier2Answer({ id: 'org-q01', sparql: 'ASK {}' })).toBe(true);
  });
  it('isTier2Answer rejects a missing/empty sparql', () => {
    expect(isTier2Answer({ id: 'org-q01' })).toBe(false);
    expect(isTier2Answer({ id: 'org-q01', sparql: '' })).toBe(false);
  });
});
