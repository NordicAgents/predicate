import type { EpisodeTriple } from '../episode-runner.js';
import { tripleId } from '../exact/contract.js';
import {
  ConflictWitnessIndex,
  type CwiWitnessFamily,
  type CwiWitnessedConflict,
} from './index.js';

export type CwiBudgetStatus = 'complete' | 'selection-overflow';
export type CwiJointBudgetStatus = 'complete' | 'infeasible' | 'search-limit';

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

export interface CwiJointBudgetQueryOptions {
  maxPathsPerConflict?: number;
  maxSearchNodes?: number;
}

export interface CwiJointBudgetQueryResult {
  status: CwiJointBudgetStatus;
  seeds: string[];
  budgetTriples: number;
  /** Best complete union found, whether or not optimality was proved. */
  requiredTriples: number;
  /** Union of the independently shortest witnesses used by ordinary CWI. */
  independentTriples: number;
  relevantConflictCount: number;
  candidateWitnessCount: number;
  searchNodes: number;
  witnessEnumerationExhaustive: boolean;
  optimalityProven: boolean;
  /**
   * A complete joint context when status=complete. Empty for proven
   * infeasibility or a search limit, so no partial certificate is exposed.
   */
  context: EpisodeTriple[];
  conflicts: CwiWitnessedConflict[];
}

function conflictId(c: CwiWitnessedConflict): string {
  const endpoints = c.records
    .map((record, i) => `${record}\u0000${c.values[i]!}`)
    .sort()
    .join('\u0001');
  return `${c.predicate}\u0002${endpoints}`;
}

function familyConflictId(family: CwiWitnessFamily): string {
  return conflictId({
    ...family.conflict,
    witness: [],
    witnessIds: [],
  });
}

function validateBudget(budgetTriples: number): void {
  if (!Number.isInteger(budgetTriples) || budgetTriples < 0) {
    throw new Error(`budgetTriples must be a non-negative integer, got ${budgetTriples}`);
  }
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
  validateBudget(budgetTriples);

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

/**
 * Exact joint selection over explicitly enumerated minimal witnesses.
 *
 * On tractable equivalence classes this realizes the b* boundary: exhaustive
 * simple-path enumeration followed by branch-and-bound proves the minimum
 * witness union. Both exponential stages are capped. A fitting union is
 * always safe to return; failure is called `infeasible` only when enumeration
 * and selection were exhaustive, and `search-limit` otherwise.
 */
export function queryCwiWithJointBudget(
  index: ConflictWitnessIndex,
  seeds: string[],
  budgetTriples: number,
  predicates?: Iterable<string>,
  options: CwiJointBudgetQueryOptions = {},
): CwiJointBudgetQueryResult {
  validateBudget(budgetTriples);
  const maxPathsPerConflict = options.maxPathsPerConflict ?? 10_000;
  const maxSearchNodes = options.maxSearchNodes ?? 1_000_000;
  if (!Number.isInteger(maxSearchNodes) || maxSearchNodes <= 0) {
    throw new Error(`maxSearchNodes must be a positive integer, got ${maxSearchNodes}`);
  }

  const requested = predicates === undefined ? null : new Set(predicates);
  const byConflict = new Map<string, CwiWitnessFamily>();
  for (const seed of seeds) {
    const queried = index.queryWitnessFamilies(seed, { maxPathsPerConflict });
    for (const family of queried.families) {
      if (requested !== null && !requested.has(family.conflict.predicate)) continue;
      const id = familyConflictId(family);
      const prior = byConflict.get(id);
      if (prior === undefined || (!prior.exhaustive && family.exhaustive)) {
        byConflict.set(id, family);
      }
    }
  }
  const families = [...byConflict.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, family]) => family);
  for (const family of families) {
    if (family.witnesses.length === 0) {
      throw new Error(`CWI invariant violated: conflict ${familyConflictId(family)} has no witness`);
    }
  }

  const allTriples = new Map<string, EpisodeTriple>();
  for (const family of families) {
    for (const witness of family.witnesses) {
      for (const triple of witness.witness) {
        allTriples.set(tripleId(triple.s, triple.p, triple.o), triple);
      }
    }
  }

  const unionSize = (selected: CwiWitnessedConflict[]): number => {
    const ids = new Set<string>();
    for (const witness of selected) {
      for (const id of witness.witnessIds) ids.add(id);
    }
    return ids.size;
  };
  const independent = families.map((family) => family.witnesses[0]!);
  const independentTriples = unionSize(independent);
  let best = independent;
  let bestSize = independentTriples;
  let searchNodes = 0;
  let searchComplete = true;
  const currentIds = new Set<string>();
  const selected: CwiWitnessedConflict[] = [];

  const search = (familyIndex: number): void => {
    searchNodes++;
    if (searchNodes > maxSearchNodes) {
      searchComplete = false;
      return;
    }
    if (currentIds.size >= bestSize) return;
    if (familyIndex === families.length) {
      best = [...selected];
      bestSize = currentIds.size;
      return;
    }
    const witnesses = [...families[familyIndex]!.witnesses].sort((a, b) => {
      const delta = (witness: CwiWitnessedConflict): number =>
        witness.witnessIds.reduce((n, id) => n + Number(!currentIds.has(id)), 0);
      return delta(a) - delta(b)
        || a.witness.length - b.witness.length
        || [...a.witnessIds].sort().join('\u0000')
          .localeCompare([...b.witnessIds].sort().join('\u0000'));
    });
    for (const witness of witnesses) {
      if (!searchComplete) break;
      const added: string[] = [];
      for (const id of witness.witnessIds) {
        if (!currentIds.has(id)) {
          currentIds.add(id);
          added.push(id);
        }
      }
      selected.push(witness);
      search(familyIndex + 1);
      selected.pop();
      for (const id of added) currentIds.delete(id);
    }
  };
  search(0);

  const witnessEnumerationExhaustive = families.every((family) => family.exhaustive);
  const optimalityProven = witnessEnumerationExhaustive && searchComplete;
  const fits = bestSize <= budgetTriples;
  const status: CwiJointBudgetStatus = fits
    ? 'complete'
    : optimalityProven
      ? 'infeasible'
      : 'search-limit';
  const selectedIds = new Set(best.flatMap((witness) => witness.witnessIds));
  const context = status === 'complete'
    ? [...selectedIds]
      .sort()
      .map((id) => allTriples.get(id)!)
    : [];

  return {
    status,
    seeds: [...new Set(seeds)],
    budgetTriples,
    requiredTriples: bestSize,
    independentTriples,
    relevantConflictCount: families.length,
    candidateWitnessCount: families.reduce((sum, family) => sum + family.witnesses.length, 0),
    searchNodes,
    witnessEnumerationExhaustive,
    optimalityProven,
    context,
    conflicts: status === 'complete' ? best : [],
  };
}
