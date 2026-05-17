import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import { capture } from '../src/commands/capture.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

const client = new SparqlClient(loadConfig());

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:usage>`);
  await client.update(`CREATE SILENT GRAPH <kg:usage>`);
}

async function captureCount(): Promise<number> {
  const r = await client.select(
    `PREFIX pred: <https://predicate.dev/meta#>
     SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall } }`,
  );
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

describe('predicate capture', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); });

  it('writes a capture when given --tool and --phase via argv', async () => {
    const code = await capture(['--tool', 'Read', '--phase', 'post', '--input', '{"x":1}']);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
  });

  it('parses Claude Code stdin payload with --from-stdin', async () => {
    const payload = JSON.stringify({
      session_id: 'ses-abc',
      tool_name: 'Edit',
      tool_input: { file_path: '/x.ts' },
      tool_response: { ok: true },
    });
    const stdin = Readable.from([payload]);
    const code = await capture(['--from-stdin', '--phase', 'post'], stdin);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
  });

  it('skips silently when tool_name is in PREDICATE_CAPTURE_SKIP', async () => {
    const orig = process.env['PREDICATE_CAPTURE_SKIP'];
    process.env['PREDICATE_CAPTURE_SKIP'] = 'Bash,WebFetch';
    try {
      const code = await capture(['--tool', 'Bash', '--phase', 'post']);
      expect(code).toBe(0);
      expect(await captureCount()).toBe(0);
    } finally {
      if (orig !== undefined) process.env['PREDICATE_CAPTURE_SKIP'] = orig;
      else delete process.env['PREDICATE_CAPTURE_SKIP'];
    }
  });

  it('returns 2 with --help and prints usage', async () => {
    const code = await capture(['--help']);
    expect(code).toBe(0);
    const printed = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(printed).toContain('predicate capture');
    expect(printed).toContain('--from-stdin');
  });
});
