import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r03: Rule = {
  id: 'r03-transitive-property',
  name: 'owl:TransitiveProperty',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?p ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:TransitiveProperty }
      {
        ${closureEligible('?x', '?p', '?y', cfg)}
      }
      {
        ${closureEligible('?y', '?p', '?z', cfg)}
      }
      FILTER (?x != ?z)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?p ?z } }
      ${cfg.aboxGraphs.map((g) => `FILTER NOT EXISTS { GRAPH <${g}> { ?x ?p ?z } }`).join('\n      ')}
    }
  `,
};
