import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  ReasonerAdapter,
  MaterializeInput, MaterializeResult,
  ValidateInput, ValidationResult,
  InferenceTrace, Quad,
} from './types.js';
import { RULES, r11 } from './rules/index.js';
import type { Rule } from './rules/types.js';
import { runFixpoint } from './fixpoint.js';
import { runValidation } from './validate.js';

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
    const inconsistencies = await r11.findInconsistencies(this.client, {
      tboxGraph: input.tboxGraph,
      aboxGraphs: input.aboxGraphs,
      inferredGraph: input.targetGraph,
      closureCutoff: input.closureCutoff,
    });
    return {
      inferredCount,
      iterations,
      inconsistencies,
      elapsedMs: Date.now() - t0,
    };
  }

  async validate(input: ValidateInput): Promise<ValidationResult> {
    return runValidation(this.client, input);
  }
  async explain(_claim: Quad): Promise<InferenceTrace | null> {
    throw new Error('explain: not implemented (Task 8)');
  }
}
