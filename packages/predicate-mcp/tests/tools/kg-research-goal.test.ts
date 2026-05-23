import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from '../../src/storage/index.js';

import { buildTools } from '../../src/tools/registry.js';
import { withCodebaseTBox } from '../fixtures/with-codebase.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  await withCodebaseTBox(client);
});

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
    })) as { goalId: string; subQuestions: unknown[]; gaps: unknown[]; decomposerKind: string };
    expect(typeof result.goalId).toBe('string');
    expect(Array.isArray(result.subQuestions)).toBe(true);
    expect(Array.isArray(result.gaps)).toBe(true);
    expect(result.decomposerKind).toBe('deterministic');
  });

  it('reports decomposerKind=deterministic when useLlmDecomposer is omitted or false', async () => {
    const tool = tools.find((t) => t.name === 'kg_research_goal')!;
    const result = (await tool.handler({
      goal: 'what calls validateToken',
      source: 'user',
      useLlmDecomposer: false,
    })) as { decomposerKind: string };
    expect(result.decomposerKind).toBe('deterministic');
  });

  it('falls back to deterministic when useLlmDecomposer=true but no ANTHROPIC_API_KEY', async () => {
    const tool = tools.find((t) => t.name === 'kg_research_goal')!;
    const orig = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      const result = (await tool.handler({
        goal: 'what calls validateToken',
        source: 'user',
        useLlmDecomposer: true,
      })) as { decomposerKind: string; subQuestions: Array<{ intent: { kind: string } }> };
      // Without API key, useSemantic is false → uses deterministic path
      expect(result.decomposerKind).toBe('deterministic');
      expect(result.subQuestions[0]!.intent.kind).toBe('find-callers');
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
    }
  });
});

describe('kg_research_goal with executeResearch=true', () => {
  let root: string;
  const tools = buildTools(client);
  const tool = tools.find((t) => t.name === 'kg_research_goal')!;

  beforeEach(async () => {
    for (const g of ['kg:abox', 'kg:provenance']) {
      await client.update(`DROP SILENT GRAPH <${g}>`);
      await client.update(`CREATE SILENT GRAPH <${g}>`);
    }
    root = mkdtempSync(join(tmpdir(), 'predicate-mcp-test-'));
    writeFileSync(join(root, 'a.ts'),
      "import { b } from './b';\nexport function a() { return b() }");
    writeFileSync(join(root, 'b.ts'),
      'export function b() { return process.env.SECRET }');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('rejects executeResearch=true without corpusRoot', async () => {
    await expect(
      tool.handler({
        goal: 'what depends on a.ts transitively',
        executeResearch: true,
      }),
    ).rejects.toThrow(/corpusRoot/);
  });

  it('asserts triples when given a corpusRoot', async () => {
    const result = (await tool.handler({
      goal: 'what depends on a.ts transitively',
      executeResearch: true,
      corpusRoot: root,
    })) as { stats?: Array<{ assertedCount: number }> };
    expect(result.stats).toBeDefined();
    const total = result.stats!.reduce((n, s) => n + s.assertedCount, 0);
    expect(total).toBeGreaterThan(0);

    const ok = await client.ask(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/a.ts> c:imports <https://industriagents.com/predicate/codebase/b.ts>
      } }
    `);
    expect(ok).toBe(true);
  });
});
