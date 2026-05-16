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
