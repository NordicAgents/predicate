import { describe, it, expect } from 'vitest';
import { decideCounterfactual } from '../src/shadow-evaluator.js';

describe('decideCounterfactual', () => {
  it('promotes when useCount >= N regardless of age', () => {
    expect(decideCounterfactual({ useCount: 5, ageInStagingDays: 1, n: 3, ttlDays: 7 })).toBe('promote');
  });
  it('expires when past TTL and under N', () => {
    expect(decideCounterfactual({ useCount: 1, ageInStagingDays: 8, n: 3, ttlDays: 7 })).toBe('expire');
  });
  it('waits when under N and within TTL', () => {
    expect(decideCounterfactual({ useCount: 1, ageInStagingDays: 2, n: 3, ttlDays: 7 })).toBe('wait');
  });
});
