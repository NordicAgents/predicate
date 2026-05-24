import type { ScoreType } from './eval-types.js';

/** Emitted per question; carries NO golden SPARQL and NO answer key. */
export interface Tier2Task {
  id: string;
  domain: string;
  questionText: string;
  type: ScoreType;
  schema: string;               // the domain world.ttl, as the predicate vocabulary
  graphsHint: string;           // which named graphs are queryable
  exampleIndividuals: string[]; // real subject IRIs (<...>) so the model can map names→IRIs
}

/** The model's drafted query for a task. */
export interface Tier2Answer {
  id: string;
  sparql: string;
}

/** One scored row for a Tier 2 question at the final episode state. */
export interface Tier2Row {
  runId: string;
  timestamp: string;
  domain: string;
  questionId: string;
  sparqlValid: boolean;     // executed without throwing
  sparqlNonEmpty: boolean;  // returned at least one binding / true
  f1: number;               // scored vs the final answer key
  hostModel?: string;
}

export function isTier2Answer(x: unknown): x is Tier2Answer {
  if (typeof x !== 'object' || x === null) return false;
  const a = x as Record<string, unknown>;
  return typeof a.id === 'string' && typeof a.sparql === 'string' && a.sparql.length > 0;
}
