import type { CounterfactualCell } from './types.js';

export interface CounterfactualInput {
  useCount: number;
  ageInStagingDays: number;
  n: number;
  ttlDays: number;
}

/** Mirror of PromotionSweeper.decide gate logic, as a pure function. */
export function decideCounterfactual(
  i: CounterfactualInput,
): 'promote' | 'wait' | 'expire' {
  if (i.useCount >= i.n) return 'promote';
  if (i.ageInStagingDays > i.ttlDays) return 'expire';
  return 'wait';
}

export const USAGE_GRID_N = [2, 3, 5];
export const USAGE_GRID_TTL = [3, 7, 14];

export function counterfactualGrid(
  useCount: number,
  ageInStagingDays: number,
): CounterfactualCell[] {
  const cells: CounterfactualCell[] = [];
  for (const n of USAGE_GRID_N) {
    for (const ttlDays of USAGE_GRID_TTL) {
      cells.push({ n, ttlDays, decision: decideCounterfactual({ useCount, ageInStagingDays, n, ttlDays }) });
    }
  }
  return cells;
}
