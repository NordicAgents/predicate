import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
  })),
}));

import { extract } from '../src/commands/extract.js';

const client = getAdapter();
const C = 'https://predicate.dev/codebase#';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function aboxCount(): Promise<number> {
  const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }');
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

function writeTranscript(dir: string, sessionId: string): void {
  const events = [
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/work/auth.ts' } },
    ]}},
    { type: 'user', message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
    ]}},
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'pnpm test' } },
    ]}},
    { type: 'user', message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't2', content: 'PASS' },
    ]}},
  ];
  writeFileSync(join(dir, `${sessionId}.jsonl`), events.map((e) => JSON.stringify(e)).join('\n'));
}

describe('predicate extract --replay', () => {
  let dir: string;
  beforeAll(async () => { await withCodebaseTBox(client); });
  beforeEach(async () => {
    await reset('kg:abox'); await reset('kg:provenance'); await reset('kg:inferred');
    dir = mkdtempSync(join(tmpdir(), 'replay-'));
  });

  it('rebuilds the abox slice and is idempotent across two replays', async () => {
    writeTranscript(dir, 'sess1');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(await extract(['--replay', dir])).toBe(0);
    const after1 = await aboxCount();
    expect(after1).toBeGreaterThan(0);

    expect(await extract(['--replay', dir])).toBe(0);
    const after2 = await aboxCount();
    expect(after2).toBe(after1); // no duplication

    log.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('preserves a model-authored fact (non-session source) across replay', async () => {
    await kgAssert(client, {
      subject: 'file:///work/manual.ts', predicate: `${C}modifiedIn`,
      object: { type: 'uri', value: 'urn:predicate:session:HUMAN' },
      source: 'manual', confidence: 1, method: 'human',
    });
    writeTranscript(dir, 'sess2');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(await extract(['--replay', dir])).toBe(0);
    const r = await client.select(
      `SELECT ?o WHERE { GRAPH <kg:abox> { <file:///work/manual.ts> <${C}modifiedIn> ?o } }`,
    );
    expect(r.results.bindings).toHaveLength(1); // manual fact survived

    log.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('errors with exit 2 when the path has no .jsonl files', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await extract(['--replay', dir])).toBe(2);
    err.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('all-malformed dir returns 1 and does not wipe existing kg:inferred', async () => {
    // seed kg:inferred with a sentinel triple
    await client.update('INSERT DATA { GRAPH <kg:inferred> { <urn:x:s> <urn:x:p> <urn:x:o> } }');
    // a transcript file with an unparseable JSON line
    writeFileSync(join(dir, 'broken.jsonl'), '{ this is not json');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(await extract(['--replay', dir])).toBe(1); // sessions===0 && errors>0

    const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:inferred> { ?s ?p ?o } }');
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1); // sentinel NOT wiped

    err.mockRestore(); log.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });
});
