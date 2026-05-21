import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://predicate.dev/meta#';

type SparqlBinding = { type: string; value: string; datatype?: string };

function renderObject(o: SparqlBinding): string {
  if (o.type === 'uri') return escapeIRI(o.value);
  return o.datatype
    ? `${escapeLiteral(o.value)}^^${escapeIRI(o.datatype)}`
    : escapeLiteral(o.value);
}

/**
 * Delete the extraction-derived slice for one session from kg:abox + kg:provenance.
 * A triple is removed only when the session URI is its SOLE provenance source, so
 * facts the model also asserted directly (a different source) are preserved.
 *
 * Oxigraph 0.5.x cannot express `<<>>`-quoted triples in SPARQL Update, so on that
 * backend we SELECT the sole-source triples (queries do allow `<<>>`), delete each
 * base triple with plain `DELETE DATA`, and strip the provenance annotations via the
 * quad API. On Fuseki the original single-pass SPARQL DELETE is used.
 */
export async function deleteExtractedSlice(
  client: StorageAdapter,
  sessionId: string,
): Promise<void> {
  const source = escapeLiteral(`urn:predicate:session:${sessionId}`);

  if (client instanceof OxigraphAdapter) {
    const matches = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?s ?p ?o WHERE {
        GRAPH <kg:provenance> { << ?s ?p ?o >> pred:source ${source} . }
        FILTER NOT EXISTS {
          GRAPH <kg:provenance> {
            << ?s ?p ?o >> pred:source ?other .
            FILTER (?other != ${source})
          }
        }
      }
    `);
    const triples = matches.results.bindings.map((b) => ({
      s: b['s']!.value,
      p: b['p']!.value,
      o: b['o']!.value,
    }));
    for (const b of matches.results.bindings) {
      const s = escapeIRI(b['s']!.value);
      const p = escapeIRI(b['p']!.value);
      const o = renderObject(b['o'] as SparqlBinding);
      await client.update(`DELETE DATA { GRAPH <kg:abox> { ${s} ${p} ${o} } }`);
    }
    client.deleteRdfStarProvenanceForTriples('kg:provenance', triples);
    return;
  }

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
