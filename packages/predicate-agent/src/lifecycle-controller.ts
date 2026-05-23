import { readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { ScaleTier, DemoteDecision } from './types.js';
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

  private promotedDir(): string {
    return process.env['PREDICATE_PROMOTED_DIR']
      ?? (process.env['PREDICATE_STORE_PATH']
        ? resolve(process.env['PREDICATE_STORE_PATH'], 'promoted')
        : resolve(process.cwd(), '.predicate', 'promoted'));
  }

  /**
   * Reverse a schema promotion by proposal id. Reads the promoted Turtle file
   * written at promotion time to learn exactly which triples to move out of
   * kg:tbox into kg:tbox-demoted (dropping kg:inferred and emitting a
   * SchemaDemoted event via `move`), then relocates the file from promoted/ to
   * demoted/ so git records what is no longer live.
   */
  async demoteById(
    proposalId: string,
    opts: { reason: string; actor: string },
  ): Promise<DemoteDecision> {
    const safe = proposalId.replace(/[^A-Za-z0-9-]/g, '_');
    const promotedFile = resolve(this.promotedDir(), `${safe}.ttl`);
    if (!existsSync(promotedFile)) {
      return { proposalId, outcome: 'not-found', reason: 'no promoted Turtle file for this proposal' };
    }
    const tripleBlock = readFileSync(promotedFile, 'utf8').trim();
    if (!tripleBlock) {
      return { proposalId, outcome: 'not-found', reason: 'promoted Turtle file is empty' };
    }
    const tboxVersion = `urn:predicate:tbox:v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    // Order matters: mutate the store (move triples + drop inferred + log) BEFORE
    // relocating the file. This ordering is crash-recoverable: RDF graphs are sets,
    // so if renameSync below fails, a re-run finds the still-present promoted/<id>.ttl,
    // re-runs move() as a harmless no-op (DELETE finds nothing in kg:tbox, INSERT
    // dedups in kg:tbox-demoted), and completes the rename. File-first ordering would
    // instead leave the store live but the file relocated -> a stuck, unrecoverable state.
    await this.move({
      fromGraph: 'kg:tbox',
      toGraph: 'kg:tbox-demoted',
      selector: { kind: 'ground', tripleBlock },
      eventType: 'SchemaDemoted',
      goalIri: proposalId,
      payload: { proposalId, reason: opts.reason, actor: opts.actor, tboxVersion },
    });
    // relocate promoted/<id>.ttl -> demoted/<id>.ttl (git's record of what is no longer live)
    const demotedDir = resolve(this.promotedDir(), '..', 'demoted');
    mkdirSync(demotedDir, { recursive: true });
    const demotedFile = resolve(demotedDir, `${safe}.ttl`);
    renameSync(promotedFile, demotedFile);
    return { proposalId, outcome: 'demoted', demotedFile, tboxVersion };
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
