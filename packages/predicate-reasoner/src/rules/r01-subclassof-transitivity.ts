import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';

const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

export const r01: Rule = {
  id: 'r01-subclassof-transitivity',
  name: 'rdfs:subClassOf transitivity',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?b } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?b } }
      }
      {
        { GRAPH <${cfg.tboxGraph}>     { ?b rdfs:subClassOf ?c } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?b rdfs:subClassOf ?c } }
      }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?c } }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    }
  `,
  backward: {
    matches: (q: Quad) => q.p === SUBCLASS_OF,
    premiseQuery: (q: Quad) => {
      const s = q.s;
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?mid WHERE {
          {
            { GRAPH <kg:tbox>     { <${s}> rdfs:subClassOf ?mid } }
            UNION
            { GRAPH <kg:inferred> { <${s}> rdfs:subClassOf ?mid } }
          }
          {
            { GRAPH <kg:tbox>     { ?mid rdfs:subClassOf <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?mid rdfs:subClassOf <${o}> } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return [
        { s: q.s, p: SUBCLASS_OF, o: binding.mid! },
        { s: binding.mid!, p: SUBCLASS_OF, o },
      ];
    },
  },
};
