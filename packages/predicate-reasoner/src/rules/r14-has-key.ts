import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
import { closureEligible } from '../closure.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_SAMEAS = 'http://www.w3.org/2002/07/owl#sameAs';

/** SPARQL SELECT bindings arrive as bare strings; re-tag non-IRI values as
 *  literals so explain's isAsserted renders them quoted instead of as IRIs. */
const asObject = (val: string): Quad['o'] =>
  /^(https?|urn):/.test(val) ? val : { value: val };

export const r14: Rule = {
  id: 'r14-has-key',
  name: 'owl:hasKey (single-property keys) → owl:sameAs',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?C owl:hasKey ?list .
        ?list rdf:first ?p ; rdf:rest rdf:nil .
      }
      {
        { GRAPH <${cfg.aboxGraphs[0] ?? 'kg:abox-fallback'}> { ?x1 rdf:type ?C } }
        UNION { GRAPH <${cfg.inferredGraph}> { ?x1 rdf:type ?C } }
      }
      {
        { GRAPH <${cfg.aboxGraphs[0] ?? 'kg:abox-fallback'}> { ?x2 rdf:type ?C } }
        UNION { GRAPH <${cfg.inferredGraph}> { ?x2 rdf:type ?C } }
      }
      ${closureEligible('?x1', '?p', '?v', cfg)}
      ${closureEligible('?x2', '?p', '?v', cfg)}
      FILTER (str(?x1) < str(?x2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    }
  `,
  backward: {
    // A key-derived co-reference is explained by: both subjects typed as the
    // keyed class, and both carrying the same key value. Needed so the full
    // cross-record conflict chain (r14 → r23 → r22) is kg_explain-able.
    matches: (q: Quad) => q.p === OWL_SAMEAS,
    premiseQuery: (q: Quad) => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?C ?p ?v WHERE {
          GRAPH <kg:tbox> {
            ?C owl:hasKey ?list .
            ?list rdf:first ?p ; rdf:rest rdf:nil .
          }
          {
            { GRAPH <kg:abox> { <${q.s}> rdf:type ?C } }
            UNION { GRAPH <kg:inferred> { <${q.s}> rdf:type ?C } }
          }
          {
            { GRAPH <kg:abox> { <${o}> rdf:type ?C } }
            UNION { GRAPH <kg:inferred> { <${o}> rdf:type ?C } }
          }
          {
            { GRAPH <kg:abox> { <${q.s}> ?p ?v } }
            UNION { GRAPH <kg:inferred> { <${q.s}> ?p ?v } }
          }
          {
            { GRAPH <kg:abox> { <${o}> ?p ?v } }
            UNION { GRAPH <kg:inferred> { <${o}> ?p ?v } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      const keyVal = asObject(binding.v!);
      return [
        { s: q.s, p: RDF_TYPE, o: binding.C! },
        { s: o, p: RDF_TYPE, o: binding.C! },
        { s: q.s, p: binding.p!, o: keyVal },
        { s: o, p: binding.p!, o: keyVal },
      ];
    },
  },
};
