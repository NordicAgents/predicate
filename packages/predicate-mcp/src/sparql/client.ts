import type { Config } from '../config.js';
import type { SelectResult, AskResult, SparqlError } from './types.js';

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

export class SparqlClient {
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
}
