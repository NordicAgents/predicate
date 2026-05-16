import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { escapeIRI } from 'predicate-mcp/src/sparql/escape.js';
import type { GapReport, MissingPredicate, SubQuestion } from './types.js';

const C = 'https://predicate.dev/codebase#';

const REQUIRED_PREDICATES: Record<string, string[]> = {
  'why-broken':                [`${C}dependsOn`, `${C}lastModifiedIn`],
  'find-callers':              [`${C}calls`],
  'find-dependencies-direct':  [`${C}imports`],
  'find-dependencies-trans':   [`${C}dependsOn`],
  'find-readers-of':           [`${C}reads`],
  'find-symbol-in-file':       [`${C}declaredIn`],
};

function requiredPredicates(sq: SubQuestion): string[] {
  switch (sq.intent.kind) {
    case 'why-broken':         return REQUIRED_PREDICATES['why-broken']!;
    case 'find-callers':       return REQUIRED_PREDICATES['find-callers']!;
    case 'find-readers-of':    return REQUIRED_PREDICATES['find-readers-of']!;
    case 'find-symbol-in-file':return REQUIRED_PREDICATES['find-symbol-in-file']!;
    case 'find-dependencies':
      return sq.intent.payload.transitive === true
        ? REQUIRED_PREDICATES['find-dependencies-trans']!
        : REQUIRED_PREDICATES['find-dependencies-direct']!;
    case 'unknown':            return [];
    default:                   return [];
  }
}

export class GapDetector {
  constructor(private client: SparqlClient) {}

  async detect(sq: SubQuestion): Promise<GapReport> {
    if (sq.intent.kind === 'unknown') {
      return {
        subQuestionId: sq.id,
        answerable: false,
        missingPredicates: [{
          iri: '',
          reason: 'cannot decompose: question pattern not recognized by v1 decomposer',
        }],
      };
    }
    const required = requiredPredicates(sq);
    if (required.length === 0) {
      return { subQuestionId: sq.id, answerable: true, missingPredicates: [] };
    }
    const missing: MissingPredicate[] = [];
    for (const iri of required) {
      const present = await this.client.ask(`
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        ASK {
          GRAPH <kg:tbox> {
            ${escapeIRI(iri)} a ?t .
            FILTER (?t IN (owl:ObjectProperty, owl:DatatypeProperty,
                           owl:AnnotationProperty, rdf:Property))
          }
        }
      `);
      if (!present) {
        missing.push({ iri, reason: `predicate not declared in kg:tbox` });
      }
    }
    return {
      subQuestionId: sq.id,
      answerable: missing.length === 0,
      missingPredicates: missing,
    };
  }
}
