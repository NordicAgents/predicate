import type { Rule, RuleConfig } from './types.js';

export const r19: Rule = {
  id: 'r19-active-file',
  name: 'codebase:ActiveFile — file modified in the most recent session',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
      PREFIX cb:   <https://predicate.dev/codebase#>
      PREFIX pred: <https://predicate.dev/meta#>
      PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      INSERT { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:ActiveFile } }
      WHERE {
        {
          SELECT ?session
          WHERE {
            GRAPH <${abox}> { ?session rdf:type pred:Session ; pred:at ?at }
          }
          ORDER BY DESC(?at)
          LIMIT 1
        }
        GRAPH <${abox}> { ?file cb:modifiedIn ?session }
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?file rdf:type cb:ActiveFile } }
      }
    `;
  },
};
