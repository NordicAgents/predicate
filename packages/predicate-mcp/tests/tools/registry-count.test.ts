import { describe, it, expect } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { buildTools } from '../../src/tools/registry.js';

describe('tool registry', () => {
  it('exposes 9 tools including kg_extract_judgments', () => {
    const tools = buildTools(getAdapter());
    const names = tools.map((t) => t.name);
    expect(names).toContain('kg_extract_judgments');
    expect(tools).toHaveLength(9);
  });
});
