import { describe, it, expect } from 'vitest';
import {
  adaptClaudeCodeTranscript,
} from '../src/transcript-adapters.js';

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
