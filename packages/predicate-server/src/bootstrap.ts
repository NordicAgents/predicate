import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

const ALL_GRAPHS = Object.values(GRAPH);

export async function bootstrapGraphs(adapter: StorageAdapter): Promise<void> {
  await adapter.ready();
  for (const g of ALL_GRAPHS) {
    // CREATE SILENT is the portable way to declare an empty graph; both Fuseki
    // and Oxigraph honor SPARQL 1.1 graph-management semantics.
    await adapter.update(`CREATE SILENT GRAPH <${g}>`);
  }
}
