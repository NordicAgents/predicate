# Predicate Phase 16 — LLM-Augmented Decomposer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a Claude-Haiku-backed fallback path to the goal decomposer. The existing pattern-based `Decomposer` stays as the deterministic baseline (fast, predictable). The new `SemanticDecomposer` runs the deterministic decomposer first; if it returns `kind: 'unknown'` AND `ANTHROPIC_API_KEY` is set, falls through to an LLM call that emits structured `SubQuestion[]` aligned with the known intent kinds. Tag v1.13.0-llm-decomposer.

**Architecture:** Mirrors Phase 9's semantic-extractor pattern. The LLM gets a TBox slice + an explicit list of valid `SubQuestionIntent.kind` values + the user's question. It returns strict JSON. Invented intent kinds are filtered out (predicate-discipline applies to decomposition too). If the LLM call fails (no key, parse error, API failure), we fall back to the deterministic `kind: 'unknown'` result — never crashes, never blocks the agent loop.

**Tech Stack:** Existing `@anthropic-ai/sdk` (already a dep from Phase 9). No new dependencies.

---

## File Structure

**New files:**
- `packages/predicate-agent/src/semantic-decomposer.ts`
- `packages/predicate-agent/tests/semantic-decomposer.test.ts`

**Modified files:**
- `packages/predicate-agent/src/index.ts` — export `SemanticDecomposer`.
- `packages/predicate-mcp/src/tools/kg-research-goal.ts` — accept optional `useLlmDecomposer: boolean` flag; if true and `ANTHROPIC_API_KEY` is set, use `SemanticDecomposer` instead of `Decomposer`.
- `packages/predicate-mcp/src/tools/registry.ts` — extend `kg_research_goal` zod schema with `useLlmDecomposer` optional flag.
- `packages/predicate-skill/skills/predicate/SKILL.md` — short note about the LLM-augmented decomposition path.
- Version bumps to 1.13.0.

---

### Task 1: SemanticDecomposer class

Create `packages/predicate-agent/src/semantic-decomposer.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Decomposer } from './decomposer.js';
import type { SubQuestion, SubQuestionIntent } from './types.js';

const MODEL = 'claude-haiku-4-5-20251001';

const VALID_INTENTS: ReadonlyArray<SubQuestionIntent['kind']> = [
  'why-broken',
  'find-callers',
  'find-dependencies',
  'find-readers-of',
  'find-symbol-in-file',
  'unknown',
];

const SYSTEM_PROMPT = `You are the goal decomposer for Predicate, a knowledge graph for
structural code questions ("why did X break", "blast radius of changing Y", etc).

Given a user question and a TBox slice describing available predicates,
output a strict-JSON list of one or more sub-questions, each with:
  - text: a focused natural-language sub-question
  - intent: { kind, payload } where kind is one of the valid intent kinds
  - symbols (optional): array of relevant identifiers extracted from the question

HARD RULES:
- intent.kind MUST be one of: why-broken, find-callers, find-dependencies,
  find-readers-of, find-symbol-in-file, unknown.
- If the question doesn't fit any specific intent kind, use "unknown".
- Do NOT invent new intent kinds — they will be filtered out.
- Extract concrete symbols (function names, file paths, env vars) into
  the symbols array and into intent.payload where appropriate.
- For "transitive"-style questions, set payload.transitive = true.

Output strict JSON, no prose:
{
  "subQuestions": [
    {
      "text": "...",
      "intent": { "kind": "find-callers", "payload": { "symbol": "validateToken", "transitive": true } },
      "symbols": ["validateToken"]
    }
  ]
}`;

interface LlmSubQuestion {
  text: string;
  intent: { kind: string; payload: Record<string, string | boolean> };
  symbols?: string[];
}

export interface SemanticDecomposerOptions {
  fallbackOnEmpty?: boolean;  // if true (default), return deterministic 'unknown' when LLM fails
}

export class SemanticDecomposer {
  private deterministic = new Decomposer();
  private options: Required<SemanticDecomposerOptions>;

  constructor(options: SemanticDecomposerOptions = {}) {
    this.options = { fallbackOnEmpty: options.fallbackOnEmpty ?? true };
  }

  async decompose(question: string, tboxSlice = ''): Promise<SubQuestion[]> {
    const deterministicResult = this.deterministic.decompose(question);

    // If deterministic matched a real pattern (not 'unknown'), use it directly.
    const allUnknown = deterministicResult.every((sq) => sq.intent.kind === 'unknown');
    if (!allUnknown) return deterministicResult;

    // Otherwise, try the LLM.
    if (!process.env['ANTHROPIC_API_KEY']) {
      return this.options.fallbackOnEmpty ? deterministicResult : [];
    }

    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: [
          { type: 'text', text: SYSTEM_PROMPT },
          { type: 'text', text: `<tbox-slice>\n${tboxSlice}\n</tbox-slice>`, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: `Question: ${question}\n\nReturn the JSON.` }],
      });
      const text = response.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(stripped) as { subQuestions: LlmSubQuestion[] };
      if (!Array.isArray(parsed.subQuestions)) return deterministicResult;

      const validated: SubQuestion[] = parsed.subQuestions
        .filter((sq) => typeof sq.text === 'string' && sq.intent && typeof sq.intent.kind === 'string')
        .filter((sq) => (VALID_INTENTS as ReadonlyArray<string>).includes(sq.intent.kind))
        .map((sq, i) => ({
          id: `SQ-${i + 1}`,
          text: sq.text,
          intent: {
            kind: sq.intent.kind as SubQuestionIntent['kind'],
            payload: sq.intent.payload ?? {},
          },
        }));

      if (validated.length === 0) return this.options.fallbackOnEmpty ? deterministicResult : [];
      return validated;
    } catch {
      return this.options.fallbackOnEmpty ? deterministicResult : [];
    }
  }
}
```

