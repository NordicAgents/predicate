import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// These tests catch regressions in the plugin install path. The Predicate
// plugin had a latent bug from Phase 7 → v1.6.1 where hooks.json used
// ${PLUGIN_DIR} (which Claude Code doesn't expand) instead of
// ${CLAUDE_PLUGIN_ROOT} (which it does). Every hook command was silently
// invoked with a literal `bash ${PLUGIN_DIR}/hooks/X.sh` path → bash error →
// no hooks ever fired in production installs.

const SKILL_ROOT = join(__dirname, '..', '..', 'predicate-skill');

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('predicate-skill plugin manifest', () => {
  it('hooks.json uses ${CLAUDE_PLUGIN_ROOT}, NEVER ${PLUGIN_DIR}', () => {
    const raw = readFileSync(join(SKILL_ROOT, 'hooks/hooks.json'), 'utf8');
    expect(raw).not.toContain('${PLUGIN_DIR}');
    expect(raw).toContain('${CLAUDE_PLUGIN_ROOT}');
  });

  it('every hook command references an existing script', () => {
    const manifest = readJson(join(SKILL_ROOT, 'hooks/hooks.json'));
    const hooks = manifest['hooks'] as Array<{ command: string }>;
    for (const h of hooks) {
      const m = h.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+)/);
      expect(m, `command "${h.command}" must reference \${CLAUDE_PLUGIN_ROOT}/...`).toBeTruthy();
      const relPath = m![1]!;
      const fullPath = join(SKILL_ROOT, relPath);
      const exists = readFileSync(fullPath, 'utf8').length > 0;
      expect(exists, `script at ${relPath} must exist and be non-empty`).toBe(true);
    }
  });

  it('plugin.json + package.json + marketplace.json agree on version', () => {
    const plugin = readJson(join(SKILL_ROOT, '.claude-plugin/plugin.json'));
    const pkg    = readJson(join(SKILL_ROOT, 'package.json'));
    const market = readJson(join(__dirname, '..', '..', '..', '.claude-plugin/marketplace.json'));
    expect(plugin['version']).toBe(pkg['version']);
    const marketPlugins = (market['plugins'] as Array<{ version: string }>)[0]!;
    expect(marketPlugins.version).toBe(pkg['version']);
  });

  it('plugin.json owner metadata is current (not the stale v1.0 MX Research)', () => {
    const plugin = readJson(join(SKILL_ROOT, '.claude-plugin/plugin.json'));
    const author = plugin['author'] as { name: string };
    expect(author.name).not.toBe('MX Research');
    expect(plugin['homepage']).toContain('NordicAgents/predicate');
    expect(plugin['repository']).toContain('NordicAgents/predicate');
  });
});
