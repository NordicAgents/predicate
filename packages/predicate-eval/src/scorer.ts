import type { Score } from './eval-types.js';

export function scoreSet(expected: Set<string>, got: Set<string>): Score {
  if (expected.size === 0 && got.size === 0) return { f1: 1, precision: 1, recall: 1 };
  let tp = 0;
  for (const g of got) if (expected.has(g)) tp++;
  const precision = got.size === 0 ? 0 : tp / got.size;
  const recall = expected.size === 0 ? 0 : tp / expected.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { f1, precision, recall };
}

export function scoreBoolean(expected: boolean, got: boolean): Score {
  return { f1: expected === got ? 1 : 0 };
}

/** Conflict is a set-membership problem over conflict ids (false positives punished by precision). */
export function scoreConflict(expectedIds: Set<string>, flaggedIds: Set<string>): Score {
  return scoreSet(expectedIds, flaggedIds);
}

/** Ordered-subsequence match: every expected edge appears in `got` in the same relative order. */
export function scorePath(
  expected: Array<[string, string, string]>, got: Array<[string, string, string]>,
): Score {
  const eq = (a: [string, string, string], b: [string, string, string]): boolean =>
    a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  let i = 0;
  for (const g of got) { if (i < expected.length && eq(expected[i]!, g)) i++; }
  return { f1: i === expected.length ? 1 : 0 };
}
