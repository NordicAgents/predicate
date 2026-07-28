import { describe, expect, it } from 'vitest';
import type { EpisodeTriple } from '../src/episode-runner.js';
import { RDF_TYPE } from '../src/exact/contract.js';
import type { TBoxSchema } from '../src/exact/tbox.js';
import { queryCwiWithBudget, queryCwiWithJointBudget } from '../src/cwi/budget.js';
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

function alternativePathIndex(conflicts = 4): {
  index: ConflictWitnessIndex;
  seed: string;
} {
  const person = `${EX}AlternativeRecord`;
  const keyPredicate = `${EX}alternative-key`;
  const predicates = Array.from({ length: conflicts }, (_, i) => `${EX}alternative-p${i + 1}`);
  const alternativeSchema: TBoxSchema = {
    prefixes: {},
    keyedClasses: new Map([[person, [keyPredicate]]]),
    singleValued: new Set(predicates),
    validFromProp: null,
    validToProp: null,
    scopeProp: null,
  };
  const a = `${EX}alternative-a`;
  const u = `${EX}alternative-u`;
  const v = `${EX}alternative-v`;
  const privateNodes = predicates.map((_, i) => `${EX}private-${i + 1}`);
  const endpoints = predicates.map((_, i) => `${EX}endpoint-${i + 1}`);
  const records = [a, u, v, ...privateNodes, ...endpoints];
  const triples: EpisodeTriple[] = records.map((record) => ({
    s: record,
    p: RDF_TYPE,
    o: person,
  }));
  const edge = (left: string, right: string, value: string): void => {
    triples.push(
      { s: left, p: keyPredicate, o: value, lit: true },
      { s: right, p: keyPredicate, o: value, lit: true },
    );
  };
  // Each conflict has a private two-link shortest path.
  for (let i = 0; i < conflicts; i++) {
    edge(a, privateNodes[i]!, `private-left-${i + 1}`);
    edge(privateNodes[i]!, endpoints[i]!, `private-right-${i + 1}`);
  }
  // A three-link alternative shares a two-link spine across all conflicts.
  edge(a, u, 'shared-left');
  edge(u, v, 'shared-right');
  for (let i = 0; i < conflicts; i++) {
    edge(v, endpoints[i]!, `shared-tail-${i + 1}`);
    triples.push(
      { s: a, p: predicates[i]!, o: `left-${i + 1}`, lit: true },
      { s: endpoints[i]!, p: predicates[i]!, o: `right-${i + 1}`, lit: true },
    );
  }

  const index = new ConflictWitnessIndex(alternativeSchema);
  for (const triple of triples) index.insert(triple);
  return { index, seed: a };
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

  it('finds a smaller globally shared union than independent shortest paths', () => {
    const { index, seed } = alternativePathIndex();
    const independent = queryCwiWithBudget(index, [seed], 27);
    expect(independent.status).toBe('selection-overflow');
    expect(independent.requiredTriples).toBe(33);

    const joint = queryCwiWithJointBudget(index, [seed], 27);
    expect(joint.status).toBe('complete');
    expect(joint.relevantConflictCount).toBe(4);
    expect(joint.independentTriples).toBe(33);
    expect(joint.requiredTriples).toBe(27);
    expect(joint.context).toHaveLength(27);
    expect(joint.witnessEnumerationExhaustive).toBe(true);
    expect(joint.optimalityProven).toBe(true);
  });

  it('calls overflow infeasible only after exhaustive joint selection', () => {
    const { index, seed } = alternativePathIndex();
    const exact = queryCwiWithJointBudget(index, [seed], 26);
    expect(exact.status).toBe('infeasible');
    expect(exact.requiredTriples).toBe(27);
    expect(exact.context).toEqual([]);
    expect(exact.optimalityProven).toBe(true);

    const capped = queryCwiWithJointBudget(
      index,
      [seed],
      26,
      undefined,
      { maxPathsPerConflict: 1 },
    );
    expect(capped.status).toBe('search-limit');
    expect(capped.context).toEqual([]);
    expect(capped.witnessEnumerationExhaustive).toBe(false);
    expect(capped.optimalityProven).toBe(false);
  });
});
