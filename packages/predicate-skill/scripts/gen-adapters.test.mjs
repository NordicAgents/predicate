import { describe, it, expect } from 'vitest';
import { buildInstructionDoc, codexPluginManifest, codexMcpJson, geminiExtensionManifest, geminiHooksJson } from './gen-adapters.mjs';

const SKILL = `---
name: predicate-reasoning
description: Local reasoning knowledge graph.
---

# When to use this skill
Use Predicate when the user asks why something happened.
`;

describe('buildInstructionDoc', () => {
  it('strips frontmatter and prepends a generated-file banner', () => {
    const out = buildInstructionDoc(SKILL, 'AGENTS.md');
    expect(out).toContain('<!-- GENERATED from skills/predicate-reasoning/SKILL.md — do not edit -->');
    expect(out).not.toContain('---\nname: predicate-reasoning');
    expect(out).toContain('# When to use this skill');
    expect(out).toContain('Predicate when the user asks why');
  });
});

describe('manifests', () => {
  it('codex .mcp.json points at the bundled server with oxigraph env', () => {
    const m = codexMcpJson();
    expect(m.predicate.command).toBe('node');
    // Must use the variable Codex actually expands in MCP args. ${PLUGIN_ROOT}
    // is passed through literally → node ENOENT → handshake closes. See
    // hooks/codex-cli/README.md: Codex honors ${CLAUDE_PLUGIN_ROOT}.
    expect(m.predicate.args[0]).toBe('${CLAUDE_PLUGIN_ROOT}/server.bundle.mjs');
    expect(m.predicate.env.PREDICATE_BACKEND).toBe('oxigraph');
    expect(JSON.stringify(m)).not.toContain('FUSEKI_URL');
  });
  it('codex plugin manifest declares skills + version', () => {
    const p = codexPluginManifest('9.9.9');
    expect(p.name).toBe('predicate');
    expect(p.version).toBe('9.9.9');
    expect(p.skills).toBe('./skills/');
  });
  it('gemini extension uses extensionPath + GEMINI.md context file', () => {
    const g = geminiExtensionManifest('9.9.9');
    expect(g.contextFileName).toBe('GEMINI.md');
    expect(g.mcpServers.predicate.args[0]).toBe('${extensionPath}/server.bundle.mjs');
    expect(g.version).toBe('9.9.9');
  });
  it('gemini hooks.json uses real event names with split SessionStart matchers', () => {
    const h = geminiHooksJson();
    expect(Object.keys(h.hooks).sort()).toEqual(['AfterAgent', 'PreCompress', 'SessionStart']);
    expect(h.hooks.SessionStart.map((e) => e.matcher).sort()).toEqual(['resume', 'startup']);
    expect(JSON.stringify(h)).toContain('${extensionPath}/hooks/gemini-cli/stop.sh');
  });
});
