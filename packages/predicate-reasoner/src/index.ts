import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  ReasonerAdapter,
  MaterializeInput, MaterializeResult,
  ValidateInput, ValidationResult,
  InferenceTrace, Quad,
} from './types.js';
import { RULES } from './rules/index.js';
import type { Rule } from './rules/types.js';
import { runFixpoint } from './fixpoint.js';

export * from './types.js';

export class FusekiConstructAdapter implements ReasonerAdapter {
  /** Override for tests; in production this is the RULES registry. */
  protected __rules: Rule[] = RULES;

  constructor(private client: SparqlClient) {}

  async materialize(input: MaterializeInput): Promise<MaterializeResult> {
    const t0 = Date.now();
    const { iterations, inferredCount } = await runFixpoint(this.client, this.__rules, {
      tboxGraph: input.tboxGraph,
      aboxGraphs: input.aboxGraphs,
      inferredGraph: input.targetGraph,
      closureCutoff: input.closureCutoff,
    });
    return {
      inferredCount,
      iterations,
      inconsistencies: [],   // populated in Task 6 (rule 11)
      elapsedMs: Date.now() - t0,
    };
  }

  async validate(_input: ValidateInput): Promise<ValidationResult> {
    throw new Error('validate: not implemented (Task 7)');
  }
  async explain(_claim: Quad): Promise<InferenceTrace | null> {
    throw new Error('explain: not implemented (Task 8)');
  }
}
