import { describe, it, expect } from 'vitest';
import type {
  SchemaDelta, AddClassDelta, BreakingDelta, StagedProposal, PromotionDecision,
} from '../src/index.js';

describe('schema-evolution types', () => {
  it('SchemaDelta narrows by kind', () => {
    const d: SchemaDelta = {
      kind: 'add-class',
      add: [{
        s: 'https://industriagents.com/predicate/codebase#Service',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
      }],
    };
    if (d.kind === 'add-class') {
      const a: AddClassDelta = d;
      expect(a.add).toHaveLength(1);
    }
  });

  it('BreakingDelta requires a migration string', () => {
    const d: BreakingDelta = {
      kind: 'breaking',
      remove: [],
      add: [],
      migration: 'DELETE WHERE { ?s <urn:old> ?o } INSERT { ?s <urn:new> ?o } WHERE { ?s <urn:old> ?o }',
    };
    expect(d.migration).toContain('DELETE');
  });

  it('StagedProposal tracks useCount and expiresAt', () => {
    const p: StagedProposal = {
      id: 'urn:predicate:proposal:P-1',
      delta: { kind: 'add-property', add: [] },
      meta: { justification: 'because', proposedAt: '2026-05-16T00:00:00Z' },
      useCount: 0,
      expiresAt: '2026-05-23T00:00:00Z',
    };
    expect(p.useCount).toBe(0);
  });

  it('PromotionDecision distinguishes outcomes', () => {
    const d: PromotionDecision = {
      proposalId: 'urn:predicate:proposal:P-1',
      outcome: 'awaiting',
    };
    expect(d.outcome).toBe('awaiting');
  });
});
