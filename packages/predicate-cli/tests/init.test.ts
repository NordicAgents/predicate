import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { init } from '../src/commands/init.js';

const client = getAdapter();
const FIXTURES = join(__dirname, 'fixtures');

async function fullReset(): Promise<void> {
  for (const g of ['kg:tbox', 'kg:tbox-staging', 'kg:abox', 'kg:inferred', 'kg:provenance', 'kg:goals', 'kg:usage', 'kg:meta']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
}

async function configExists(): Promise<boolean> {
  return client.ask(
    `PREFIX pred: <https://industriagents.com/predicate/meta#>
     ASK { GRAPH <kg:meta> { <urn:predicate:config> a pred:Config } }`,
  );
}

describe('predicate init', () => {
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

  it('--mode community --ontology codebase loads codebase.ttl + meta', async () => {
    const code = await init(['--mode', 'community', '--ontology', 'codebase']);
    expect(code).toBe(0);
    expect(await configExists()).toBe(true);
    const cb = await client.ask(
      `PREFIX cb: <https://industriagents.com/predicate/codebase#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }`,
    );
    expect(cb).toBe(true);
  });

  it('--mode upload --file good.ttl loads the file', async () => {
    const code = await init(['--mode', 'upload', '--file', join(FIXTURES, 'good.ttl')]);
    expect(code).toBe(0);
    const ok = await client.ask(
      `ASK { GRAPH <kg:tbox> { <https://example.com/test#Widget> a <http://www.w3.org/2002/07/owl#Class> } }`,
    );
    expect(ok).toBe(true);
  });

  it('--mode upload --file bad-prefix.ttl rejects (uses pred: namespace)', async () => {
    const code = await init(['--mode', 'upload', '--file', join(FIXTURES, 'bad-prefix.ttl')]);
    expect(code).toBe(1);
    const errOutput = errSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(errOutput).toMatch(/reserved.*pred:/i);
    expect(await configExists()).toBe(false);
  });

  it('--mode empty loads meta + top only', async () => {
    const code = await init(['--mode', 'empty']);
    expect(code).toBe(0);
    const top = await client.ask(
      `ASK { GRAPH <kg:tbox> { <https://industriagents.com/predicate/top#Thing> a <http://www.w3.org/2002/07/owl#Class> } }`,
    );
    expect(top).toBe(true);
  });

  it('refuses re-init without --force', async () => {
    await init(['--mode', 'empty']);
    const code = await init(['--mode', 'community', '--ontology', 'codebase']);
    expect(code).toBe(2);
    const err = errSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/already initialized/i);
  });

  it('--force wipes and re-inits', async () => {
    await init(['--mode', 'empty']);
    const code = await init(['--mode', 'community', '--ontology', 'codebase', '--force']);
    expect(code).toBe(0);
    const cb = await client.ask(
      `PREFIX cb: <https://industriagents.com/predicate/codebase#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }`,
    );
    expect(cb).toBe(true);
  });

  it('--mode community --ontology nonexistent fails with helpful message', async () => {
    const code = await init(['--mode', 'community', '--ontology', 'nope']);
    expect(code).toBe(2);
    const err = errSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/unknown ontology/i);
  });

  // v2.0.1 regression: init now WIPES kg:tbox before loading, even when no
  // config exists. Without this fix, residual TBox triples from a prior
  // partial install would leak into the new ontology selection.
  it('--mode empty wipes kg:tbox before loading (no codebase residue from prior install)', async () => {
    // Seed kg:tbox with stale codebase triples but leave kg:meta empty
    // (the partial-migration state that bit a real v2.0.0 user).
    await client.update(`
      PREFIX cb:  <https://industriagents.com/predicate/codebase#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <kg:tbox> { cb:File a owl:Class . cb:Function a owl:Class } }
    `);

    const code = await init(['--mode', 'empty']);
    expect(code).toBe(0);

    // Probe cb:Function: unlike cb:File (now declared in the always-loaded meta
    // vocab as session-history vocabulary), cb:Function lives only in codebase.ttl,
    // so it is the true indicator that stale residue survived the wipe.
    const stillHasCodebase = await client.ask(
      `PREFIX cb:  <https://industriagents.com/predicate/codebase#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { cb:Function a owl:Class } }`,
    );
    expect(stillHasCodebase).toBe(false);

    const hasTop = await client.ask(
      `PREFIX top: <https://industriagents.com/predicate/top#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { top:Thing a owl:Class } }`,
    );
    expect(hasTop).toBe(true);
  });

  // v2.0.1 regression: bad uploads must be rejected BEFORE the destructive
  // reset, so the user's previous TBox state survives an invalid upload.
  it('--force --mode upload with bad-prefix.ttl does NOT destroy previous TBox', async () => {
    await init(['--mode', 'community', '--ontology', 'codebase']);
    const codebaseWasLoaded = await client.ask(
      `PREFIX cb:  <https://industriagents.com/predicate/codebase#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }`,
    );
    expect(codebaseWasLoaded).toBe(true);

    const code = await init(['--force', '--mode', 'upload', '--file', join(FIXTURES, 'bad-prefix.ttl')]);
    expect(code).toBe(1);

    const codebaseStillThere = await client.ask(
      `PREFIX cb:  <https://industriagents.com/predicate/codebase#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }`,
    );
    expect(codebaseStillThere, 'rejected upload must not destroy previous TBox').toBe(true);

    const cfg = await client.select(
      `PREFIX pred: <https://industriagents.com/predicate/meta#>
       SELECT ?o WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:initOntology ?o } }`,
    );
    expect(cfg.results.bindings[0]?.o?.value).toBe('codebase');
  });

  it('--help prints usage', async () => {
    const code = await init(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate init');
    expect(out).toContain('community');
    expect(out).toContain('upload');
    expect(out).toContain('empty');
  });
});
