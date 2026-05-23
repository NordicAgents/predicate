import { describe, it, expect } from 'vitest';
import { scoreSet, scoreBoolean, scoreConflict, scorePath } from '../src/scorer.js';

describe('scoreSet', () => {
  it('exact match is f1 1', () => {
    expect(scoreSet(new Set(['a', 'b']), new Set(['a', 'b'])).f1).toBe(1);
  });
  it('partial overlap gives partial f1', () => {
    const s = scoreSet(new Set(['a', 'b']), new Set(['a', 'c']));
    expect(s.precision).toBeCloseTo(0.5);
    expect(s.recall).toBeCloseTo(0.5);
    expect(s.f1).toBeCloseTo(0.5);
  });
  it('two empty sets are a perfect (vacuous) match', () => {
    expect(scoreSet(new Set(), new Set()).f1).toBe(1);
  });
});

describe('scoreBoolean', () => {
  it('match is 1, mismatch is 0', () => {
    expect(scoreBoolean(true, true).f1).toBe(1);
    expect(scoreBoolean(true, false).f1).toBe(0);
  });
});

describe('scoreConflict', () => {
  it('penalizes inventing a conflict not in the oracle', () => {
    expect(scoreConflict(new Set(), new Set(['c1'])).f1).toBe(0);
  });
  it('rewards flagging the real conflict', () => {
    expect(scoreConflict(new Set(['c1']), new Set(['c1'])).f1).toBe(1);
  });
});

describe('scorePath', () => {
  it('is 1 when expected edge sequence is an ordered subsequence of the returned path', () => {
    const exp: Array<[string, string, string]> = [['a', 'p', 'b'], ['b', 'p', 'c']];
    const got: Array<[string, string, string]> = [['a', 'p', 'b'], ['x', 'q', 'y'], ['b', 'p', 'c']];
    expect(scorePath(exp, got).f1).toBe(1);
  });
  it('is 0 when order is broken', () => {
    const exp: Array<[string, string, string]> = [['a', 'p', 'b'], ['b', 'p', 'c']];
    const got: Array<[string, string, string]> = [['b', 'p', 'c'], ['a', 'p', 'b']];
    expect(scorePath(exp, got).f1).toBe(0);
  });
});
