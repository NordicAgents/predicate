/**
 * Record-level tau/sigma overlap (F3's side conditions, formal doc §1.3),
 * shared by exact-key-join-x and the CWI (Amendments A2.3 / A3.1).
 */

export interface TauSigma {
  from: string | null;
  to: string | null;
  scope: string | null;
}

export const BOTTOM: TauSigma = { from: null, to: null, scope: null };

/** Interval overlap on [from, to): absent bound = unbounded; ISO dates compare lexicographically. */
export const tauOverlaps = (a: TauSigma, b: TauSigma): boolean =>
  (a.from === null || b.to === null || a.from < b.to)
  && (b.from === null || a.to === null || b.from < a.to);

/** Scope comparability: equal, or either side absent. */
export const sigmaOverlaps = (a: TauSigma, b: TauSigma): boolean =>
  a.scope === null || b.scope === null || a.scope === b.scope;
