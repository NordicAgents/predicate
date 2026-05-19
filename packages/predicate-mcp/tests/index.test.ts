import { describe, it, expect } from 'vitest';
import { getAdapter } from '../src/storage/index.js';

import { buildTools } from '../src/tools/registry.js';

describe('tool registry', () => {
  const tools = buildTools(getAdapter());
  const names = tools.map((t) => t.name);

  it('exposes all 11 tools', () => {
    expect(names.sort()).toEqual(
      [
        'kg_ask',
        'kg_assert',
        'kg_capture',
        'kg_config_get',
        'kg_config_set',
        'kg_explain',
        'kg_explore_schema',
        'kg_maintain',
        'kg_propose_schema',
        'kg_research_goal',
        'kg_stats',
      ].sort(),
    );
  });

  it('no remaining stubs — all 11 tools are implemented', () => {
    expect(names).toEqual(expect.arrayContaining([
      'kg_explore_schema', 'kg_ask', 'kg_assert', 'kg_explain',
      'kg_propose_schema', 'kg_research_goal', 'kg_stats', 'kg_maintain',
      'kg_capture', 'kg_config_get', 'kg_config_set',
    ]));
  });
});
