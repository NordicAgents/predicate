import type { StorageAdapter } from '../storage/index.js';
import { LifecycleController, type DemoteDecision } from 'predicate-agent/src/index.js';

export interface KgDemoteInput {
  proposalId: string;
  reason?: string;
}

export async function kgDemote(
  client: StorageAdapter,
  input: KgDemoteInput,
): Promise<DemoteDecision> {
  const ctrl = new LifecycleController(client);
  return ctrl.demoteById(input.proposalId, {
    reason: input.reason ?? 'demoted via kg_demote',
    actor: 'kg_demote',
  });
}
