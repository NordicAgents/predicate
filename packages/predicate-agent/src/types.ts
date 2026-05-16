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

// --- Phase 3c: schema evolution ---------------------------------------

export type IRI = string;
export type LiteralTerm = { type: 'literal'; value: string; datatype?: IRI };
export type Term = { type: 'uri'; value: IRI } | LiteralTerm;

export interface DeltaQuad {
  s: IRI;
  p: IRI;
  o: Term;
}

export interface AddClassDelta {
  kind: 'add-class';
  add: DeltaQuad[];
  shapes?: DeltaQuad[];
}
export interface AddPropertyDelta {
  kind: 'add-property';
  add: DeltaQuad[];
  shapes?: DeltaQuad[];
}
export interface RefineClassDelta {
  kind: 'refine-class';
  parent: IRI;
  add: DeltaQuad[];
  shapes?: DeltaQuad[];
}
export interface BreakingDelta {
  kind: 'breaking';
  remove: DeltaQuad[];
  add: DeltaQuad[];
  migration: string;
  shapes?: DeltaQuad[];
}
export type SchemaDelta =
  | AddClassDelta
  | AddPropertyDelta
  | RefineClassDelta
  | BreakingDelta;

export interface ProposalMeta {
  justification: string;
  motivatingGoal?: IRI;
  proposedAt: string;
}

export interface StagedProposal {
  id: IRI;
  delta: SchemaDelta;
  meta: ProposalMeta;
  useCount: number;
  expiresAt: string;
}

export interface PromotionDecision {
  proposalId: IRI;
  outcome: 'promoted' | 'rejected-validation' | 'rejected-expired' | 'awaiting';
  reason?: string;
  turtleFile?: string;
  tboxVersion?: IRI;
}

export interface SweeperResult {
  decisions: PromotionDecision[];
  durationMs: number;
}
