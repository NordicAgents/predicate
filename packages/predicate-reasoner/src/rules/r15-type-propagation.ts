import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
import { closureEligible } from '../closure.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

export const r15: Rule = {
  id: 'r15-type-propagation',
  name: 'rdf:type propagation via rdfs:subClassOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    WHERE {
      ${closureEligible('?x', 'rdf:type', '?C', cfg)}
      {
        { GRAPH <${cfg.tboxGraph}>     { ?C rdfs:subClassOf ?D } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?C rdfs:subClassOf ?D } }
      }
      FILTER (?C != ?D)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    }
  `,
  backward: {
    matches: (q: Quad) => q.p === RDF_TYPE,
    premiseQuery: (q: Quad) => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return `
        PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?C WHERE {
          {
            { GRAPH <kg:abox>     { <${q.s}> rdf:type ?C } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> rdf:type ?C } }
          }
          {
            { GRAPH <kg:tbox>     { ?C rdfs:subClassOf <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?C rdfs:subClassOf <${o}> } }
          }
          FILTER (?C != <${o}>)
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return [
        { s: q.s, p: RDF_TYPE, o: binding.C! },
        { s: binding.C!, p: SUBCLASS_OF, o },
      ];
    },
  },
};
