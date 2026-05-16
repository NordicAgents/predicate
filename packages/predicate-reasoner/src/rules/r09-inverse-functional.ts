import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r09: Rule = {
  id: 'r09-inverse-functional',
  name: 'owl:InverseFunctionalProperty → owl:sameAs',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:InverseFunctionalProperty }
      ${closureEligible('?x1', '?p', '?y', cfg)}
      ${closureEligible('?x2', '?p', '?y', cfg)}
      FILTER (str(?x1) < str(?x2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    }
  `,
};
