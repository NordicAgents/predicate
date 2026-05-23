import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';

const META = 'https://industriagents.com/predicate/meta#';

/**
 * Annotate every kg:abox triple with confidence=1 in kg:provenance so the
 * reasoner's closureEligible() gate includes them in materialization.
 */
export async function seedProvenance(client: StorageAdapter): Promise<void> {
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT { GRAPH <kg:provenance> { << ?s ?p ?o >> pred:confidence "1"^^xsd:decimal . } }
    WHERE  { GRAPH <kg:abox> { ?s ?p ?o }
             FILTER NOT EXISTS { GRAPH <kg:provenance> { << ?s ?p ?o >> pred:confidence ?c } } }
  `);
}
