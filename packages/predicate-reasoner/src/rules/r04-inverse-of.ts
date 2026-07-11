import type { Rule, RuleConfig } from './types.js';
import { closureEligible, deltaEligible } from '../closure.js';

export const r04: Rule = {
  id: 'r04-inverse-of',
  name: 'owl:inverseOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?p owl:inverseOf ?q }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?q owl:inverseOf ?p }
      }
      {
        ${closureEligible('?x', '?p', '?y', cfg)}
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    }
  `,
  // Semi-naive: the inverseOf declarations live in the (static) tbox, so the
  // closure atom is the only recursive one — a single delta variant suffices.
  deltaInsertWhere: (cfg: RuleConfig) => [`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?p owl:inverseOf ?q }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?q owl:inverseOf ?p }
      }
      {
        ${deltaEligible('?x', '?p', '?y', cfg)}
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    }
  `],
};
