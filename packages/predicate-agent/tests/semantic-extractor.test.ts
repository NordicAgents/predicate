import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK BEFORE importing the module under test
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { extractSemantic } from '../src/semantic-extractor.js';

describe('extractSemantic', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns no triples when ANTHROPIC_API_KEY is missing', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      const r = await extractSemantic({
        sessionId: 'ses-x',
        finalMessage: 'I added JWT auth.',
        toolSummary: 'Edit auth.ts; Bash pnpm test (exit 0)',
        tboxSlice: 'codebase:hasAuthFlow ObjectProperty',
      });
      expect(r.triples).toHaveLength(0);
      expect(r.skipped).toContain('no ANTHROPIC_API_KEY');
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
    }
  });

  it('parses the LLM JSON response into ExtractedTriples when API key is set', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          triples: [
            {
              subject: 'file:///auth.ts',
              predicate: 'https://industriagents.com/predicate/codebase#hasAuthFlow',
              object: { type: 'literal', value: 'true' },
              source: 'urn:predicate:session:ses-x',
              confidence: 0.7,
              method: 'agent-self-report',
            },
          ],
          skipped: [],
        }),
      }],
    });
    try {
      const r = await extractSemantic({
        sessionId: 'ses-x',
        finalMessage: 'I added JWT auth to login.',
        toolSummary: 'Edit auth.ts; Bash pnpm test (exit 0)',
        tboxSlice: 'codebase:hasAuthFlow ObjectProperty',
      });
      expect(r.triples).toHaveLength(1);
      expect(r.triples[0]!.subject).toBe('file:///auth.ts');
      expect(r.triples[0]!.confidence).toBe(0.7);
      expect(r.triples[0]!.method).toBe('agent-self-report');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('returns empty triples and records a skip reason on malformed JSON', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    });
    try {
      const r = await extractSemantic({
        sessionId: 'ses-x',
        finalMessage: 'hi',
        toolSummary: '',
        tboxSlice: '',
      });
      expect(r.triples).toHaveLength(0);
      expect(r.skipped.join(' ')).toMatch(/parse/i);
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });
});
