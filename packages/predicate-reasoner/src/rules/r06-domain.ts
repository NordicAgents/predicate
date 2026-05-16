import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r06: Rule = {
  id: 'r06-domain',
  name: 'rdfs:domain → rdf:type',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:domain ?D }
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    }
  `,
};
