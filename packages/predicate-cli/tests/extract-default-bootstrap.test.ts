import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { extractTranscript } from '../src/commands/extract.js';

const META_TTL = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'predicate-ontology', 'meta', 'predicate-meta.ttl',
);

describe('session capture works after loading only the meta vocabulary', () => {
  it('accepts modifiedIn/commandText/succeededIn without the codebase ontology', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(readFileSync(META_TTL, 'utf8'), 'kg:tbox');

    const dir = mkdtempSync(join(tmpdir(), 'pred-boot-'));
    const transcript = join(dir, 't.jsonl');
    writeFileSync(transcript, [
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
        { type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'pnpm test' } },
      ] } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'e1', is_error: false, content: 'ok' },
        { type: 'tool_result', tool_use_id: 'b1', is_error: false, content: 'ok' },
      ] } }),
    ].join('\n') + '\n', 'utf8');

    try {
      const r = await extractTranscript(client, { sessionId: 's1', transcriptPath: transcript, platform: 'claude-code' });
      expect(r.rejected).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
