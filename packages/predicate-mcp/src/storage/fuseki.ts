import type { Config } from '../config.js';
import type { SelectResult, AskResult, SparqlError } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat } from './adapter.js';

function err(status: number, body: string): SparqlError {
  const e = new Error(`SPARQL error ${status}: ${body}`) as SparqlError;
  e.status = status;
  e.body = body;
  return e;
}

function authHeader(): string {
  const user = process.env.PREDICATE_ADMIN_USER ?? 'admin';
  const pass = process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export class FusekiAdapter implements StorageAdapter {
  constructor(private cfg: Config) {}

  async select(query: string): Promise<SelectResult> {
    const res = await fetch(this.cfg.queryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
        'Authorization': authHeader(),
      },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
    return (await res.json()) as SelectResult;
  }

  async ask(query: string): Promise<boolean> {
    const res = await fetch(this.cfg.queryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
        'Authorization': authHeader(),
      },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
    const json = (await res.json()) as AskResult;
    return json.boolean;
  }

  async update(query: string): Promise<void> {
    const res = await fetch(this.cfg.updateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
        'Authorization': authHeader(),
      },
      body: query,
    });
    if (!res.ok) throw err(res.status, await res.text());
  }

  async knownGraphs(): Promise<string[]> {
    const r = await this.select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } FILTER(STRSTARTS(STR(?g), "kg:")) }',
    );
    return r.results.bindings.map((b) => b.g!.value);
  }

  async loadTurtle(turtle: string, graph: string): Promise<void> {
    const url = `${this.cfg.dataEndpoint}?graph=${encodeURIComponent(graph)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle', 'Authorization': authHeader() },
      body: turtle,
    });
    if (!res.ok) throw err(res.status, await res.text());
  }

  async serializeGraph(graph: string, format: TurtleFormat): Promise<string> {
    // Fuseki 5.x (Jena) does not recognise application/n-triples-star and
    // returns 406 for that MIME type. RDF-star quoted-triple syntax is
    // preserved when the graph is serialised as Turtle, so we request
    // text/turtle for both 'turtle' and 'nt-star'. Plain 'nt' uses
    // application/n-triples as before (no RDF-star needed).
    const mime =
      format === 'nt' ? 'application/n-triples' : 'text/turtle';
    const url = `${this.cfg.dataEndpoint}?graph=${encodeURIComponent(graph)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': mime, 'Authorization': authHeader() },
    });
    if (!res.ok) throw err(res.status, await res.text());
    return await res.text();
  }

  async clearGraph(graph: string): Promise<void> {
    await this.update(`DROP SILENT GRAPH <${graph}>`);
    await this.update(`CREATE SILENT GRAPH <${graph}>`);
  }

  async ready(): Promise<void> {
    const url = `${this.cfg.fusekiUrl}/$/ping`;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) throw new Error(`fuseki not reachable at ${this.cfg.fusekiUrl}`);
  }

  async close(): Promise<void> {
    // HTTP client has no persistent state.
  }
}
