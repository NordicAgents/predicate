# Predicate Phase 15 — External Linked Data Federation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a thin Linked Data federation layer so the agent can query well-known public SPARQL endpoints (DBpedia, Wikidata) alongside local data. Ship one new CLI command (`predicate ld`), pre-register the two endpoints as peers in `kg:peers`, and extend the SKILL.md with a worked example showing when to reach out for public data. Tag v1.12.0-external-ld.

**Architecture:** Phase 14 already shipped the per-peer fetch path in `kgAsk` (--includeRemote). Phase 15 reuses that. The new pieces are minimal:

1. **`predicate ld <subcommand>`** — convenience CLI for the public-LD use case. Subcommands:
   - `predicate ld init` — registers DBpedia + Wikidata as `kg:peers` entries (idempotent — won't duplicate).
   - `predicate ld ask <query>` — runs a one-shot SPARQL query against the registered LD endpoints (NOT local). Useful for quick lookups like "what does Wikidata say about React?" without polluting local kg:abox.
   - `predicate ld list` — alias for `predicate peer list` but filtered to entries tagged as `external-ld`.

2. **Public-LD peer marker** — when added via `predicate ld init`, peers get an extra triple `pred:peerKind "external-ld"` distinguishing them from team peers. The existing peer registry stores both; `peer list` shows them all, `ld list` filters.

3. **SKILL.md worked example** — agent learns to use `predicate ld ask` for canonical public knowledge (e.g., "is this library deprecated?") without trying to memorize it.

**Out of scope:**
- Caching of LD results (each query re-fetches; users with rate limits should not use this in tight loops).
- Auto-discovery of endpoints (the user has to call `predicate ld init` once).
- Custom-endpoint registration via `ld init` flags (you can add custom endpoints via `predicate peer add` and tag them manually with `pred:peerKind`).
- Auth or API keys (DBpedia and Wikidata both serve unauthenticated SPARQL).

**Tech Stack:** Existing peer registry + SparqlClient + fetch.

---

## File Structure

**New files:**
- `packages/predicate-cli/src/commands/ld.ts` — handles `init`, `ask`, `list` subcommands.
- `packages/predicate-cli/tests/ld.test.ts` — tests with mocked fetch (don't call real endpoints in CI).

**Modified files:**
- `packages/predicate-cli/src/index.ts` — register `ld` command.
- `packages/predicate-ontology/meta/predicate-meta.ttl` — add `pred:peerKind` datatype property.
- `packages/predicate-cli/src/commands/peer.ts` — list output gets a "kind" column if any peer has the kind tag set.
- `packages/predicate-skill/skills/predicate/SKILL.md` — add LD worked example.
- Version bumps to 1.12.0.

---

### Task 1: Meta vocab — `pred:peerKind`

Append to `predicate-meta.ttl`:

```turtle
pred:peerKind a owl:DatatypeProperty ;
              rdfs:domain pred:Peer ; rdfs:range xsd:string ;
              rdfs:label "Peer kind tag: 'team' (default) or 'external-ld'" .
```

Bump version.json 0.6.0 → 0.7.0. Reload.

### Task 2: `predicate ld init`

The well-known endpoints baked in:

| Name | Endpoint |
|---|---|
| `dbpedia` | `https://dbpedia.org/sparql` |
| `wikidata` | `https://query.wikidata.org/sparql` |

Create `packages/predicate-cli/src/commands/ld.ts`:

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://industriagents.com/predicate/meta#';
const PEERS_GRAPH = 'kg:peers';

interface LdEndpoint { name: string; endpoint: string; description: string }

const WELL_KNOWN: LdEndpoint[] = [
  { name: 'dbpedia',  endpoint: 'https://dbpedia.org/sparql',         description: 'DBpedia — structured Wikipedia data' },
  { name: 'wikidata', endpoint: 'https://query.wikidata.org/sparql',  description: 'Wikidata — collaborative knowledge base' },
];

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

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

async function initLd(client: SparqlClient): Promise<number> {
  let added = 0, kept = 0;
  for (const ep of WELL_KNOWN) {
    const uri = `urn:predicate:peer:${ep.name}`;
    const existing = await client.select(
      `ASK { GRAPH <${PEERS_GRAPH}> { ${escapeIRI(uri)} a <${META}Peer> } }`,
    ).catch(() => null);
    if (existing && (existing as unknown as { boolean?: boolean }).boolean) { kept++; continue; }
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

async function listLd(client: SparqlClient, json: boolean): Promise<number> {
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

async function askLd(client: SparqlClient, query: string, json: boolean): Promise<number> {
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
  const client = new SparqlClient(loadConfig());
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
```

### Task 3: Tests

Create `packages/predicate-cli/tests/ld.test.ts` with mocked global.fetch. ~5 tests:
- `ld init` adds DBpedia + Wikidata to kg:peers with `pred:peerKind "external-ld"`
- `ld init` is idempotent (second call adds nothing)
- `ld list` shows only external-ld peers, filters out team peers
- `ld ask` errors with exit 2 if no LD peers registered
- `ld ask` parses a mocked SPARQL JSON response and prints rows (the test mocks fetch — don't hit real DBpedia)

### Task 4: Add `kind` column to `peer list`

Update `packages/predicate-cli/src/commands/peer.ts` to optionally show the `peerKind` column. Query `pred:peerKind` with OPTIONAL, show "team" as default if missing.

### Task 5: SKILL.md LD primer

Append to SKILL.md (after the existing federation section):

```markdown
## External Linked Data

For canonical public knowledge (Wikidata, DBpedia), call `predicate ld
ask` instead of trying to recall from training data. Examples:

\`\`\`bash
predicate ld init  # one-time

predicate ld ask 'SELECT ?label WHERE {
  <http://dbpedia.org/resource/JSON> rdfs:label ?label .
  FILTER (LANG(?label) = "en")
} LIMIT 1'
\`\`\`

Use cases:
- "Is library X deprecated?" → check Wikidata for last-release metadata
- "Who maintains project Y?" → DBpedia abstract
- "What's the canonical URI for concept Z?" → both
\`\`\`
```

### Task 6: Release

- Register `ld` command in index.ts.
- Bump versions 1.11.0 → 1.12.0.
- README Status: v1.12 — external LD federation.
- Bundle rebuild.
- One commit, tag `v1.12.0-external-ld`, merge + push.
- Expected test count: ~237 (232 + 5 ld tests).
