import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../src/tier2-prompt.js';
import type { Tier2Task } from '../src/tier2-types.js';

const task: Tier2Task = {
  id: 'org-q01', domain: 'org', questionText: "Who is in Dana's management chain?",
  type: 'set', schema: 'org:reportsTo a owl:TransitiveProperty .', graphsHint: 'kg:abox, kg:inferred',
};

describe('buildPrompt', () => {
  it('includes schema, question, and the output contract', () => {
    const p = buildPrompt(task);
    expect(p).toContain('org:reportsTo');
    expect(p).toContain("Who is in Dana's management chain?");
    expect(p).toContain('kg:abox');
    expect(p).toContain('kg:inferred');
    expect(p.toLowerCase()).toContain('sparql');
  });
  it('does not leak an answer or golden query', () => {
    const p = buildPrompt(task);
    expect(p).not.toContain('golden');
  });
});
