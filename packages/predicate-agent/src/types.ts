export type GoalStatus = 'active' | 'dormant' | 'done';

export interface Goal {
  id: string;                  // IRI, e.g. urn:predicate:goal:G-<timestamp>-<random>
  statement: string;
  status: GoalStatus;
  createdAt: string;           // ISO 8601
  updatedAt: string;
  source: 'user' | 'inferred';
  parentGoal?: string;
}

export interface SubQuestionIntent {
  kind:
    | 'why-broken'
    | 'find-callers'
    | 'find-dependencies'
    | 'find-readers-of'
    | 'find-symbol-in-file'
    | 'unknown';
  payload: Record<string, string | boolean>;
}

export interface SubQuestion {
  id: string;                  // local to the goal (e.g. SQ-1)
  text: string;
  intent: SubQuestionIntent;
}

export interface MissingPredicate {
  iri: string;
  reason: string;
}

export interface GapReport {
  subQuestionId: string;
  answerable: boolean;
  missingPredicates: MissingPredicate[];
}

export interface GoalPlan {
  goalId: string;
  subQuestions: SubQuestion[];
  gaps: GapReport[];
}

// --- Phase 3b: research execution -------------------------------------

export interface ResearchArtifact {
  source: string;                           // source name (e.g. "docs")
  uri: string;                              // file path or URL
  content: string;
  metadata: Record<string, string>;
}

export interface ResearchQuery {
  intent: SubQuestionIntent;
  symbols?: string[];                       // optional hint
  paths?: string[];                         // optional hint
}

export interface CandidateTriple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string };
  source: string;                           // e.g. "file:///repo/auth.ts:3"
  confidence: number;                       // [0, 1]
  method: string;                           // e.g. "regex-import"
}

export interface ResearchStats {
  subQuestionId: string;
  artifactsFetched: number;
  candidatesExtracted: number;
  assertedCount: number;
  rejectedCount: number;
  errors: string[];
}

/**
 * GoalPlan with an optional execution report. The `stats` field is populated
 * when `researchGoal({ executeResearch: true })` is called.
 */
export interface GoalPlanWithStats extends GoalPlan {
  stats?: ResearchStats[];
}
