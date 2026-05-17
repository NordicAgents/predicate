import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { sessionstart } from '../src/commands/sessionstart.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

describe('predicate sessionstart', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // Bootstrap a minimal kg:tbox so the count is non-zero
    const client = new SparqlClient(loadConfig());
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
    const client = new SparqlClient(loadConfig());
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

  it('returns 0 and prints a fallback message when fuseki is unreachable', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orig = process.env['FUSEKI_URL'];
    process.env['FUSEKI_URL'] = 'http://127.0.0.1:1';  // unreachable
    try {
      const code = await sessionstart();
      expect(code).toBe(0);
      const line = logSpy.mock.calls[0]![0] as string;
      expect(line).toContain('not reachable');
    } finally {
      if (orig !== undefined) process.env['FUSEKI_URL'] = orig;
      else delete process.env['FUSEKI_URL'];
    }
  });
});
