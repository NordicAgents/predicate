import type { Quad } from '../types.js';

export interface Rule {
  id: string;                       // e.g. 'r01-subclassof-transitivity'
  name: string;                     // human label
  insertWhere: (cfg: RuleConfig) => string;
  /**
   * Semi-naive delta variants — one INSERT UPDATE per recursive body atom,
   * with that atom restricted to cfg.deltaGraph (the triples derived in the
   * previous fixpoint round) and every other atom left at full breadth.
   * A rule with two recursive atoms therefore returns TWO updates
   * (delta JOIN full, full JOIN delta) so path lengths keep doubling per
   * round. Must derive exactly the same conclusions as insertWhere would.
   * Optional: rules without it are re-evaluated in full each round.
   */
  deltaInsertWhere?: (cfg: RuleConfig) => string[];
  /**
   * Bookkeeping graphs (beyond the engine's prev/delta) that this rule's
   * deltaInsertWhere updates use, derived from cfg.deltaGraph. The engine
   * drops them before the first round (stale state from an earlier run must
   * not leak in) and again before returning.
   */
  auxGraphs?: (cfg: RuleConfig) => string[];
  /** For backward-chained kg_explain — define for rules producing common inferences. */
  backward?: {
    matches: (q: Quad) => boolean;
    premiseQuery: (q: Quad) => string;          // SPARQL SELECT
    buildPremises: (q: Quad, binding: Record<string, string>) => Quad[];
  };
}

export interface RuleConfig {
  tboxGraph: string;       // typically 'kg:tbox'
  aboxGraphs: string[];    // typically ['kg:abox']
  inferredGraph: string;   // typically 'kg:inferred'
  closureCutoff: number;   // 0.5 default
  /**
   * Bookkeeping graph holding the previous round's newly derived triples.
   * Set by the semi-naive engine before it calls deltaInsertWhere; absent
   * when rules run through insertWhere alone.
   */
  deltaGraph?: string;
  /** Fixpoint iteration cap override (default DEFAULT_MAX_ITERATIONS = 30). */
  maxIterations?: number;
}
