import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

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
};
