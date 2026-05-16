import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocsResearchSource } from '../src/research-source.js';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'predicate-docs-test-'));
  writeFileSync(join(root, 'a.ts'), 'export function a() { return 1 }');
  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'nested', 'b.ts'), 'export function b() { return 2 }');
  writeFileSync(join(root, 'c.md'), '# notes');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('DocsResearchSource', () => {
  it('returns one ResearchArtifact per .ts file by default', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    const artifacts = await src.fetch({
      intent: { kind: 'find-dependencies', payload: { symbol: 'x', transitive: false } },
    });
    expect(artifacts).toHaveLength(2);
    const uris = artifacts.map((a) => a.uri).sort();
    expect(uris[0]!.endsWith('a.ts')).toBe(true);
    expect(uris[1]!.endsWith('nested/b.ts')).toBe(true);
  });

  it('includes the file content', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    const artifacts = await src.fetch({
      intent: { kind: 'find-symbol-in-file', payload: { symbol: 'a' } },
    });
    const a = artifacts.find((a) => a.uri.endsWith('a.ts'))!;
    expect(a.content).toContain('export function a()');
  });

  it('respects the extensions filter', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.md'] });
    const artifacts = await src.fetch({
      intent: { kind: 'unknown', payload: { raw: 'x' } },
    });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.uri.endsWith('c.md')).toBe(true);
  });

  it('returns artifacts with source name set to "docs"', async () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    const [first] = await src.fetch({
      intent: { kind: 'unknown', payload: { raw: 'x' } },
    });
    expect(first!.source).toBe('docs');
  });

  it('name property identifies the source', () => {
    const src = new DocsResearchSource({ root, extensions: ['.ts'] });
    expect(src.name).toBe('docs');
  });
});
