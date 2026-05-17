# Predicate Phase 14 — Team Federation (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ship the minimum viable federation primitives: export local session deltas as TriG, import a teammate's TriG into a separate namespace graph, and register a remote SPARQL endpoint so queries can optionally union local + remote results. No realtime sync, no conflict resolution, no auth — those are v2. Tag v1.11.0-federation-mvp.

**Architecture:** Two simple commands and one Fuseki configuration helper.

1. **`predicate export-sessions [--since DATE] > out.trig`** — dumps `kg:abox` triples for sessions newer than `--since` (default 7 days) as a TriG file. The graph name inside the TriG is `urn:predicate:export:<user>:<timestamp>` so an importer can keep multiple peers' data separate.

2. **`predicate import-sessions <file.trig>`** — loads a TriG into Fuseki, preserving the embedded graph names. Imported data lands in `kg:abox-remote-<peer-id>` (one named graph per peer, NOT mixed into local `kg:abox`).

3. **`predicate peer add <name> <sparql-endpoint>` / `predicate peer list` / `predicate peer remove <name>`** — manages a peer registry stored in `kg:peers`. Each peer has a URI, a label, and a SPARQL endpoint.

4. **`kg_ask --include-remote`** — runs the user's SPARQL against the local store AND every registered peer endpoint via SPARQL `SERVICE`, unioning results. Each result row gets a `?peer` column indicating where it came from. (Implementation-wise: the CLI wraps the user's SELECT in a UNION with `SERVICE <endpoint>` blocks.)

**Out of scope (deferred):**
- Auth / TLS — peers are trusted localhost endpoints for the MVP. Document that exposing the Fuseki endpoint publicly without auth is the user's problem.
- Realtime sync — push/pull is manual; teammates exchange .trig files.
- Conflict resolution — there are no conflicts because each peer's data lives in a separate named graph.
- Cross-user identity reconciliation — `file:///work/auth.ts` from Alice and from Bob are different RDF resources unless someone manually `owl:sameAs`'s them.

**Tech Stack:** Existing SparqlClient. New TriG serialization via Fuseki's CONSTRUCT-with-TRIG-content-type or N3 library if needed. No new heavy deps.

---

## File Structure

**New files:**
- `packages/predicate-cli/src/commands/export-sessions.ts`
- `packages/predicate-cli/src/commands/import-sessions.ts`
- `packages/predicate-cli/src/commands/peer.ts` (handles `add`/`list`/`remove`)
- `packages/predicate-cli/tests/export-sessions.test.ts`
- `packages/predicate-cli/tests/import-sessions.test.ts`
- `packages/predicate-cli/tests/peer.test.ts`

**Modified files:**
- `packages/predicate-cli/src/index.ts` — register the new commands.
- `packages/predicate-mcp/src/graphs.ts` — add `peers: 'kg:peers'` (need to create the graph at bootstrap too).
- `packages/predicate-server/scripts/bootstrap-graphs.sh` — add `kg:peers` to the list of created graphs.
- `packages/predicate-mcp/src/tools/kg-ask.ts` — add `includeRemote: boolean` flag; when true, query peer registry, wrap user SPARQL with SERVICE blocks. Update the MCP tool registration accordingly.
- `packages/predicate-mcp/src/tools/registry.ts` — add `includeRemote` to the kg_ask zod schema.
- `packages/predicate-ontology/meta/predicate-meta.ttl` — declare `pred:Peer` class + properties.
- `packages/predicate-skill/skills/predicate/SKILL.md` — add federation primer.
- Version bumps to 1.11.0.

---

### Task 1: Meta vocab — `pred:Peer`

Append to `packages/predicate-ontology/meta/predicate-meta.ttl`:

```turtle

# --- Peer registry (federation) ----------------------------------

pred:Peer       a owl:Class ; rdfs:label "Registered federation peer" .
pred:peerName   a owl:DatatypeProperty ;
                rdfs:domain pred:Peer ; rdfs:range xsd:string .
pred:peerEndpoint a owl:DatatypeProperty ;
                rdfs:domain pred:Peer ; rdfs:range xsd:anyURI .
pred:peerAddedAt a owl:DatatypeProperty ;
                rdfs:domain pred:Peer ; rdfs:range xsd:dateTime .
```

Bump `version.json` 0.5.0 → 0.6.0. Reload via bootstrap-graphs.sh.

### Task 2: `predicate peer add/list/remove`

Create `packages/predicate-cli/src/commands/peer.ts`:

