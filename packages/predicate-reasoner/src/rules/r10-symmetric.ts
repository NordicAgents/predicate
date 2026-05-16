import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r10: Rule = {
  id: 'r10-symmetric',
  name: 'owl:SymmetricProperty',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y ?p ?x } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:SymmetricProperty }
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y ?p ?x } }
    }
  `,
};
