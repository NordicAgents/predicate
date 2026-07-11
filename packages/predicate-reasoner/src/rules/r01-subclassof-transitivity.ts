import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
import { deltaEligible } from '../closure.js';

const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

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
  // Semi-naive: instead of delta-JOIN variants (which still enumerate every
  // length-2 decomposition of every closure pair — O(n^3) rows on chains),
  // maintain a lean base-edge work graph W and let oxigraph's NATIVE
  // property-path evaluator compute the closure in one shot. W is fed from
  // the tbox plus delta edges NOT already produced by this rule's own path
  // output (tracked in O), so W stays at base-edge scale — cross-rule feeds
  // (e.g. r12's subClassOf output) still enter W via the delta. The path
  // rdfs:subClassOf/rdfs:subClassOf+ matches length >= 2 only, exactly the
  // pairs the join body derives.
  auxGraphs: (cfg: RuleConfig) => [`${cfg.deltaGraph}-r01w`, `${cfg.deltaGraph}-r01o`],
  deltaInsertWhere: (cfg: RuleConfig) => {
    const w = `${cfg.deltaGraph}-r01w`;
    const o = `${cfg.deltaGraph}-r01o`;
    return [
      `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${w}> { ?a rdfs:subClassOf ?b } }
    WHERE { GRAPH <${cfg.tboxGraph}> { ?a rdfs:subClassOf ?b } }
  `,
      `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${w}> { ?a rdfs:subClassOf ?b } }
    WHERE {
      ${deltaEligible('?a', 'rdfs:subClassOf', '?b', cfg)}
      FILTER NOT EXISTS { GRAPH <${o}> { ?a rdfs:subClassOf ?b } }
    }
  `,
      `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c }
      GRAPH <${o}>                 { ?a rdfs:subClassOf ?c }
    }
    WHERE {
      GRAPH <${w}> { ?a rdfs:subClassOf/rdfs:subClassOf+ ?c }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}> { ?a rdfs:subClassOf ?c } }
    }
  `,
    ];
  },
  backward: {
    matches: (q: Quad) => q.p === SUBCLASS_OF,
    premiseQuery: (q: Quad) => {
      const s = q.s;
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?mid WHERE {
          {
            { GRAPH <kg:tbox>     { <${s}> rdfs:subClassOf ?mid } }
            UNION
            { GRAPH <kg:inferred> { <${s}> rdfs:subClassOf ?mid } }
          }
          {
            { GRAPH <kg:tbox>     { ?mid rdfs:subClassOf <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?mid rdfs:subClassOf <${o}> } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return [
        { s: q.s, p: SUBCLASS_OF, o: binding.mid! },
        { s: binding.mid!, p: SUBCLASS_OF, o },
      ];
    },
  },
};
