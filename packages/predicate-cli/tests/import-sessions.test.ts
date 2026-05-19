import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

import { importSessions } from '../src/commands/import-sessions.js';

// import-sessions uses Fuseki's HTTP data-upload endpoint directly (not via the storage adapter).
// Skip these tests when running against the Oxigraph in-memory backend.
const isFuseki = (process.env['PREDICATE_BACKEND'] ?? 'fuseki') === 'fuseki';

const client = getAdapter();
const IMPORT_GRAPH = 'urn:predicate:import:test-peer';

async function dropImportGraph(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${IMPORT_GRAPH}>`);
}

describe('predicate import-sessions', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await dropImportGraph();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    await dropImportGraph();
  });

  it.skipIf(!isFuseki)('loads a TriG file into Fuseki preserving the named graph', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'predicate-import-'));
    const file = join(dir, 'peer.trig');
    const trig = `<${IMPORT_GRAPH}> {
      <urn:predicate:session:ses-import-a> a <https://predicate.dev/meta#Session> ;
        <https://predicate.dev/meta#sessionId> "ses-import-a" ;
        <https://predicate.dev/meta#at> "2026-05-16T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    }`;
    writeFileSync(file, trig, 'utf8');

    const code = await importSessions([file]);
    expect(code).toBe(0);

    const r = await client.select(
      `SELECT ?s WHERE { GRAPH <${IMPORT_GRAPH}> { ?s a <https://predicate.dev/meta#Session> } }`,
    );
    expect(r.results.bindings).toHaveLength(1);
    expect(r.results.bindings[0]!['s']!.value).toBe('urn:predicate:session:ses-import-a');
  });

  it('--help prints usage and returns 0', async () => {
    const code = await importSessions(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate import-sessions');
    expect(out).toContain('TriG');
  });
});
