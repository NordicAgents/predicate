import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
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
  backward: {
    matches: () => true,
    premiseQuery: (q: Quad) => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        SELECT ?mid WHERE {
          GRAPH <kg:tbox> { <${q.p}> a owl:TransitiveProperty }
          {
            { GRAPH <kg:abox>     { <${q.s}> <${q.p}> ?mid } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> <${q.p}> ?mid } }
          }
          {
            { GRAPH <kg:abox>     { ?mid <${q.p}> <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?mid <${q.p}> <${o}> } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return [
        { s: q.s, p: q.p, o: binding.mid! },
        { s: binding.mid!, p: q.p, o },
      ];
    },
  },
};
