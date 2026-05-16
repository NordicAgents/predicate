import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
import { closureEligible } from '../closure.js';

const SUBPROPERTY_OF = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf';

/**
 * OWL 2 RL prp-spo1: rdfs:subPropertyOf instance propagation.
 * If p rdfs:subPropertyOf q and (x p y) then (x q y).
 */
export const r16: Rule = {
  id: 'r16-subpropertyof-instance',
  name: 'rdfs:subPropertyOf instance propagation',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?q ?y } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?p rdfs:subPropertyOf ?q } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?p rdfs:subPropertyOf ?q } }
      }
      FILTER (?p != ?q)
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?q ?y } }
    }
  `,
  backward: {
    matches: (q: Quad) => {
      // Only attempt backward chaining for non-schema predicates inferred via
      // subPropertyOf (i.e. not a subPropertyOf triple itself)
      return q.p !== SUBPROPERTY_OF;
    },
    premiseQuery: (q: Quad) => {
      const o = typeof q.o === 'string' ? `<${q.o}>` : `"${(q.o as { value: string }).value}"`;
      return `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?subProp WHERE {
          {
            { GRAPH <kg:tbox>     { ?subProp rdfs:subPropertyOf <${q.p}> } }
            UNION
            { GRAPH <kg:inferred> { ?subProp rdfs:subPropertyOf <${q.p}> } }
          }
          {
            { GRAPH <kg:abox>     { <${q.s}> ?subProp ${o} } }
            UNION
            { GRAPH <kg:tbox>     { <${q.s}> ?subProp ${o} } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> ?subProp ${o} } }
          }
          FILTER (?subProp != <${q.p}>)
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return [
        { s: binding.subProp!, p: SUBPROPERTY_OF, o: q.p },
        { s: q.s, p: binding.subProp!, o },
      ];
    },
  },
};
