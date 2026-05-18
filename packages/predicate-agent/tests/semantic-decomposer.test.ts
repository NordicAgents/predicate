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
import type { CompletionProvider } from '../src/completion-provider.js';

function fakeProvider(opts: {
  available: boolean;
  kind?: 'mcp-sampling' | 'anthropic-sdk';
  response?: string;
  reject?: Error;
}): CompletionProvider & { complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn(async () => {
    if (opts.reject) throw opts.reject;
    return opts.response ?? '';
  });
  return {
    kind: opts.kind ?? 'mcp-sampling',
    isAvailable: () => opts.available,
    complete,
  };
}

describe('SemanticDecomposer', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('preserves deterministic-pattern path: "what calls X" never hits LLM', async () => {
    const provider = fakeProvider({ available: true, response: '{}' });
    const d = new SemanticDecomposer({ providers: [provider] });
    const result = await d.decompose('what calls validateToken transitively');
    expect(result).toHaveLength(1);
    expect(result[0]!.intent.kind).toBe('find-callers');
    expect(provider.complete).not.toHaveBeenCalled();
    expect(d.lastProviderUsed).toBeNull();
  });

  it('falls back to deterministic when no provider is available', async () => {
    const provider = fakeProvider({ available: false });
    const d = new SemanticDecomposer({ providers: [provider] });
    const result = await d.decompose('a question with no pattern match');
    expect(result).toHaveLength(1);
    expect(result[0]!.intent.kind).toBe('unknown');
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it('picks the first available provider in priority order', async () => {
    const sampling = fakeProvider({
      available: true,
      kind: 'mcp-sampling',
      response: JSON.stringify({
        subQuestions: [
          { text: 'callers of foo', intent: { kind: 'find-callers', payload: { symbol: 'foo' } } },
        ],
      }),
    });
    const sdk = fakeProvider({ available: true, kind: 'anthropic-sdk' });
    const d = new SemanticDecomposer({ providers: [sampling, sdk] });
    const result = await d.decompose('please figure out who uses foo');
    expect(sampling.complete).toHaveBeenCalledTimes(1);
    expect(sdk.complete).not.toHaveBeenCalled();
    expect(d.lastProviderUsed).toBe('mcp-sampling');
    expect(result[0]!.intent.kind).toBe('find-callers');
  });

  it('skips an unavailable provider and uses the next available one', async () => {
    const sampling = fakeProvider({ available: false, kind: 'mcp-sampling' });
    const sdk = fakeProvider({
      available: true,
      kind: 'anthropic-sdk',
      response: JSON.stringify({
        subQuestions: [
          { text: 'callers of foo', intent: { kind: 'find-callers', payload: { symbol: 'foo' } } },
        ],
      }),
    });
    const d = new SemanticDecomposer({ providers: [sampling, sdk] });
    const result = await d.decompose('please figure out who uses foo');
    expect(sampling.complete).not.toHaveBeenCalled();
    expect(sdk.complete).toHaveBeenCalledTimes(1);
    expect(d.lastProviderUsed).toBe('anthropic-sdk');
    expect(result[0]!.intent.kind).toBe('find-callers');
  });

  it('filters out invented intent kinds', async () => {
    const provider = fakeProvider({
      available: true,
      response: JSON.stringify({
        subQuestions: [
          { text: 'invented intent', intent: { kind: 'made-up-thing', payload: {} } },
          { text: 'legit intent', intent: { kind: 'find-callers', payload: { symbol: 'x' } } },
        ],
      }),
    });
    const d = new SemanticDecomposer({ providers: [provider] });
    const result = await d.decompose('something exotic');
    expect(result).toHaveLength(1);
    expect(result[0]!.intent.kind).toBe('find-callers');
  });

  it('falls back gracefully on JSON parse failure', async () => {
    const provider = fakeProvider({ available: true, response: 'not json at all' });
    const d = new SemanticDecomposer({ providers: [provider] });
    const result = await d.decompose('weird question');
    expect(result).toHaveLength(1);
    expect(result[0]!.intent.kind).toBe('unknown');
  });

  it('falls back gracefully on provider error', async () => {
    const provider = fakeProvider({ available: true, reject: new Error('429 rate limit') });
    const d = new SemanticDecomposer({ providers: [provider] });
    const result = await d.decompose('weird question 2');
    expect(result).toHaveLength(1);
    expect(result[0]!.intent.kind).toBe('unknown');
  });

  it('default constructor uses the Anthropic SDK provider when key is set', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          subQuestions: [
            { text: 'callers of foo', intent: { kind: 'find-callers', payload: { symbol: 'foo' } } },
          ],
        }),
      }],
    });
    try {
      const d = new SemanticDecomposer();
      const result = await d.decompose('please figure out who uses foo');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(d.lastProviderUsed).toBe('anthropic-sdk');
      expect(result[0]!.intent.kind).toBe('find-callers');
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('default constructor falls back to deterministic when ANTHROPIC_API_KEY is missing', async () => {
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
});
