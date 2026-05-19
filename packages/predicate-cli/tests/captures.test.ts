import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

import { captures } from '../src/commands/captures.js';

const client = getAdapter();

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:usage>`);
  await client.update(`CREATE SILENT GRAPH <kg:usage>`);
}

async function seedCapture(
  id: string,
  toolName: string,
  phase: string,
  at: string,
  sessionId?: string,
): Promise<void> {
  const c = `<urn:predicate:capture:${id}>`;
  let triples = `${c} a <https://predicate.dev/meta#ToolCall> .
                 ${c} <https://predicate.dev/meta#toolName> "${toolName}" .
                 ${c} <https://predicate.dev/meta#phase>    "${phase}" .
                 ${c} <https://predicate.dev/meta#at>       "${at}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`;
  if (sessionId) {
    triples += `\n${c} <https://predicate.dev/meta#sessionId> "${sessionId}" .`;
  }
  await client.update(`INSERT DATA { GRAPH <kg:usage> { ${triples} } }`);
}

describe('predicate captures', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); });

  it('lists captures with their tool / phase / sessionId columns', async () => {
    await seedCapture('cap-a', 'Read', 'pre', '2026-05-17T10:00:00Z', 'ses-a');
    const code = await captures([]);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('cap-a');
    expect(out).toContain('Read');
    expect(out).toContain('pre');
    expect(out).toContain('ses-a');
  });

  it('--json emits parseable JSON', async () => {
    await seedCapture('cap-json', 'Bash', 'post', '2026-05-17T11:00:00Z', 'ses-j');
    const code = await captures(['--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(out) as Array<{ captureId: string; toolName: string; phase: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.toolName).toBe('Bash');
    expect(parsed[0]!.phase).toBe('post');
  });

  it('--tool filters to the specified tool', async () => {
    await seedCapture('cap-r', 'Read', 'pre', '2026-05-17T12:00:00Z');
    await seedCapture('cap-b', 'Bash', 'pre', '2026-05-17T12:01:00Z');
    const code = await captures(['--tool', 'Bash', '--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(out) as Array<{ toolName: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.toolName).toBe('Bash');
  });

  it('honors --limit', async () => {
    await seedCapture('cap-1', 'Read', 'pre', '2026-05-17T13:00:00Z');
    await seedCapture('cap-2', 'Read', 'pre', '2026-05-17T13:01:00Z');
    await seedCapture('cap-3', 'Read', 'pre', '2026-05-17T13:02:00Z');
    const code = await captures(['--limit', '2', '--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(JSON.parse(out)).toHaveLength(2);
  });

  it('prints a friendly message when kg:usage has no captures', async () => {
    const code = await captures([]);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('no captures');
    expect(out).toContain('PREDICATE_RAW_CAPTURE');
  });

  it('--help prints usage and returns 0', async () => {
    const code = await captures(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate captures');
    expect(out).toContain('--limit');
    expect(out).toContain('--tool');
  });
});
