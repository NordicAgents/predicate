import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { init } from '../src/commands/init.js';

const client = getAdapter();

async function fullReset(): Promise<void> {
  for (const g of ['kg:tbox', 'kg:tbox-staging', 'kg:abox', 'kg:inferred', 'kg:provenance', 'kg:goals', 'kg:usage', 'kg:meta']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
}

describe('predicate init — judgment overlay', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await fullReset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('--mode empty loads j:Judgment into kg:tbox', async () => {
    const code = await init(['--mode', 'empty']);
    expect(code).toBe(0);
    const ok = await client.ask(`
      PREFIX j:   <https://predicate.dev/judgment#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { j:Judgment a owl:Class } }
    `);
    expect(ok).toBe(true);
  });

  it('--mode community --ontology codebase loads j:Judgment into kg:tbox', async () => {
    const code = await init(['--mode', 'community', '--ontology', 'codebase']);
    expect(code).toBe(0);
    const ok = await client.ask(`
      PREFIX j:   <https://predicate.dev/judgment#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { j:Judgment a owl:Class } }
    `);
    expect(ok).toBe(true);
  });
});
