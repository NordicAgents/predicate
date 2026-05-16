import { describe, it, expect } from 'vitest';
import { SparqlClient } from '../src/sparql/client.js';
import { loadConfig } from '../src/config.js';
import { buildTools } from '../src/tools/registry.js';

describe('tool registry', () => {
  const tools = buildTools(new SparqlClient(loadConfig()));
  const names = tools.map((t) => t.name);

  it('exposes all 8 tools', () => {
    expect(names.sort()).toEqual(
      [
        'kg_ask',
        'kg_assert',
        'kg_explain',
        'kg_explore_schema',
        'kg_maintain',
        'kg_propose_schema',
        'kg_research_goal',
        'kg_stats',
      ].sort(),
    );
  });

  it('stub tools throw NotImplementedError', async () => {
    const stub = tools.find((t) => t.name === 'kg_propose_schema')!;
    await expect(stub.handler({})).rejects.toThrow(/Phase 1 stub/);
  });
});
