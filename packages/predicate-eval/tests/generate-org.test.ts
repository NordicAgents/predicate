import { describe, it, expect } from 'vitest';
import { generateOrg } from '../src/scale/generate-org.js';

describe('generateOrg', () => {
  it('builds the expected balanced tree (branching=2) and correct ancestor chains', () => {
    // p0 root; parent(i)=floor((i-1)/2): p1,p2->p0 ; p3,p4->p1 ; p5,p6->p2
    const g = generateOrg({ people: 7, branching: 2, questions: 0 });
    const has = (s: string, p: string, o: string): boolean =>
      g.triples.some((t) => t.s === s && t.p === p && t.o === o);
    const RT = 'http://ex/org#reportsTo';
    expect(has('http://ex/org/p3', RT, 'http://ex/org/p1')).toBe(true);
    expect(has('http://ex/org/p1', RT, 'http://ex/org/p0')).toBe(true);
    // p0 (root) has no reportsTo edge
    expect(g.triples.some((t) => t.s === 'http://ex/org/p0' && t.p === RT)).toBe(false);
  });

  it('computes a question answer key equal to the true ancestor chain', () => {
    const g = generateOrg({ people: 7, branching: 2, questions: 50, seed: 7 });
    const q3 = g.questions.find((q) => q.text.startsWith("Who is in p3"));
    // p3 -> p1 -> p0
    expect(q3).toBeDefined();
    expect((q3!.expected as { values: string[] }).values).toEqual(['http://ex/org/p1', 'http://ex/org/p0']);
    expect(q3!.goldenSparql).toContain('kg:inferred');
  });

  it('is deterministic for a fixed seed and scales triple count ~3x people', () => {
    const a = generateOrg({ people: 100, seed: 42 });
    const b = generateOrg({ people: 100, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // each person: 1 type + 1 memberOf + (1 reportsTo unless root) = 3*people - 1
    expect(a.triples.length).toBe(3 * 100 - 1);
  });
});
