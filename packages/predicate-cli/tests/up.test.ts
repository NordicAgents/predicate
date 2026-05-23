import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

vi.mock('../src/docker.js', () => ({
  findComposeDir: () => '/tmp',
  dockerAvailable: () => true,
  compose: () => Promise.resolve(0),
}));

import { up } from '../src/commands/up.js';

const client = getAdapter();

async function fullReset(): Promise<void> {
  for (const g of ['kg:tbox', 'kg:meta']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
}

describe('predicate up — v2.0 legacy migration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await fullReset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); errSpy.mockRestore(); });

  it('auto-adopts as codebase when kg:tbox has codebase:File but no config', async () => {
    // Simulate v1.13 state: codebase.ttl loaded, no config
    await client.update(`
      PREFIX cb:  <https://industriagents.com/predicate/codebase#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <kg:tbox> { cb:File a owl:Class } }
    `);
    await up();
    const configured = await client.ask(
      `PREFIX pred: <https://industriagents.com/predicate/meta#>
       ASK { GRAPH <kg:meta> { <urn:predicate:config> pred:initOntology "codebase" } }`,
    );
    expect(configured).toBe(true);

    // Regression: legacy adoption must also load the core meta vocab, or the
    // Stop-hook extractor's pred:sessionId / pred:at triples get rejected as
    // undeclared on every session.
    const hasMeta = await client.ask(
      `ASK { GRAPH <kg:tbox> { <https://industriagents.com/predicate/meta#sessionId> ?p ?o } }`,
    );
    expect(hasMeta).toBe(true);
  });

  it('skips init when config already exists', async () => {
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      INSERT DATA { GRAPH <kg:meta> {
        <urn:predicate:config> a pred:Config ; pred:initOntology "foaf" .
      } }
    `);
    await up();
    const r = await client.select(
      `PREFIX pred: <https://industriagents.com/predicate/meta#>
       SELECT ?o WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:initOntology ?o } }`,
    );
    expect(r.results.bindings[0]!.o!.value).toBe('foaf');  // unchanged
  });
});