### Task 2: Tests with mocked Anthropic SDK

Create `packages/predicate-agent/tests/semantic-decomposer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { SemanticDecomposer } from '../src/semantic-decomposer.js';

describe('SemanticDecomposer', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('preserves deterministic-pattern path: "what calls X" never hits LLM', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    try {
      const d = new SemanticDecomposer();
      const result = await d.decompose('what calls validateToken transitively');
      expect(result).toHaveLength(1);
      expect(result[0]!.intent.kind).toBe('find-callers');
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('falls back to deterministic when ANTHROPIC_API_KEY is missing', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      const d = new SemanticDecomposer();
      const result = await d.decompose('a question with no pattern match');
      expect(result).toHaveLength(1);
      expect(result[0]!.intent.kind).toBe('unknown');
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
    }
  });

  it('calls LLM for unknown questions and parses structured response', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          subQuestions: [
            {
              text: 'find callers of foo',
              intent: { kind: 'find-callers', payload: { symbol: 'foo', transitive: false } },
              symbols: ['foo'],
            },
          ],
        }),
      }],
    });
    try {
      const d = new SemanticDecomposer();
      const result = await d.decompose('please figure out who uses foo');
      expect(result).toHaveLength(1);
      expect(result[0]!.intent.kind).toBe('find-callers');
      expect(result[0]!.intent.payload['symbol']).toBe('foo');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('filters out invented intent kinds', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          subQuestions: [
            { text: 'invented intent', intent: { kind: 'made-up-thing', payload: {} } },
            { text: 'legit intent',    intent: { kind: 'find-callers',   payload: { symbol: 'x' } } },
          ],
        }),
      }],
    });
    try {
      const d = new SemanticDecomposer();
      const result = await d.decompose('something exotic');
      // Only the legit one survives
      expect(result).toHaveLength(1);
      expect(result[0]!.intent.kind).toBe('find-callers');
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('falls back gracefully on LLM JSON parse failure', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    });
    try {
      const d = new SemanticDecomposer();
      const result = await d.decompose('weird question');
      // Falls back to deterministic 'unknown'
      expect(result).toHaveLength(1);
      expect(result[0]!.intent.kind).toBe('unknown');
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('falls back gracefully on API error', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockRejectedValue(new Error('429 rate limit'));
    try {
      const d = new SemanticDecomposer();
      const result = await d.decompose('weird question 2');
      expect(result).toHaveLength(1);
      expect(result[0]!.intent.kind).toBe('unknown');
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });
});
```

### Task 3: Export from predicate-agent

Modify `packages/predicate-agent/src/index.ts` — add `export { SemanticDecomposer } from './semantic-decomposer.js';`.

### Task 4: kg_research_goal integration

Modify `packages/predicate-mcp/src/tools/kg-research-goal.ts`:

1. Add `useLlmDecomposer?: boolean` to the input interface.
2. If true and `ANTHROPIC_API_KEY` is set, instantiate `SemanticDecomposer` instead of `Decomposer`. Build the TBox slice from `kg:tbox` (reuse the helper from `predicate-cli/src/commands/extract.ts` if extracted, otherwise inline a small SELECT for ObjectProperty + DatatypeProperty names).
3. Add a `decomposerKind: 'deterministic' | 'semantic'` field to the result so callers know which path ran.

Modify `packages/predicate-mcp/src/tools/registry.ts` to extend the zod schema:
```typescript
useLlmDecomposer: z.boolean().optional(),
```

Add or extend an existing test in `kg-research-goal.test.ts` to assert that `useLlmDecomposer: false` (default) uses deterministic, and `useLlmDecomposer: true` without API key still works (falls back).

### Task 5: SKILL.md note

Append to the relevant section:

```markdown
## Goal decomposition

The default `kg_research_goal` uses a pattern-based decomposer
(deterministic, fast, predictable). For questions that don't match any
pattern, you can opt-in to LLM-augmented decomposition by passing
\`useLlmDecomposer: true\`. The LLM (Claude Haiku) is constrained to
emit only the known intent kinds — invented kinds are filtered out.
If no \`ANTHROPIC_API_KEY\` is set, it transparently falls back to the
deterministic decomposer's 'unknown' result.
```

### Task 6: Release

- Bump versions 1.12.0 → 1.13.0 across 3 manifest files.
- README Status: v1.13 — LLM-augmented decomposer.
- Bundle rebuild.
- One commit.
- Tag `v1.13.0-llm-decomposer`.
- Merge to main, push.
- Expected test count: ~244 (238 + 6 semantic-decomposer tests).
