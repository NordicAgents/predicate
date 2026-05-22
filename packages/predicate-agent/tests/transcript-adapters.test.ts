import { describe, it, expect } from 'vitest';
import {
  adaptClaudeCodeTranscript,
  adaptGeminiTranscript,
} from '../src/transcript-adapters.js';
import { extractDeterministic, type Transcript } from '../src/turn-extractor.js';

describe('adaptClaudeCodeTranscript', () => {
  it('is the identity (canonical shape passes through unchanged)', () => {
    const canonical: Array<Record<string, unknown>> = [
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/a.ts' } }],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }],
        },
      },
    ];
    expect(adaptClaudeCodeTranscript(canonical)).toEqual(canonical);
  });
});

describe('adaptGeminiTranscript', () => {
  it('transforms tool_call with toolUse{toolName,toolInput,toolCallId} into canonical assistant/tool_use', () => {
    const adapted = adaptGeminiTranscript([
      {
        type: 'tool_call',
        toolUse: {
          toolCallId: 'g1',
          toolName: 'Edit',
          toolInput: { file_path: '/work/auth.ts' },
        },
      },
    ]);
    expect(adapted[0]).toEqual({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'g1',
            name: 'Edit',
            input: { file_path: '/work/auth.ts' },
          },
        ],
      },
    });
  });

  it('transforms tool_result with toolResult{isError:true} into canonical user/tool_result with is_error:true', () => {
    const adapted = adaptGeminiTranscript([
      {
        type: 'tool_result',
        toolResult: {
          toolCallId: 'g1',
          isError: true,
          output: 'boom',
        },
      },
    ]);
    expect(adapted[0]).toEqual({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'g1',
            is_error: true,
            content: 'boom',
          },
        ],
      },
    });
  });

  it('produces events that extractDeterministic understands end-to-end', () => {
    const adapted = adaptGeminiTranscript([
      {
        type: 'tool_call',
        toolUse: { toolCallId: 'g1', toolName: 'Edit', toolInput: { file_path: '/work/gem.ts' } },
      },
      {
        type: 'tool_result',
        toolResult: { toolCallId: 'g1', content: 'ok' },
      },
    ]);
    const transcript: Transcript = { sessionId: 'ses-gem', events: adapted };
    const r = extractDeterministic(transcript);
    const fileTriples = r.triples.filter(
      (t) => t.subject === 'file:///work/gem.ts' && t.predicate.endsWith('#modifiedIn'),
    );
    expect(fileTriples).toHaveLength(1);
  });
});

describe('adaptGeminiTranscript — AfterAgent turn', () => {
  it('maps a tool_call/tool_result pair to canonical events', () => {
    const events = [
      {
        type: 'tool_call',
        toolUse: { toolCallId: 'g2', toolName: 'Bash', toolInput: { command: 'pnpm test' } },
      },
      {
        type: 'tool_result',
        toolResult: { toolCallId: 'g2', output: 'ok' },
      },
    ];
    const out = adaptGeminiTranscript(events);
    expect(out[0]).toEqual({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'g2', name: 'Bash', input: { command: 'pnpm test' } }],
      },
    });
    expect(out[1]).toEqual({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'g2', is_error: false, content: 'ok' }],
      },
    });
  });
});

