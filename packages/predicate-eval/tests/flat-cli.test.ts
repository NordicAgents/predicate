import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadOracle, deriveAnswerKey } from '../src/oracle.js';
import { loadQuestions } from '../src/questions.js';
import { emitFlatTasks, scoreFlatAnswers } from '../src/flat.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('flat cli functions', () => {
  it('emitFlatTasks writes one JSONL line per question', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flat-'));
    const file = join(dir, 'tasks.jsonl');
    const n = await emitFlatTasks(getAdapter(), 'org', DIR, 8, file);
    expect(n).toBe(8);
    expect(readFileSync(file, 'utf8').trim().split('\n').length).toBe(8);
  }, 30_000);

  it('true in-context answers tie the reasoner (reasoner_advantage ≈ 0)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flat-'));
    const oracle = loadOracle(DIR);
    const answersFile = join(dir, 'answers.jsonl');
    const lines = loadQuestions(DIR).map((q) => {
      const key = deriveAnswerKey(oracle, q.key, q.type, 8);
      const answer = key.kind === 'boolean' ? key.value
        : key.kind === 'set' ? [...key.values]
          : key.kind === 'conflict' ? [...key.ids] : [];
      return JSON.stringify({ id: q.id, answer });
    });
    writeFileSync(answersFile, lines.join('\n'));
    const { gap } = await scoreFlatAnswers(getAdapter(), 'org', DIR, 8, answersFile,
      join(dir, 'scoreboard.jsonl'));
    expect(gap).toBeCloseTo(0, 5);
  }, 60_000);
});
