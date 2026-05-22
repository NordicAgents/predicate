import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { StorageAdapter } from '../../src/storage/adapter.js';

// Defaults to the same backend as the rest of the suite (Oxigraph, no Docker);
// the Fuseki leg runs only when explicitly requested via BACKEND/PREDICATE_BACKEND.
const BACKEND = process.env.BACKEND ?? process.env.PREDICATE_BACKEND ?? 'oxigraph';

async function makeAdapter(): Promise<StorageAdapter> {
  if (BACKEND === 'fuseki') {
    const { FusekiAdapter } = await import('../../src/storage/fuseki.js');
    const { loadConfig } = await import('../../src/config.js');
    return new FusekiAdapter(loadConfig());
  }
  if (BACKEND === 'oxigraph' || BACKEND === 'oxigraph-wasm') {
    const { OxigraphAdapter } = await import('../../src/storage/oxigraph.js');
    return new OxigraphAdapter({ storePath: ':memory:' });
  }
  throw new Error(`unknown BACKEND=${BACKEND}`);
}

describe(`RDF-star (BACKEND=${BACKEND})`, () => {
  let adapter: StorageAdapter;

  beforeAll(async () => {
    adapter = await makeAdapter();
    await adapter.ready();
    await adapter.clearGraph('kg:star');
  });

  afterAll(async () => {
    await adapter.close();
  });

  it('stores and queries a quoted triple as subject', async () => {
    await adapter.update(`
      PREFIX prov: <http://www.w3.org/ns/prov#>
      INSERT DATA { GRAPH <kg:star> {
        << <urn:s> <urn:p> "o" >> prov:wasDerivedFrom <urn:source-1> .
      } }
    `);

    const r = await adapter.select(`
      PREFIX prov: <http://www.w3.org/ns/prov#>
      SELECT ?src WHERE { GRAPH <kg:star> {
        << <urn:s> <urn:p> "o" >> prov:wasDerivedFrom ?src .
      } }
    `);
    expect(r.results.bindings.map((b) => b['src']!.value)).toEqual(['urn:source-1']);
  });
});
