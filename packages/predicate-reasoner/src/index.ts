import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  ReasonerAdapter,
  MaterializeInput, MaterializeResult,
  ValidateInput, ValidationResult,
  InferenceTrace, Quad,
} from './types.js';

export * from './types.js';

export class FusekiConstructAdapter implements ReasonerAdapter {
  constructor(_client: SparqlClient) {}

  async materialize(_input: MaterializeInput): Promise<MaterializeResult> {
    throw new Error('materialize: not implemented (Task 3)');
  }
  async validate(_input: ValidateInput): Promise<ValidationResult> {
    throw new Error('validate: not implemented (Task 8)');
  }
  async explain(_claim: Quad): Promise<InferenceTrace | null> {
    throw new Error('explain: not implemented (Task 9)');
  }
}
