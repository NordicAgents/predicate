export interface Rule {
  id: string;                       // e.g. 'r01-subclassof-transitivity'
  name: string;                     // human label
  insertWhere: (cfg: RuleConfig) => string;
  /** For backward-chained kg_explain (filled in Task 8). */
  backward?: {
    headPattern: (vars: { s: string; p: string; o: string }) => string;
    premisePatterns: (binding: Record<string, string>) => string[];
  };
}

export interface RuleConfig {
  tboxGraph: string;       // typically 'kg:tbox'
  aboxGraphs: string[];    // typically ['kg:abox']
  inferredGraph: string;   // typically 'kg:inferred'
  closureCutoff: number;   // 0.5 default
}
