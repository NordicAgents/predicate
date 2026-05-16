import { describe, it, expect } from 'vitest';
import type { Goal, GoalPlan, SubQuestion } from '../src/index.js';

describe('predicate-agent types', () => {
  it('Goal is structurally typed', () => {
    const g: Goal = {
      id: 'urn:predicate:goal:test',
      statement: 'why did login break',
      status: 'active',
      createdAt: '2026-05-16T00:00:00Z',
      updatedAt: '2026-05-16T00:00:00Z',
      source: 'user',
    };
    expect(g.status).toBe('active');
  });

  it('GoalPlan composes SubQuestions and gaps', () => {
    const sq: SubQuestion = {
      id: 'SQ-1',
      text: 'what does login depend on?',
      intent: { kind: 'find-dependencies', payload: { symbol: 'login', transitive: true } },
    };
    const p: GoalPlan = {
      goalId: 'urn:predicate:goal:test',
      subQuestions: [sq],
      gaps: [{ subQuestionId: 'SQ-1', answerable: true, missingPredicates: [] }],
    };
    expect(p.subQuestions).toHaveLength(1);
  });
});
