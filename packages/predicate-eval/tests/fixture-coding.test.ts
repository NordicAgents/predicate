import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadOracle, deriveAnswerKey } from '../src/oracle.js';
import { loadQuestions } from '../src/questions.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'coding');

describe('coding fixture integrity', () => {
  const oracle = loadOracle(DIR);
  const questions = loadQuestions(DIR);
  it('every question is unanswerable before needs_episode and answerable at/after it', () => {
    for (const q of questions) {
      const before = deriveAnswerKey(oracle, q.key, q.type, q.needs_episode - 1);
      const at = deriveAnswerKey(oracle, q.key, q.type, q.needs_episode);
      if (q.type === 'set') {
        expect((before as { values: Set<string> }).values.size)
          .toBeLessThan((at as { values: Set<string> }).values.size);
      } else if (q.type === 'boolean') {
        expect((before as { value: boolean }).value).toBe(false);
        expect((at as { value: boolean }).value).toBe(true);
      }
    }
  });
});
