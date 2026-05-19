import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgMaintain } from 'predicate-mcp/src/tools/kg-maintain.js';

export async function maintain(): Promise<number> {
  try {
    const client = getAdapter();
    const result = await kgMaintain(client, {});
    const proposals = result.generalizer?.proposals.length ?? 0;
    const promotions = result.sweeper?.decisions.filter((d) => d.outcome === 'promoted').length ?? 0;
    const inferred = result.fixpoint?.inferredCount ?? 0;
    const skipped = result.autoProposalsSkipped ? ' (skipped: schema-learning off)' : '';
    console.log(
      `predicate maintain: archived=${result.archivedCount} proposals=${proposals}${skipped} promotions=${promotions} inferred=${inferred} elapsed=${result.elapsedMs}ms event=${result.eventId}`,
    );
    return 0;
  } catch (err) {
    console.error(`predicate maintain failed: ${(err as Error).message}`);
    return 1;
  }
}
