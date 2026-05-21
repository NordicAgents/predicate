import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OxigraphAdapter } from '../src/storage/index.js';

describe('OxigraphAdapter.close persistence', () => {
  it('flushes a freshly-written triple to disk so a reopened adapter sees it', async () => {
    const store = mkdtempSync(join(tmpdir(), 'pred-close-'));
    const w = new OxigraphAdapter({ storePath: store });
    await w.ready();
    await w.update('INSERT DATA { GRAPH <kg:abox> { <urn:s> <urn:p> <urn:o> } }');
    await w.close();
    const r = new OxigraphAdapter({ storePath: store });
    await r.ready();
    const survived = await r.ask('ASK { GRAPH <kg:abox> { <urn:s> <urn:p> <urn:o> } }');
    await r.close();
    expect(survived).toBe(true);
    rmSync(store, { recursive: true, force: true });
  });
});
