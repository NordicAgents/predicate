import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { buildTools } from '../../src/tools/registry.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('kg_research_goal wired in MCP registry', () => {
  const tools = buildTools(client);

  it('is no longer a stub', async () => {
    const tool = tools.find((t) => t.name === 'kg_research_goal')!;
    expect(tool).toBeDefined();
    const result = (await tool.handler({
      goal: 'why did login break',
      source: 'user',
    })) as { goalId: string; subQuestions: unknown[]; gaps: unknown[] };
    expect(typeof result.goalId).toBe('string');
    expect(Array.isArray(result.subQuestions)).toBe(true);
    expect(Array.isArray(result.gaps)).toBe(true);
  });
});
