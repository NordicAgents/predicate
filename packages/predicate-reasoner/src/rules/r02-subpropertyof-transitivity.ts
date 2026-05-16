import type { Rule, RuleConfig } from './types.js';

export const r02: Rule = {
  id: 'r02-subpropertyof-transitivity',
  name: 'rdfs:subPropertyOf transitivity',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?c } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subPropertyOf ?b } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?b } }
      }
      {
        { GRAPH <${cfg.tboxGraph}>     { ?b rdfs:subPropertyOf ?c } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?b rdfs:subPropertyOf ?c } }
      }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subPropertyOf ?c } }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?c } }
    }
  `,
};
