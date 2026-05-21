import { Store, namedNode } from 'oxigraph';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Term as OxiTermType } from 'oxigraph';
import type { SelectResult, Binding, Term } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat } from './adapter.js';

// Best-effort: a crash between debounced writes loses uncommitted triples; tests use ':memory:' to avoid this entirely.

export interface OxigraphAdapterOptions {
  storePath: string; // ':memory:' or filesystem path for per-graph .nq file persistence
}

const KG_IRI_RE = /^kg:[A-Za-z0-9-]+$/;
const GRAPH_IRI_RE = /GRAPH\s+<([^>]+)>/gi;

const FLUSH_DEBOUNCE_MS = ((): number => {
  const env = process.env['PREDICATE_FLUSH_DEBOUNCE_MS'];
  const n = env !== undefined ? parseInt(env, 10) : NaN;
  return isNaN(n) ? 300 : n;
})();

function graphIriToFilename(iri: string): string {
  return encodeURIComponent(iri) + '.nq';
}

function filenameToGraphIri(basename: string): string | null {
  if (!basename.endsWith('.nq')) return null;
  const encoded = basename.slice(0, -3);
  try {
    const iri = decodeURIComponent(encoded);
    return KG_IRI_RE.test(iri) ? iri : null;
  } catch {
    return null;
  }
}

function extractDirtyGraphs(sparqlUpdate: string): Set<string> | 'ALL' {
  const graphs = new Set<string>();
  let match: RegExpExecArray | null;
  GRAPH_IRI_RE.lastIndex = 0;
  while ((match = GRAPH_IRI_RE.exec(sparqlUpdate)) !== null) {
    graphs.add(match[1]!);
  }
  return graphs.size > 0 ? graphs : 'ALL';
}

function oxiTermToTerm(t: OxiTermType): Term {
  if (t.termType === 'NamedNode') return { type: 'uri', value: t.value };
  if (t.termType === 'BlankNode') return { type: 'bnode', value: t.value };
  if (t.termType === 'Literal') {
    const term: Term = { type: 'literal', value: t.value };
    if (t.language) term['xml:lang'] = t.language;
    if (
      t.datatype &&
      t.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string'
    ) {
      term.datatype = t.datatype.value;
    }
    return term;
  }
  // DefaultGraph / Variable — should not appear in SELECT bindings
  return { type: 'uri', value: t.value };
}

export class OxigraphAdapter implements StorageAdapter {
  private store: Store;
  private storePath: string;
  private dirtyGraphs: Set<string> = new Set();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor(opts: OxigraphAdapterOptions) {
    // The 0.5.x npm binding does not accept a path in the constructor;
    // the Store is always in-memory. storePath ':memory:' is the canonical
    // value; other values are accepted for API compatibility but trigger
    // per-graph .nq file persistence.
    this.store = new Store();
    this.storePath = opts.storePath;
  }

  private get isPersisted(): boolean {
    return this.storePath !== ':memory:';
  }

  // Idempotent: the persisted .nq files are loaded into the in-memory store
  // exactly once, on the first call. Every data-access method awaits this, so
  // callers that never call ready() explicitly (the MCP server boot, the read
  // CLIs, the eval scripts) still see persisted data on their first query.
  async ready(): Promise<void> {
    if (!this.isPersisted) return;
    if (this.loadPromise === null) {
      this.loadPromise = this.loadFromDisk();
    }
    await this.loadPromise;
  }

  private async loadFromDisk(): Promise<void> {
    await fs.mkdir(this.storePath, { recursive: true });

    const entries = await fs.readdir(this.storePath);
    for (const entry of entries) {
      const iri = filenameToGraphIri(entry);
      if (iri === null) continue;

      const filePath = join(this.storePath, entry);
      const content = await fs.readFile(filePath, 'utf8');
      if (content.trim().length > 0) {
        // dump() with from_graph_name strips the graph IRI; restore it via to_graph_name on load
        this.store.load(content, {
          format: 'application/n-quads',
          to_graph_name: namedNode(iri),
        });
      }
    }
  }

  async close(): Promise<void> {
    if (!this.isPersisted) return;

    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Run flush synchronously (awaiting any already-in-flight write)
    if (this.flushPromise !== null) {
      await this.flushPromise;
    }
    await this.flushDirty();
  }

