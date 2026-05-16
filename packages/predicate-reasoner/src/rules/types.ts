import type { Quad } from '../types.js';

export interface Rule {
  id: string;                       // e.g. 'r01-subclassof-transitivity'
  name: string;                     // human label
  insertWhere: (cfg: RuleConfig) => string;
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
}
