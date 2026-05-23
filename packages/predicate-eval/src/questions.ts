import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Question, isQuestion } from './eval-types.js';

export function loadQuestions(domainDir: string): Question[] {
  const raw = JSON.parse(readFileSync(join(domainDir, 'questions.json'), 'utf8'));
  if (!Array.isArray(raw)) throw new Error('questions.json must be an array');
  for (const q of raw) {
    if (!isQuestion(q)) throw new Error(`invalid question: ${JSON.stringify(q)}`);
  }
  return raw as Question[];
}
