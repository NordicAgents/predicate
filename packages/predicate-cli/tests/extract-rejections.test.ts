import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { extractTranscript } from '../src/commands/extract.js';

describe('extractTranscript rejection reporting', () => {
  it('returns the rejected triples with reasons on an un-seeded store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pred-extract-'));
    const transcript = join(dir, 't.jsonl');
    writeFileSync(transcript, [
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
      ] } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'e1', is_error: false, content: 'ok' },
      ] } }),
    ].join('\n') + '\n', 'utf8');

    const client = new OxigraphAdapter({ storePath: ':memory:' });
    const r = await extractTranscript(client, { sessionId: 's1', transcriptPath: transcript, platform: 'claude-code' });

    expect(r.rejected).toBeGreaterThan(0);
    expect(r.rejections.length).toBe(r.rejected);
    expect(r.rejections[0]!.reason).toMatch(/not declared/);
    rmSync(dir, { recursive: true, force: true });
  });
});
