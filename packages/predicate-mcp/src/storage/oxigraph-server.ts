import type { SelectResult, AskResult, SparqlError } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat } from './adapter.js';
import { ensureUp, type DaemonHandle } from './oxigraph-daemon.js';

function err(status: number, body: string): SparqlError {
  const e = new Error(`SPARQL error ${status}: ${body}`) as SparqlError;
  e.status = status;
  e.body = body;
  return e;
}

export interface OxigraphServerAdapterOptions {
  storePath: string;
}

export class OxigraphServerAdapter implements StorageAdapter {
  private storePath: string;
  private handle: DaemonHandle | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor(opts: OxigraphServerAdapterOptions) {
    this.storePath = opts.storePath;
  }

  async ready(): Promise<void> {
    if (this.readyPromise === null) {
      this.readyPromise = ensureUp(this.storePath).then((h) => { this.handle = h; });
    }
    await this.readyPromise;
  }

  private base(): string {
    if (!this.handle) throw new Error('OxigraphServerAdapter.ready() was not awaited');
    return `http://${this.handle.host}:${this.handle.port}`;
  }

  async select(query: string): Promise<SelectResult> {
    await this.ready();
    const res = await fetch(`${this.base()}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
      },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
    return (await res.json()) as SelectResult;
  }

  async ask(query: string): Promise<boolean> {
    await this.ready();
    const res = await fetch(`${this.base()}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
      },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
    const json = (await res.json()) as AskResult;
    return json.boolean;
  }

  async update(query: string): Promise<void> {
    await this.ready();
    const res = await fetch(`${this.base()}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
  }

  async knownGraphs(): Promise<string[]> {
    const r = await this.select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } FILTER(STRSTARTS(STR(?g), "kg:")) }',
    );
    return r.results.bindings.map((b) => b['g']!.value);
  }

  async loadTurtle(turtle: string, graph: string): Promise<void> {
    await this.ready();
    const url = `${this.base()}/store?graph=${encodeURIComponent(graph)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle' },
      body: turtle,
    });
    if (!res.ok) throw err(res.status, await res.text());
  }

  async serializeGraph(graph: string, format: TurtleFormat): Promise<string> {
    await this.ready();
    // Native Oxigraph supports RDF-star MIME types directly — no Fuseki workaround.
    const mime =
      format === 'turtle' ? 'text/turtle'
      : format === 'nt-star' ? 'application/n-triples-star'
      : 'application/n-triples';
    const url = `${this.base()}/store?graph=${encodeURIComponent(graph)}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': mime } });
    if (!res.ok) throw err(res.status, await res.text());
    return await res.text();
  }

  async clearGraph(graph: string): Promise<void> {
    await this.update(`DROP SILENT GRAPH <${graph}>`);
  }

  async close(): Promise<void> {
    // The daemon is shared across sessions; close() releases client state only.
    // Daemon lifecycle is owned by `predicate up` / `predicate down`.
  }
}
