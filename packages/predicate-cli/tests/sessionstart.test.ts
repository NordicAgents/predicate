import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { sessionstart } from '../src/commands/sessionstart.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { _resetAdapterCache } from 'predicate-mcp/src/storage/factory.js';

const isFuseki = (process.env['PREDICATE_BACKEND'] ?? 'fuseki') === 'fuseki';

describe('predicate sessionstart', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // Bootstrap a minimal kg:tbox so the count is non-zero
    const client = getAdapter();
    await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
    await client.update(`CREATE SILENT GRAPH <kg:goals>`);
    await client.update(`CREATE SILENT GRAPH <kg:abox>`);
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errSpy?.mockRestore();
  });

  it('prints a single-line summary with goals + classes counts when fuseki is reachable', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await sessionstart();
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]![0] as string;
    expect(line).toMatch(/^Predicate ready: \d+ active goals, \d+ TBox classes\./);
    expect(line).toContain('kg_explore_schema');
  });

  it('mentions prior sessions when kg:abox has Session entities', async () => {
    const client = getAdapter();
    await client.update(`
      INSERT DATA { GRAPH <kg:abox> {
        <urn:predicate:session:test-prior> a <https://predicate.dev/meta#Session> .
      } }
    `);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const code = await sessionstart();
      expect(code).toBe(0);
      const line = logSpy.mock.calls[0]![0] as string;
      expect(line).toContain('prior session');
    } finally {
      await client.update(`
        DELETE DATA { GRAPH <kg:abox> {
          <urn:predicate:session:test-prior> a <https://predicate.dev/meta#Session> .
        } }
      `);
    }
  });

  it('includes ontology name in banner when init config exists', async () => {
    const client = getAdapter();
    await client.update(`
      PREFIX pred: <https://predicate.dev/meta#>
      INSERT DATA { GRAPH <kg:meta> {
        <urn:predicate:config> a pred:Config ; pred:initOntology "codebase" .
      } }
    `);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await sessionstart();
      const line = logSpy.mock.calls[0]![0] as string;
      expect(line).toContain('(codebase ontology)');
    } finally {
      await client.update(`
        PREFIX pred: <https://predicate.dev/meta#>
        DELETE WHERE { GRAPH <kg:meta> { <urn:predicate:config> ?p ?o } }
      `);
    }
  });

  it.skipIf(!isFuseki)('returns 0 and prints a fallback message when fuseki is unreachable', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orig = process.env['FUSEKI_URL'];
    process.env['FUSEKI_URL'] = 'http://127.0.0.1:1';  // unreachable
    _resetAdapterCache();  // force new adapter with the updated URL
    try {
      const code = await sessionstart();
      expect(code).toBe(0);
      const line = logSpy.mock.calls[0]![0] as string;
      expect(line).toContain('not reachable');
    } finally {
      if (orig !== undefined) process.env['FUSEKI_URL'] = orig;
      else delete process.env['FUSEKI_URL'];
      _resetAdapterCache();  // restore cache for subsequent tests
    }
  });
});
