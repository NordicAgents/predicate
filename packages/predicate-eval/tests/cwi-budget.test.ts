import { describe, expect, it } from 'vitest';
import type { EpisodeTriple } from '../src/episode-runner.js';
import { RDF_TYPE } from '../src/exact/contract.js';
import type { TBoxSchema } from '../src/exact/tbox.js';
import { queryCwiWithBudget } from '../src/cwi/budget.js';
import { ConflictWitnessIndex } from '../src/cwi/index.js';

const EX = 'https://example.org/cwi-budget-test/';
const PERSON = `${EX}PersonRecord`;
const KEY = `${EX}key`;
const P1 = `${EX}p1`;
const P2 = `${EX}p2`;
const schema: TBoxSchema = {
  prefixes: {},
  keyedClasses: new Map([[PERSON, [KEY]]]),
  singleValued: new Set([P1, P2]),
  validFromProp: null,
  validToProp: null,
  scopeProp: null,
};

function sharedIndex(): ConflictWitnessIndex {
  const a = `${EX}a`;
  const b = `${EX}b`;
  const triples: EpisodeTriple[] = [
    { s: a, p: RDF_TYPE, o: PERSON },
    { s: b, p: RDF_TYPE, o: PERSON },
    { s: a, p: KEY, o: 'same', lit: true },
    { s: b, p: KEY, o: 'same', lit: true },
    { s: a, p: P1, o: 'a1', lit: true },
    { s: b, p: P1, o: 'b1', lit: true },
    { s: a, p: P2, o: 'a2', lit: true },
    { s: b, p: P2, o: 'b2', lit: true },
  ];
  const index = new ConflictWitnessIndex(schema);
  for (const triple of triples) index.insert(triple);
  return index;
}

describe('budget-aware multi-conflict CWI query', () => {
  it('deduplicates a shared identity spine across conflicts', () => {
    const result = queryCwiWithBudget(sharedIndex(), [`${EX}a`], 8);
    expect(result.status).toBe('complete');
    expect(result.relevantConflictCount).toBe(2);
    expect(result.requiredTriples).toBe(8);
    expect(result.context).toHaveLength(8);
    expect(result.conflicts.map((c) => c.witness.length)).toEqual([6, 6]);
  });

  it('returns no misleading partial context when the selected union overflows', () => {
    const result = queryCwiWithBudget(sharedIndex(), [`${EX}a`], 7);
    expect(result.status).toBe('selection-overflow');
    expect(result.requiredTriples).toBe(8);
    expect(result.relevantConflictCount).toBe(2);
    expect(result.context).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it('filters the requested predicate footprint before applying the budget', () => {
    const result = queryCwiWithBudget(sharedIndex(), [`${EX}a`], 6, [P1]);
    expect(result.status).toBe('complete');
    expect(result.relevantConflictCount).toBe(1);
    expect(result.requiredTriples).toBe(6);
  });

  it('rejects invalid budgets', () => {
    expect(() => queryCwiWithBudget(sharedIndex(), [`${EX}a`], -1)).toThrow(
      /non-negative integer/,
    );
  });
});
