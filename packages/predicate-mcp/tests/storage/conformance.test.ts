import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { StorageAdapter } from '../../src/storage/adapter.js';

// Set by the caller before importing. We pick the adapter via env so this same
// file runs under both BACKEND=fuseki and BACKEND=oxigraph in CI. Defaults to
// the same backend as the rest of the suite (Oxigraph, no Docker); the Fuseki
// leg runs only when explicitly requested via BACKEND/PREDICATE_BACKEND.
const BACKEND = process.env.BACKEND ?? process.env.PREDICATE_BACKEND ?? 'oxigraph';

// storePath used by the oxigraph-server branch; captured here so afterAll can
// call stop() on the same path without closing the shared production daemon.
let _oxigraphServerStorePath: string | null = null;

async function makeAdapter(): Promise<StorageAdapter> {
  if (BACKEND === 'fuseki') {
    const { FusekiAdapter } = await import('../../src/storage/fuseki.js');
    const { loadConfig } = await import('../../src/config.js');
    return new FusekiAdapter(loadConfig());
  }
  if (BACKEND === 'oxigraph-server') {
    const { OxigraphServerAdapter } = await import('../../src/storage/oxigraph-server.js');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const storePath = join(tmpdir(), `predicate-conformance-${process.pid}`);
    _oxigraphServerStorePath = storePath;
    return new OxigraphServerAdapter({ storePath });
  }
  if (BACKEND === 'oxigraph') {
    const { OxigraphAdapter } = await import('../../src/storage/oxigraph.js');
    return new OxigraphAdapter({ storePath: ':memory:' });
  }
  throw new Error(`unknown BACKEND=${BACKEND}`);
}

describe(`StorageAdapter conformance (BACKEND=${BACKEND})`, () => {
  let adapter: StorageAdapter;

  beforeAll(async () => {
    adapter = await makeAdapter();
    await adapter.ready();
    for (const g of ['kg:a', 'kg:b']) await adapter.clearGraph(g);
  });

  afterAll(async () => {
    await adapter.close();
    // For the oxigraph-server backend, stop the test-spawned daemon and clean up
    // the temp store. This is safe because the store path is unique to this
    // process (includes process.pid), so it cannot be the shared production daemon.
    if (_oxigraphServerStorePath !== null) {
      const { stop } = await import('../../src/storage/oxigraph-daemon.js');
      await stop(_oxigraphServerStorePath);
    }
  });

  it('round-trips a triple via update + select', async () => {
    await adapter.update(`INSERT DATA { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`);
    const r = await adapter.select(
      `SELECT ?o WHERE { GRAPH <kg:a> { <urn:s> <urn:p> ?o } }`,
    );
    expect(r.results.bindings.map((b) => b['o']!.value)).toEqual(['v']);
  });

  it('ask returns boolean', async () => {
    expect(await adapter.ask(`ASK { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`)).toBe(true);
    expect(await adapter.ask(`ASK { GRAPH <kg:a> { <urn:s> <urn:p> "missing" } }`)).toBe(false);
  });

  it('isolates named graphs', async () => {
    await adapter.update(`INSERT DATA { GRAPH <kg:b> { <urn:x> <urn:p> "in-b" } }`);
    const a = await adapter.ask(`ASK { GRAPH <kg:a> { <urn:x> <urn:p> "in-b" } }`);
    expect(a).toBe(false);
    const b = await adapter.ask(`ASK { GRAPH <kg:b> { <urn:x> <urn:p> "in-b" } }`);
    expect(b).toBe(true);
  });

  it('clearGraph empties only the target', async () => {
    await adapter.clearGraph('kg:a');
    const a = await adapter.ask(`ASK { GRAPH <kg:a> { ?s ?p ?o } }`);
    expect(a).toBe(false);
    const b = await adapter.ask(`ASK { GRAPH <kg:b> { ?s ?p ?o } }`);
    expect(b).toBe(true);
  });

  it('loadTurtle + serializeGraph round-trip', async () => {
    await adapter.clearGraph('kg:a');
    await adapter.loadTurtle(
      `<urn:s1> <urn:p1> "v1" .\n<urn:s2> <urn:p1> "v2" .\n`,
      'kg:a',
    );
    const out = await adapter.serializeGraph('kg:a', 'nt');
    expect(out).toContain('<urn:s1> <urn:p1> "v1"');
    expect(out).toContain('<urn:s2> <urn:p1> "v2"');
  });

  it('knownGraphs lists graphs with kg: prefix', async () => {
    const gs = await adapter.knownGraphs();
    expect(gs).toContain('kg:a');
    expect(gs).toContain('kg:b');
  });
});
