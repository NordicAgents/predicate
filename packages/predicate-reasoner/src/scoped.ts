import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { RULES } from './rules/index.js';
import { runFixpoint } from './fixpoint.js';

/**
 * Neighbourhood-scoped materialization.
 *
 * Instead of running the fixpoint over the ENTIRE abox (whose cost grows with
 * total accumulated history), materializeScoped reasons only over the k-hop
 * retrieval ball around a set of seed entities, so reasoning cost tracks
 * neighbourhood size, not fact-store size:
 *
 *   1. BFS from the seeds over the union of the abox graphs, treating every
 *      triple as an UNDIRECTED edge between its IRI subject and IRI object,
 *      for `hops` hops (frontier expansion via VALUES-batched SELECTs).
 *   2. Attribute completeness (the locality guarantee): copy into the scratch
 *      graph EVERY abox triple whose SUBJECT is a ball node — including
 *      literal-valued triples, not just the edges the BFS walked. Any
 *      same-subject conflict (r08/r11/r22) on a retrieved subject is therefore
 *      detectable inside the ball.
 *   3. Run the standard fixpoint with the scratch graph as the only abox; the
 *      full TBox participates (it is small — only instance data is scoped).
 *
 * Provenance is NOT copied: kg:provenance is a global graph keyed by triple
 * content, so closureEligible's confidence gate works on the scratch graph
 * as-is.
 *
 * The known trade-off (the recall cliff): a conclusion whose premises span
 * more than `hops` edges from every seed is NOT derived. Callers choose the
 * radius; the full materialize() path remains the completeness baseline.
 *
 * Both graphs are left in place for the caller — query the scratch graph
 * UNION the target graph (ball facts + what was inferred from them), and call
 * dropScoped when done.
 */
export interface ScopedOptions {
  /** Entity IRIs (no angle brackets) the retrieval ball grows from. */
  seeds: string[];
  /**
   * BFS radius: how many undirected edges to walk out from the seeds.
   *
   * Caveat at hops >= 2 on typed data: rdf:type edges are walked undirected
   * like any other, so class IRIs act as hubs — seed → Class → every co-typed
   * instance — and ball size becomes dominated by class fan-in (bounded by
   * maxBallNodes, so cost stays capped but truncation gets likely). Same-
   * subject conflict detection (r08/r11/r22) needs only hops=1 plus attribute
   * completeness; prefer small radii and grow deliberately.
   */
  hops: number;
  tboxGraph: string;
  aboxGraphs: string[];
  /** Inferred-output graph; DROP+CREATEd by the fixpoint, like runFixpoint's. */
  targetGraph: string;
  /**
   * Ball-copy graph; defaults to `${targetGraph}-scope` (kg: graph names
   * allow only [A-Za-z0-9-] after the prefix, so suffixing stays well-formed).
   */
  scratchGraph?: string;
  closureCutoff: number;
  /**
   * Ball-size cap (default 10000). When the BFS would exceed it, expansion
   * stops and the result is flagged truncated=true — no throw.
   */
  maxBallNodes?: number;
}

export interface ScopedResult {
  /** IRI nodes collected by the BFS (seeds included). */
  ballNodes: number;
  /** Abox triples copied into the scratch graph (attribute completeness). */
  ballTriples: number;
  inferredCount: number;
  iterations: number;
  /** BFS + ball-copy time. */
  retrievalMs: number;
  /** Fixpoint time over the scratch graph. */
  reasoningMs: number;
  elapsedMs: number;
  /** True when maxBallNodes stopped the BFS before the full ball was collected. */
  truncated: boolean;
}

const DEFAULT_MAX_BALL_NODES = 10000;
/** VALUES batching keeps individual SPARQL queries bounded. */
const BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const asValues = (iris: string[]): string => iris.map((n) => `<${n}>`).join(' ');

