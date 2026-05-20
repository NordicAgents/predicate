import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://predicate.dev/meta#';
const PEERS_GRAPH = 'kg:peers';

interface LdEndpoint { name: string; endpoint: string; description: string }

const WELL_KNOWN: LdEndpoint[] = [
  { name: 'dbpedia',  endpoint: 'https://dbpedia.org/sparql',         description: 'DBpedia — structured Wikipedia data' },
  { name: 'wikidata', endpoint: 'https://query.wikidata.org/sparql',  description: 'Wikidata — collaborative knowledge base' },
];

function help(): void {
  console.log(`predicate ld <subcommand> [args]

Linked-Data federation: query well-known public SPARQL endpoints
(DBpedia, Wikidata) without polluting local kg:abox.

Subcommands:
  init            Register the well-known LD endpoints as peers
                  (tagged with pred:peerKind "external-ld"). Idempotent.
  ask <query>     Run SPARQL against ALL registered external-ld peers
                  and merge the results. Prints \`?peer\` column to
                  indicate which endpoint each row came from.
  list [--json]   List registered external-ld peers.
  --help          Print this message.

Examples:
  predicate ld init
  predicate ld ask "PREFIX wdt: <http://www.wikidata.org/prop/direct/> SELECT ?label WHERE { ?s wdt:P31 wd:Q5 . ?s rdfs:label ?label } LIMIT 1"
`);
}

async function initLd(client: StorageAdapter): Promise<number> {
  let added = 0, kept = 0;
  for (const ep of WELL_KNOWN) {
    const uri = `urn:predicate:peer:${ep.name}`;
    // Idempotency: check if a peer with this name already exists in kg:peers.
    // We check by name rather than URI so manual `peer add dbpedia ...` is also detected.
    const existing = await client
      .ask(
        `PREFIX pred: <${META}>
         ASK { GRAPH <${PEERS_GRAPH}> {
           ?p a pred:Peer ; pred:peerName ${escapeLiteral(ep.name)} .
         } }`,
      )
      .catch(() => false);
    if (existing) { kept++; continue; }
    const now = new Date().toISOString();
    await client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <${PEERS_GRAPH}> {
        ${escapeIRI(uri)} a pred:Peer ;
          pred:peerName     ${escapeLiteral(ep.name)} ;
          pred:peerEndpoint "${ep.endpoint}"^^xsd:anyURI ;
          pred:peerKind     ${escapeLiteral('external-ld')} ;
          pred:peerAddedAt  "${now}"^^xsd:dateTime .
      } }
    `);
    added++;
  }
  console.log(`predicate ld init: ${added} added, ${kept} already present (${WELL_KNOWN.length} total well-known endpoints).`);
  return 0;
}

async function listLd(client: StorageAdapter, json: boolean): Promise<number> {
  const r = await client.select(
    `PREFIX pred: <${META}>
     SELECT ?name ?endpoint WHERE {
       GRAPH <${PEERS_GRAPH}> {
         ?p a pred:Peer ;
            pred:peerName ?name ;
            pred:peerEndpoint ?endpoint ;
            pred:peerKind "external-ld" .
       }
     } ORDER BY ?name`,
  );
  const rows = r.results.bindings.map((b) => ({
    name:     b['name']!.value,
    endpoint: b['endpoint']!.value,
  }));
  if (json) console.log(JSON.stringify(rows, null, 2));
  else if (rows.length === 0) console.log('(no external-ld peers — run `predicate ld init`)');
  else {
    const w = Math.max(4, ...rows.map((r) => r.name.length));
    console.log(['name'.padEnd(w), 'endpoint'].join('  '));
    for (const r of rows) console.log([r.name.padEnd(w), r.endpoint].join('  '));
  }
  return 0;
}

interface LdRow { peer: string; binding: Record<string, { value: string; type: string }>; }

async function askLd(client: StorageAdapter, query: string, json: boolean): Promise<number> {
  const peers = await client.select(
    `PREFIX pred: <${META}>
     SELECT ?name ?endpoint WHERE {
       GRAPH <${PEERS_GRAPH}> {
         ?p a pred:Peer ;
            pred:peerName ?name ;
            pred:peerEndpoint ?endpoint ;
            pred:peerKind "external-ld" .
       }
     }`,
  );
  if (peers.results.bindings.length === 0) {
    console.error('predicate ld ask: no external-ld peers registered. Run `predicate ld init` first.');
    return 2;
  }
  const allRows: LdRow[] = [];
  for (const p of peers.results.bindings) {
    const name = p['name']!.value;
    const endpoint = p['endpoint']!.value;
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'predicate-skill (https://github.com/NordicAgents/predicate)',
        },
        body: 'query=' + encodeURIComponent(query),
      });
      if (!r.ok) {
        console.error(`predicate ld ask: ${name} returned ${r.status}`);
        continue;
      }
      const data = await r.json() as { results: { bindings: Array<Record<string, { value: string; type: string }>> } };
      for (const b of data.results.bindings) allRows.push({ peer: name, binding: b });
    } catch (err) {
      console.error(`predicate ld ask: ${name} failed: ${(err as Error).message}`);
    }
  }
  if (json) console.log(JSON.stringify(allRows, null, 2));
  else if (allRows.length === 0) console.log('(no results from any external-ld peer)');
  else {
    // Render a table — discover columns from the first row's binding keys.
    const cols = Object.keys(allRows[0]!.binding);
    const header = ['peer', ...cols];
    const widths = header.map((h, i) => {
      if (i === 0) return Math.max(4, ...allRows.map((r) => r.peer.length));
      const k = cols[i - 1]!;
      return Math.max(h.length, ...allRows.map((r) => (r.binding[k]?.value ?? '').length));
    });
    console.log(header.map((h, i) => h.padEnd(widths[i]!)).join('  '));
    for (const r of allRows) {
      const cells = [r.peer, ...cols.map((c) => r.binding[c]?.value ?? '')];
      console.log(cells.map((c, i) => c.padEnd(widths[i]!)).join('  '));
    }
  }
  return 0;
}

export async function ld(args: string[]): Promise<number> {
  if (args.length === 0 || args[0] === '--help') { help(); return args.length === 0 ? 2 : 0; }
  const sub = args[0];
  const client = getAdapter();
  await client.update(`CREATE SILENT GRAPH <${PEERS_GRAPH}>`);
  try {
    if (sub === 'init') return await initLd(client);
    if (sub === 'list') return await listLd(client, args.includes('--json'));
    if (sub === 'ask')  {
      const query = args.slice(1).filter((a) => a !== '--json').join(' ').trim();
      if (!query) { console.error('predicate ld ask: query argument required'); return 2; }
      return await askLd(client, query, args.includes('--json'));
    }
    console.error(`predicate ld: unknown subcommand "${sub}"`); help(); return 2;
  } catch (err) {
    console.error(`predicate ld failed: ${(err as Error).message}`);
    return 1;
  }
}
