import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { bootstrapGraphs } from '../src/bootstrap.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

describe('bootstrapGraphs', () => {
  it('creates all 9 named graphs on a fresh store', async () => {
    const adapter = new OxigraphAdapter({ storePath: ':memory:' });
    await bootstrapGraphs(adapter);
    // CREATE SILENT GRAPH does not produce any triples, so we verify via
    // a per-graph ASK that the graph exists and is empty.
    for (const g of Object.values(GRAPH)) {
      const has = await adapter.ask(`ASK { GRAPH <${g}> { ?s ?p ?o } }`);
      expect(has).toBe(false);
    }
  });
});
