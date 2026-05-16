import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

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
};
