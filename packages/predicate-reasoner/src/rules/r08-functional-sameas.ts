import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r08: Rule = {
  id: 'r08-functional-sameas',
  name: 'owl:FunctionalProperty → owl:sameAs',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y1 owl:sameAs ?y2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:FunctionalProperty }
      ${closureEligible('?x', '?p', '?y1', cfg)}
      ${closureEligible('?x', '?p', '?y2', cfg)}
      FILTER (str(?y1) < str(?y2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y1 owl:sameAs ?y2 } }
    }
  `,
};
