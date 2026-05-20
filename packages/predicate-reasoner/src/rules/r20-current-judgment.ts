import type { Rule, RuleConfig } from './types.js';

const J = 'https://predicate.dev/judgment#';

export const r20: Rule = {
  id: 'r20-current-judgment',
  name: 'j:Current — a judgment with no j:supersededBy',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
      PREFIX j: <${J}>
      INSERT { GRAPH <${cfg.inferredGraph}> { ?jd a j:Current } }
      WHERE {
        {
          { GRAPH <${abox}>                { ?jd a j:Judgment } }
          UNION
          { GRAPH <${cfg.inferredGraph}>   { ?jd a j:Judgment } }
        }
        FILTER NOT EXISTS { GRAPH <${abox}>              { ?jd j:supersededBy ?n } }
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?jd j:supersededBy ?n } }
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?jd a j:Current } }
      }
    `;
  },
};
