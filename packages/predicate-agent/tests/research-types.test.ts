import { describe, it, expect } from 'vitest';
import type {
  ResearchArtifact, ResearchQuery, CandidateTriple, ResearchStats, GoalPlanWithStats,
} from '../src/index.js';

describe('research types', () => {
  it('ResearchArtifact has source/uri/content/metadata', () => {
    const a: ResearchArtifact = {
      source: 'docs', uri: 'file:///x.ts', content: 'x', metadata: { lang: 'ts' },
    };
    expect(a.uri).toBe('file:///x.ts');
  });

  it('CandidateTriple has source + confidence + method', () => {
    const t: CandidateTriple = {
      subject: 'urn:s', predicate: 'urn:p',
      object: { type: 'uri', value: 'urn:o' },
      source: 'file:///x', confidence: 0.95, method: 'regex-import',
    };
    expect(t.confidence).toBe(0.95);
  });

  it('GoalPlanWithStats can carry per-sub-question stats', () => {
    const stat: ResearchStats = {
      subQuestionId: 'SQ-1', artifactsFetched: 3, candidatesExtracted: 5,
      assertedCount: 4, rejectedCount: 1, errors: ['one rejected'],
    };
    const p: GoalPlanWithStats = {
      goalId: 'urn:g', subQuestions: [], gaps: [],
      stats: [stat],
    };
    expect(p.stats?.[0]?.assertedCount).toBe(4);
  });

  it('ResearchQuery accepts optional symbols + paths hints', () => {
    const q: ResearchQuery = {
      intent: { kind: 'find-dependencies', payload: { symbol: 'x', transitive: true } },
      symbols: ['x'],
      paths: ['auth.ts'],
    };
    expect(q.symbols).toEqual(['x']);
  });
});
