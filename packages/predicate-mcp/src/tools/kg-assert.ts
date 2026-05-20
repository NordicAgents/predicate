import type { StorageAdapter } from '../storage/index.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';
import { buildProvenanceMeta } from '../provenance.js';

const ALWAYS_ALLOWED_PREDICATES = new Set<string>([
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
]);

async function predicateIsDeclared(client: StorageAdapter, p: string): Promise<boolean> {
  return client.ask(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    ASK {
      { GRAPH ${escapeIRI(GRAPH.tbox)}         { ${escapeIRI(p)} a ?t } }
      UNION
      { GRAPH ${escapeIRI(GRAPH.tboxStaging)}  { ${escapeIRI(p)} a ?t } }
      FILTER (?t IN (owl:ObjectProperty, owl:DatatypeProperty,
                     owl:AnnotationProperty, rdf:Property))
    }
  `);
}

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

export async function kgAssert(client: StorageAdapter, t: Triple): Promise<void> {
  if (t.confidence < 0 || t.confidence > 1) {
    throw new Error(`confidence must be in [0,1], got ${t.confidence}`);
  }
  if (!ALWAYS_ALLOWED_PREDICATES.has(t.predicate)) {
    if (!(await predicateIsDeclared(client, t.predicate))) {
      throw new Error(
        `Predicate ${t.predicate} is not declared in kg:tbox or kg:tbox-staging. ` +
        `Call kg_explore_schema first, or kg_propose_schema if the predicate doesn't exist yet.`,
      );
    }
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
