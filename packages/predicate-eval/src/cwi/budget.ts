import type { EpisodeTriple } from '../episode-runner.js';
import { tripleId } from '../exact/contract.js';
import {
  ConflictWitnessIndex,
  type CwiWitnessedConflict,
} from './index.js';

export type CwiBudgetStatus = 'complete' | 'selection-overflow';

export interface CwiBudgetQueryResult {
  status: CwiBudgetStatus;
  seeds: string[];
  budgetTriples: number;
  requiredTriples: number;
  relevantConflictCount: number;
  /**
   * A complete joint context when it fits. Empty on overflow: callers must
   * not mistake a truncated prefix for a conflict-complete answer.
   */
  context: EpisodeTriple[];
  /** Per-conflict certificates are exposed only when the joint context fits. */
  conflicts: CwiWitnessedConflict[];
}

function conflictId(c: CwiWitnessedConflict): string {
  const endpoints = c.records
    .map((record, i) => `${record}\u0000${c.values[i]!}`)
    .sort()
    .join('\u0001');
  return `${c.predicate}\u0002${endpoints}`;
}

/**
 * Query one or more entity seeds under an explicit triple budget.
 *
 * CWI first selects one shortest witness independently per relevant conflict,
 * then deduplicates their union. If that complete selected union exceeds the
 * budget, the method abstains with `selection-overflow` and returns no partial
 * context. The status is deliberately not called `infeasible`: a different
 * combination of alternative witnesses could have a smaller global union.
 */
export function queryCwiWithBudget(
  index: ConflictWitnessIndex,
  seeds: string[],
  budgetTriples: number,
  predicates?: Iterable<string>,
): CwiBudgetQueryResult {
  if (!Number.isInteger(budgetTriples) || budgetTriples < 0) {
    throw new Error(`budgetTriples must be a non-negative integer, got ${budgetTriples}`);
  }

  const requested = predicates === undefined ? null : new Set(predicates);
  const byConflict = new Map<string, CwiWitnessedConflict>();
  for (const seed of seeds) {
    for (const conflict of index.query(seed).conflicts) {
      if (requested !== null && !requested.has(conflict.predicate)) continue;
      byConflict.set(conflictId(conflict), conflict);
    }
  }

  const conflicts = [...byConflict.values()].sort((a, b) =>
    conflictId(a).localeCompare(conflictId(b)));
  const byTriple = new Map<string, EpisodeTriple>();
  for (const conflict of conflicts) {
    for (const triple of conflict.witness) {
      byTriple.set(tripleId(triple.s, triple.p, triple.o), triple);
    }
  }
  const selectedContext = [...byTriple.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, triple]) => triple);
  const requiredTriples = selectedContext.length;
  const complete = requiredTriples <= budgetTriples;

  return {
    status: complete ? 'complete' : 'selection-overflow',
    seeds: [...new Set(seeds)],
    budgetTriples,
    requiredTriples,
    relevantConflictCount: conflicts.length,
    context: complete ? selectedContext : [],
    conflicts: complete ? conflicts : [],
  };
}
