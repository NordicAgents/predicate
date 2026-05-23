import type { StorageAdapter } from '../storage/index.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';
import { buildProvenanceMeta } from '../provenance.js';
import { markAboxDirty } from '../materialize.js';

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
  for (const field of ['subject', 'predicate', 'source', 'method'] as const) {
    const v = (t as unknown as Record<string, unknown>)[field];
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(
        `kg_assert: "${field}" must be a non-empty string, got ${JSON.stringify(v)}`,
      );
    }
  }
  if (typeof t.confidence !== 'number' || Number.isNaN(t.confidence) || t.confidence < 0 || t.confidence > 1) {
    throw new Error(`kg_assert: "confidence" must be a number in [0,1], got ${JSON.stringify(t.confidence)}`);
  }
  const o0 = t.object as unknown;
  if (
    o0 === null || typeof o0 !== 'object' ||
    typeof (o0 as { value?: unknown }).value !== 'string' ||
    ((o0 as { type?: unknown }).type !== 'uri' && (o0 as { type?: unknown }).type !== 'literal')
  ) {
    throw new Error(
      `kg_assert: object must be {type:"uri"|"literal", value:string, datatype?:string}, got ${JSON.stringify(t.object)}`,
    );
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

  const META_NS = 'https://industriagents.com/predicate/meta#';
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
  await markAboxDirty(client);
}
