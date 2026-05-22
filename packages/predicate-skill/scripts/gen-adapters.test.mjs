import { describe, it, expect } from 'vitest';
import { buildInstructionDoc } from './gen-adapters.mjs';

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
