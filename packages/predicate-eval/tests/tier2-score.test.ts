import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadQuestions } from '../src/questions.js';
import { scoreTier2 } from '../src/rigs/tier2-score.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('scoreTier2', () => {
  it('a perfect answer (the golden query) scores f1=1 and valid', async () => {
    const golden = new Map(loadQuestions(DIR).map((q) => [q.id, q.golden_sparql]));
    const rows = await scoreTier2(getAdapter(), 'org', DIR, 8, golden);
    expect(rows.length).toBe(8);
    for (const r of rows) {
      expect(r.sparqlValid).toBe(true);
      expect(r.f1).toBe(1);
    }
  }, 30_000);

  it('a broken query is recorded as invalid with f1=0, not thrown', async () => {
    const answers = new Map([['org-q01', 'SELECT ?p WHERE { THIS IS NOT SPARQL']]);
    const rows = await scoreTier2(getAdapter(), 'org', DIR, 8, answers);
    const r = rows.find((x) => x.questionId === 'org-q01')!;
    expect(r.sparqlValid).toBe(false);
    expect(r.f1).toBe(0);
  }, 30_000);

  it('a question with no provided answer is scored as f1=0 invalid', async () => {
    const rows = await scoreTier2(getAdapter(), 'org', DIR, 8, new Map());
    expect(rows.every((r) => r.f1 === 0 && !r.sparqlValid)).toBe(true);
  }, 30_000);
});
