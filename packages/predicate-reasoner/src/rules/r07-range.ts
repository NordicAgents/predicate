import type { Rule, RuleConfig } from './types.js';
import { closureEligible, deltaEligible } from '../closure.js';

export const r07: Rule = {
  id: 'r07-range',
  name: 'rdfs:range → rdf:type',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:range ?R }
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER (isIRI(?y))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    }
  `,
  // Semi-naive: the range declarations live in the (static) tbox, so the
  // closure atom is the only recursive one — a single delta variant suffices.
  deltaInsertWhere: (cfg: RuleConfig) => [`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:range ?R }
      ${deltaEligible('?x', '?p', '?y', cfg)}
      FILTER (isIRI(?y))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    }
  `],
};
