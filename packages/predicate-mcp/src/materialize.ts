import type { StorageAdapter } from './storage/index.js';
import { runFixpoint } from 'predicate-reasoner/src/fixpoint.js';
import { RULES } from 'predicate-reasoner/src/rules/index.js';

const STATE = 'urn:predicate:materialization-state';
const META = 'https://predicate.dev/meta#';

// Presence-based marker: the triple's presence means "ABox changed since the
// inferred graph was last materialized". Absent means clean. Re-inserting the
// same triple is a no-op (RDF set semantics).
export async function markAboxDirty(client: StorageAdapter): Promise<void> {
  await client.update(
    `PREFIX pred: <${META}> INSERT DATA { GRAPH <kg:meta> { <${STATE}> pred:aboxDirty true } }`,
  );
}

export async function isAboxDirty(client: StorageAdapter): Promise<boolean> {
  return client.ask(
    `PREFIX pred: <${META}> ASK { GRAPH <kg:meta> { <${STATE}> pred:aboxDirty true } }`,
  );
}

export async function clearAboxDirty(client: StorageAdapter): Promise<void> {
  await client.update(
    `PREFIX pred: <${META}> DELETE WHERE { GRAPH <kg:meta> { <${STATE}> pred:aboxDirty ?v } }`,
  );
}

// Back-fill confidence=1.0 provenance for any kg:abox triple that was inserted
// directly (bypassing kg_assert) and therefore lacks a confidence annotation in
// kg:provenance. The reasoner's closureEligible filter requires provenance; this
// ensures lazy materialization works even for raw INSERT DATA statements.
async function stampMissingProvenance(client: StorageAdapter): Promise<void> {
  const ts = new Date().toISOString();
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT {
      GRAPH <kg:provenance> {
        << ?s ?p ?o >> pred:confidence "1.0"^^xsd:decimal ;
                       pred:source     "materialize" ;
                       pred:method     "auto-stamp" ;
                       pred:timestamp  "${ts}"^^xsd:dateTime .
      }
    }
    WHERE {
      GRAPH <kg:abox> { ?s ?p ?o }
      FILTER NOT EXISTS {
        GRAPH <kg:provenance> { << ?s ?p ?o >> pred:confidence ?c }
      }
    }
  `);
}

// Lazy reasoning: if the ABox changed, run the reasoner fixpoint (NOT the
// reaper/sweeper/generalizer that kg_maintain runs) and clear the marker.
// Returns true if it materialized, false if already clean. On a runFixpoint
// failure the marker is left dirty so the next read retries.
export async function materializeIfDirty(client: StorageAdapter): Promise<boolean> {
  if (!(await isAboxDirty(client))) return false;
  await stampMissingProvenance(client);
  await runFixpoint(client, RULES, {
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    inferredGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });
  await clearAboxDirty(client);
  return true;
}
