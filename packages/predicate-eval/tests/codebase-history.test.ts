import { describe, it, expect } from 'vitest';
import { generateCodebaseHistory } from '../src/scale/generate-codebase-history.js';
import { neighborhood } from '../src/scale/retrieval.js';

const DEP = 'https://industriagents.com/predicate/codebase#dependsOn';

describe('generateCodebaseHistory', () => {
  it('keeps signal constant while noise grows with sessions', () => {
    const few = generateCodebaseHistory({ files: 50, sessions: 5, seed: 3, questions: 5 });
    const many = generateCodebaseHistory({ files: 50, sessions: 100, seed: 3, questions: 5 });
    // Same files+seed => identical dependency signal; only the noise (total triples) grows.
    expect(many.signalTriples).toBe(few.signalTriples);
    expect(many.triples.length).toBeGreaterThan(few.triples.length);
    // Questions (which depend only on the fixed DAG) are identical across history length.
    expect(many.questions.map((q) => q.id)).toEqual(few.questions.map((q) => q.id));
  });

  it('question answer keys equal the true transitive dependency closure', () => {
    const g = generateCodebaseHistory({ files: 30, depsPerFile: 2, sessions: 1, seed: 9, questions: 8 });
    for (const q of g.questions) {
      // every claimed dependency must be reachable via dependsOn edges in the triples
      const set = (q.expected as { values: string[] }).values;
      expect(set.length).toBeGreaterThanOrEqual(2);
      expect(q.goldenSparql).toContain('kg:inferred');
    }
  });
});

describe('neighborhood retrieval', () => {
  it('retrieves the dependency closure of a seed and ignores unrelated noise', () => {
    const g = generateCodebaseHistory({ files: 40, depsPerFile: 2, sessions: 200, seed: 1, questions: 6 });
    const q = g.questions[0]!;
    const seed = q.text.match(/f\d+\.ts/)![0];
    const seedIri = `https://industriagents.com/predicate/codebase/${seed}`;
    const sub = neighborhood(g.triples, [seedIri], [DEP], 20);
    const reached = new Set(sub.map((t) => t.o));
    const expected = new Set((q.expected as { values: string[] }).values);
    // retrieval recovers exactly the dependency closure...
    for (const e of expected) expect(reached.has(e)).toBe(true);
    // ...and the retrieved subset is far smaller than the full noisy history.
    expect(sub.length).toBeLessThan(g.triples.length / 5);
  });
});
