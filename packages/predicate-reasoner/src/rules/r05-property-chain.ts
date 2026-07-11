import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
import { closureEligible, deltaEligible } from '../closure.js';

export const r05: Rule = {
  id: 'r05-property-chain',
  name: 'owl:propertyChainAxiom (length 2)',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?q owl:propertyChainAxiom ?list .
        ?list rdf:first ?p1 ; rdf:rest ?rest .
        ?rest rdf:first ?p2 ; rdf:rest rdf:nil .
      }
      {
        ${closureEligible('?x', '?p1', '?y', cfg)}
      }
      {
        ${closureEligible('?y', '?p2', '?z', cfg)}
      }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    }
  `,
  // Semi-naive: both chain-link closure atoms are recursive, so two variants
  // (delta JOIN full, full JOIN delta).
  deltaInsertWhere: (cfg: RuleConfig) => {
    const head = `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?q owl:propertyChainAxiom ?list .
        ?list rdf:first ?p1 ; rdf:rest ?rest .
        ?rest rdf:first ?p2 ; rdf:rest rdf:nil .
      }`;
    const guard = `
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }`;
    return [
      `${head}
      {
        ${deltaEligible('?x', '?p1', '?y', cfg)}
      }
      {
        ${closureEligible('?y', '?p2', '?z', cfg)}
      }
      ${guard}
    }`,
      `${head}
      {
        ${closureEligible('?x', '?p1', '?y', cfg)}
      }
      {
        ${deltaEligible('?y', '?p2', '?z', cfg)}
      }
      ${guard}
    }`,
    ];
  },
  backward: {
    matches: () => true,
    premiseQuery: (q: Quad) => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?p1 ?p2 ?mid WHERE {
          GRAPH <kg:tbox> {
            <${q.p}> owl:propertyChainAxiom ?list .
            ?list rdf:first ?p1 ; rdf:rest ?rest .
            ?rest rdf:first ?p2 ; rdf:rest rdf:nil .
          }
          {
            { GRAPH <kg:abox>     { <${q.s}> ?p1 ?mid } }
            UNION
            { GRAPH <kg:inferred> { <${q.s}> ?p1 ?mid } }
          }
          {
            { GRAPH <kg:abox>     { ?mid ?p2 <${o}> } }
            UNION
            { GRAPH <kg:inferred> { ?mid ?p2 <${o}> } }
          }
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => {
      const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
      return [
        { s: q.s, p: binding.p1!, o: binding.mid! },
        { s: binding.mid!, p: binding.p2!, o },
      ];
    },
  },
};
