export type ScoreType = 'set' | 'boolean' | 'path' | 'conflict';

export type KeySpec =
  | { derive: 'transitive'; rel: string; from: string }
  | { derive: 'direct'; rel: string; from: string }
  | { derive: 'boolean-conflict'; about: string }
  | { derive: 'conflict-ids'; about: string }
  | { derive: 'path'; edges: Array<[string, string, string]> }
  // Hand-authored ground truth for questions that require OWL entailment to
  // answer (subclass-type, inverse-property, domain inference, disjointness) —
  // where deriving the key mechanically would mean replicating the reasoner.
  // `since` is the episode at which the fact becomes true; before it the key
  // is empty/false (so the fixture-integrity check still holds).
  | { derive: 'literal-set'; values: string[]; since: number }
  | { derive: 'literal-boolean'; since: number };

export interface Question {
  id: string;
  text: string;
  type: ScoreType;
  key: KeySpec;
  needs_episode: number;
  rule_under_test: string[];
  reasoning_dependent: boolean;
  golden_sparql: string;
}

export type AnswerKey =
  | { kind: 'set'; values: Set<string> }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'conflict'; ids: Set<string> }
  | { kind: 'path'; edges: Array<[string, string, string]> };

export interface Score { f1: number; precision?: number; recall?: number; }

export interface Boundedness {
  triples: number;
  inferred: number;
  unusedConceptRatio: number;
  materializeMs: number;
}

export interface ScoreRow {
  runId: string;
  timestamp: string;
  domain: string;
  tier: 'tier1' | 'tier2';
  episode: number;
  inference: 'on' | 'off';
  accuracy: number;
  lift?: number;
  perQuestion: Record<string, number>;
  boundedness: Boundedness;
  hostModel?: string;
}

export function isQuestion(x: unknown): x is Question {
  if (typeof x !== 'object' || x === null) return false;
  const q = x as Record<string, unknown>;
  return (
    typeof q.id === 'string' &&
    typeof q.text === 'string' &&
    typeof q.type === 'string' &&
    typeof q.key === 'object' && q.key !== null &&
    typeof q.needs_episode === 'number' &&
    Array.isArray(q.rule_under_test) &&
    typeof q.reasoning_dependent === 'boolean' &&
    typeof q.golden_sparql === 'string'
  );
}
