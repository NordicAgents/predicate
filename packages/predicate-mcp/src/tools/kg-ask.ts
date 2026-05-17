import { SparqlClient } from '../sparql/client.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';
import type { Binding } from '../sparql/types.js';

export interface AskInput {
  question: string;
  sparql: string;
  maxRows?: number;
  includeRemote?: boolean;
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

  if (input.includeRemote) {
    const result = await askWithRemote(client, input.sparql);
    const elapsedMs = Date.now() - t0;
    await logUsage(client, input.question, input.sparql, result.bindings.length, elapsedMs);
    const truncated = result.bindings.length > maxRows;
    const bindings = truncated ? result.bindings.slice(0, maxRows) : result.bindings;
    return {
      vars: result.vars,
      bindings,
      truncated,
      rowCount: result.bindings.length,
    };
  }

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

interface PeerInfo {
  name: string;
  endpoint: string;
}

async function listPeers(client: SparqlClient): Promise<PeerInfo[]> {
  const META = 'https://predicate.dev/meta#';
  const r = await client.select(
    `PREFIX pred: <${META}>
     SELECT ?name ?endpoint WHERE {
       GRAPH <${GRAPH.peers}> {
         ?p a pred:Peer ;
            pred:peerName ?name ;
            pred:peerEndpoint ?endpoint .
       }
     }`,
  );
  return r.results.bindings.map((b) => ({
    name: b['name']!.value,
    endpoint: b['endpoint']!.value,
  }));
}

async function askWithRemote(
  client: SparqlClient,
  sparql: string,
): Promise<{ vars: string[]; bindings: Binding[] }> {
  let peers: PeerInfo[] = [];
  try {
    peers = await listPeers(client);
  } catch {
    // peers graph might not exist yet — proceed local-only
    peers = [];
  }

  // Local result
  const local = await client.select(sparql);
  const vars = [...local.head.vars];
  if (!vars.includes('peer')) vars.push('peer');
  const merged: Binding[] = local.results.bindings.map((row) => ({
    ...row,
    peer: { type: 'literal', value: 'local' },
  }));

  for (const p of peers) {
    try {
      const remote = await fetch(p.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/sparql-results+json',
        },
        body: 'query=' + encodeURIComponent(sparql),
      });
      if (remote.ok) {
        const json = (await remote.json()) as {
          head?: { vars?: string[] };
          results?: { bindings?: Binding[] };
        };
        const peerBindings = json.results?.bindings ?? [];
        for (const row of peerBindings) {
          merged.push({ ...row, peer: { type: 'literal', value: p.name } });
        }
      } else {
        console.error(`kg_ask: peer "${p.name}" returned ${remote.status}; skipping`);
      }
    } catch (err) {
      // swallow per-peer errors so a dead peer doesn't break the query
      console.error(`kg_ask: peer "${p.name}" unreachable (${(err as Error).message}); skipping`);
    }
  }

  return { vars, bindings: merged };
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
