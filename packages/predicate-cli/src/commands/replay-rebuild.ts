import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://industriagents.com/predicate/meta#';

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
 * No backend accepts quoted triples (`<<>>`) in a DELETE *template*. The in-process
 * WASM adapter is handled via its quad API. Every other backend (native Oxigraph
 * daemon, Fuseki) uses two SPARQL passes that keep `<<>>` out of DELETE templates:
 * (1) delete the sole-source base triples from kg:abox, matching them via `<<>>` in
 * the WHERE clause (which IS accepted); (2) delete the provenance annotation quads by
 * binding the quoted triple to a plain variable `?qt` and deleting `?qt ?pp ?po`.
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

  // Pass 1: delete the sole-source base triples from kg:abox. The quoted triple
  // appears only in the WHERE clause (accepted by Oxigraph/Fuseki). Runs first,
  // while kg:provenance is still intact so the sole-source match is correct.
  await client.update(`
    PREFIX pred: <${META}>
    DELETE { GRAPH <kg:abox> { ?s ?p ?o } }
    WHERE {
      GRAPH <kg:provenance> { << ?s ?p ?o >> pred:source ${source} . }
      FILTER NOT EXISTS {
        GRAPH <kg:provenance> {
          << ?s ?p ?o >> pred:source ?other .
          FILTER (?other != ${source})
        }
      }
    }
  `);

  // Pass 2: delete the provenance annotation quads of those quoted triples. ?qt
  // binds to the quoted-triple subject, so no `<<>>` appears in the DELETE template.
  await client.update(`
    PREFIX pred: <${META}>
    DELETE { GRAPH <kg:provenance> { ?qt ?pp ?po } }
    WHERE {
      GRAPH <kg:provenance> {
        ?qt pred:source ${source} .
        ?qt ?pp ?po .
      }
      FILTER NOT EXISTS {
        GRAPH <kg:provenance> {
          ?qt pred:source ?other .
          FILTER (?other != ${source})
        }
      }
    }
  `);
}
