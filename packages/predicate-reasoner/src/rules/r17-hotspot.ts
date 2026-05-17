import type { Rule, RuleConfig } from './types.js';

const HOTSPOT_THRESHOLD = 3;

export const r17: Rule = {
  id: 'r17-hotspot',
  name: 'codebase:Hotspot — file modified in >=3 sessions',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
      PREFIX cb:  <https://predicate.dev/codebase#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      INSERT { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:Hotspot } }
      WHERE {
        {
          SELECT ?file (COUNT(DISTINCT ?session) AS ?n)
          WHERE { GRAPH <${abox}> { ?file cb:modifiedIn ?session } }
          GROUP BY ?file
          HAVING (?n >= ${HOTSPOT_THRESHOLD})
        }
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:Hotspot } }
      }
    `;
  },
};
