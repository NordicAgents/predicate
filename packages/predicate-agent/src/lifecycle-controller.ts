import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { ScaleTier } from './types.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const COUNTED_GRAPHS = ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage'];
const META = 'https://industriagents.com/predicate/meta#';

export type MoveSelector =
  | { kind: 'ground'; tripleBlock: string }                 // concrete `s p o .` block
  | { kind: 'where'; whereClause: string };                 // pattern that binds ?s ?p ?o

export interface MoveOptions {
  fromGraph: string;
  toGraph: string;
  selector: MoveSelector;
  eventType: 'SchemaDemoted' | 'MaintenanceArchive';
  goalIri: string;
  payload: Record<string, unknown>;
}

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

  private newEventId(kind: string): string {
    return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Moves triples from `opts.fromGraph` to `opts.toGraph` according to the
   * given selector, then unconditionally drops kg:inferred so the next
   * reasoner pass re-materialises without the moved axioms, and emits a
   * provenance event into kg:meta.
   */
  async move(opts: MoveOptions): Promise<void> {
    if (opts.selector.kind === 'ground') {
      const block = opts.selector.tripleBlock;
      await this.client.update(
        `DELETE DATA { GRAPH ${escapeIRI(opts.fromGraph)} { ${block} } } ;\n` +
        `INSERT DATA { GRAPH ${escapeIRI(opts.toGraph)} { ${block} } }`,
      );
    } else {
      await this.client.update(`
        PREFIX pred: <${META}>
        PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
        DELETE { GRAPH ${escapeIRI(opts.fromGraph)} { ?s ?p ?o } }
        INSERT { GRAPH ${escapeIRI(opts.toGraph)}   { ?s ?p ?o } }
        WHERE  { ${opts.selector.whereClause} }
      `);
    }
    await this.client.update(`DROP SILENT GRAPH <kg:inferred>`);
    const eventId = this.newEventId(opts.eventType.toLowerCase());
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:meta> {
        ${escapeIRI(eventId)} a ${escapeIRI(META + opts.eventType)} ;
          pred:at      "${new Date().toISOString()}"^^xsd:dateTime ;
          pred:actor   "LifecycleController" ;
          pred:goal    ${escapeIRI(opts.goalIri)} ;
          pred:payload ${escapeLiteral(JSON.stringify(opts.payload))} .
      } }
    `);
  }

  async scaleSignal(): Promise<ScaleSignal> {
    let tripleCount = 0;
    for (const g of COUNTED_GRAPHS) {
      const r = await this.client.select(
        `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${g}> { ?s ?p ?o } }`,
      );
      const raw = r.results.bindings[0]?.['n']?.value;
      const n = raw ? parseInt(raw, 10) : 0;
      tripleCount += Number.isNaN(n) ? 0 : n;
    }
    return {
      tier: tripleCount >= this.scaleGateTriples ? 'Active' : 'Seedling',
      tripleCount,
      threshold: this.scaleGateTriples,
    };
  }
}
