#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_ENV, PLATFORMS } from './adapter-spec.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..'); // packages/predicate-skill
const SKILL_PATH = resolve(root, 'skills/predicate-reasoning/SKILL.md');

const BANNER = (src) =>
  `<!-- GENERATED from ${src} — do not edit -->`;

/** Strip YAML frontmatter, prepend the do-not-edit banner. */
export function buildInstructionDoc(skillSource, _targetName) {
  const body = skillSource.replace(/^---\n[\s\S]*?\n---\n/, '');
  return `${BANNER('skills/predicate-reasoning/SKILL.md')}\n\n# Predicate — reasoning knowledge graph\n\n${body.trimStart()}`;
}

export function generateAll() {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const written = [];
  // One AGENTS.md and one GEMINI.md (deduped by filename across platforms).
  const files = new Set(Object.values(PLATFORMS).map((p) => p.instructionFile));
  for (const name of files) {
    const out = buildInstructionDoc(skill, name);
    writeFileSync(resolve(root, name), out);
    written.push(name);
  }
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
