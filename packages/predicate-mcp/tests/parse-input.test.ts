import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseInput } from '../src/tools/parse-input.js';
import { buildTools } from '../src/tools/registry.js';
import { OxigraphAdapter } from '../src/storage/index.js';

describe('parseInput teaching errors', () => {
  const schema = z.object({ concept: z.string().min(1) });

  it('names the offending field and tool on bad input', () => {
    expect(() => parseInput(schema, { concept: '' }, 'kg_explore_schema'))
      .toThrow(/kg_explore_schema: concept/);
  });

  it('returns the parsed value on good input', () => {
    expect(parseInput(schema, { concept: 'Function' }, 'kg_explore_schema'))
      .toEqual({ concept: 'Function' });
  });
});

describe('registry routes teaching errors', () => {
  it('kg_explore_schema rejects an empty concept with a teaching error', async () => {
    const tools = buildTools(new OxigraphAdapter({ storePath: ':memory:' }));
    const tool = tools.find((t) => t.name === 'kg_explore_schema')!;
    await expect(tool.handler({ concept: '' })).rejects.toThrow(/kg_explore_schema: concept/);
  });

  it('kg_propose_schema rejects malformed input with a teaching error', async () => {
    const tools = buildTools(new OxigraphAdapter({ storePath: ':memory:' }));
    const tool = tools.find((t) => t.name === 'kg_propose_schema')!;
    await expect(tool.handler({})).rejects.toThrow(/kg_propose_schema:/);
  });
});
