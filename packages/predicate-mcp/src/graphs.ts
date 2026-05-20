export const GRAPH = {
  tbox: 'kg:tbox',
  tboxStaging: 'kg:tbox-staging',
  abox: 'kg:abox',
  inferred: 'kg:inferred',
  provenance: 'kg:provenance',
  goals: 'kg:goals',
  usage: 'kg:usage',
  meta: 'kg:meta',
} as const;

export type GraphName = (typeof GRAPH)[keyof typeof GRAPH];
