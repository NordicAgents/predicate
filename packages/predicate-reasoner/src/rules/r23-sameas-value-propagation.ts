import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
import { closureEligible, deltaEligible } from '../closure.js';

const J = 'https://industriagents.com/predicate/judgment#';
const OWL_SAMEAS = 'http://www.w3.org/2002/07/owl#sameAs';

/**
 * r23 — sameAs-mediated value propagation for j:SingleValued properties.
 *
 * The missing link for CROSS-RECORD conflict surfacing: when two records are
 * co-referent (owl:sameAs, typically derived by r14 hasKey or r09
 * inverse-functional), their j:SingleValued values must be visible on ONE
 * subject for r22 to compare them. Full OWL eq-rep (copy every triple across
 * every sameAs pair) blows up the closure; this rule copies ONLY values of
 * properties marked j:SingleValued — bounded by design, and exactly the slice
 * conflict detection needs.
 *
 * Fires in both sameAs directions (r14/r08/r09 emit one direction only).
 * Chain: r14 (shared key) → sameAs → r23 (values converge on each member) →
 * r22 (two distinct values on one subject → j:ValueConflict on BOTH members).
 * Both original records and both values remain untouched — contradiction-
 * preserving end to end.
 */
export const r23: Rule = {
  id: 'r23-sameas-value-propagation',
  name: 'owl:sameAs propagates j:SingleValued values across co-referent subjects',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX j:   <${J}>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?p ?v } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a j:SingleValued }
      ${closureEligible('?y', '?p', '?v', cfg)}
      {
        { GRAPH <${cfg.inferredGraph}> { ?x owl:sameAs ?y } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?y owl:sameAs ?x } }
      }
      FILTER (?x != ?y)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?p ?v } }
      FILTER NOT EXISTS { GRAPH <${abox}> { ?x ?p ?v } }
    }
  `;
  },
  // Semi-naive: from round 2 join only (a) NEW sameAs pairs against all values
  // and (b) all sameAs pairs against NEW values. Without this, the full body
  // re-joins every accumulated sameAs pair against the whole closure each
  // round (~20% of total materialize cost on the history corpus, measured).
  deltaInsertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    const head = `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX j:   <${J}>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?p ?v } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a j:SingleValued }`;
    const guards = `
      FILTER (?x != ?y)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?p ?v } }
      FILTER NOT EXISTS { GRAPH <${abox}> { ?x ?p ?v } }
    }`;
    const sameAsFull = `
      {
        { GRAPH <${cfg.inferredGraph}> { ?x owl:sameAs ?y } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?y owl:sameAs ?x } }
      }`;
    const sameAsDelta = `
      {
        { ${deltaEligible('?x', 'owl:sameAs', '?y', cfg)} }
        UNION
        { ${deltaEligible('?y', 'owl:sameAs', '?x', cfg)} }
      }`;
    return [
      `${head}
      ${closureEligible('?y', '?p', '?v', cfg)}
      ${sameAsDelta}
      ${guards}`,
      `${head}
      ${deltaEligible('?y', '?p', '?v', cfg)}
      ${sameAsFull}
      ${guards}`,
    ];
  },
  backward: {
    // A propagated value ?x ?p ?v is explained by the co-reference plus the
    // co-referent record's own value.
    matches: () => true,
    premiseQuery: (q: Quad) => {
      const o = typeof q.o === 'string' ? `<${q.o}>` : `"${(q.o as { value: string }).value}"`;
      return `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX j:   <${J}>
        SELECT ?y WHERE {
          GRAPH <kg:tbox> { <${q.p}> a j:SingleValued }
          {
            { GRAPH <kg:inferred> { <${q.s}> owl:sameAs ?y } }
            UNION
            { GRAPH <kg:inferred> { ?y owl:sameAs <${q.s}> } }
          }
          {
            { GRAPH <kg:abox>     { ?y <${q.p}> ${o} } }
            UNION
            { GRAPH <kg:inferred> { ?y <${q.p}> ${o} } }
          }
          FILTER (?y != <${q.s}>)
        } LIMIT 1
      `;
    },
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => [
      { s: q.s, p: OWL_SAMEAS, o: binding.y! },
      { s: binding.y!, p: q.p, o: q.o },
    ],
  },
};
