import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';
import { closureEligible } from '../closure.js';

const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const VALUE_CONFLICT = `${J}ValueConflict`;
const CONFLICT_ON = `${J}conflictOn`;

const objValue = (o: Quad['o']): string => (typeof o === 'string' ? o : (o as { value: string }).value);

/**
 * r22 — domain-level single-valued conflict surfacing.
 *
 * r21 covers conflicts between JUDGMENTS (j:about / j:Current / supersession-aware
 * via r20). Nothing covered plain domain facts: `lee reportsTo omar` + `lee
 * reportsTo nadia` fires no rule unless the property is owl:FunctionalProperty —
 * and marking it functional is wrong, because r08 would infer omar owl:sameAs
 * nadia and silently MERGE two distinct people (the exact averaging failure
 * Predicate exists to avoid).
 *
 * The `j:SingleValued` marker says: this domain property should hold one value
 * per subject; two closure-eligible values is a conflict to SURFACE, not resolve.
 * r22 materializes a queryable `j:ValueConflict` flag (with `j:conflictOn` naming
 * the property) while preserving both value triples.
 *
 * Deliberately a SEPARATE marker from j:ConflictFunctionalProperty: that marker
 * drives r21's judgment-layer semantics (only *current*, non-superseded judgments
 * conflict). Reusing it here would make r22 fire on raw judgment triples and
 * bypass r20's supersession filter. Domain-level supersession-awareness is a
 * planned CONFLICT-BENCH axis, not implicit behavior.
 */
export const r22: Rule = {
  id: 'r22-value-conflict',
  name: 'j:ValueConflict — a j:SingleValued domain property holds two values for one subject',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX j: <${J}>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?x a j:ValueConflict .
        ?x j:conflictOn ?p .
      }
    }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a j:SingleValued }
      ${closureEligible('?x', '?p', '?va', cfg)}
      ${closureEligible('?x', '?p', '?vb', cfg)}
      FILTER (str(?va) < str(?vb))
      FILTER NOT EXISTS {
        GRAPH <${cfg.inferredGraph}> { ?x a j:ValueConflict ; j:conflictOn ?p }
      }
    }
  `,
  backward: {
    matches: (q: Quad) => q.p === RDF_TYPE && objValue(q.o) === VALUE_CONFLICT,
    premiseQuery: (q: Quad) => `
      PREFIX j: <${J}>
      SELECT ?p ?va ?vb WHERE {
        GRAPH <kg:inferred> { <${q.s}> j:conflictOn ?p }
        {
          { GRAPH <kg:abox>     { <${q.s}> ?p ?va } }
          UNION
          { GRAPH <kg:inferred> { <${q.s}> ?p ?va } }
        }
        {
          { GRAPH <kg:abox>     { <${q.s}> ?p ?vb } }
          UNION
          { GRAPH <kg:inferred> { <${q.s}> ?p ?vb } }
        }
        FILTER (str(?va) < str(?vb))
      } LIMIT 1
    `,
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => [
      { s: q.s, p: binding.p!, o: binding.va! },
      { s: q.s, p: binding.p!, o: binding.vb! },
    ],
  },
};

export { VALUE_CONFLICT, CONFLICT_ON };
