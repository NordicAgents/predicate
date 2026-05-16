import type { Rule, RuleConfig } from './types.js';

export const r13: Rule = {
  id: 'r13-equivalent-property',
  name: 'owl:equivalentProperty → bidirectional subPropertyOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?p rdfs:subPropertyOf ?q .
        ?q rdfs:subPropertyOf ?p .
      }
    }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?p owl:equivalentProperty ?q }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?q owl:equivalentProperty ?p }
      }
      FILTER (?p != ?q)
    }
  `,
};
