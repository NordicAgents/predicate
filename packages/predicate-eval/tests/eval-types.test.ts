import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Question, ScoreRow } from '../src/eval-types.js';
import { isQuestion } from '../src/eval-types.js';

describe('eval-types', () => {
  it('isQuestion accepts a well-formed set question', () => {
    const q: Question = {
      id: 'org-q01', text: 'x', type: 'set',
      key: { derive: 'transitive', rel: 'reportsTo', from: 'person:dana' },
      needs_episode: 2, rule_under_test: ['r03'], reasoning_dependent: true,
      golden_sparql: 'SELECT ?p WHERE {}',
    };
    expect(isQuestion(q)).toBe(true);
  });

  it('isQuestion rejects a missing field', () => {
    expect(isQuestion({ id: 'x' })).toBe(false);
  });
});
