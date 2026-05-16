export type IRI = string;
export type LiteralValue = { value: string; datatype?: IRI; lang?: string };

export interface Quad {
  s: IRI;
  p: IRI;
  o: IRI | LiteralValue;
  g?: IRI;
}

export interface MaterializeInput {
  tboxGraph: IRI;
  aboxGraphs: IRI[];
  targetGraph: IRI;
  closureCutoff: number;
}

export interface Inconsistency {
  kind: 'disjoint-class' | 'shacl' | 'functional-property-conflict';
  description: string;
  triples: Quad[];
}

export interface MaterializeResult {
  inferredCount: number;
  inconsistencies: Inconsistency[];
  iterations: number;
  elapsedMs: number;
}

export interface ValidateInput {
  tboxGraph: IRI;
  stagingGraph: IRI;
  aboxSample: IRI;
}

export interface ShaclViolation {
  focusNode: IRI;
  resultPath?: IRI;
  message: string;
  sourceShape?: IRI;
}

export interface ValidationResult {
  ok: boolean;
  unsatisfiableClasses: IRI[];
  shaclViolations: ShaclViolation[];
  impactedTriples: number;
  impactedQueries: number;
}

export interface ProvenanceRecord {
  triple: Quad;
  source: string;
  confidence: number;
  method: string;
  timestamp: string;
}

export interface DerivationStep {
  rule: string;
  premises: Quad[];
  conclusion: Quad;
}

export interface InferenceTrace {
  conclusion: Quad;
  derivation: DerivationStep[];
  citedProvenance: ProvenanceRecord[];
  alternatesExist: boolean;
}

export interface ReasonerAdapter {
  materialize(input: MaterializeInput): Promise<MaterializeResult>;
  validate(input: ValidateInput): Promise<ValidationResult>;
  explain(claim: Quad): Promise<InferenceTrace | null>;
}
