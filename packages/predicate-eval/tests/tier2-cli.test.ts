import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { emitTasks, scoreAnswers } from '../src/tier2.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('tier2 cli functions', () => {
  it('emitTasks writes one JSONL line per question', async () => {
    const dir = mkdtempSync(join(tmpdir(), 't2-'));
    const file = join(dir, 'tasks.jsonl');
    const n = await emitTasks(getAdapter(), 'org', DIR, 8, file);
    expect(n).toBe(8);
    expect(readFileSync(file, 'utf8').trim().split('\n').length).toBe(8);
  }, 30_000);

  it('scoreAnswers scores golden answers to a zero gap', async () => {
    const dir = mkdtempSync(join(tmpdir(), 't2-'));
    const { loadQuestions } = await import('../src/questions.js');
    const answersFile = join(dir, 'answers.jsonl');
    writeFileSync(answersFile, loadQuestions(DIR)
      .map((q) => JSON.stringify({ id: q.id, sparql: q.golden_sparql })).join('\n'));
    const { gap, summary } = await scoreAnswers(getAdapter(), 'org', DIR, 8, answersFile,
      join(dir, 'scoreboard.jsonl'));
    expect(gap).toBeCloseTo(0, 5);
    expect(summary).toContain('aggregate');
  }, 60_000);
});
