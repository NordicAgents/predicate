import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { buildTier2Tasks } from '../src/rigs/tier2-tasks.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'org');

describe('buildTier2Tasks', () => {
  it('emits one task per question with schema and no leaked golden/key', async () => {
    const tasks = await buildTier2Tasks(getAdapter(), 'org', DIR, 8);
    expect(tasks.length).toBe(8);
    const q01 = tasks.find((t) => t.id === 'org-q01')!;
    expect(q01.schema).toContain('reportsTo');
    expect(q01.questionText.length).toBeGreaterThan(0);
    // Example individuals are sampled real subject IRIs (the IRI scheme, not answers).
    expect(q01.exampleIndividuals.length).toBeGreaterThan(0);
    expect(q01.exampleIndividuals.some((i) => i.includes('http://ex/org/'))).toBe(true);
    expect(JSON.stringify(tasks)).not.toContain('golden_sparql');
    expect(JSON.stringify(tasks)).not.toContain('kg:inferred }');
  }, 30_000);
});
