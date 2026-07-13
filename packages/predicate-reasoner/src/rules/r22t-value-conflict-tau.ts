import type { Rule, RuleConfig } from './types.js';

const J = 'https://industriagents.com/predicate/judgment#';
const META = 'https://industriagents.com/predicate/meta#';

/**
 * r22t — τ/σ-aware variant of r22 (pre-registration Amendment A4.3, system
 * `reasoner-tau`, hypothesis H12). NEW rule: the frozen blind r22 is
 * untouched (registered H7 result) and r22t is NOT in the default RULES
 * array — only the reasoner-tau arm runs it.
 *
 * F3's side conditions: two distinct closure-eligible values of a
 * j:SingleValued property on one subject are a j:ValueConflict ONLY IF
 *  - their τ intervals OVERLAP — [from,to) semantics, ISO date strings
 *    compared lexicographically, an absent bound is unbounded, both bounds
 *    absent means the value holds always (overlaps everything); and
 *  - their σ scopes are EQUAL OR ABSENT — an unscoped value is comparable
 *    to everything; two values are incomparable only when BOTH are scoped
 *    and the scopes differ.
 *
 * Effective τ/σ of a value (registered in A4.3):
 *  - propagated value (inferred): the RDF-star j:tauFrom/j:tauTo/j:tauScope
 *    annotations r23t carried forward from the ORIGINAL record, if any;
 *  - asserted value (abox): the HOLDING record's record-level annotation
 *    triples via the TBox markers (?fp a j:ValidFrom etc.);
 *  - neither present: ⊥ (unbounded, unscoped).
 * All three pairings (asserted-asserted, asserted-propagated,
 * propagated-propagated) fall out of the per-value UNION blocks below.
 *
 * Interval overlap is expressed with COALESCE + sentinel bounds
 * ("0000-01-01" / "9999-12-31") rather than OPTIONAL+BOUND case analysis:
 * the sentinels sort lexicographically below/above every real ISO date, so
 * one two-conjunct FILTER covers all bounded/unbounded combinations —
 * [fa,ta) ∩ [fb,tb) ≠ ∅  ⇔  fa < tb ∧ fb < ta (strict, end-exclusive).
 *
 * On a τ/σ-free domain every annotation variable is unbound, the τ FILTER
 * degenerates to "0000-01-01" < "9999-12-31" and the σ FILTER to true, and
 * the value blocks equal closureEligible — r22t fires exactly like blind
 * r22 (H12's identity requirement).
 *
 * Record-level marker triples are read WITHOUT the confidence gate (same
 * rationale as r23t: dropping a record's τ would MANUFACTURE conflicts).
 * No backward{}: kg_explain integration is out of scope for the H12 arm.
 */

/**
 * Binds ?x ?p <v> plus that value's effective τ/σ (<f>, <t>, <s>; each may
 * stay unbound = ⊥). Branch order mirrors closureEligible: tbox, inferred,
 * confidence-gated abox.
 */
function valueBlock(
  cfg: RuleConfig, v: string, f: string, t: string, s: string,
  fp: string, tp: string, sp: string,
): string {
  const inf = cfg.inferredGraph;
  const assertedBranches = cfg.aboxGraphs.map((g) => `
      {
        GRAPH <${g}> { ?x ?p ${v} }
        FILTER EXISTS {
          GRAPH <kg:provenance> {
            << ?x ?p ${v} >> pred:confidence ?conf .
            FILTER (?conf >= ${cfg.closureCutoff})
          }
        }
        OPTIONAL { GRAPH <${cfg.tboxGraph}> { ${fp} a j:ValidFrom }   GRAPH <${g}> { ?x ${fp} ${f} } }
        OPTIONAL { GRAPH <${cfg.tboxGraph}> { ${tp} a j:ValidTo }     GRAPH <${g}> { ?x ${tp} ${t} } }
        OPTIONAL { GRAPH <${cfg.tboxGraph}> { ${sp} a j:SourceScope } GRAPH <${g}> { ?x ${sp} ${s} } }
      }`).join('\n      UNION');
  return `
      {
        { GRAPH <${cfg.tboxGraph}> { ?x ?p ${v} } }
        UNION
        {
          GRAPH <${inf}> { ?x ?p ${v} }
          OPTIONAL { GRAPH <${inf}> { << ?x ?p ${v} >> j:tauFrom  ${f} } }
          OPTIONAL { GRAPH <${inf}> { << ?x ?p ${v} >> j:tauTo    ${t} } }
          OPTIONAL { GRAPH <${inf}> { << ?x ?p ${v} >> j:tauScope ${s} } }
        }
        UNION${assertedBranches}
      }`;
}

export const r22t: Rule = {
  id: 'r22t-value-conflict-tau',
  name: 'j:ValueConflict gated on τ-interval overlap and σ equality-or-absence (F3 side conditions)',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX j:    <${J}>
    PREFIX pred: <${META}>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?x a j:ValueConflict .
        ?x j:conflictOn ?p .
      }
    }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a j:SingleValued }
      ${valueBlock(cfg, '?va', '?fa', '?ta', '?sa', '?fpa', '?tpa', '?spa')}
      ${valueBlock(cfg, '?vb', '?fb', '?tb', '?sb', '?fpb', '?tpb', '?spb')}
      FILTER (str(?va) < str(?vb))
      FILTER (
        COALESCE(str(?fa), "0000-01-01") < COALESCE(str(?tb), "9999-12-31") &&
        COALESCE(str(?fb), "0000-01-01") < COALESCE(str(?ta), "9999-12-31")
      )
      FILTER (!BOUND(?sa) || !BOUND(?sb) || str(?sa) = str(?sb))
      FILTER NOT EXISTS {
        GRAPH <${cfg.inferredGraph}> { ?x a j:ValueConflict ; j:conflictOn ?p }
      }
    }
  `,
};
