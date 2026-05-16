import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r05: Rule = {
  id: 'r05-property-chain',
  name: 'owl:propertyChainAxiom (length 2)',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?q owl:propertyChainAxiom ?list .
        ?list rdf:first ?p1 ; rdf:rest ?rest .
        ?rest rdf:first ?p2 ; rdf:rest rdf:nil .
      }
      {
        ${closureEligible('?x', '?p1', '?y', cfg)}
      }
      {
        ${closureEligible('?y', '?p2', '?z', cfg)}
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    }
  `,
};
