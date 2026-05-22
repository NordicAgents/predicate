import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_ENV = { PREDICATE_BACKEND: 'oxigraph', PREDICATE_DATASET: 'predicate' };

type Platform = 'vscode' | 'cursor';

/** VS Code uses { servers: {...} }; Cursor uses { mcpServers: {...} }. */
function configSpec(platform: Platform): { rel: string; key: 'servers' | 'mcpServers' } {
  switch (platform) {
    case 'vscode': return { rel: '.vscode/mcp.json', key: 'servers' };
    case 'cursor': return { rel: '.cursor/mcp.json', key: 'mcpServers' };
  }
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}

export function writeMcpConfig(platform: Platform, projectDir: string, serverPath: string): string {
  const { rel, key } = configSpec(platform);
  const out = join(projectDir, rel);
  mkdirSync(dirname(out), { recursive: true });
  const cfg = readJson(out);
  const servers = (cfg[key] as Record<string, unknown>) ?? {};
  servers.predicate = { command: 'node', args: [serverPath], env: { ...MCP_ENV } };
  cfg[key] = servers;
  writeFileSync(out, JSON.stringify(cfg, null, 2) + '\n');
  return out;
}

/** Resolve the bundled server.bundle.mjs shipped beside this CLI. */
function bundledServerPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(here, 'server.bundle.mjs');
  return existsSync(candidate) ? candidate : resolve(here, '../../../predicate-skill/server.bundle.mjs');
}

/** Copy the generated AGENTS.md beside the project config, if available. */
function dropInstructions(projectDir: string): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = resolve(here, 'AGENTS.md');
  if (!existsSync(src)) return null;
  const dst = join(projectDir, 'AGENTS.md');
  if (!existsSync(dst)) copyFileSync(src, dst);
  return existsSync(dst) ? dst : null;
}

export async function install(args: string[]): Promise<number> {
  const platform = args[0] as Platform | undefined;
  if (platform !== 'vscode' && platform !== 'cursor') {
    console.error('usage: predicate install <vscode|cursor>');
    console.error('  (Claude/Codex/Gemini install via their own marketplace/extension commands)');
    return 2;
  }
  const projectDir = process.cwd();
  const serverPath = bundledServerPath();
  const written = writeMcpConfig(platform, projectDir, serverPath);
  const instr = dropInstructions(projectDir);
  console.log(`Wrote ${written}`);
  if (instr) console.log(`Wrote ${instr}`);
  console.log(`Restart ${platform === 'vscode' ? 'VS Code' : 'Cursor'} to load the predicate MCP server.`);
  return 0;
}
