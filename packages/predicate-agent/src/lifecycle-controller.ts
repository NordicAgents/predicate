import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { ScaleTier } from './types.js';

const COUNTED_GRAPHS = ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage'];

export interface LifecycleControllerOptions {
  /** Total-triple threshold. At/above => Active; below => Seedling. */
  scaleGateTriples?: number;
}

export interface ScaleSignal {
  tier: ScaleTier;
  tripleCount: number;
  threshold: number;
}

export class LifecycleController {
  private scaleGateTriples: number;

  constructor(private client: StorageAdapter, opts: LifecycleControllerOptions = {}) {
    this.scaleGateTriples = opts.scaleGateTriples ?? 25000;
  }

  async scaleSignal(): Promise<ScaleSignal> {
    let tripleCount = 0;
    for (const g of COUNTED_GRAPHS) {
      const r = await this.client.select(
        `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${g}> { ?s ?p ?o } }`,
      );
      tripleCount += parseInt(r.results.bindings[0]!['n']!.value, 10);
    }
    return {
      tier: tripleCount >= this.scaleGateTriples ? 'Active' : 'Seedling',
      tripleCount,
      threshold: this.scaleGateTriples,
    };
  }
}
