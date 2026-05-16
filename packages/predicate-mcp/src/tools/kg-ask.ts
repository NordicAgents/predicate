import { SparqlClient } from '../sparql/client.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';
import type { Binding } from '../sparql/types.js';

export interface AskInput {
  question: string;
  sparql: string;
  maxRows?: number;
}

export interface AskOutput {
  vars: string[];
  bindings: Binding[];
  truncated: boolean;
  rowCount: number;
}

const FORBIDDEN = /\b(INSERT|DELETE|DROP|CREATE|CLEAR|LOAD)\b/i;
const DEFAULT_MAX = 200;

export async function kgAsk(client: SparqlClient, input: AskInput): Promise<AskOutput> {
  if (FORBIDDEN.test(input.sparql)) {
    throw new Error('kg_ask is read-only; got update keyword in SPARQL');
  }
  const maxRows = input.maxRows ?? DEFAULT_MAX;
  const t0 = Date.now();
  const r = await client.select(input.sparql);
  const elapsedMs = Date.now() - t0;

  await logUsage(client, input.question, input.sparql, r.results.bindings.length, elapsedMs);

  const truncated = r.results.bindings.length > maxRows;
  const bindings = truncated ? r.results.bindings.slice(0, maxRows) : r.results.bindings;
  return {
    vars: r.head.vars,
    bindings,
    truncated,
    rowCount: r.results.bindings.length,
  };
}

async function logUsage(
  client: SparqlClient,
  question: string,
  sparql: string,
  rowCount: number,
  elapsedMs: number,
): Promise<void> {
  const usage = escapeIRI(GRAPH.usage);
  const id = `urn:predicate:usage:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const META = 'https://predicate.dev/meta#';
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH ${usage} {
      <${id}> a pred:Query ;
              pred:question ${escapeLiteral(question)} ;
              pred:sparql   ${escapeLiteral(sparql)} ;
              pred:rowCount "${rowCount}"^^xsd:integer ;
              pred:elapsedMs "${elapsedMs}"^^xsd:integer ;
              pred:at        "${new Date().toISOString()}"^^xsd:dateTime .
    } }
  `);
}
