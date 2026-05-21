import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { extractTranscript } from '../src/commands/extract.js';

const META_TTL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'predicate-ontology', 'meta', 'predicate-meta.ttl');

describe('extract per-line resilience', () => {
  it('skips a malformed JSONL line and captures the valid ones', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(readFileSync(META_TTL, 'utf8'), 'kg:tbox');

    const dir = mkdtempSync(join(tmpdir(), 'pred-resil-'));
    const t = join(dir, 't.jsonl');
    writeFileSync(t, [
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/r/a.ts', old_string: 'x', new_string: 'y' } },
      ] } }),
      '{ this is not valid json',
      JSON.stringify({ type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'e1', is_error: false, content: 'ok' },
      ] } }),
    ].join('\n') + '\n', 'utf8');

    try {
      const r = await extractTranscript(client, { sessionId: 's1', transcriptPath: t, platform: 'claude-code' });
      expect(r.skippedLines).toBe(1);
      expect(r.rejected).toBe(0);
      expect(r.asserted).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