/** One undirected frontier expansion: all IRI neighbours of `batch` across the abox graphs. */
async function neighbours(
  client: StorageAdapter,
  batch: string[],
  aboxGraphs: string[],
): Promise<string[]> {
  const edgeBlocks = aboxGraphs.map((g) => `
      { GRAPH <${g}> { ?x ?p ?n } }
      UNION
      { GRAPH <${g}> { ?n ?p ?x } }
  `).join('\n      UNION\n');
  const r = await client.select(`
    SELECT DISTINCT ?n WHERE {
      VALUES ?x { ${asValues(batch)} }
      ${edgeBlocks}
      FILTER (isIRI(?n))
    }
  `);
  return r.results.bindings.map((b) => b.n!.value);
}

/** Default scratch-graph name derived from the target graph. */
export function scopeScratchGraph(targetGraph: string): string {
  return `${targetGraph}-scope`;
}

export async function materializeScoped(
  client: StorageAdapter,
  opts: ScopedOptions,
): Promise<ScopedResult> {
  const t0 = Date.now();
  const maxBallNodes = opts.maxBallNodes ?? DEFAULT_MAX_BALL_NODES;
  const scratch = opts.scratchGraph ?? scopeScratchGraph(opts.targetGraph);

  // --- 1. BFS the k-hop undirected ball around the seeds -------------------
  const ball = new Set<string>();
  let truncated = false;
  const admit = (n: string): boolean => {
    if (ball.has(n)) return false;
    if (ball.size >= maxBallNodes) {
      truncated = true;
      return false;
    }
    ball.add(n);
    return true;
  };

  let frontier: string[] = [];
  for (const s of opts.seeds) {
    if (admit(s)) frontier.push(s);
  }
  for (let h = 0; h < opts.hops && frontier.length > 0 && !truncated; h++) {
    const next: string[] = [];
    for (const batch of chunk(frontier, BATCH_SIZE)) {
      for (const n of await neighbours(client, batch, opts.aboxGraphs)) {
        if (admit(n)) next.push(n);
      }
      if (truncated) break;
    }
    frontier = next;
  }

  // --- 2. Attribute completeness: copy every ball-subject abox triple ------
  await client.update(`DROP SILENT GRAPH <${scratch}>`);
  await client.update(`CREATE SILENT GRAPH <${scratch}>`);
  const subjectBlocks = opts.aboxGraphs
    .map((g) => `{ GRAPH <${g}> { ?s ?p ?o } }`)
    .join('\n      UNION\n      ');
  for (const batch of chunk([...ball], BATCH_SIZE)) {
    await client.update(`
      INSERT { GRAPH <${scratch}> { ?s ?p ?o } }
      WHERE {
        VALUES ?s { ${asValues(batch)} }
        ${subjectBlocks}
      }
    `);
  }
  const counted = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${scratch}> { ?s ?p ?o } }`,
  );
  const ballTriples = parseInt(counted.results.bindings[0]!.n!.value, 10);
  const retrievalMs = Date.now() - t0;

  // --- 3. Standard fixpoint, with the ball as the only instance data -------
  const t1 = Date.now();
  const { iterations, inferredCount } = await runFixpoint(client, RULES, {
    tboxGraph: opts.tboxGraph,
    aboxGraphs: [scratch],
    inferredGraph: opts.targetGraph,
    closureCutoff: opts.closureCutoff,
  });
  const reasoningMs = Date.now() - t1;

  return {
    ballNodes: ball.size,
    ballTriples,
    inferredCount,
    iterations,
    retrievalMs,
    reasoningMs,
    elapsedMs: Date.now() - t0,
    truncated,
  };
}

/** Drops a scoped run's output pair: the target graph and its scratch graph. */
export async function dropScoped(
  client: StorageAdapter,
  targetGraph: string,
  scratchGraph?: string,
): Promise<void> {
  for (const g of [scratchGraph ?? scopeScratchGraph(targetGraph), targetGraph]) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
  }
}
