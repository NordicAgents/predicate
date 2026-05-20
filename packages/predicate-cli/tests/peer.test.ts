import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

import { peer } from '../src/commands/peer.js';

const client = getAdapter();

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:peers>`);
  await client.update(`CREATE SILENT GRAPH <kg:peers>`);
}

describe('predicate peer', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); errSpy.mockRestore(); });

  it('add registers a peer and list returns it', async () => {
    const c1 = await peer(['add', 'alice', 'http://alice.local:3030/predicate/query']);
    expect(c1).toBe(0);

    const c2 = await peer(['list', '--json']);
    expect(c2).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    // JSON output is the second log call after the "registered" message.
    const jsonCall = logSpy.mock.calls.map((c) => c[0] as string).find((s) => s.trim().startsWith('['));
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall!) as Array<{ name: string; endpoint: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.name).toBe('alice');
    expect(parsed[0]!.endpoint).toBe('http://alice.local:3030/predicate/query');
    expect(out).toContain('alice');
  });

  it('remove deletes a peer', async () => {
    await peer(['add', 'bob', 'http://bob.local:3030/predicate/query']);
    const code = await peer(['remove', 'bob']);
    expect(code).toBe(0);
    logSpy.mockClear();
    await peer(['list', '--json']);
    const jsonCall = logSpy.mock.calls.map((c) => c[0] as string).find((s) => s.trim().startsWith('['));
    expect(jsonCall).toBeDefined();
    expect(JSON.parse(jsonCall!)).toHaveLength(0);
  });

  it('list (table) renders columns', async () => {
    await peer(['add', 'carol', 'http://carol.local:3030/predicate/query']);
    logSpy.mockClear();
    const code = await peer(['list']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('name');
    expect(out).toContain('endpoint');
    expect(out).toContain('carol');
  });

  it('list when empty prints friendly message', async () => {
    const code = await peer(['list']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('no peers registered');
  });

  it('--help prints usage and returns 0', async () => {
    const code = await peer(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate peer');
    expect(out).toContain('add');
    expect(out).toContain('list');
    expect(out).toContain('remove');
  });
});
