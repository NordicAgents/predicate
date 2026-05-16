import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

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
};
