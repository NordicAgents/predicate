import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { Rule, RuleConfig } from './rules/types.js';

export interface FixpointResult {
  iterations: number;
  inferredCount: number;
}

const MAX_ITERATIONS = 10;

export async function runFixpoint(
  client: StorageAdapter,
  rules: Rule[],
  cfg: RuleConfig,
): Promise<FixpointResult> {
  await client.update(`DROP SILENT GRAPH <${cfg.inferredGraph}>`);
  await client.update(`CREATE SILENT GRAPH <${cfg.inferredGraph}>`);

  let lastCount = -1;
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    for (const rule of rules) {
      await client.update(rule.insertWhere(cfg));
    }
    const r = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${cfg.inferredGraph}> { ?s ?p ?o } }`,
    );
    const n = parseInt(r.results.bindings[0]!.n!.value, 10);
    if (n === lastCount) return { iterations: i, inferredCount: n };
    lastCount = n;
  }
  throw new Error(
    `Fixpoint did not converge in ${MAX_ITERATIONS} iterations ` +
    `(current inferred count: ${lastCount}). ` +
    `On the v1 OWL 2 RL rule subset this should be impossible — investigate ` +
    `for a divergent rule or an unbounded property-chain depth.`,
  );
}
