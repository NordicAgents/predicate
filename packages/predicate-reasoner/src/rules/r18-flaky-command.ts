import type { Rule, RuleConfig } from './types.js';

const FLAKY_THRESHOLD = 2;

export const r18: Rule = {
  id: 'r18-flaky-command',
  name: 'codebase:FlakyCommand — command failed in >=2 sessions',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
      PREFIX cb:  <https://predicate.dev/codebase#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      INSERT { GRAPH <${cfg.inferredGraph}> { ?cmd rdf:type cb:FlakyCommand } }
      WHERE {
        {
          SELECT ?cmd (COUNT(DISTINCT ?session) AS ?n)
          WHERE { GRAPH <${abox}> { ?cmd cb:failedIn ?session } }
          GROUP BY ?cmd
          HAVING (COUNT(DISTINCT ?session) >= ${FLAKY_THRESHOLD})
        }
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?cmd rdf:type cb:FlakyCommand } }
      }
    `;
  },
};
