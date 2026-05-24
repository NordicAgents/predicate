import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadOracle, deriveAnswerKey } from '../src/oracle.js';
import { loadQuestions } from '../src/questions.js';
import {
  buildFlatTasks, buildFlatPrompt, scoreFlat, type FlatAnswerValue,
} from '../src/rigs/flat-baseline.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('buildFlatTasks', () => {
  it('emits one task per question with TBox+ABox context and no answer-key leak', async () => {
    const tasks = await buildFlatTasks(getAdapter(), 'org', DIR, 8);
    expect(tasks.length).toBe(8);
    const q01 = tasks.find((t) => t.id === 'org-q01')!;
    expect(q01.context).toContain('reportsTo');                 // TBox present
    expect(q01.context).toContain('http://ex/org/dana');        // ABox facts present
    expect(JSON.stringify(tasks)).not.toContain('golden_sparql');
  }, 30_000);
});

describe('buildFlatPrompt', () => {
  it('asks for JSON and forbids assuming a query engine', () => {
    const p = buildFlatPrompt({
      id: 'x', domain: 'org', questionText: 'who?', type: 'set', context: '...facts...',
    });
    expect(p).toContain('JSON');
    expect(p.toLowerCase()).toContain('no database or query engine');
  });
});

describe('scoreFlat', () => {
  it('the true answer scores f1=1 (upper bound)', () => {
    // Derive the true final-episode answers and feed them back as the model output.
    const oracle = loadOracle(DIR);
    const answers = new Map<string, FlatAnswerValue>();
    for (const q of loadQuestions(DIR)) {
      const key = deriveAnswerKey(oracle, q.key, q.type, 8);
      if (key.kind === 'set') answers.set(q.id, [...key.values]);
      else if (key.kind === 'boolean') answers.set(q.id, key.value);
      else if (key.kind === 'conflict') answers.set(q.id, [...key.ids]);
    }
    const rows = scoreFlat('org', DIR, 8, answers);
    expect(rows.length).toBe(8);
    for (const r of rows) { expect(r.parsed).toBe(true); expect(r.f1).toBe(1); }
  });

  it('a wrong set answer scores below 1 and a missing answer scores 0', () => {
    const wrong = new Map<string, FlatAnswerValue>([['org-q01', ['http://ex/org/nobody']]]);
    const rows = scoreFlat('org', DIR, 8, wrong);
    expect(rows.find((r) => r.questionId === 'org-q01')!.f1).toBe(0);
    expect(rows.filter((r) => !r.parsed).every((r) => r.f1 === 0)).toBe(true);
  });
});
