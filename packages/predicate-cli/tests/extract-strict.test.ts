/**
 * Tests for the --strict exit-code contract:
 *   - extract(['--from-stdin', '--strict'], stdin) → 1 when triples are rejected
 *   - extract(['--from-stdin'],              stdin) → 0 when triples are rejected
 *
 * Isolation strategy: set PREDICATE_STORE_PATH=':memory:' and call
 * _resetAdapterCache() before each case so extract()'s internal getAdapter()
 * picks up a fresh, un-seeded in-memory store. No TBox is loaded, so every
 * codebase# triple emitted by the deterministic extractor will be rejected.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { _resetAdapterCache } from 'predicate-mcp/src/storage/factory.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
  })),
}));

import { extract } from '../src/commands/extract.js';

/** Build a transcript file with one Edit tool_use + successful tool_result. */
function writeTranscript(): string {
  const dir = mkdtempSync(join(tmpdir(), 'predicate-strict-'));
  const path = join(dir, 'transcript.jsonl');
  writeFileSync(
    path,
    [
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 's1', name: 'Edit', input: { file_path: '/work/strict.ts' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 's1', is_error: false, content: 'ok' }],
        },
      }),
    ].join('\n') + '\n',
    'utf8',
  );
  return path;
}

describe('extract --strict exit-code contract', () => {
  const origStorePath = process.env['PREDICATE_STORE_PATH'];

  afterEach(() => {
    // Restore env and reset cache so later test files start clean.
    if (origStorePath === undefined) {
      delete process.env['PREDICATE_STORE_PATH'];
    } else {
      process.env['PREDICATE_STORE_PATH'] = origStorePath;
    }
    _resetAdapterCache();
  });

  it('Case A: returns 1 with --strict when triples are rejected on un-seeded store', async () => {
    // Silence the rejection warnings emitted to stderr.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const transcript = writeTranscript();
    try {
      // Fresh in-memory store: no TBox loaded → every codebase# triple rejected.
      process.env['PREDICATE_STORE_PATH'] = ':memory:';
      _resetAdapterCache();

      const payload = JSON.stringify({
        session_id: 'ses-strict-a',
        transcript_path: transcript,
        stop_hook_active: true,
      });
      const code = await extract(['--from-stdin', '--strict'], Readable.from([payload]));
      expect(code).toBe(1);
    } finally {
      errSpy.mockRestore();
      logSpy.mockRestore();
      rmSync(transcript, { force: true });
    }
  });

  it('Case B: returns 0 without --strict even when triples are rejected on un-seeded store', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const transcript = writeTranscript();
    try {
      process.env['PREDICATE_STORE_PATH'] = ':memory:';
      _resetAdapterCache();

      const payload = JSON.stringify({
        session_id: 'ses-strict-b',
        transcript_path: transcript,
        stop_hook_active: true,
      });
      const code = await extract(['--from-stdin'], Readable.from([payload]));
      expect(code).toBe(0);
    } finally {
      errSpy.mockRestore();
      logSpy.mockRestore();
      rmSync(transcript, { force: true });
    }
  });
});
