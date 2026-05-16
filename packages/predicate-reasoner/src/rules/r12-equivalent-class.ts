import type { Rule, RuleConfig } from './types.js';

export const r12: Rule = {
  id: 'r12-equivalent-class',
  name: 'owl:equivalentClass → bidirectional subClassOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?a rdfs:subClassOf ?b .
        ?b rdfs:subClassOf ?a .
      }
    }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?a owl:equivalentClass ?b }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?b owl:equivalentClass ?a }
      }
      FILTER (?a != ?b)
    }
  `,
};
