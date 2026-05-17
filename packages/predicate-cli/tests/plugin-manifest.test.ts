import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Regression tests for the plugin install path.
//
// Two latent bugs have hit production installs:
//
// 1. (v1.6.2 fix) hooks.json used ${PLUGIN_DIR} instead of
//    ${CLAUDE_PLUGIN_ROOT}. The variable never expanded, so every hook
//    command's path was broken.
//
// 2. (v1.6.3 fix) hooks.json used a flat-array shape
//    `{ hooks: [{event, matcher, command}, …] }` which Claude Code's
//    plugin loader silently rejected. `/reload-plugins` reported
//    "0 hooks". The correct shape (per context-mode's working plugin) is
//    a nested object keyed by event name, each event mapping to an array
//    of matcher groups, each group containing an inner `hooks` array of
//    { type: "command", command } entries.

const SKILL_ROOT = join(__dirname, '..', '..', 'predicate-skill');

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

interface InnerHook { type: string; command: string }
interface MatcherGroup { matcher: string; hooks: InnerHook[] }
interface HooksManifest { hooks: Record<string, MatcherGroup[]> }

describe('predicate-skill plugin manifest', () => {
  it('hooks.json uses ${CLAUDE_PLUGIN_ROOT}, NEVER ${PLUGIN_DIR}', () => {
    const raw = readFileSync(join(SKILL_ROOT, 'hooks/hooks.json'), 'utf8');
    expect(raw).not.toContain('${PLUGIN_DIR}');
    expect(raw).toContain('${CLAUDE_PLUGIN_ROOT}');
  });

  it('hooks.json uses the Claude-Code-expected nested-object schema, not a flat array', () => {
    const raw = readJson(join(SKILL_ROOT, 'hooks/hooks.json')) as unknown as HooksManifest;
    expect(Array.isArray(raw.hooks)).toBe(false);
    expect(typeof raw.hooks).toBe('object');
    for (const [eventName, groups] of Object.entries(raw.hooks)) {
      expect(Array.isArray(groups), `event ${eventName} must map to an array`).toBe(true);
      for (const g of groups) {
        expect(typeof g.matcher).toBe('string');
        expect(Array.isArray(g.hooks), `matcher group under ${eventName} must have inner hooks[]`).toBe(true);
        for (const inner of g.hooks) {
          expect(inner.type).toBe('command');
          expect(typeof inner.command).toBe('string');
        }
      }
    }
  });

  it('every hook command references an existing script', () => {
    const raw = readJson(join(SKILL_ROOT, 'hooks/hooks.json')) as unknown as HooksManifest;
    for (const groups of Object.values(raw.hooks)) {
      for (const g of groups) {
        for (const inner of g.hooks) {
          const m = inner.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)(?:\s|"|$)/);
          expect(m, `command "${inner.command}" must reference \${CLAUDE_PLUGIN_ROOT}/...`).toBeTruthy();
          const relPath = m![1]!;
          const fullPath = join(SKILL_ROOT, relPath);
          expect(existsSync(fullPath), `script at ${relPath} must exist`).toBe(true);
        }
      }
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
