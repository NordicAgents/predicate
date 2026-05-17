import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://predicate.dev/meta#';
const PEERS_GRAPH = 'kg:peers';

interface PeerRow {
  uri: string;
  name: string;
  endpoint: string;
  addedAt: string;
  kind: string;
}

function help(): void {
  console.log(`predicate peer <subcommand> [args]

Manage the federation peer registry stored in kg:peers.

Subcommands:
  add <name> <sparql-endpoint>    Register a peer.
  remove <name>                   Unregister a peer.
  list [--json]                   List registered peers.
  --help                          Print this message.

Example:
  predicate peer add alice http://alice.local:3030/predicate/query
  predicate peer list
  kg_ask --include-remote ...     (see kg_ask docs)
`);
}

async function addPeer(client: SparqlClient, name: string, endpoint: string): Promise<number> {
  const uri = `urn:predicate:peer:${encodeURIComponent(name)}`;
  const now = new Date().toISOString();
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    DELETE { GRAPH <${PEERS_GRAPH}> { ${escapeIRI(uri)} ?p ?o } }
    WHERE  { GRAPH <${PEERS_GRAPH}> { ${escapeIRI(uri)} ?p ?o } }
  `);
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <${PEERS_GRAPH}> {
      ${escapeIRI(uri)} a pred:Peer ;
        pred:peerName ${escapeLiteral(name)} ;
        pred:peerEndpoint "${endpoint}"^^xsd:anyURI ;
        pred:peerAddedAt  "${now}"^^xsd:dateTime .
    } }
  `);
  console.log(`peer "${name}" registered → ${endpoint}`);
  return 0;
}

async function removePeer(client: SparqlClient, name: string): Promise<number> {
  const uri = `urn:predicate:peer:${encodeURIComponent(name)}`;
  await client.update(`
    DELETE { GRAPH <${PEERS_GRAPH}> { ${escapeIRI(uri)} ?p ?o } }
    WHERE  { GRAPH <${PEERS_GRAPH}> { ${escapeIRI(uri)} ?p ?o } }
  `);
  console.log(`peer "${name}" removed`);
  return 0;
}

async function listPeers(client: SparqlClient): Promise<PeerRow[]> {
  const r = await client.select(
    `PREFIX pred: <${META}>
     SELECT ?uri ?name ?endpoint ?addedAt ?kind
     WHERE {
       GRAPH <${PEERS_GRAPH}> {
         ?uri a pred:Peer ;
              pred:peerName ?name ;
              pred:peerEndpoint ?endpoint ;
              pred:peerAddedAt ?addedAt .
         OPTIONAL { ?uri pred:peerKind ?kind }
       }
     }
     ORDER BY ?name`,
  );
  return r.results.bindings.map((b) => ({
    uri:      b['uri']!.value,
    name:     b['name']!.value,
    endpoint: b['endpoint']!.value,
    addedAt:  b['addedAt']!.value,
    kind:     b['kind']?.value ?? 'team',
  }));
}

export async function peer(args: string[]): Promise<number> {
  if (args.length === 0 || args[0] === '--help') { help(); return args.length === 0 ? 2 : 0; }
  const sub = args[0];
  const client = new SparqlClient(loadConfig());
  await client.update(`CREATE SILENT GRAPH <${PEERS_GRAPH}>`);
  try {
    if (sub === 'add') {
      const name = args[1]; const endpoint = args[2];
      if (!name || !endpoint) { console.error('predicate peer add: usage: predicate peer add <name> <endpoint>'); return 2; }
      return await addPeer(client, name, endpoint);
    }
    if (sub === 'remove') {
      const name = args[1];
      if (!name) { console.error('predicate peer remove: usage: predicate peer remove <name>'); return 2; }
      return await removePeer(client, name);
    }
    if (sub === 'list') {
      const peers = await listPeers(client);
      if (args.includes('--json')) console.log(JSON.stringify(peers, null, 2));
      else if (peers.length === 0) console.log('(no peers registered — `predicate peer add <name> <endpoint>`)');
      else {
        const widths = [
          Math.max(4, ...peers.map((p) => p.name.length)),
          Math.max(4, ...peers.map((p) => p.kind.length)),
          Math.max(8, ...peers.map((p) => p.endpoint.length)),
        ];
        console.log(['name'.padEnd(widths[0]!), 'kind'.padEnd(widths[1]!), 'endpoint'.padEnd(widths[2]!), 'addedAt'].join('  '));
        for (const p of peers) console.log([p.name.padEnd(widths[0]!), p.kind.padEnd(widths[1]!), p.endpoint.padEnd(widths[2]!), p.addedAt].join('  '));
      }
      return 0;
    }
    console.error(`predicate peer: unknown subcommand "${sub}"`); help(); return 2;
  } catch (err) {
    console.error(`predicate peer failed: ${(err as Error).message}`);
    return 1;
  }
}
