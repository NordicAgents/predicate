import type { Rule, RuleConfig } from './types.js';

const J = 'https://industriagents.com/predicate/judgment#';
const META = 'https://industriagents.com/predicate/meta#';

/**
 * r23t — τ/σ-aware variant of r23 (pre-registration Amendment A4.3, system
 * `reasoner-tau`, hypothesis H12). NEW rule: the frozen blind chain
 * r14→r23→r22 is untouched (its behavior is a registered H7 result), and
 * r23t is NOT in the default RULES array — only the reasoner-tau arm runs it.
 *
 * Like r23, copies j:SingleValued values across owl:sameAs pairs so r22t can
 * compare them on one subject. Unlike r23, every propagated value triple
 * written to the inferred graph ALSO carries the SOURCE record's τ/σ forward
 * as RDF-star annotations on the inferred triple itself:
 *
 *   << ?x ?p ?v >> j:tauFrom ?f ; j:tauTo ?t ; j:tauScope ?s .
 *
 * Source τ/σ resolution (registered in A4.3):
 *  - copied triple ASSERTED (abox): read the source RECORD's record-level
 *    annotation triples via the TBox markers (?fp a j:ValidFrom etc. —
 *    conflict-tausig marks cb3:validFrom/validTo/sourceScope this way);
 *  - copied triple itself INFERRED: carry its existing RDF-star τ/σ
 *    annotations UNCHANGED, so a propagation chain of any length preserves
 *    the ORIGINAL endpoint record's τ/σ, never an intermediate record's;
 *  - neither present: no annotation (⊥ — r22t treats ⊥ as unbounded/unscoped).
 *
 * Record-level marker triples are read WITHOUT the confidence gate: they are
 * side-condition metadata about the record, not domain facts being reasoned
 * about; gating them would silently turn an annotated record into an
 * unbounded one, which is the direction that MANUFACTURES conflicts.
 *
 * SPARQL template lines whose variables are unbound are skipped per the
 * SPARQL 1.1 Update spec, so an unannotated source propagates exactly like
 * blind r23 — value triple only, zero annotations (H12's τ/σ-free identity).
 *
 * oxigraph realizes << s p o >> as RDF 1.2 reifiers and mints a FRESH
 * reifier bnode per template line, so the three annotations of one value
 * land on three reifiers. Consumers must therefore match each annotation as
 * its own << s p o >> statement (a fresh pattern variable), never ;-chain
 * two annotations onto one quoted-triple subject — r22t below and the tests
 * follow this.
 *
 * No deltaInsertWhere: full re-evaluation each round is always correct
 * (fixpoint.ts), and every registered domain converges in <= 3 iterations.
 * No backward{}: kg_explain integration is out of scope for the H12 arm.
 */
export const r23t: Rule = {
  id: 'r23t-sameas-value-propagation-tau',
  name: 'owl:sameAs propagates j:SingleValued values, carrying the source record\'s τ/σ as RDF-star annotations',
  insertWhere: (cfg: RuleConfig) => {
    const inf = cfg.inferredGraph;
    // One asserted-source branch per abox graph (annotations read from the
    // same graph that holds the copied value's record).
    const assertedBranches = cfg.aboxGraphs.map((g) => `
      {
        GRAPH <${g}> { ?y ?p ?v }
        FILTER EXISTS {
          GRAPH <kg:provenance> {
            << ?y ?p ?v >> pred:confidence ?conf .
            FILTER (?conf >= ${cfg.closureCutoff})
          }
        }
        OPTIONAL { GRAPH <${cfg.tboxGraph}> { ?fp a j:ValidFrom }   GRAPH <${g}> { ?y ?fp ?tf } }
        OPTIONAL { GRAPH <${cfg.tboxGraph}> { ?tp a j:ValidTo }     GRAPH <${g}> { ?y ?tp ?tt } }
        OPTIONAL { GRAPH <${cfg.tboxGraph}> { ?sp a j:SourceScope } GRAPH <${g}> { ?y ?sp ?ts } }
      }`).join('\n      UNION');
    const aboxGuards = cfg.aboxGraphs.map((g) =>
      `FILTER NOT EXISTS { GRAPH <${g}> { ?x ?p ?v } }`).join('\n      ');
    return `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX j:    <${J}>
    PREFIX pred: <${META}>
    INSERT {
      GRAPH <${inf}> {
        ?x ?p ?v .
        << ?x ?p ?v >> j:tauFrom  ?tf .
        << ?x ?p ?v >> j:tauTo    ?tt .
        << ?x ?p ?v >> j:tauScope ?ts .
      }
    }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a j:SingleValued }
      {
        # TBox-held value (closureEligible parity): no record, so τ/σ = ⊥.
        { GRAPH <${cfg.tboxGraph}> { ?y ?p ?v } }
        UNION${assertedBranches}
        UNION
        {
          # Already-propagated value: carry the ORIGINAL record's RDF-star
          # annotations unchanged (chained propagation, A4.3).
          GRAPH <${inf}> { ?y ?p ?v }
          OPTIONAL { GRAPH <${inf}> { << ?y ?p ?v >> j:tauFrom  ?tf } }
          OPTIONAL { GRAPH <${inf}> { << ?y ?p ?v >> j:tauTo    ?tt } }
          OPTIONAL { GRAPH <${inf}> { << ?y ?p ?v >> j:tauScope ?ts } }
        }
      }
      {
        { GRAPH <${inf}> { ?x owl:sameAs ?y } }
        UNION
        { GRAPH <${inf}> { ?y owl:sameAs ?x } }
      }
      FILTER (?x != ?y)
      FILTER NOT EXISTS { GRAPH <${inf}> { ?x ?p ?v } }
      ${aboxGuards}
    }
  `;
  },
};
