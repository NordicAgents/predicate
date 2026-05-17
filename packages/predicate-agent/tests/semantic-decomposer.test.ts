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
