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
          << ${s} ${p} ${o} >> <https://industriagents.com/predicate/meta#confidence> ?conf .
          FILTER (?conf >= ${cfg.closureCutoff})
        }
      }
    }
  `).join('\n    UNION\n');
  const aboxUnion = aboxBlocks.length > 0 ? `\n    UNION\n    ${aboxBlocks}` : '';
  return `
    {
      GRAPH <${cfg.tboxGraph}> { ${s} ${p} ${o} }
    }
    UNION
    {
      GRAPH <${cfg.inferredGraph}> { ${s} ${p} ${o} }
    }${aboxUnion}
  `;
}

/**
 * Delta-restricted counterpart of closureEligible for semi-naive evaluation:
 * binds (?s, ?p, ?o) to the triples derived in the PREVIOUS fixpoint round
 * only (the engine-maintained delta graph). No provenance filter — every
 * triple in the delta was already closure-eligible when it was derived.
 *
 * Only valid inside a Rule.deltaInsertWhere body: the semi-naive engine sets
 * cfg.deltaGraph before calling it.
 */
export function deltaEligible(
  s: string, p: string, o: string,
  cfg: RuleConfig,
): string {
  if (cfg.deltaGraph === undefined) {
    throw new Error(
      'deltaEligible requires cfg.deltaGraph — it is only usable inside ' +
      'Rule.deltaInsertWhere, where the semi-naive engine provides it.',
    );
  }
  return `GRAPH <${cfg.deltaGraph}> { ${s} ${p} ${o} }`;
}
