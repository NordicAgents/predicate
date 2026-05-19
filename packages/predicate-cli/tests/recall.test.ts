import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

import { recall } from '../src/commands/recall.js';

const client = getAdapter();

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:abox>`);
  await client.update(`CREATE SILENT GRAPH <kg:abox>`);
}

async function seedSession(sessionId: string, at: string): Promise<void> {
  const s = `<urn:predicate:session:${sessionId}>`;
  const triples = `${s} a <https://predicate.dev/meta#Session> .
                   ${s} <https://predicate.dev/meta#sessionId> "${sessionId}" .
                   ${s} <https://predicate.dev/meta#at> "${at}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`;
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

async function seedFileModified(fileIri: string, sessionId: string): Promise<void> {
  const s = `<urn:predicate:session:${sessionId}>`;
  const triples = `<${fileIri}> <https://predicate.dev/codebase#modifiedIn> ${s} .`;
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

async function seedCommand(
  cmdId: string,
  text: string,
  okSessions: string[],
  badSessions: string[],
): Promise<void> {
  const c = `<urn:predicate:cmd:${cmdId}>`;
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  let triples = `${c} a <https://predicate.dev/codebase#Command> .
                 ${c} <https://predicate.dev/codebase#commandText> "${escaped}" .`;
  for (const sid of okSessions) {
    triples += `\n${c} <https://predicate.dev/codebase#succeededIn> <urn:predicate:session:${sid}> .`;
  }
  for (const sid of badSessions) {
    triples += `\n${c} <https://predicate.dev/codebase#failedIn> <urn:predicate:session:${sid}> .`;
  }
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

describe('predicate recall', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('finds files whose path contains the query substring', async () => {
    await seedSession('ses-1', '2026-05-17T10:00:00Z');
    await seedSession('ses-2', '2026-05-17T11:00:00Z');
    await seedFileModified('file:///work/auth.ts', 'ses-1');
    await seedFileModified('file:///work/auth.ts', 'ses-2');
    await seedFileModified('file:///work/other.ts', 'ses-1');

    const code = await recall(['auth', '--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(out) as {
      query: string;
      files: Array<{ file: string; modifiedInSessions: number }>;
      commands: Array<unknown>;
    };
    expect(parsed.query).toBe('auth');
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]!.file).toContain('auth.ts');
    expect(parsed.files[0]!.modifiedInSessions).toBe(2);
  });

  it('finds commands whose commandText contains the query substring and tallies ok/fail', async () => {
    await seedSession('ses-1', '2026-05-17T10:00:00Z');
    await seedSession('ses-2', '2026-05-17T11:00:00Z');
    await seedSession('ses-3', '2026-05-17T12:00:00Z');
    await seedCommand('c1', 'pnpm test', [], ['ses-1', 'ses-2']);
    await seedCommand('c2', 'ls -la', ['ses-3'], []);

    const code = await recall(['pnpm', 'test', '--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(out) as {
      query: string;
      files: Array<unknown>;
      commands: Array<{ commandText: string; succeeded: number; failed: number }>;
    };
    expect(parsed.query).toBe('pnpm test');
    expect(parsed.commands).toHaveLength(1);
    expect(parsed.commands[0]!.commandText).toBe('pnpm test');
    expect(parsed.commands[0]!.failed).toBe(2);
    expect(parsed.commands[0]!.succeeded).toBe(0);
  });

  it('returns empty arrays when query matches nothing', async () => {
    await seedSession('ses-1', '2026-05-17T10:00:00Z');
    await seedFileModified('file:///work/auth.ts', 'ses-1');
    const code = await recall(['nonexistent', '--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(out) as { files: unknown[]; commands: unknown[] };
    expect(parsed.files).toHaveLength(0);
    expect(parsed.commands).toHaveLength(0);
  });

  it('renders a human-readable summary with file and command counts', async () => {
    await seedSession('ses-1', '2026-05-17T10:00:00Z');
    await seedFileModified('file:///work/auth.ts', 'ses-1');
    await seedCommand('c1', 'auth-rotate-keys', ['ses-1'], []);
    const code = await recall(['auth']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('recall "auth"');
    expect(out).toContain('Files');
    expect(out).toContain('auth.ts');
    expect(out).toContain('Commands');
    expect(out).toContain('auth-rotate-keys');
  });

  it('prints a friendly message when nothing matches in human mode', async () => {
    const code = await recall(['nomatch']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('no files or commands matched');
  });

  it('returns exit code 2 when called with no args', async () => {
    const code = await recall([]);
    expect(code).toBe(2);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate recall');
  });

  it('--help prints usage and returns 0', async () => {
    const code = await recall(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate recall');
    expect(out).toContain('--limit');
    expect(out).toContain('--json');
  });

  it('honors --limit per category', async () => {
    await seedSession('ses-1', '2026-05-17T10:00:00Z');
    await seedFileModified('file:///work/auth1.ts', 'ses-1');
    await seedFileModified('file:///work/auth2.ts', 'ses-1');
    await seedFileModified('file:///work/auth3.ts', 'ses-1');
    const code = await recall(['auth', '--limit', '2', '--json']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(out) as { files: unknown[] };
    expect(parsed.files).toHaveLength(2);
  });
});
