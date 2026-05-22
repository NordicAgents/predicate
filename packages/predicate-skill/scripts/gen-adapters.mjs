#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_ENV, PLATFORMS } from './adapter-spec.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..'); // packages/predicate-skill
const SKILL_PATH = resolve(root, 'skills/predicate-reasoning/SKILL.md');

const PKG = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const BANNER = (src) =>
  `<!-- GENERATED from ${src} — do not edit -->`;

/** Strip YAML frontmatter, prepend the do-not-edit banner. */
export function buildInstructionDoc(skillSource, _targetName) {
  const body = skillSource.replace(/^---\n[\s\S]*?\n---\n/, '');
  return `${BANNER('skills/predicate-reasoning/SKILL.md')}\n\n# Predicate — reasoning knowledge graph\n\n${body.trimStart()}`;
}

export function codexMcpJson() {
  return {
    predicate: {
      command: 'node',
      args: ['${PLUGIN_ROOT}/server.bundle.mjs'],
      env: { ...MCP_ENV },
    },
  };
}

export function codexPluginManifest(version = PKG.version) {
  return {
    name: 'predicate',
    version,
    description: PKG.description,
    author: PKG.author,
    homepage: PKG.homepage,
    license: 'Elastic-2.0', // SPDX id for the manifest; package.json uses npm's "SEE LICENSE IN LICENSE" form
    keywords: ['mcp', 'knowledge-graph', 'rdf', 'owl', 'sparql', 'reasoning'],
    skills: './skills/',
  };
}

export function geminiExtensionManifest(version = PKG.version) {
  return {
    name: 'predicate',
    version,
    description: PKG.description,
    contextFileName: 'GEMINI.md',
    mcpServers: {
      predicate: {
        command: 'node',
        args: ['${extensionPath}/server.bundle.mjs'],
        env: { ...MCP_ENV },
      },
    },
  };
}

export function geminiHooksJson() {
  const cmd = (script) => `bash "\${extensionPath}/hooks/gemini-cli/${script}"`;
  return {
    hooks: {
      SessionStart: [{ matcher: 'startup|resume', hooks: [{ type: 'command', command: cmd('session-start.sh') }] }],
      AfterAgent:   [{ matcher: '', hooks: [{ type: 'command', command: cmd('stop.sh') }] }],
      PreCompress:  [{ matcher: '', hooks: [{ type: 'command', command: cmd('pre-compact.sh') }] }],
    },
  };
}

export function generateAll() {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const written = [];

  // One AGENTS.md and one GEMINI.md (deduped by filename across platforms).
  const files = new Set(Object.values(PLATFORMS).map((p) => p.instructionFile));
  for (const name of files) {
    writeFileSync(resolve(root, name), buildInstructionDoc(skill, name));
    written.push(name);
  }

  // Codex plugin bundle
  mkdirSync(resolve(root, '.codex-plugin'), { recursive: true });
  writeFileSync(resolve(root, '.codex-plugin/plugin.json'),
    JSON.stringify(codexPluginManifest(), null, 2) + '\n');
  writeFileSync(resolve(root, '.mcp.json'),
    JSON.stringify(codexMcpJson(), null, 2) + '\n');
  written.push('.codex-plugin/plugin.json', '.mcp.json');

  // Gemini extension manifest
  writeFileSync(resolve(root, 'gemini-extension.json'),
    JSON.stringify(geminiExtensionManifest(), null, 2) + '\n');
  written.push('gemini-extension.json');

  // Gemini hooks/hooks.json — REAL Gemini event names
  mkdirSync(resolve(root, 'hooks/gemini-cli'), { recursive: true });
  writeFileSync(resolve(root, 'hooks/gemini-cli/hooks.json'),
    JSON.stringify(geminiHooksJson(), null, 2) + '\n');
  written.push('hooks/gemini-cli/hooks.json');

  return written;
}

// MCP server config block shared by manifests/templates.
export function mcpServerBlock({ argsPrefix }) {
  return {
    command: 'node',
    args: [`${argsPrefix}/server.bundle.mjs`],
    env: { ...MCP_ENV },
  };
}

const isMain = resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const written = generateAll();
  console.log(`generated: ${written.join(', ')}`);
}
