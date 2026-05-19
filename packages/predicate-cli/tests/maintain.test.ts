import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { maintain } from '../src/commands/maintain.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { _resetAdapterCache } from 'predicate-mcp/src/storage/factory.js';

describe('predicate maintain', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    const client = getAdapter();
    await client.update(`CREATE SILENT GRAPH <kg:abox>`);
    await client.update(`CREATE SILENT GRAPH <kg:provenance>`);
    await client.update(`CREATE SILENT GRAPH <kg:meta>`);
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errSpy?.mockRestore();
  });

  it('runs the maintenance pass and prints a one-line summary', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await maintain();
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]![0] as string;
    expect(line).toMatch(/^predicate maintain: archived=\d+ proposals=\d+ promotions=\d+ inferred=\d+ elapsed=\d+ms event=urn:predicate:event:/);
  });

  it('returns 1 and prints to stderr when fuseki is unreachable', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orig = process.env['FUSEKI_URL'];
    process.env['FUSEKI_URL'] = 'http://127.0.0.1:1';
    _resetAdapterCache();  // force new adapter with the updated URL
    try {
      const code = await maintain();
      expect(code).toBe(1);
      expect(errSpy).toHaveBeenCalled();
      const errLine = errSpy.mock.calls[0]![0] as string;
      expect(errLine).toContain('predicate maintain failed');
    } finally {
      if (orig !== undefined) process.env['FUSEKI_URL'] = orig;
      else delete process.env['FUSEKI_URL'];
      _resetAdapterCache();  // restore cache for subsequent tests
    }
  });
});
