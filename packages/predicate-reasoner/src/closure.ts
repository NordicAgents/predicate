import type { RuleConfig } from './rules/types.js';

/**
 * Returns a SPARQL fragment that binds (?s, ?p, ?o) to the set of triples
 * eligible for the reasoner's closure input: everything in kg:tbox or
 * kg:inferred unconditionally, plus kg:abox triples whose RDF-star
 * confidence annotation in kg:provenance is >= closureCutoff.
 *
 * Triples from kg:abox without any confidence annotation are EXCLUDED —
 * we treat "no provenance" as "not reasoned about."
 */
export function closureEligible(
  s: string, p: string, o: string,
  cfg: RuleConfig,
): string {
  const aboxBlocks = cfg.aboxGraphs.map((g) => `
    {
      GRAPH <${g}> { ${s} ${p} ${o} }
      FILTER EXISTS {
        GRAPH <kg:provenance> {
          << ${s} ${p} ${o} >> <https://predicate.dev/meta#confidence> ?conf .
          FILTER (?conf >= ${cfg.closureCutoff})
        }
      }
    }
  `).join('\n    UNION\n');
  return `
    {
      GRAPH <${cfg.tboxGraph}> { ${s} ${p} ${o} }
    }
    UNION
    {
      GRAPH <${cfg.inferredGraph}> { ${s} ${p} ${o} }
    }
    UNION
    ${aboxBlocks}
  `;
}
