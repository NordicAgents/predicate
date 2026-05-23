import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';

import { buildTools } from '../../src/tools/registry.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta']) await reset(g);
});

describe('kg_propose_schema wired in MCP registry', () => {
  const tools = buildTools(client);
  const tool = tools.find((t) => t.name === 'kg_propose_schema')!;

  it('is no longer a stub', () => {
    expect(tool).toBeDefined();
  });

  it('accepts an add-class delta and returns a proposal id', async () => {
    const result = (await tool.handler({
      delta: {
        kind: 'add-class',
        add: [{
          s: 'https://industriagents.com/predicate/codebase#Service',
          p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
        }],
      },
      justification: 'needed for ownership',
    })) as { proposalId: string };
    expect(result.proposalId).toMatch(/^urn:predicate:proposal:/);
    const ok = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> {
        <https://industriagents.com/predicate/codebase#Service>
        <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
        <http://www.w3.org/2002/07/owl#Class>
      } }
    `);
    expect(ok).toBe(true);
  });

  it('rejects a malformed delta (missing kind)', async () => {
    await expect(
      tool.handler({ delta: { add: [] }, justification: 'x' }),
    ).rejects.toThrow();
  });
});
