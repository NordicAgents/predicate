import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

import { exportSessions } from '../src/commands/export-sessions.js';

const client = getAdapter();

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:abox>`);
  await client.update(`CREATE SILENT GRAPH <kg:abox>`);
}

async function seedSession(id: string, at: string): Promise<void> {
  const s = `<urn:predicate:session:${id}>`;
  const triples = `${s} a <https://predicate.dev/meta#Session> .
    ${s} <https://predicate.dev/meta#sessionId> "${id}" .
    ${s} <https://predicate.dev/meta#at> "${at}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    <file:///${id}/auth.ts> <https://predicate.dev/codebase#modifiedIn> ${s} .`;
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

describe('predicate export-sessions', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); errSpy.mockRestore(); });

  it('exports recent session triples wrapped in TriG graph syntax', async () => {
    const at = new Date(Date.now() - 86400_000).toISOString(); // yesterday
    await seedSession('ses-export-a', at);

    const code = await exportSessions(['--user', 'alice']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    // TriG header: graph IRI followed by '{'
    expect(out).toMatch(/<urn:predicate:export:alice:[^>]+>\s*\{/);
    // Body contains the session URI
    expect(out).toContain('urn:predicate:session:ses-export-a');
    // Closing '}'
    expect(out.trim().endsWith('}')).toBe(true);
  });

  it('--help prints usage and returns 0', async () => {
    const code = await exportSessions(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate export-sessions');
    expect(out).toContain('--since');
    expect(out).toContain('--user');
  });
});
