import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeMcpConfig } from '../src/commands/install.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'predicate-install-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('writeMcpConfig', () => {
  it('vscode: writes .vscode/mcp.json with oxigraph env', () => {
    const out = writeMcpConfig('vscode', dir, '/abs/server.bundle.mjs');
    const cfg = JSON.parse(readFileSync(out, 'utf8'));
    expect(cfg.servers.predicate.command).toBe('node');
    expect(cfg.servers.predicate.args[0]).toBe('/abs/server.bundle.mjs');
    expect(cfg.servers.predicate.env.PREDICATE_BACKEND).toBe('oxigraph');
    expect(JSON.stringify(cfg)).not.toContain('FUSEKI_URL');
  });

  it('cursor: writes .cursor/mcp.json with the predicate server', () => {
    const out = writeMcpConfig('cursor', dir, '/abs/server.bundle.mjs');
    expect(out).toContain('.cursor');
    const cfg = JSON.parse(readFileSync(out, 'utf8'));
    expect(cfg.mcpServers.predicate.args[0]).toBe('/abs/server.bundle.mjs');
  });

  it('preserves a pre-existing unrelated server entry and top-level keys', () => {
    // Seed an existing .vscode/mcp.json with an unrelated server + extra key.
    mkdirSync(join(dir, '.vscode'), { recursive: true });
    writeFileSync(
      join(dir, '.vscode/mcp.json'),
      JSON.stringify({ servers: { otherTool: { command: 'foo' } }, someTopLevelExtra: 1 }),
    );
    const out = writeMcpConfig('vscode', dir, '/abs/server.bundle.mjs');
    const cfg = JSON.parse(readFileSync(out, 'utf8'));
    expect(cfg.servers.predicate.args[0]).toBe('/abs/server.bundle.mjs');
    expect(cfg.servers.otherTool).toEqual({ command: 'foo' }); // unrelated entry untouched
    expect(cfg.someTopLevelExtra).toBe(1); // sibling top-level key preserved
  });
});
