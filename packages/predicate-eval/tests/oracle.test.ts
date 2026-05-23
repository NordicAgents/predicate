import { describe, it, expect } from 'vitest';
import { transitiveClosure, deriveAnswerKey, type Oracle } from '../src/oracle.js';

const oracle: Oracle = {
  facts: [
    { s: 'person:dana', p: 'reportsTo', o: 'person:erin', episode: 1 },
    { s: 'person:erin', p: 'reportsTo', o: 'person:omar', episode: 2 },
    { s: 'person:omar', p: 'reportsTo', o: 'person:zoe',  episode: 3 },
  ],
  conflicts: [
    { id: 'c1', about: 'person:lee', predicate: 'reportsTo',
      values: ['person:omar', 'person:nadia'], episode: 4 },
  ],
  disjoint: [],
};

describe('transitiveClosure', () => {
  it('follows the relation only up to the episode cutoff', () => {
    expect([...transitiveClosure(oracle.facts, 'reportsTo', 'person:dana', 1)])
      .toEqual(['person:erin']);
    expect([...transitiveClosure(oracle.facts, 'reportsTo', 'person:dana', 3)].sort())
      .toEqual(['person:erin', 'person:omar', 'person:zoe']);
  });
});

describe('deriveAnswerKey', () => {
  it('derives a transitive set key', () => {
    const key = deriveAnswerKey(oracle,
      { derive: 'transitive', rel: 'reportsTo', from: 'person:dana' }, 'set', 2);
    expect(key).toEqual({ kind: 'set', values: new Set(['person:erin', 'person:omar']) });
  });

  it('derives conflict ids only after the conflict episode', () => {
    expect(deriveAnswerKey(oracle, { derive: 'conflict-ids', about: 'person:lee' }, 'conflict', 3))
      .toEqual({ kind: 'conflict', ids: new Set() });
    expect(deriveAnswerKey(oracle, { derive: 'conflict-ids', about: 'person:lee' }, 'conflict', 4))
      .toEqual({ kind: 'conflict', ids: new Set(['c1']) });
  });

  it('derives boolean-conflict', () => {
    expect(deriveAnswerKey(oracle, { derive: 'boolean-conflict', about: 'person:lee' }, 'boolean', 4))
      .toEqual({ kind: 'boolean', value: true });
  });

  it('gates a literal-set on its since-episode', () => {
    const key = { derive: 'literal-set' as const, values: ['person:dana'], since: 3 };
    expect(deriveAnswerKey(oracle, key, 'set', 2)).toEqual({ kind: 'set', values: new Set() });
    expect(deriveAnswerKey(oracle, key, 'set', 3)).toEqual({ kind: 'set', values: new Set(['person:dana']) });
  });

  it('gates a literal-boolean on its since-episode', () => {
    const key = { derive: 'literal-boolean' as const, since: 5 };
    expect(deriveAnswerKey(oracle, key, 'boolean', 4)).toEqual({ kind: 'boolean', value: false });
    expect(deriveAnswerKey(oracle, key, 'boolean', 5)).toEqual({ kind: 'boolean', value: true });
  });
});
