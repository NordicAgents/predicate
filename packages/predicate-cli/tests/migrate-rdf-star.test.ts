import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FusekiAdapter } from 'predicate-mcp/src/storage/fuseki.js';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

// Verifies that FusekiAdapter.serializeGraph('nt-star') requests text/turtle
// (Fuseki 5.x preserves RDF-star quoted-triple syntax in Turtle, not in
// application/n-triples-star which it doesn't support), and that the Turtle
// is faithfully ingested by OxigraphAdapter.loadTurtle so quoted-triple
// annotations survive the fuseki → oxigraph migration.
//
// We test the serialization + load round-trip directly (without calling
// migrate()) because migrate() iterates all GRAPH constants and the
// kg:provenance graph may have pre-existing data or state changes from
// concurrent tests. Testing serializeGraph + loadTurtle in isolation avoids
// that non-determinism while still exercising the exact code path that was
// broken (FusekiAdapter returning 406 when requesting nt-star format).

describe('FusekiAdapter → OxigraphAdapter preserves RDF-star annotations', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'predicate-migrate-star-'));
    process.env.PREDICATE_STORE_PATH = tmp;
  });

  afterEach(() => {
    delete process.env.PREDICATE_STORE_PATH;
    rmSync(tmp, { recursive: true, force: true });
  });

  it('round-trips a quoted-triple annotation via serializeGraph + loadTurtle', async () => {
    const cfg = loadConfig();
    const src = new FusekiAdapter(cfg);
    await src.ready();

    // Seed a quoted-triple annotation in kg:provenance.
    await src.clearGraph(GRAPH.provenance);
    await src.update(`
      INSERT DATA { GRAPH <${GRAPH.provenance}> {
        << <urn:s> <urn:p> "o" >> <urn:wasDerivedFrom> <urn:src-1> .
      } }
    `);

    // Verify the annotation is queryable in the source.
    const srcCheck = await src.select(`
      SELECT ?src WHERE { GRAPH <${GRAPH.provenance}> {
        << <urn:s> <urn:p> "o" >> <urn:wasDerivedFrom> ?src .
      } }
    `);
    expect(srcCheck.results.bindings.map((b) => b['src']!.value)).toEqual(['urn:src-1']);

    // Serialize in nt-star format. With the fix, FusekiAdapter requests
    // text/turtle (Fuseki 5.x embeds quoted-triple syntax in Turtle).
    // Before the fix it requested application/n-triples-star which returns 406.
    const serialized = await src.serializeGraph(GRAPH.provenance, 'nt-star');

    // The serialized content must contain the RDF-star quoted-triple syntax.
    expect(serialized).toContain('<<');
    expect(serialized).toContain('urn:src-1');

    // Load the serialized content into a fresh OxigraphAdapter (in-memory).
    const dst = new OxigraphAdapter({ storePath: ':memory:' });
    await dst.ready();
    await dst.loadTurtle(serialized, GRAPH.provenance);

    // Query the destination: the quoted triple must be intact.
    const r = await dst.select(`
      SELECT ?src WHERE { GRAPH <${GRAPH.provenance}> {
        << <urn:s> <urn:p> "o" >> <urn:wasDerivedFrom> ?src .
      } }
    `);
    expect(r.results.bindings.map((b) => b['src']!.value)).toEqual(['urn:src-1']);
    await dst.close();
  });
});
