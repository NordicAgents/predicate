import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
  })),
}));

import { extract } from '../src/commands/extract.js';

const client = new SparqlClient(loadConfig());

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:abox>`);
  await client.update(`CREATE SILENT GRAPH <kg:abox>`);
  await client.update(`DROP SILENT GRAPH <kg:provenance>`);
  await client.update(`CREATE SILENT GRAPH <kg:provenance>`);
}

function writeTranscript(events: Array<Record<string, unknown>>): string {
  const dir = mkdtempSync(join(tmpdir(), 'predicate-test-'));
  const path = join(dir, 'transcript.jsonl');
  writeFileSync(path, events.map((e) => JSON.stringify(e)).join('\n'));
  return path;
}

describe('predicate extract', () => {
  beforeEach(async () => { await reset(); });

  it('reads the Stop-hook payload, runs deterministic extractor, and asserts triples', async () => {
    const transcript = writeTranscript([
      {
        type: 'assistant',
        message: { role: 'assistant', content: [
          { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/work/auth.ts' } },
        ]},
      },
      { type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
      ]}},
      {
        type: 'assistant',
        message: { role: 'assistant', content: [
          { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'pnpm test' } },
        ]},
      },
      { type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 't2', content: 'PASS' },
      ]}},
    ]);
    const payload = JSON.stringify({
      session_id: 'ses-extract',
      transcript_path: transcript,
      stop_hook_active: true,
    });
    const code = await extract(['--from-stdin'], Readable.from([payload]));
    expect(code).toBe(0);
    try {
      const r = await client.select(
        `PREFIX cb: <https://predicate.dev/codebase#>
         SELECT (COUNT(*) AS ?n) WHERE {
           GRAPH <kg:abox> {
             <file:///work/auth.ts> cb:modifiedIn <urn:predicate:session:ses-extract>
           }
         }`,
      );
      expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);
    } finally {
      rmSync(transcript, { force: true });
    }
  });

  it('returns 2 with --help', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const code = await extract(['--help'], Readable.from(['']));
      expect(code).toBe(0);
      const printed = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(printed).toContain('predicate extract');
      expect(printed).toContain('--from-stdin');
    } finally { logSpy.mockRestore(); }
  });

  it('errors with exit 2 on missing transcript_path', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const code = await extract(['--from-stdin'], Readable.from(['{"session_id":"x"}']));
      expect(code).toBe(2);
    } finally { errSpy.mockRestore(); }
  });

  it('extracts triples from a Gemini-shaped transcript when --platform gemini is set', async () => {
    const transcript = writeTranscript([
      {
        type: 'tool_call',
        toolUse: { toolCallId: 'g1', toolName: 'Edit', toolInput: { file_path: '/work/gem.ts' } },
      },
      {
        type: 'tool_result',
        toolResult: { toolCallId: 'g1', content: 'ok' },
      },
    ]);
    const payload = JSON.stringify({
      session_id: 'ses-gemini-extract',
      transcript_path: transcript,
      stop_hook_active: true,
    });
    const code = await extract(['--from-stdin', '--platform', 'gemini'], Readable.from([payload]));
    expect(code).toBe(0);
    try {
      const r = await client.select(
        `PREFIX cb: <https://predicate.dev/codebase#>
         SELECT (COUNT(*) AS ?n) WHERE {
           GRAPH <kg:abox> {
             <file:///work/gem.ts> cb:modifiedIn <urn:predicate:session:ses-gemini-extract>
           }
         }`,
      );
      expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);
    } finally {
      rmSync(transcript, { force: true });
    }
  });

  it('extracts triples from an OpenCode-shaped transcript when --platform opencode is set', async () => {
    const transcript = writeTranscript([
      {
        event: 'tool.before',
        id: 'o1',
        tool: { name: 'Write', input: { file_path: '/work/oc.ts' } },
      },
      { event: 'tool.after', id: 'o1', result: 'ok' },
    ]);
    const payload = JSON.stringify({
      session_id: 'ses-opencode-extract',
      transcript_path: transcript,
      stop_hook_active: true,
    });
    const code = await extract(['--from-stdin', '--platform', 'opencode'], Readable.from([payload]));
    expect(code).toBe(0);
    try {
      const r = await client.select(
        `PREFIX cb: <https://predicate.dev/codebase#>
         SELECT (COUNT(*) AS ?n) WHERE {
           GRAPH <kg:abox> {
             <file:///work/oc.ts> cb:modifiedIn <urn:predicate:session:ses-opencode-extract>
           }
         }`,
      );
      expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);
    } finally {
      rmSync(transcript, { force: true });
    }
  });

  it('errors with exit 2 on unsupported --platform value', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const code = await extract(
        ['--from-stdin', '--platform', 'cursor'],
        Readable.from(['{}']),
      );
      expect(code).toBe(2);
    } finally { errSpy.mockRestore(); }
  });
});