  private scheduleDebouncedFlush(): void {
    if (!this.isPersisted) return;

    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPromise = this.flushDirty().finally(() => {
        this.flushPromise = null;
      });
    }, FLUSH_DEBOUNCE_MS);
  }

  private async flushDirty(): Promise<void> {
    if (this.dirtyGraphs.size === 0) return;

    // Collect the set of graph IRIs to flush
    let graphsToFlush: string[];
    if (this.dirtyGraphs.has('ALL')) {
      // Flush every kg: graph the store knows about
      const known = await this.knownGraphs();
      graphsToFlush = known;
    } else {
      graphsToFlush = Array.from(this.dirtyGraphs).filter((g) =>
        KG_IRI_RE.test(g),
      );
    }

    this.dirtyGraphs.clear();

    for (const iri of graphsToFlush) {
      const content = this.store.dump({
        format: 'application/n-quads',
        from_graph_name: namedNode(iri),
      });
      // Store.dump returns string for application/n-quads
      const basename = graphIriToFilename(iri);
      const finalPath = join(this.storePath, basename);
      const tmpPath = finalPath + '.tmp';
      await fs.writeFile(tmpPath, content, 'utf8');
      await fs.rename(tmpPath, finalPath);
    }
  }

  private markDirty(graphs: Set<string> | 'ALL'): void {
    if (!this.isPersisted) return;

    if (graphs === 'ALL') {
      this.dirtyGraphs.add('ALL');
    } else {
      for (const g of graphs) {
        this.dirtyGraphs.add(g);
      }
    }
    this.scheduleDebouncedFlush();
  }

  async select(query: string): Promise<SelectResult> {
    await this.ready();
    // query() returns Map<string, OxiTerm>[] for SELECT queries
    const raw = this.store.query(query);
    if (!Array.isArray(raw)) {
      throw new Error('select() called with a non-SELECT query');
    }
    const results = raw as Map<string, OxiTermType>[];
    const firstRow = results[0];
    const vars = firstRow !== undefined ? Array.from(firstRow.keys()) : [];
    const bindings: Binding[] = results.map((row) => {
      const b: Binding = {};
      for (const [k, v] of row.entries()) b[k] = oxiTermToTerm(v);
      return b;
    });
    return { head: { vars }, results: { bindings } };
  }

  async ask(query: string): Promise<boolean> {
    await this.ready();
    const result = this.store.query(query);
    if (typeof result === 'boolean') return result;
    throw new Error('ask() called with a non-ASK query');
  }

  async update(query: string): Promise<void> {
    await this.ready();
    this.store.update(query);
    this.markDirty(extractDirtyGraphs(query));
  }

  async knownGraphs(): Promise<string[]> {
    const r = await this.select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } FILTER(STRSTARTS(STR(?g), "kg:")) }',
    );
    return r.results.bindings.map((b) => b['g']!.value);
  }

  async loadTurtle(turtle: string, graph: string): Promise<void> {
    await this.ready();
    this.store.load(turtle, {
      format: 'text/turtle',
      to_graph_name: namedNode(graph),
    });
    this.markDirty(new Set([graph]));
  }

  async serializeGraph(graph: string, format: TurtleFormat): Promise<string> {
    await this.ready();
    const mime =
      format === 'turtle' ? 'text/turtle'
      : format === 'nt-star' ? 'application/n-triples-star'
      : 'application/n-triples';
    return this.store.dump({ format: mime, from_graph_name: namedNode(graph) });
  }

  async clearGraph(graph: string): Promise<void> {
    await this.update(`DROP SILENT GRAPH <${graph}>`);
  }

  /**
   * Delete all RDF-star annotation quads for a quoted triple `<< s p o >>` inside
   * a named graph, along with the base triple `s p o` itself.
   *
   * Oxigraph 0.5.x stores RDF-star annotations internally as blank-node reification
   * pairs and does not support `<<>>` in SPARQL Update operations at all.  This
   * method uses the lower-level quad API (`Store.match` + `Store.delete`) to work
   * around that limitation.
   *
   * @param graphIri  The named graph IRI (compact kg: form OK, e.g. "kg:tbox-staging")
   * @param proposalId  The IRI of the proposal whose annotation quads should be removed
   */
  deleteRdfStarAnnotationsForProposal(graphIri: string, proposalId: string): void {
    const PROPOSAL_PRED = 'https://predicate.dev/meta#proposalId';
    const graphNode = namedNode(graphIri);
    const proposalNode = namedNode(proposalId);

    // Find all quads in the graph where the predicate is pred:proposalId and the
    // object is the target proposal IRI.  These quads have a BlankNode subject
    // (Oxigraph's internal reification bnode for the quoted triple).
    const annotationQuads = [
      ...this.store.match(null, namedNode(PROPOSAL_PRED), proposalNode, graphNode),
    ];

    for (const aq of annotationQuads) {
      const bnode = aq.subject;
      // Delete every quad in the graph that has this bnode as its subject
      // (the annotation quad itself + the synthetic rdf:reifies quad).
      const bnodeQuads = [...this.store.match(bnode, null, null, graphNode)];
      for (const bq of bnodeQuads) {
        this.store.delete(bq);
      }
    }

    this.markDirty(new Set([graphIri]));
  }

  /**
   * Delete all RDF-star provenance annotations (the reification bnode and every
   * quad hanging off it) for each of the given base triples, inside a named graph.
   *
   * Like {@link deleteRdfStarAnnotationsForProposal}, this exists because Oxigraph
   * 0.5.x cannot express `<<>>`-quoted triples in SPARQL Update. We enumerate the
   * synthetic `rdf:reifies` quads (whose object is the quoted triple) via the quad
   * API and match on the base triple's term values.
   *
   * @param graphIri  The named graph holding the provenance annotations (e.g. "kg:provenance")
   * @param triples   The base triples whose annotations should be removed, as term-value strings
   */
  deleteRdfStarProvenanceForTriples(
    graphIri: string,
    triples: Array<{ s: string; p: string; o: string }>,
  ): void {
    if (triples.length === 0) return;
    const RDF_REIFIES = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies';
    const graphNode = namedNode(graphIri);
    const SEP = ' ';
    const targets = new Set(triples.map((t) => `${t.s}${SEP}${t.p}${SEP}${t.o}`));

    const reifyQuads = [...this.store.match(null, namedNode(RDF_REIFIES), null, graphNode)];
    for (const rq of reifyQuads) {
      const qt = rq.object as { termType: string; subject?: { value: string }; predicate?: { value: string }; object?: { value: string } };
      if (qt.subject === undefined || qt.predicate === undefined || qt.object === undefined) continue;
      const key = `${qt.subject.value}${SEP}${qt.predicate.value}${SEP}${qt.object.value}`;
      if (!targets.has(key)) continue;

      const bnode = rq.subject;
      for (const bq of this.store.match(bnode, null, null, graphNode)) {
        this.store.delete(bq);
      }
    }

    this.markDirty(new Set([graphIri]));
  }
}
