import { describe, it, expect } from 'vitest';
import { closureEligible } from '../src/closure.js';

describe('closureEligible', () => {
  it('produces a SPARQL fragment that unions tbox/inferred and filtered abox', () => {
    const frag = closureEligible('?s', '?p', '?o', {
      tboxGraph: 'kg:tbox',
      aboxGraphs: ['kg:abox'],
      inferredGraph: 'kg:inferred',
      closureCutoff: 0.5,
    });
    expect(frag).toContain('GRAPH <kg:tbox>');
    expect(frag).toContain('GRAPH <kg:abox>');
    expect(frag).toContain('GRAPH <kg:inferred>');
    expect(frag).toContain('FILTER (?conf >= 0.5)');
  });
});
