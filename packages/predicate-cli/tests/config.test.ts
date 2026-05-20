import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { config } from '../src/commands/config.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

describe('predicate config', () => {
  beforeEach(async () => { await reset('kg:meta'); });

  it('set then get round-trips a boolean key', async () => {
    expect(await config(['set', 'schema-learning', 'false'])).toBe(0);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await config(['get', 'schema-learning'])).toBe(0);
    expect(log.mock.calls.flat().join(' ')).toContain('false');
    log.mockRestore();
  });

  it('rejects an unknown key with exit 2', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await config(['set', 'nope', 'x'])).toBe(2);
    err.mockRestore();
  });

  it('rejects a non-boolean schema-learning value with exit 2', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await config(['set', 'schema-learning', 'maybe'])).toBe(2);
    err.mockRestore();
  });

  it('prints help with exit 0', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await config(['--help'])).toBe(0);
    expect(log.mock.calls.flat().join(' ')).toContain('predicate config');
    log.mockRestore();
  });

  it('get with no key returns the full config using kebab keys', async () => {
    expect(await config(['set', 'schema-learning', 'true'])).toBe(0);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await config(['get'])).toBe(0);
    const out = log.mock.calls.flat().join(' ');
    expect(out).toContain('schema-learning');
    expect(out).not.toContain('schemaLearningEnabled');
    log.mockRestore();
  });

  it('get with an unknown key exits 2', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await config(['get', 'bogus'])).toBe(2);
    err.mockRestore();
  });
});
