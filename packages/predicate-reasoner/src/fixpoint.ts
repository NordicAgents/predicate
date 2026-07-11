import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { Rule, RuleConfig } from './rules/types.js';

export interface FixpointResult {
  iterations: number;
  inferredCount: number;
}

/**
 * Default iteration cap for the semi-naive engine. Transitive rules double
 * reachable path length per round (delta JOIN full + full JOIN delta), so a
 * 1000-step chain converges in ~11 rounds; 30 leaves ample headroom while a
 * genuinely divergent rule still hard-fails quickly.
 */
export const DEFAULT_MAX_ITERATIONS = 30;

/** Cap of the preserved naive engine — the historical value. */
const NAIVE_MAX_ITERATIONS = 10;

async function countGraph(client: StorageAdapter, graph: string): Promise<number> {
  const r = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`,
  );
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

function nonConvergenceError(cap: number, lastCount: number): Error {
  return new Error(
    `Fixpoint did not converge in ${cap} iterations ` +
    `(current inferred count: ${lastCount}). ` +
    `On the v1 OWL 2 RL rule subset this should be impossible — investigate ` +
    `for a divergent rule or an unbounded property-chain depth.`,
  );
}

/**
 * The original naive engine: every rule re-evaluates its FULL body every
 * round. O(n^2..3) on transitive workloads — kept only for the semi-naive
 * equivalence tests and before/after measurement. Production callers use
 * runFixpoint below.
 */
export async function runFixpointNaive(
  client: StorageAdapter,
  rules: Rule[],
  cfg: RuleConfig,
): Promise<FixpointResult> {
  await client.update(`DROP SILENT GRAPH <${cfg.inferredGraph}>`);
  await client.update(`CREATE SILENT GRAPH <${cfg.inferredGraph}>`);

  let lastCount = -1;
  for (let i = 1; i <= NAIVE_MAX_ITERATIONS; i++) {
    for (const rule of rules) {
      await client.update(rule.insertWhere(cfg));
    }
    const n = await countGraph(client, cfg.inferredGraph);
    if (n === lastCount) return { iterations: i, inferredCount: n };
    lastCount = n;
  }
  throw nonConvergenceError(NAIVE_MAX_ITERATIONS, lastCount);
}

/**
 * Semi-naive (delta-aware) fixpoint. Computes the IDENTICAL least fixpoint
 * as runFixpointNaive, but from round 2 onward a rule that defines
 * deltaInsertWhere only re-joins against the triples derived in the previous
 * round (the delta) instead of re-evaluating its full body.
 *
 * The delta is maintained engine-side and rule-agnostically: after each
 * round, delta := inferred MINUS prev, then prev := inferred. A triple is
 * therefore in the delta no matter WHICH rule produced it — outputs of
 * fallback (full-evaluation) rules land there too, so delta-variant rules
 * never miss cross-rule feeds. Rules without deltaInsertWhere keep full
 * re-evaluation every round, which is slower but always correct (RDF graphs
 * are sets, so re-derived duplicates absorb).
 *
 * Convergence detection is unchanged from the naive engine: inferred-graph
 * count stability. That stays sound even with a conservatively large delta.
 *
 * Bookkeeping graphs <inferredGraph>-prev and <inferredGraph>-delta are
 * created on entry and dropped before returning, on success AND failure.
 */
export async function runFixpoint(
  client: StorageAdapter,
  rules: Rule[],
  cfg: RuleConfig,
): Promise<FixpointResult> {
  const maxIterations = cfg.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  // The oxigraph adapter only persists graphs matching /^kg:[A-Za-z0-9-]+$/,
  // so deriving the bookkeeping names by suffixing keeps them well-formed.
  const prevGraph = `${cfg.inferredGraph}-prev`;
  const deltaGraph = `${cfg.inferredGraph}-delta`;
  const runCfg: RuleConfig = { ...cfg, deltaGraph };

  const auxGraphs = rules.flatMap((r) => r.auxGraphs?.(runCfg) ?? []);

  for (const g of [cfg.inferredGraph, prevGraph, deltaGraph]) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  // Rule-owned bookkeeping: stale content from an earlier run must not leak in.
  for (const g of auxGraphs) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
  }

  try {
    let lastCount = -1;
    for (let i = 1; i <= maxIterations; i++) {
      for (const rule of rules) {
        // Round 1 runs every rule in full (the delta is still empty);
        // afterwards, rules with delta variants run those instead.
        if (i > 1 && rule.deltaInsertWhere !== undefined) {
          for (const update of rule.deltaInsertWhere(runCfg)) {
            await client.update(update);
          }
        } else {
          await client.update(rule.insertWhere(runCfg));
        }
      }
      const n = await countGraph(client, cfg.inferredGraph);
      if (n === lastCount) return { iterations: i, inferredCount: n };
      lastCount = n;

      // delta := inferred MINUS prev (the triples this round added) …
      await client.update(`DROP SILENT GRAPH <${deltaGraph}>`);
      await client.update(`CREATE SILENT GRAPH <${deltaGraph}>`);
      await client.update(`
        INSERT { GRAPH <${deltaGraph}> { ?s ?p ?o } }
        WHERE {
          GRAPH <${cfg.inferredGraph}> { ?s ?p ?o }
          FILTER NOT EXISTS { GRAPH <${prevGraph}> { ?s ?p ?o } }
        }
      `);
      // … then prev := inferred (prev already held everything but the delta).
      await client.update(`
        INSERT { GRAPH <${prevGraph}> { ?s ?p ?o } }
        WHERE { GRAPH <${deltaGraph}> { ?s ?p ?o } }
      `);
    }
    throw nonConvergenceError(maxIterations, lastCount);
  } finally {
    // Best-effort cleanup: a storage-level failure here must not mask the
    // error (if any) that is already propagating out of the try block.
    try {
      for (const g of [prevGraph, deltaGraph, ...auxGraphs]) {
        await client.update(`DROP SILENT GRAPH <${g}>`);
      }
    } catch {
      // ignore — the graphs are recreated (DROP+CREATE) on the next run
    }
  }
}
