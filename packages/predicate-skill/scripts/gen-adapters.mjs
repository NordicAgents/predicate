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
      // Codex follows the Claude Code plugin model and expands
      // ${CLAUDE_PLUGIN_ROOT} (NOT ${PLUGIN_ROOT}) inside MCP server args.
      // MCP servers are spawned directly (no shell), so an unexpanded
      // variable reaches node verbatim → "Cannot find module" → the Codex
      // client reports "connection closed: initialize response".
      args: ['${CLAUDE_PLUGIN_ROOT}/server.bundle.mjs'],
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

export function generateAll() {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const written = [];

  // AGENTS.md at package root (Codex/Cursor/VSCode).
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