```typescript
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
     SELECT ?uri ?name ?endpoint ?addedAt
     WHERE {
       GRAPH <${PEERS_GRAPH}> {
         ?uri a pred:Peer ;
              pred:peerName ?name ;
              pred:peerEndpoint ?endpoint ;
              pred:peerAddedAt ?addedAt .
       }
     }
     ORDER BY ?name`,
  );
  return r.results.bindings.map((b) => ({
    uri:      b['uri']!.value,
    name:     b['name']!.value,
    endpoint: b['endpoint']!.value,
    addedAt:  b['addedAt']!.value,
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
          Math.max(8, ...peers.map((p) => p.endpoint.length)),
        ];
        console.log(['name'.padEnd(widths[0]), 'endpoint'.padEnd(widths[1]), 'addedAt'].join('  '));
        for (const p of peers) console.log([p.name.padEnd(widths[0]), p.endpoint.padEnd(widths[1]), p.addedAt].join('  '));
      }
      return 0;
    }
    console.error(`predicate peer: unknown subcommand "${sub}"`); help(); return 2;
  } catch (err) {
    console.error(`predicate peer failed: ${(err as Error).message}`);
    return 1;
  }
}
```

### Task 3: `predicate export-sessions`

Create `packages/predicate-cli/src/commands/export-sessions.ts`. Outputs TriG to stdout (so users can pipe to a file).

```typescript
import { loadConfig } from 'predicate-mcp/src/config.js';

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function help(): void {
  console.log(`predicate export-sessions [--since DATE] [--user NAME] > out.trig

Export local kg:abox session-history triples as TriG (one named graph
containing all triples for sessions started after --since).

Options:
  --since DATE   ISO 8601 datetime cutoff (default: 7 days ago).
  --user NAME    Tag the export graph name with this user identifier
                 (default: \$USER env var).
  --help         Print this message.

Example:
  predicate export-sessions --since 2026-05-10 --user alice > alice.trig
  # send alice.trig to teammate; they run:
  predicate import-sessions alice.trig
`);
}

export async function exportSessions(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const cfg = loadConfig();
  const since = parseFlag(args, '--since') ?? new Date(Date.now() - 7 * 86400_000).toISOString();
  const user = parseFlag(args, '--user') ?? process.env['USER'] ?? 'anonymous';
  const exportGraph = `urn:predicate:export:${encodeURIComponent(user)}:${new Date().toISOString()}`;

  const query = `
    PREFIX pred: <https://predicate.dev/meta#>
    CONSTRUCT { ?s ?p ?o }
    WHERE {
      GRAPH <kg:abox> {
        ?session a pred:Session ; pred:at ?at .
        FILTER (?at >= "${since}"^^<http://www.w3.org/2001/XMLSchema#dateTime>)
        ?s ?p ?o .
        FILTER (?s = ?session ||
                EXISTS { ?s ?_p1 ?session } ||
                EXISTS { ?session ?_p2 ?s })
      }
    }
  `;

  try {
    const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/n-triples' },
      body: 'query=' + encodeURIComponent(query),
    });
    if (!r.ok) {
      console.error(`predicate export-sessions: SPARQL error ${r.status}`);
      return 1;
    }
    const ntriples = await r.text();
    // Wrap into TriG with the export graph name.
    console.log(`<${exportGraph}> {`);
    console.log(ntriples.split('\n').filter((l) => l.trim()).map((l) => '  ' + l).join('\n'));
    console.log('}');
    return 0;
  } catch (err) {
    console.error(`predicate export-sessions failed: ${(err as Error).message}`);
    return 1;
  }
}
```

### Task 4: `predicate import-sessions <file>`

Create `packages/predicate-cli/src/commands/import-sessions.ts`. Reads the TriG, posts to Fuseki's `/data?graph=...` endpoint per-graph.

```typescript
import { readFileSync } from 'node:fs';
import { loadConfig } from 'predicate-mcp/src/config.js';

function help(): void {
  console.log(`predicate import-sessions <file.trig>

Load a TriG-formatted peer export into local Fuseki. Each named graph
in the TriG is created in the local store as-is (it does NOT overwrite
kg:abox). Use \`kg_ask --include-remote\` to query unioned data
across local + imported peer graphs.

Options:
  --help    Print this message.
`);
}

