import type { Rule, RuleConfig } from './types.js';

export const r01: Rule = {
  id: 'r01-subclassof-transitivity',
  name: 'rdfs:subClassOf transitivity',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?b } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?b } }
      }
      {
        { GRAPH <${cfg.tboxGraph}>     { ?b rdfs:subClassOf ?c } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?b rdfs:subClassOf ?c } }
      }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?c } }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    }
  `,
};
