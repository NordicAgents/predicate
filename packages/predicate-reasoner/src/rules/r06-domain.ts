import type { Rule, RuleConfig } from './types.js';
import { closureEligible, deltaEligible } from '../closure.js';

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
  // Semi-naive: the domain declarations live in the (static) tbox, so the
  // closure atom is the only recursive one — a single delta variant suffices.
  deltaInsertWhere: (cfg: RuleConfig) => [`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:domain ?D }
      ${deltaEligible('?x', '?p', '?y', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    }
  `],
};
