import { SparqlClient } from '../sparql/client.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';
import { buildProvenanceMeta } from '../provenance.js';

export interface Triple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string; datatype?: string };
  source: string;
  confidence: number;
  method: string;
}

function renderObject(obj: Triple['object']): string {
  if (obj.type === 'uri') return escapeIRI(obj.value);
  if (obj.datatype) return `${escapeLiteral(obj.value)}^^${escapeIRI(obj.datatype)}`;
  return escapeLiteral(obj.value);
}

export async function kgAssert(client: SparqlClient, t: Triple): Promise<void> {
  if (t.confidence < 0 || t.confidence > 1) {
    throw new Error(`confidence must be in [0,1], got ${t.confidence}`);
  }
  const meta = buildProvenanceMeta({
    source: t.source,
    confidence: t.confidence,
    method: t.method,
  });

  const s = escapeIRI(t.subject);
  const p = escapeIRI(t.predicate);
  const o = renderObject(t.object);

  const META_NS = 'https://predicate.dev/meta#';
  const aboxG = escapeIRI(GRAPH.abox);
  const provG = escapeIRI(GRAPH.provenance);
  const star = `<< ${s} ${p} ${o} >>`;

  await client.update(`
    PREFIX pred: <${META_NS}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH ${aboxG} { ${s} ${p} ${o} . }
      GRAPH ${provG} {
        ${star} pred:source     ${escapeLiteral(meta.source)} ;
                pred:confidence "${meta.confidence}"^^xsd:decimal ;
                pred:method     ${escapeLiteral(meta.method)} ;
                pred:timestamp  "${meta.timestamp}"^^xsd:dateTime .
      }
    }
  `);
}
