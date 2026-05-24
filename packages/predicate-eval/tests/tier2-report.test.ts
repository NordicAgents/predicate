import { describe, it, expect } from 'vitest';
import { tier1VsTier2 } from '../src/tier2-report.js';
import type { Tier2Row } from '../src/tier2-types.js';

const t2: Tier2Row[] = [
  { runId: 'r', timestamp: 't', domain: 'org', questionId: 'q1', sparqlValid: true, sparqlNonEmpty: true, f1: 1 },
  { runId: 'r', timestamp: 't', domain: 'org', questionId: 'q2', sparqlValid: true, sparqlNonEmpty: false, f1: 0 },
];
const tier1Final = new Map([['q1', 1], ['q2', 1]]);

describe('tier1VsTier2', () => {
  it('reports per-question gap and aggregate', () => {
    const out = tier1VsTier2('org', t2, tier1Final);
    expect(out).toContain('q1');
    expect(out).toContain('q2');
    expect(out).toContain('gap');
    expect(out).toContain('0.50');
  });
});