export async function importSessions(args: string[]): Promise<number> {
  if (args.length === 0 || args[0] === '--help') { help(); return args.length === 0 ? 2 : 0; }
  const file = args[0]!;
  let trig: string;
  try { trig = readFileSync(file, 'utf8'); }
  catch (err) { console.error(`predicate import-sessions: failed to read ${file}: ${(err as Error).message}`); return 1; }

  const cfg = loadConfig();
  try {
    const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/trig' },
      body: trig,
    });
    if (!r.ok) {
      console.error(`predicate import-sessions: Fuseki rejected (${r.status}): ${await r.text()}`);
      return 1;
    }
    console.log(`predicate import-sessions: loaded ${trig.length} bytes from ${file}`);
    return 0;
  } catch (err) {
    console.error(`predicate import-sessions failed: ${(err as Error).message}`);
    return 1;
  }
}
```

### Task 5: `kg_ask --include-remote` plumbing

Modify `packages/predicate-mcp/src/tools/kg-ask.ts`. Read the current implementation, then:

1. Add an `includeRemote: boolean` field to the `KgAskInput` interface.
2. Before executing the user's SPARQL, if `includeRemote`, query `kg:peers` for all peer endpoints. For each, rewrite the user's SPARQL to include a SERVICE block. The cleanest approach for an MVP: run the user's SPARQL once locally AND once via SPARQL `SERVICE <endpoint>` per peer, then merge results in JS (rather than constructing a complex UNION query). Each result row gets a `peer` field set to either `'local'` or the peer's `name`.

```typescript
// Sketch (adapt to actual kg-ask.ts shape):
if (input.includeRemote) {
  const peersGraph = 'kg:peers';
  const peers = (await client.select(
    `PREFIX pred: <https://predicate.dev/meta#>
     SELECT ?name ?endpoint WHERE { GRAPH <${peersGraph}> { ?p a pred:Peer ; pred:peerName ?name ; pred:peerEndpoint ?endpoint } }`,
  )).results.bindings;

  // Local result
  const local = await client.select(input.sparql);
  const merged = local.results.bindings.map((row) => ({ ...row, peer: { type: 'literal', value: 'local' } }));

  // Each peer
  for (const p of peers) {
    try {
      const remote = await fetch(p['endpoint']!.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/sparql-results+json' },
        body: 'query=' + encodeURIComponent(input.sparql),
      });
      if (remote.ok) {
        const json = await remote.json() as { results: { bindings: Array<Record<string, unknown>> } };
        for (const row of json.results.bindings) {
          merged.push({ ...row, peer: { type: 'literal', value: p['name']!.value } });
        }
      }
    } catch { /* swallow per-peer errors so a dead peer doesn't break the query */ }
  }
  return { rows: merged };
}
// else: existing behavior unchanged
```

Update the `kg_ask` tool registration in `packages/predicate-mcp/src/tools/registry.ts` to accept the new `includeRemote` flag in its zod schema.

### Task 6: Tests

For each of the three new commands, follow the existing test pattern (seed graphs, invoke, assert console output / Fuseki state). 

For `peer.test.ts`: add, list, remove, --json output, --help.

For `export-sessions.test.ts`: seed a session triple in kg:abox dated yesterday, run export, assert output contains the session URI and is wrapped in TriG graph syntax.

For `import-sessions.test.ts`: write a synthetic TriG file to a temp path, run import, assert the named graph exists in Fuseki afterward.

For kg-ask test: extend `kg-ask.test.ts` with one new case for `includeRemote: true` against an empty peer list (should behave identically to includeRemote: false).

### Task 7: SKILL.md federation primer

Append a short section to SKILL.md:

```markdown
## Federation

If teammates also use Predicate, they can share session-history:

\`\`\`bash
# On Alice's machine:
predicate export-sessions --user alice > alice.trig
# Send to Bob (Slack, scp, etc.)

# On Bob's machine:
predicate import-sessions alice.trig
predicate peer add alice http://alice.local:3030/predicate/query  # optional, for live queries

# Then kg_ask can union local + remote:
kg_ask --include-remote ...
\`\`\`

This MVP is offline-friendly: no realtime sync, no auth. Each user's data
lives in a separate named graph so there are no merge conflicts. Same-IRI
collisions (e.g. \`file:///work/auth.ts\` from two users) are treated as
the same resource by RDF — use \`owl:sameAs\` if you want them merged, or
namespace your files per-user if you want them separate.
```

### Task 8: Register + release

- `packages/predicate-cli/src/index.ts`: import + help text + 3 switch cases (`export-sessions`, `import-sessions`, `peer`).
- Version bumps 1.10.0 → 1.11.0 in 3 files.
- README Status: v1.11 — federation MVP.
- Bundle rebuild.
- One commit.
- Tag `v1.11.0-federation-mvp`.
- Merge + push.
- Expected test count: ~230 (222 + 5 peer + 2 export + 2 import + 1 kg-ask).
