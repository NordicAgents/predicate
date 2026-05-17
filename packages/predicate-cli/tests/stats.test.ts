import { describe, it, expect, vi } from 'vitest';
import { stats } from '../src/commands/stats.js';

describe('stats', () => {
  it('prints kg_stats output and returns 0', async () => {
    const lines: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((m: string) => {
      lines.push(m);
    });
    const code = await stats();
    log.mockRestore();
    expect(code).toBe(0);
    expect(lines.some((l) => l.startsWith('triples'))).toBe(true);
    expect(lines.some((l) => l.startsWith('abox'))).toBe(true);
  });
});
