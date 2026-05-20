import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://predicate.dev/meta#';

/**
 * Delete the extraction-derived slice for one session from kg:abox + kg:provenance.
 * A triple is removed only when the session URI is its SOLE provenance source, so
 * facts the model also asserted directly (a different source) are preserved.
 */
export async function deleteExtractedSlice(
  client: StorageAdapter,
  sessionId: string,
): Promise<void> {
  const source = escapeLiteral(`urn:predicate:session:${sessionId}`);
  await client.update(`
    PREFIX pred: <${META}>
    DELETE {
      GRAPH <kg:abox> { ?s ?p ?o }
      GRAPH <kg:provenance> { << ?s ?p ?o >> ?pp ?po }
    }
    WHERE {
      GRAPH <kg:provenance> {
        << ?s ?p ?o >> pred:source ${source} .
        << ?s ?p ?o >> ?pp ?po .
      }
      FILTER NOT EXISTS {
        GRAPH <kg:provenance> {
          << ?s ?p ?o >> pred:source ?other .
          FILTER (?other != ${source})
        }
      }
    }
  `);
}
