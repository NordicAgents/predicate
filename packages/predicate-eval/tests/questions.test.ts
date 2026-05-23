import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadQuestions } from '../src/questions.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('loadQuestions', () => {
  it('loads and validates org questions', () => {
    const qs = loadQuestions(DIR);
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.find((q) => q.id === 'org-q01')?.type).toBe('set');
  });
});
