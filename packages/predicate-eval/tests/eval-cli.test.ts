import { describe, it, expect } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runEval } from '../src/eval.js';

describe('runEval', () => {
  it('runs the org domain and returns rows with a printable curve', async () => {
    const { rows, curve } = await runEval(getAdapter(), 'org', { episodes: 4, write: false });
    expect(rows.length).toBe(8);          // 4 episodes x {on, off}
    expect(curve).toContain('org');
  }, 30_000);
});
