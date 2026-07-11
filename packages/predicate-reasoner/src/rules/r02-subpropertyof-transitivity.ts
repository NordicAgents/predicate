import type { Rule, RuleConfig } from './types.js';
import { deltaEligible } from '../closure.js';

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
  // Semi-naive: same lean-work-graph + native property-path strategy as r01
  // (see the comment there) — W holds base subPropertyOf edges, O tracks this
  // rule's own path output so W never densifies with derived pairs.
  auxGraphs: (cfg: RuleConfig) => [`${cfg.deltaGraph}-r02w`, `${cfg.deltaGraph}-r02o`],
  deltaInsertWhere: (cfg: RuleConfig) => {
    const w = `${cfg.deltaGraph}-r02w`;
    const o = `${cfg.deltaGraph}-r02o`;
    return [
      `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${w}> { ?a rdfs:subPropertyOf ?b } }
    WHERE { GRAPH <${cfg.tboxGraph}> { ?a rdfs:subPropertyOf ?b } }
  `,
      `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${w}> { ?a rdfs:subPropertyOf ?b } }
    WHERE {
      ${deltaEligible('?a', 'rdfs:subPropertyOf', '?b', cfg)}
      FILTER NOT EXISTS { GRAPH <${o}> { ?a rdfs:subPropertyOf ?b } }
    }
  `,
      `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?c }
      GRAPH <${o}>                 { ?a rdfs:subPropertyOf ?c }
    }
    WHERE {
      GRAPH <${w}> { ?a rdfs:subPropertyOf/rdfs:subPropertyOf+ ?c }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}> { ?a rdfs:subPropertyOf ?c } }
    }
  `,
    ];
  },
};
