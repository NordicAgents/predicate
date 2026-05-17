import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgMaintain } from 'predicate-mcp/src/tools/kg-maintain.js';

export async function maintain(): Promise<number> {
  try {
    const client = new SparqlClient(loadConfig());
    const result = await kgMaintain(client, {});
    const proposals = result.generalizer?.proposals.length ?? 0;
    const promotions = result.sweeper?.decisions.filter((d) => d.outcome === 'promoted').length ?? 0;
    console.log(
      `predicate maintain: archived=${result.archivedCount} proposals=${proposals} promotions=${promotions} elapsed=${result.elapsedMs}ms event=${result.eventId}`,
    );
    return 0;
  } catch (err) {
    console.error(`predicate maintain failed: ${(err as Error).message}`);
    return 1;
  }
}
