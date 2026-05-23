import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://industriagents.com/predicate/meta#';

/**
 * Count successful uses of a staged proposal: the distinct subjects tagged
 * with the proposalId (RDF-star) in kg:tbox-staging, then kg:usage Query rows
 * whose recorded SPARQL references any of those subject IRIs.
 * Shared by PromotionSweeper (live gate) and ShadowEvaluator (counterfactual)
 * so the two never drift. NOTE: the matched subject IRIs are not re-escaped in
 * the CONTAINS filter — they are KG-resident IRIs that already passed escapeIRI
 * validation in the first query, so they cannot contain a quote.
 */
export async function countProposalUses(client: StorageAdapter, proposalId: string): Promise<number> {
  const subjects = await client.select(`
    PREFIX pred: <${META}>
    SELECT DISTINCT ?s WHERE {
      GRAPH <kg:tbox-staging> { << ?s ?p ?o >> pred:proposalId ${escapeIRI(proposalId)} . }
    }
  `);
  const iris = subjects.results.bindings.map((b) => b['s']!.value);
  if (iris.length === 0) return 0;
  const filters = iris.map((iri) => `CONTAINS(?sparql, "${iri}")`).join(' || ');
  const r = await client.select(`
    PREFIX pred: <${META}>
    SELECT (COUNT(*) AS ?n) WHERE {
      GRAPH <kg:usage> { ?q a pred:Query ; pred:sparql ?sparql . FILTER (${filters}) }
    }
  `);
  return parseInt(r.results.bindings[0]!['n']!.value, 10);
}
