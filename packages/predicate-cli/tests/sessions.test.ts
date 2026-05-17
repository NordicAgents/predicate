import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { sessions } from '../src/commands/sessions.js';

const client = new SparqlClient(loadConfig());

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:abox>`);
  await client.update(`CREATE SILENT GRAPH <kg:abox>`);
}

async function seed(sessionId: string, files: number, ok: number, bad: number): Promise<void> {
  const s = `<urn:predicate:session:${sessionId}>`;
  const at = new Date().toISOString();
  let triples = `${s} a <https://predicate.dev/meta#Session> .
                 ${s} <https://predicate.dev/meta#sessionId> "${sessionId}" .
                 ${s} <https://predicate.dev/meta#at> "${at}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`;
  for (let i = 0; i < files; i++) {
    triples += `\n<file:///${sessionId}/f${i}.ts> <https://predicate.dev/codebase#modifiedIn> ${s} .`;
  }
  for (let i = 0; i < ok; i++) {
    triples += `\n<urn:bash:${sessionId}o${i}> <https://predicate.dev/codebase#succeededIn> ${s} .`;
  }
  for (let i = 0; i < bad; i++) {
    triples += `\n<urn:bash:${sessionId}b${i}> <https://predicate.dev/codebase#failedIn> ${s} .`;
  }
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

describe('predicate sessions', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); });

  it('lists sessions with their modifiedFiles / succeeded / failed counts', async () => {
    await seed('ses-a', 3, 5, 1);
    const code = await sessions([]);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('ses-a');
    expect(out).toMatch(/ses-a\s.*\s+3\s+5\s+1/);
  });

  it('--json emits parseable JSON', async () => {
    await seed('ses-json', 2, 4, 0);
    const code = await sessions(['--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(out) as Array<{ sessionId: string; modifiedFiles: number }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.sessionId).toBe('ses-json');
    expect(parsed[0]!.modifiedFiles).toBe(2);
  });

  it('honors --limit', async () => {
    for (const id of ['s1', 's2', 's3']) await seed(id, 0, 0, 0);
    const code = await sessions(['--limit', '2', '--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(JSON.parse(out)).toHaveLength(2);
  });

  it('prints a friendly message when kg:abox has no sessions', async () => {
    const code = await sessions([]);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('no sessions');
  });

  it('--help prints usage and returns 0', async () => {
    const code = await sessions(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate sessions');
    expect(out).toContain('--limit');
  });
});
