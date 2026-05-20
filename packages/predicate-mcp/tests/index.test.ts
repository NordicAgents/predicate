import { describe, it, expect } from 'vitest';
import { getAdapter } from '../src/storage/index.js';

import { buildTools } from '../src/tools/registry.js';

describe('tool registry', () => {
  const tools = buildTools(getAdapter());
  const names = tools.map((t) => t.name);

  it('exposes exactly the 9 agent-facing tools', () => {
    expect(names.sort()).toEqual(
      [
        'kg_ask',
        'kg_assert',
        'kg_explain',
        'kg_explore_schema',
        'kg_extract_judgments',
        'kg_maintain',
        'kg_propose_schema',
        'kg_research_goal',
        'kg_stats',
      ].sort(),
    );
  });

  it('no longer exposes capture/config tools (moved to CLI)', () => {
    expect(names).not.toContain('kg_capture');
    expect(names).not.toContain('kg_config_get');
    expect(names).not.toContain('kg_config_set');
  });
});
