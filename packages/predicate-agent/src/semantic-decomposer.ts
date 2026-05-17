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
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
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
