import { Store, namedNode } from 'oxigraph';
import type { Term as OxiTermType } from 'oxigraph';
import type { SelectResult, Binding, Term } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat } from './adapter.js';

export interface OxigraphAdapterOptions {
  storePath: string; // ':memory:' or filesystem path (NOTE: 0.5.x bindings only support in-memory; storePath is reserved for future use)
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

  constructor(_opts: OxigraphAdapterOptions) {
    // The 0.5.x npm binding does not accept a path in the constructor;
    // the Store is always in-memory. storePath ':memory:' is the canonical
    // value; other values are accepted for API compatibility but ignored.
    this.store = new Store();
  }

  async ready(): Promise<void> {
    // Store opens synchronously in the constructor.
  }

  async close(): Promise<void> {
    // The Store releases on GC; no explicit close in 0.5.x bindings.
  }

  async select(query: string): Promise<SelectResult> {
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
    const result = this.store.query(query);
    if (typeof result === 'boolean') return result;
    throw new Error('ask() called with a non-ASK query');
  }

  async update(query: string): Promise<void> {
    this.store.update(query);
  }

  async knownGraphs(): Promise<string[]> {
    const r = await this.select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } FILTER(STRSTARTS(STR(?g), "kg:")) }',
    );
    return r.results.bindings.map((b) => b['g']!.value);
  }

  async loadTurtle(turtle: string, graph: string): Promise<void> {
    this.store.load(turtle, {
      format: 'text/turtle',
      to_graph_name: namedNode(graph),
    });
  }

  async serializeGraph(graph: string, format: TurtleFormat): Promise<string> {
    const mime =
      format === 'turtle' ? 'text/turtle'
      : format === 'nt-star' ? 'application/n-triples-star'
      : 'application/n-triples';
    return this.store.dump({ format: mime, from_graph_name: namedNode(graph) });
  }

  async clearGraph(graph: string): Promise<void> {
    await this.update(`DROP SILENT GRAPH <${graph}>`);
  }
}
