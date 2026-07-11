import type { Rule, RuleConfig } from './types.js';
import type { Inconsistency, Quad } from '../types.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { closureEligible } from '../closure.js';

const J = 'https://industriagents.com/predicate/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const DISJOINT_CONFLICT = `${J}DisjointClassConflict`;
const CONFLICTING_TYPE = `${J}conflictingType`;

const objValue = (o: Quad['o']): string => (typeof o === 'string' ? o : (o as { value: string }).value);

/**
 * r11 — owl:disjointWith conflict surfacing.
 *
 * When an individual is typed (asserted or inferred) as two classes declared
 * owl:disjointWith, standard OWL treats the graph as inconsistent and, under
 * forward chaining, everything is entailed (the owl:Nothing explosion). Predicate
 * is contradiction-PRESERVING instead: the fixpoint materializes a soft, queryable
 * `j:DisjointClassConflict` marker on the individual (linking both conflicting
 * types) — mirroring how r21 flags functional-property conflicts — WITHOUT deleting
 * either type assertion and WITHOUT exploding the closure. The conflict becomes a
 * fact the agent can query and `kg_explain`, not a graph-wide failure.
 *
 * `insertWhere` (the firing rule) is confidence-gated via `closureEligible`, so it
 * is consistent with the rest of the fixpoint: only closure-eligible type triples
 * can surface a materialized conflict.
 *
 * `findInconsistencies` is kept as a SEPARATE, deliberately more-liberal safety net
 * for the validation gate (`validate.ts`): a schema proposal that would introduce a
 * disjoint-class clash must be rejected regardless of per-triple confidence, so that
 * check is not confidence-gated. The two are complementary — the marker is "what the
 * closure surfaces"; findInconsistencies is "should we refuse this schema change."
 */
export const r11: Rule & {
  findInconsistencies: (c: StorageAdapter, cfg: RuleConfig) => Promise<Inconsistency[]>;
} = {
  id: 'r11-disjoint-with',
  name: 'j:DisjointClassConflict — an individual typed as two owl:disjointWith classes',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX j:   <${J}>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?x a j:DisjointClassConflict .
        ?x j:conflictingType ?a .
        ?x j:conflictingType ?b .
      }
    }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?a owl:disjointWith ?b }
      ${closureEligible('?x', `<${RDF_TYPE}>`, '?a', cfg)}
      ${closureEligible('?x', `<${RDF_TYPE}>`, '?b', cfg)}
      FILTER (str(?a) < str(?b))
      FILTER NOT EXISTS {
        GRAPH <${cfg.inferredGraph}> { ?x a j:DisjointClassConflict ; j:conflictingType ?a , ?b }
      }
    }
  `,
  backward: {
    matches: (q: Quad) => q.p === RDF_TYPE && objValue(q.o) === DISJOINT_CONFLICT,
    premiseQuery: (q: Quad) => `
      PREFIX j: <${J}>
      SELECT ?a ?b WHERE {
        GRAPH <kg:inferred> { <${q.s}> j:conflictingType ?a , ?b }
        FILTER (str(?a) < str(?b))
      } LIMIT 1
    `,
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => [
      { s: q.s, p: RDF_TYPE, o: binding.a! },
      { s: q.s, p: RDF_TYPE, o: binding.b! },
    ],
  },
  findInconsistencies: async (client, cfg) => {
    const aboxGraph = cfg.aboxGraphs[0] ?? 'kg:abox';
    const r = await client.select(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?x ?a ?b WHERE {
        GRAPH <${cfg.tboxGraph}> { ?a owl:disjointWith ?b }
        {
          { GRAPH <${aboxGraph}> { ?x rdf:type ?a } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?a } }
        }
        {
          { GRAPH <${aboxGraph}> { ?x rdf:type ?b } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?b } }
        }
        FILTER (str(?a) < str(?b))
      }
    `);
    return r.results.bindings.map((b) => ({
      kind: 'disjoint-class' as const,
      description: `${b.x!.value} is typed as both ${b.a!.value} and ${b.b!.value} which are owl:disjointWith`,
      triples: [
        { s: b.x!.value, p: RDF_TYPE, o: b.a!.value },
        { s: b.x!.value, p: RDF_TYPE, o: b.b!.value },
      ],
    }));
  },
};

export { CONFLICTING_TYPE, DISJOINT_CONFLICT };
