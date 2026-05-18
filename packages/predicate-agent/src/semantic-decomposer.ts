import { Decomposer } from './decomposer.js';
import {
  AnthropicSdkProvider,
  type CompletionProvider,
  type CompletionProviderKind,
} from './completion-provider.js';
import type { SubQuestion, SubQuestionIntent } from './types.js';

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
  /** Providers tried in order; first available wins. Defaults to [AnthropicSdkProvider]. */
  providers?: CompletionProvider[];
  /** When true (default), an LLM failure returns the deterministic 'unknown' fallback. */
  fallbackOnEmpty?: boolean;
}

export class SemanticDecomposer {
  private deterministic = new Decomposer();
  private providers: CompletionProvider[];
  private fallbackOnEmpty: boolean;
  /** Set to the provider actually used on the last decompose() call (for telemetry). */
  lastProviderUsed: CompletionProviderKind | null = null;

  constructor(options: SemanticDecomposerOptions = {}) {
    this.providers = options.providers ?? [new AnthropicSdkProvider()];
    this.fallbackOnEmpty = options.fallbackOnEmpty ?? true;
  }

  async decompose(question: string, tboxSlice = ''): Promise<SubQuestion[]> {
    this.lastProviderUsed = null;
    const deterministicResult = this.deterministic.decompose(question);

    const allUnknown = deterministicResult.every((sq) => sq.intent.kind === 'unknown');
    if (!allUnknown) return deterministicResult;

    const provider = this.providers.find((p) => p.isAvailable());
    if (!provider) {
      return this.fallbackOnEmpty ? deterministicResult : [];
    }

    try {
      const text = await provider.complete({
        systemPrompt: SYSTEM_PROMPT,
        tboxSlice,
        question,
        maxTokens: 1024,
      });
      this.lastProviderUsed = provider.kind;
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

      if (validated.length === 0) return this.fallbackOnEmpty ? deterministicResult : [];
      return validated;
    } catch {
      return this.fallbackOnEmpty ? deterministicResult : [];
    }
  }
}
