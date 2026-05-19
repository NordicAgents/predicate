# Oxigraph storage adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship in-process Oxigraph as the default storage backend for Predicate; keep Fuseki working as opt-in. Drops Docker from the default install path.

**Architecture:** Introduce a `StorageAdapter` interface at `packages/predicate-mcp/src/storage/`. Two implementations: `OxigraphAdapter` (in-process, default) and `FusekiAdapter` (HTTP, opt-in via `PREDICATE_BACKEND=fuseki`). Factory selects at startup. Reasoner, MCP tools, SHACL, and federation are unchanged because the seam they already use (`SparqlClient`) is what's being formalized into the interface.

**Tech Stack:** TypeScript 5.5, Node 20, pnpm workspaces, vitest, `oxigraph` npm package (N-API bindings, RocksDB), existing Fuseki/TDB2 stack as the secondary backend.

---

## File structure

**Created:**
- `packages/predicate-mcp/src/storage/adapter.ts` — `StorageAdapter` interface + shared types
- `packages/predicate-mcp/src/storage/fuseki.ts` — HTTP adapter (current behavior, formalized)
- `packages/predicate-mcp/src/storage/oxigraph.ts` — in-process Oxigraph adapter
- `packages/predicate-mcp/src/storage/factory.ts` — selects adapter from config
- `packages/predicate-mcp/src/storage/index.ts` — barrel export
- `packages/predicate-mcp/tests/storage/conformance.test.ts` — adapter conformance suite
- `packages/predicate-mcp/tests/storage/rdf-star.test.ts` — RDF-star round-trip
- `packages/predicate-server/src/bootstrap.ts` — backend-agnostic graph creation + meta seed
- `packages/predicate-server/src/index.ts` — package barrel
- `packages/predicate-server/package.json` — turn predicate-server into a buildable package
- `packages/predicate-server/tsconfig.json` — TS config for new code
- `packages/predicate-cli/src/commands/migrate.ts` — `predicate migrate` command
- `packages/predicate-cli/tests/migrate.test.ts` — migration end-to-end test

**Modified:**
- `packages/predicate-mcp/src/config.ts` — add `backend` field
- `packages/predicate-mcp/package.json` — add `oxigraph` dep
- `packages/predicate-cli/src/commands/up.ts` — branch on backend
- `packages/predicate-cli/src/commands/init.ts` — call bootstrap, drop direct HTTP
- `packages/predicate-cli/src/commands/doctor.ts` — backend-aware checks
- `packages/predicate-cli/src/index.ts` — register `migrate` command
- `README.md` — install section
- `packages/predicate-skill/README.md` — install section
- `.github/workflows/test.yml` — backend matrix (or create if absent)

**Not touched:**
- `packages/predicate-mcp/src/sparql/client.ts` — kept for any straggling direct imports; new code goes through the adapter
- `packages/predicate-mcp/src/graphs.ts` — graph constants unchanged
- `packages/predicate-reasoner/**` — uses adapter via dependency injection; no rewrite
- `packages/predicate-mcp/src/tools/**` — MCP tools call adapter through existing imports

---

## Task 1: Define `StorageAdapter` interface

**Files:**
- Create: `packages/predicate-mcp/src/storage/adapter.ts`
- Create: `packages/predicate-mcp/src/storage/index.ts`

- [ ] **Step 1: Create the interface file**

Write `packages/predicate-mcp/src/storage/adapter.ts`:

```ts
import type { SelectResult } from '../sparql/types.js';

export type TurtleFormat = 'turtle' | 'nt' | 'nt-star';

export interface StorageAdapter {
  // Query
  select(query: string): Promise<SelectResult>;
  ask(query: string): Promise<boolean>;
  update(query: string): Promise<void>;

  // Graph inspection
  knownGraphs(): Promise<string[]>;

  // Bulk I/O
  loadTurtle(turtle: string, graph: string): Promise<void>;
  serializeGraph(graph: string, format: TurtleFormat): Promise<string>;
  clearGraph(graph: string): Promise<void>;

  // Lifecycle
  ready(): Promise<void>;
  close(): Promise<void>;
}

export type BackendName = 'oxigraph' | 'fuseki';
```

- [ ] **Step 2: Create the barrel export**

Write `packages/predicate-mcp/src/storage/index.ts`:

```ts
export type { StorageAdapter, BackendName, TurtleFormat } from './adapter.js';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter predicate-mcp typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-mcp/src/storage/adapter.ts packages/predicate-mcp/src/storage/index.ts
git commit -m "feat(storage): introduce StorageAdapter interface"
```

---

## Task 2: Conformance test suite (red, no adapter exists yet)

Write the conformance suite before any adapter so both adapters are held to the same bar.

**Files:**
- Create: `packages/predicate-mcp/tests/storage/conformance.test.ts`

- [ ] **Step 1: Write the conformance test**

Write `packages/predicate-mcp/tests/storage/conformance.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { StorageAdapter } from '../../src/storage/adapter.js';

// Set by the caller before importing. We pick the adapter via env so this same
// file runs under both BACKEND=fuseki and BACKEND=oxigraph in CI.
const BACKEND = process.env.BACKEND ?? 'fuseki';

async function makeAdapter(): Promise<StorageAdapter> {
  if (BACKEND === 'fuseki') {
    const { FusekiAdapter } = await import('../../src/storage/fuseki.js');
    const { loadConfig } = await import('../../src/config.js');
    return new FusekiAdapter(loadConfig());
  }
  if (BACKEND === 'oxigraph') {
    const { OxigraphAdapter } = await import('../../src/storage/oxigraph.js');
    return new OxigraphAdapter({ storePath: ':memory:' });
  }
  throw new Error(`unknown BACKEND=${BACKEND}`);
}

describe(`StorageAdapter conformance (BACKEND=${BACKEND})`, () => {
  let adapter: StorageAdapter;

  beforeAll(async () => {
    adapter = await makeAdapter();
    await adapter.ready();
    for (const g of ['kg:a', 'kg:b']) await adapter.clearGraph(g);
  });

  afterAll(async () => {
    await adapter.close();
  });

  it('round-trips a triple via update + select', async () => {
    await adapter.update(`INSERT DATA { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`);
    const r = await adapter.select(
      `SELECT ?o WHERE { GRAPH <kg:a> { <urn:s> <urn:p> ?o } }`,
    );
    expect(r.results.bindings.map((b) => b.o.value)).toEqual(['v']);
  });

  it('ask returns boolean', async () => {
    expect(await adapter.ask(`ASK { GRAPH <kg:a> { <urn:s> <urn:p> "v" } }`)).toBe(true);
    expect(await adapter.ask(`ASK { GRAPH <kg:a> { <urn:s> <urn:p> "missing" } }`)).toBe(false);
  });

  it('isolates named graphs', async () => {
    await adapter.update(`INSERT DATA { GRAPH <kg:b> { <urn:x> <urn:p> "in-b" } }`);
    const a = await adapter.ask(`ASK { GRAPH <kg:a> { <urn:x> <urn:p> "in-b" } }`);
    expect(a).toBe(false);
    const b = await adapter.ask(`ASK { GRAPH <kg:b> { <urn:x> <urn:p> "in-b" } }`);
    expect(b).toBe(true);
  });

  it('clearGraph empties only the target', async () => {
    await adapter.clearGraph('kg:a');
    const a = await adapter.ask(`ASK { GRAPH <kg:a> { ?s ?p ?o } }`);
    expect(a).toBe(false);
    const b = await adapter.ask(`ASK { GRAPH <kg:b> { ?s ?p ?o } }`);
    expect(b).toBe(true);
  });

  it('loadTurtle + serializeGraph round-trip', async () => {
    await adapter.clearGraph('kg:a');
    await adapter.loadTurtle(
      `<urn:s1> <urn:p1> "v1" .\n<urn:s2> <urn:p1> "v2" .\n`,
      'kg:a',
    );
    const out = await adapter.serializeGraph('kg:a', 'nt');
    expect(out).toContain('<urn:s1> <urn:p1> "v1"');
    expect(out).toContain('<urn:s2> <urn:p1> "v2"');
  });

  it('knownGraphs lists graphs with kg: prefix', async () => {
    const gs = await adapter.knownGraphs();
    expect(gs).toContain('kg:a');
    expect(gs).toContain('kg:b');
  });
});
```

- [ ] **Step 2: Run it to verify it fails (Fuseki adapter does not exist yet)**

Run: `BACKEND=fuseki pnpm --filter predicate-mcp test tests/storage/conformance.test.ts`
Expected: FAIL — cannot import `../../src/storage/fuseki.js`.

- [ ] **Step 3: Commit the red test**

```bash
git add packages/predicate-mcp/tests/storage/conformance.test.ts
git commit -m "test(storage): conformance suite for StorageAdapter (red)"
```

---

## Task 3: Implement `FusekiAdapter`

**Files:**
- Create: `packages/predicate-mcp/src/storage/fuseki.ts`

- [ ] **Step 1: Write the adapter**

Write `packages/predicate-mcp/src/storage/fuseki.ts`:

```ts
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
    const mime = format === 'turtle' ? 'text/turtle' : 'application/n-triples';
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
```

- [ ] **Step 2: Re-export from barrel**

Edit `packages/predicate-mcp/src/storage/index.ts` to add:

```ts
export { FusekiAdapter } from './fuseki.js';
```

Final file:

```ts
export type { StorageAdapter, BackendName, TurtleFormat } from './adapter.js';
export { FusekiAdapter } from './fuseki.js';
```

- [ ] **Step 3: Run the conformance suite against Fuseki**

Make sure Fuseki is running (`predicate up`), then:

Run: `BACKEND=fuseki pnpm --filter predicate-mcp test tests/storage/conformance.test.ts`
Expected: PASS — all 6 cases green.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-mcp/src/storage/fuseki.ts packages/predicate-mcp/src/storage/index.ts
git commit -m "feat(storage): FusekiAdapter implementing StorageAdapter"
```

---

## Task 4: Add `backend` field to `Config` and a `getAdapter` factory

**Files:**
- Modify: `packages/predicate-mcp/src/config.ts`
- Create: `packages/predicate-mcp/src/storage/factory.ts`

- [ ] **Step 1: Add backend field to config**

Edit `packages/predicate-mcp/src/config.ts` to:

```ts
import type { BackendName } from './storage/adapter.js';

export interface Config {
  backend: BackendName;
  fusekiUrl: string;
  dataset: string;
  queryEndpoint: string;
  updateEndpoint: string;
  dataEndpoint: string;
  oxigraphStorePath: string;
}

export function loadConfig(): Config {
  const raw = process.env.FUSEKI_URL ?? 'http://localhost:3030';
  const fusekiUrl = raw.replace(/\/+$/, '');
  const dataset = process.env.PREDICATE_DATASET ?? 'predicate';
  const backend = (process.env.PREDICATE_BACKEND ?? 'oxigraph') as BackendName;
  const home = process.env.HOME ?? '';
  const xdg = process.env.XDG_DATA_HOME;
  const oxigraphStorePath =
    process.env.PREDICATE_STORE_PATH ??
    (xdg ? `${xdg}/predicate/store` : `${home}/.predicate/store`);
  return {
    backend,
    fusekiUrl,
    dataset,
    queryEndpoint: `${fusekiUrl}/${dataset}/query`,
    updateEndpoint: `${fusekiUrl}/${dataset}/update`,
    dataEndpoint: `${fusekiUrl}/${dataset}/data`,
    oxigraphStorePath,
  };
}
```

- [ ] **Step 2: Write the failing factory test**

Create `packages/predicate-mcp/tests/storage/factory.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter, _resetAdapterCache } from '../../src/storage/factory.js';
import { FusekiAdapter } from '../../src/storage/fuseki.js';

describe('getAdapter', () => {
  beforeEach(() => {
    _resetAdapterCache();
    delete process.env.PREDICATE_BACKEND;
  });

  it('returns FusekiAdapter when PREDICATE_BACKEND=fuseki', () => {
    process.env.PREDICATE_BACKEND = 'fuseki';
    const a = getAdapter();
    expect(a).toBeInstanceOf(FusekiAdapter);
  });

  it('throws a clear error for unknown backend', () => {
    process.env.PREDICATE_BACKEND = 'sqlite';
    expect(() => getAdapter()).toThrow(/unknown PREDICATE_BACKEND/);
  });
});
```

- [ ] **Step 3: Run it — should fail (factory does not exist)**

Run: `pnpm --filter predicate-mcp test tests/storage/factory.test.ts`
Expected: FAIL — cannot resolve `../../src/storage/factory.js`.

- [ ] **Step 4: Implement the factory**

Create `packages/predicate-mcp/src/storage/factory.ts`:

```ts
import { loadConfig } from '../config.js';
import { FusekiAdapter } from './fuseki.js';
import type { StorageAdapter } from './adapter.js';

let cached: StorageAdapter | undefined;

export function getAdapter(): StorageAdapter {
  if (cached) return cached;
  const cfg = loadConfig();
  switch (cfg.backend) {
    case 'fuseki':
      cached = new FusekiAdapter(cfg);
      return cached;
    case 'oxigraph':
      throw new Error(
        'PREDICATE_BACKEND=oxigraph is the default but the adapter is not yet linked; ' +
        'set PREDICATE_BACKEND=fuseki to use the HTTP backend in this build.',
      );
    default:
      throw new Error(`unknown PREDICATE_BACKEND='${cfg.backend}'`);
  }
}

// Test-only.
export function _resetAdapterCache(): void {
  cached = undefined;
}
```

- [ ] **Step 5: Re-export from barrel**

Edit `packages/predicate-mcp/src/storage/index.ts` to:

```ts
export type { StorageAdapter, BackendName, TurtleFormat } from './adapter.js';
export { FusekiAdapter } from './fuseki.js';
export { getAdapter } from './factory.js';
```

- [ ] **Step 6: Test passes**

Run: `pnpm --filter predicate-mcp test tests/storage/factory.test.ts`
Expected: PASS — 2 cases green.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-mcp/src/config.ts packages/predicate-mcp/src/storage/factory.ts packages/predicate-mcp/src/storage/index.ts packages/predicate-mcp/tests/storage/factory.test.ts
git commit -m "feat(storage): adapter factory + PREDICATE_BACKEND config"
```

---

## Task 5: Migrate `SparqlClient` call sites to `getAdapter`

The refactor is mechanical: every `new SparqlClient(loadConfig())` becomes `getAdapter()`. We keep the old `SparqlClient` file around for now to avoid touching unrelated imports; the conformance suite already proves `FusekiAdapter` behaves identically.

**Files:**
- Modify: `packages/predicate-cli/src/commands/up.ts`
- Modify: `packages/predicate-cli/src/commands/init.ts`
- Modify: `packages/predicate-cli/src/commands/doctor.ts`
- Modify: any other CLI command file importing `SparqlClient`

- [ ] **Step 1: Find every direct import**

Run: `grep -rn "from 'predicate-mcp/src/sparql/client" packages/`
Expected: list of files to update.

- [ ] **Step 2: Replace each import**

In every match, change:

```ts
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
// ...
const client = new SparqlClient(loadConfig());
```

to:

```ts
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
// ...
const client = getAdapter();
```

Type annotations like `client: SparqlClient` become `client: StorageAdapter` (import the type from `predicate-mcp/src/storage/index.js`).

For `init.ts`, also replace the bespoke HTTP `loadTtlFile` (lines 74–84) with `await client.loadTurtle(turtle, 'kg:tbox')` — `client` is now a `StorageAdapter` and exposes this method. Delete the helper.

- [ ] **Step 3: Force backend to fuseki while we're transitioning**

Edit `packages/predicate-cli/src/commands/up.ts` so the top of `up()` sets:

```ts
if (!process.env.PREDICATE_BACKEND) process.env.PREDICATE_BACKEND = 'fuseki';
```

This keeps the CLI on the working HTTP path until Task 9 wires Oxigraph in. Remove this line in Task 9.

- [ ] **Step 4: Typecheck + run existing tests**

Run: `pnpm -r typecheck && BACKEND=fuseki pnpm -r test`
Expected: PASS — no behavioral change.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-cli/src
git commit -m "refactor(cli): route SPARQL through StorageAdapter (Fuseki forced)"
```

---

## Task 6: Add `oxigraph` npm dep + `OxigraphAdapter` skeleton

**Files:**
- Modify: `packages/predicate-mcp/package.json`
- Create: `packages/predicate-mcp/src/storage/oxigraph.ts`

- [ ] **Step 1: Add the dep**

Edit `packages/predicate-mcp/package.json` so `dependencies` includes:

```json
    "oxigraph": "^0.5.0",
```

Then:

Run: `pnpm install`
Expected: lockfile updated, native binary fetched.

- [ ] **Step 2: Sanity-check the API surface**

Run:

```bash
node -e "import('oxigraph').then(m => console.log(Object.keys(m).sort()))"
```

Expected: contains at least `Store`, `NamedNode`, `Literal`, `Quad`, `DefaultGraph` (exact names depend on the binding version — if names differ, adjust Step 3 accordingly).

- [ ] **Step 3: Write the adapter**

Create `packages/predicate-mcp/src/storage/oxigraph.ts`:

```ts
import { Store } from 'oxigraph';
import type { SelectResult, Binding, Term } from '../sparql/types.js';
import type { StorageAdapter, TurtleFormat } from './adapter.js';

export interface OxigraphAdapterOptions {
  storePath: string; // ':memory:' or filesystem path
}

interface OxiTerm {
  termType: 'NamedNode' | 'BlankNode' | 'Literal' | 'DefaultGraph';
  value: string;
  language?: string;
  datatype?: { value: string };
}

function oxiTermToTerm(t: OxiTerm): Term {
  if (t.termType === 'NamedNode') return { type: 'uri', value: t.value };
  if (t.termType === 'BlankNode') return { type: 'bnode', value: t.value };
  const term: Term = { type: 'literal', value: t.value };
  if (t.language) term['xml:lang'] = t.language;
  if (t.datatype && t.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
    term.datatype = t.datatype.value;
  }
  return term;
}

export class OxigraphAdapter implements StorageAdapter {
  private store: Store;

  constructor(opts: OxigraphAdapterOptions) {
    this.store = opts.storePath === ':memory:' ? new Store() : new Store(opts.storePath);
  }

  async ready(): Promise<void> {
    // Store opens synchronously in the constructor.
  }

  async close(): Promise<void> {
    // The Store releases on GC; no explicit close in 0.5.x bindings.
  }

  async select(query: string): Promise<SelectResult> {
    const results = this.store.query(query) as Array<Record<string, OxiTerm>>;
    if (!Array.isArray(results)) {
      throw new Error('select() called with a non-SELECT query');
    }
    const vars = results.length > 0 ? Object.keys(results[0]) : [];
    const bindings: Binding[] = results.map((row) => {
      const b: Binding = {};
      for (const [k, v] of Object.entries(row)) b[k] = oxiTermToTerm(v);
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
    return r.results.bindings.map((b) => b.g!.value);
  }

  async loadTurtle(turtle: string, graph: string): Promise<void> {
    this.store.load(turtle, {
      format: 'text/turtle',
      to_graph_name: graph,
    });
  }

  async serializeGraph(graph: string, format: TurtleFormat): Promise<string> {
    const mime =
      format === 'turtle' ? 'text/turtle'
      : format === 'nt-star' ? 'application/n-triples-star'
      : 'application/n-triples';
    return this.store.dump({ format: mime, from_graph_name: graph });
  }

  async clearGraph(graph: string): Promise<void> {
    await this.update(`DROP SILENT GRAPH <${graph}>`);
  }
}
```

- [ ] **Step 4: Re-export from barrel**

Edit `packages/predicate-mcp/src/storage/index.ts` to:

```ts
export type { StorageAdapter, BackendName, TurtleFormat } from './adapter.js';
export { FusekiAdapter } from './fuseki.js';
export { OxigraphAdapter } from './oxigraph.js';
export { getAdapter } from './factory.js';
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter predicate-mcp typecheck`
Expected: no errors. If the `oxigraph` package's TS types don't match the field names above (`to_graph_name`, `from_graph_name`), check the installed `node_modules/oxigraph/index.d.ts` and adjust field names. Field-naming drift between minor versions is the most likely source of breakage here.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/package.json packages/predicate-mcp/src/storage/oxigraph.ts packages/predicate-mcp/src/storage/index.ts pnpm-lock.yaml
git commit -m "feat(storage): OxigraphAdapter using in-process npm binding"
```

---

## Task 7: Run the conformance suite against Oxigraph

The suite already exists from Task 2; just exercise it against the new adapter.

- [ ] **Step 1: Run the conformance suite**

Run: `BACKEND=oxigraph pnpm --filter predicate-mcp test tests/storage/conformance.test.ts`
Expected: PASS — 6 cases green.

If any case fails, diagnose against the actual `oxigraph` binding API; fix the adapter; rerun. Likely fix points: `Store.query` return shape for SELECT, `Store.load`/`Store.dump` parameter names.

- [ ] **Step 2: Commit any adapter fixes**

If you needed to patch `oxigraph.ts` to make the suite green:

```bash
git add packages/predicate-mcp/src/storage/oxigraph.ts
git commit -m "fix(storage): align OxigraphAdapter with oxigraph 0.5.x API"
```

Otherwise skip the commit.

---

## Task 8: RDF-star round-trip test

The product depends on RDF-star for per-triple provenance. Pin behavior with a dedicated test.

**Files:**
- Create: `packages/predicate-mcp/tests/storage/rdf-star.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/predicate-mcp/tests/storage/rdf-star.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { StorageAdapter } from '../../src/storage/adapter.js';

const BACKEND = process.env.BACKEND ?? 'fuseki';

async function makeAdapter(): Promise<StorageAdapter> {
  if (BACKEND === 'fuseki') {
    const { FusekiAdapter } = await import('../../src/storage/fuseki.js');
    const { loadConfig } = await import('../../src/config.js');
    return new FusekiAdapter(loadConfig());
  }
  const { OxigraphAdapter } = await import('../../src/storage/oxigraph.js');
  return new OxigraphAdapter({ storePath: ':memory:' });
}

describe(`RDF-star (BACKEND=${BACKEND})`, () => {
  let adapter: StorageAdapter;

  beforeAll(async () => {
    adapter = await makeAdapter();
    await adapter.ready();
    await adapter.clearGraph('kg:star');
  });

  afterAll(async () => {
    await adapter.close();
  });

  it('stores and queries a quoted triple as subject', async () => {
    await adapter.update(`
      PREFIX prov: <http://www.w3.org/ns/prov#>
      INSERT DATA { GRAPH <kg:star> {
        << <urn:s> <urn:p> "o" >> prov:wasDerivedFrom <urn:source-1> .
      } }
    `);

    const r = await adapter.select(`
      PREFIX prov: <http://www.w3.org/ns/prov#>
      SELECT ?src WHERE { GRAPH <kg:star> {
        << <urn:s> <urn:p> "o" >> prov:wasDerivedFrom ?src .
      } }
    `);
    expect(r.results.bindings.map((b) => b.src.value)).toEqual(['urn:source-1']);
  });
});
```

- [ ] **Step 2: Run under both backends**

```bash
BACKEND=oxigraph pnpm --filter predicate-mcp test tests/storage/rdf-star.test.ts
BACKEND=fuseki   pnpm --filter predicate-mcp test tests/storage/rdf-star.test.ts
```

Both Expected: PASS.

If Oxigraph rejects the RDF-star syntax, check binding version supports `text/turtle` parser with RDF-star — `oxigraph` 0.4+ does by default. If it still fails, that's a release blocker — escalate before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-mcp/tests/storage/rdf-star.test.ts
git commit -m "test(storage): RDF-star round-trip pinned for both backends"
```

---

## Task 9: Wire Oxigraph into the factory; default to Oxigraph

**Files:**
- Modify: `packages/predicate-mcp/src/storage/factory.ts`
- Modify: `packages/predicate-cli/src/commands/up.ts`

- [ ] **Step 1: Wire Oxigraph in**

Edit `packages/predicate-mcp/src/storage/factory.ts`:

```ts
import { loadConfig } from '../config.js';
import { FusekiAdapter } from './fuseki.js';
import { OxigraphAdapter } from './oxigraph.js';
import type { StorageAdapter } from './adapter.js';

let cached: StorageAdapter | undefined;

export function getAdapter(): StorageAdapter {
  if (cached) return cached;
  const cfg = loadConfig();
  switch (cfg.backend) {
    case 'fuseki':
      cached = new FusekiAdapter(cfg);
      return cached;
    case 'oxigraph':
      cached = new OxigraphAdapter({ storePath: cfg.oxigraphStorePath });
      return cached;
    default:
      throw new Error(`unknown PREDICATE_BACKEND='${cfg.backend}'`);
  }
}

export function _resetAdapterCache(): void {
  cached = undefined;
}
```

- [ ] **Step 2: Remove the Fuseki force from `up.ts`**

In `packages/predicate-cli/src/commands/up.ts`, delete the line added in Task 5:

```ts
if (!process.env.PREDICATE_BACKEND) process.env.PREDICATE_BACKEND = 'fuseki';
```

- [ ] **Step 3: Update factory test**

Edit `packages/predicate-mcp/tests/storage/factory.test.ts` to add a third case (the `_resetAdapterCache()` call is already in `beforeEach` from Task 4):

```ts
  it('returns OxigraphAdapter by default (no env var set)', () => {
    // beforeEach already deletes PREDICATE_BACKEND.
    const a = getAdapter();
    expect(a.constructor.name).toBe('OxigraphAdapter');
  });
```

- [ ] **Step 4: Run factory test**

Run: `pnpm --filter predicate-mcp test tests/storage/factory.test.ts`
Expected: PASS — 3 cases green.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/storage/factory.ts packages/predicate-cli/src/commands/up.ts packages/predicate-mcp/tests/storage/factory.test.ts
git commit -m "feat(storage): default backend is Oxigraph (in-process)"
```

---

## Task 10: Bootstrap module in `predicate-server`

Move named-graph creation and meta seeding into a backend-agnostic module.

**Files:**
- Create: `packages/predicate-server/package.json`
- Create: `packages/predicate-server/tsconfig.json`
- Create: `packages/predicate-server/src/index.ts`
- Create: `packages/predicate-server/src/bootstrap.ts`

- [ ] **Step 1: Make `predicate-server` a buildable package**

Create `packages/predicate-server/package.json`:

```json
{
  "name": "predicate-server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/src/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "predicate-mcp": "workspace:^"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Create `packages/predicate-server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src"]
}
```

Run: `pnpm install`
Expected: workspace links predicate-server to predicate-mcp.

- [ ] **Step 2: Write bootstrap module**

Create `packages/predicate-server/src/bootstrap.ts`:

```ts
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

const ALL_GRAPHS = Object.values(GRAPH);

export async function bootstrapGraphs(adapter: StorageAdapter): Promise<void> {
  await adapter.ready();
  for (const g of ALL_GRAPHS) {
    // CREATE SILENT is the portable way to declare an empty graph; both Fuseki
    // and Oxigraph honor SPARQL 1.1 graph-management semantics.
    await adapter.update(`CREATE SILENT GRAPH <${g}>`);
  }
}
```

Create `packages/predicate-server/src/index.ts`:

```ts
export { bootstrapGraphs } from './bootstrap.js';
```

- [ ] **Step 3: Add a smoke test**

Create `packages/predicate-server/tests/bootstrap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { bootstrapGraphs } from '../src/bootstrap.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

describe('bootstrapGraphs', () => {
  it('creates all 9 named graphs on a fresh store', async () => {
    const adapter = new OxigraphAdapter({ storePath: ':memory:' });
    await bootstrapGraphs(adapter);
    // CREATE SILENT GRAPH does not produce any triples, so we verify via
    // a per-graph ASK that the graph exists and is empty.
    for (const g of Object.values(GRAPH)) {
      const has = await adapter.ask(`ASK { GRAPH <${g}> { ?s ?p ?o } }`);
      expect(has).toBe(false);
    }
  });
});
```

- [ ] **Step 4: Run**

Run: `pnpm --filter predicate-server test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-server/package.json packages/predicate-server/tsconfig.json packages/predicate-server/src packages/predicate-server/tests pnpm-lock.yaml
git commit -m "feat(server): backend-agnostic bootstrap module"
```

---

## Task 11: Refactor `init.ts` to use the bootstrap + adapter

**Files:**
- Modify: `packages/predicate-cli/src/commands/init.ts`

- [ ] **Step 1: Replace HTTP-y bits with adapter calls**

In `packages/predicate-cli/src/commands/init.ts`:

- Replace the import of `SparqlClient` and `loadConfig` with `getAdapter` from `predicate-mcp/src/storage/index.js`.
- Replace `loadTtlFile(client, path)` (lines 74–84) with:

```ts
async function loadTtlFile(client: StorageAdapter, path: string): Promise<void> {
  const turtle = readFileSync(path, 'utf8');
  await client.loadTurtle(turtle, 'kg:tbox');
}
```

- Replace the `wipeForInit` body to use `adapter.clearGraph(g)` instead of `DROP SILENT GRAPH <g>; CREATE SILENT GRAPH <g>` pair (the adapter's `clearGraph` is portable):

```ts
async function wipeForInit(client: StorageAdapter, force: boolean): Promise<void> {
  const tboxGraphs = ['kg:tbox', 'kg:tbox-staging', 'kg:meta'];
  const aboxGraphs = ['kg:abox', 'kg:inferred', 'kg:provenance', 'kg:goals', 'kg:usage'];
  const toWipe = force ? [...tboxGraphs, ...aboxGraphs] : tboxGraphs;
  for (const g of toWipe) await client.clearGraph(g);
}
```

- At the top of `init()`, call `bootstrapGraphs` before the refusal check:

```ts
import { bootstrapGraphs } from 'predicate-server/src/index.js';
// ...
const client = getAdapter();
await bootstrapGraphs(client);
```

- [ ] **Step 2: Run existing init tests + manual smoke**

Run: `pnpm --filter predicate-cli test` (if init tests exist)
Then on a clean Oxigraph store:

```bash
rm -rf ~/.predicate/store
BACKEND=oxigraph node packages/predicate-cli/dist/cli.js init --mode empty
BACKEND=oxigraph node packages/predicate-cli/dist/cli.js stats
```

Expected: init reports success; `stats` reports >0 TBox triples (meta vocab loaded).

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-cli/src/commands/init.ts
git commit -m "refactor(cli): init goes through StorageAdapter + bootstrapGraphs"
```

---

## Task 12: Branch `up.ts` on backend

**Files:**
- Modify: `packages/predicate-cli/src/commands/up.ts`

- [ ] **Step 1: Rewrite `up()`**

Replace the body of `up()` in `packages/predicate-cli/src/commands/up.ts` with:

```ts
export async function up(): Promise<number> {
  const { loadConfig } = await import('predicate-mcp/src/config.js');
  const cfg = loadConfig();

  if (cfg.backend === 'fuseki') {
    if (!dockerAvailable()) {
      console.error('Docker not found. Install Docker Desktop or Docker Engine first, or unset PREDICATE_BACKEND to use the default in-process Oxigraph backend.');
      return 2;
    }
    const dir = findComposeDir();
    console.log(`bringing Fuseki up from ${dir}`);
    const rc = await compose(['up', '-d'], dir);
    if (rc !== 0) return rc;
    const ready = await waitForFuseki(20);
    if (!ready) {
      console.error('predicate up: Fuseki did not become ready in 20s.');
      return 1;
    }
  } else {
    console.log(`opening Oxigraph store at ${cfg.oxigraphStorePath}`);
  }

  // Bootstrap + init paths are shared.
  const { bootstrapGraphs } = await import('predicate-server/src/index.js');
  const { getAdapter } = await import('predicate-mcp/src/storage/index.js');
  const client = getAdapter();
  await bootstrapGraphs(client);

  try {
    if (await checkConfigExists(client)) return 0;
    if (await detectLegacyCodebase(client)) {
      await writeLegacyConfig(client);
      console.log(`predicate up: legacy codebase ontology detected — wrote 'community/codebase' config.`);
      return 0;
    }
    if (process.stdin.isTTY) return init([]);
    console.error('predicate up: no init config and non-TTY stdin; defaulting to empty mode.');
    return init(['--mode', 'empty']);
  } catch (err) {
    console.error(`predicate up: post-bootstrap init check failed: ${(err as Error).message}`);
    return 0;
  }
}
```

Make sure `checkConfigExists`, `detectLegacyCodebase`, and `writeLegacyConfig` accept `StorageAdapter` instead of `SparqlClient`.

- [ ] **Step 2: Manual smoke**

```bash
unset PREDICATE_BACKEND
rm -rf ~/.predicate/store
predicate up
predicate stats
```

Expected: Oxigraph store created, named graphs present, init prompt or default behavior triggers.

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-cli/src/commands/up.ts
git commit -m "feat(cli): predicate up branches on backend"
```

---

## Task 13: Backend-aware `doctor.ts`

**Files:**
- Modify: `packages/predicate-cli/src/commands/doctor.ts`

- [ ] **Step 1: Rewrite**

Replace the contents of `packages/predicate-cli/src/commands/doctor.ts` with:

```ts
import { loadConfig } from 'predicate-mcp/src/config.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { dockerAvailable } from '../docker.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';
import { existsSync, accessSync, constants } from 'node:fs';
import { dirname } from 'node:path';

interface Check { name: string; ok: boolean; detail?: string }

export async function doctor(): Promise<number> {
  const cfg = loadConfig();
  const checks: Check[] = [];

  checks.push({ name: 'backend', ok: true, detail: cfg.backend });

  if (cfg.backend === 'fuseki') {
    checks.push({
      name: 'docker installed',
      ok: dockerAvailable(),
      detail: dockerAvailable() ? '' : 'install Docker Desktop',
    });
    const ping = await fetch(`${cfg.fusekiUrl}/$/ping`).catch(() => null);
    checks.push({
      name: 'fuseki reachable',
      ok: Boolean(ping?.ok),
      detail: ping?.ok ? cfg.fusekiUrl : `not reachable at ${cfg.fusekiUrl} — try 'predicate up'`,
    });
  } else {
    // Oxigraph: directory must be writable.
    let writable = true;
    try {
      const dir = dirname(cfg.oxigraphStorePath);
      if (existsSync(dir)) accessSync(dir, constants.W_OK);
    } catch { writable = false; }
    checks.push({
      name: 'oxigraph store writable',
      ok: writable,
      detail: writable ? cfg.oxigraphStorePath : `cannot write to ${cfg.oxigraphStorePath}`,
    });
    // Detect a leftover Fuseki to nudge migration (informational, no state change).
    const fusekiPing = await fetch(`${cfg.fusekiUrl}/$/ping`).catch(() => null);
    if (fusekiPing?.ok) {
      checks.push({
        name: 'fuseki detected',
        ok: true,
        detail: `${cfg.fusekiUrl} — set PREDICATE_BACKEND=fuseki to keep using it, or run 'predicate migrate --from fuseki --to oxigraph'`,
      });
    }
  }

  try {
    const client = getAdapter();
    await client.ready();
    const tboxOk = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${GRAPH.tbox}> { ?c a owl:Class } }
    `).catch(() => false);
    checks.push({
      name: 'kg:tbox loaded',
      ok: tboxOk,
      detail: tboxOk ? '' : "no classes found — try 'predicate up' (re-runs bootstrap)",
    });
  } catch (err) {
    checks.push({ name: 'adapter open', ok: false, detail: (err as Error).message });
  }

  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    const mark = c.ok ? '[x]' : '[ ]';
    const name = c.name.padEnd(width);
    const detail = c.detail ? `  — ${c.detail}` : '';
    console.log(`${mark} ${name}${detail}`);
  }

  return checks.every((c) => c.ok) ? 0 : 1;
}
```

- [ ] **Step 2: Manual smoke under both backends**

```bash
unset PREDICATE_BACKEND
predicate doctor
PREDICATE_BACKEND=fuseki predicate doctor
```

Expected: under Oxigraph, no Docker check is shown; under Fuseki, Docker + fuseki reachable checks appear.

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-cli/src/commands/doctor.ts
git commit -m "feat(cli): doctor is backend-aware"
```

---

## Task 14: `predicate migrate` command

**Files:**
- Create: `packages/predicate-cli/src/commands/migrate.ts`
- Modify: `packages/predicate-cli/src/index.ts` (register the command)

- [ ] **Step 1: Write the command**

Create `packages/predicate-cli/src/commands/migrate.ts`:

```ts
import { FusekiAdapter } from 'predicate-mcp/src/storage/fuseki.js';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

export async function migrate(args: string[]): Promise<number> {
  const from = parseFlag(args, '--from');
  const to = parseFlag(args, '--to');
  if (from !== 'fuseki' || to !== 'oxigraph') {
    console.error("predicate migrate: only --from fuseki --to oxigraph is supported.");
    return 2;
  }

  const cfg = loadConfig();
  const src = new FusekiAdapter(cfg);
  const dst = new OxigraphAdapter({ storePath: cfg.oxigraphStorePath });
  await src.ready();
  await dst.ready();

  const graphs = Object.values(GRAPH);
  for (const g of graphs) {
    process.stdout.write(`migrating ${g} ... `);
    const nt = await src.serializeGraph(g, 'nt-star').catch(() => src.serializeGraph(g, 'nt'));
    await dst.clearGraph(g);
    if (nt.trim().length > 0) await dst.loadTurtle(nt, g);

    // Triple-count parity check.
    const srcCount = (await src.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${g}> { ?s ?p ?o } }`)).results.bindings[0]?.n?.value ?? '0';
    const dstCount = (await dst.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${g}> { ?s ?p ?o } }`)).results.bindings[0]?.n?.value ?? '0';
    if (srcCount !== dstCount) {
      console.error(`\npredicate migrate: triple count mismatch on ${g}: source=${srcCount}, dest=${dstCount}. Aborting.`);
      return 1;
    }
    console.log(`${srcCount} triples ✓`);
  }

  console.log(`predicate migrate: complete. Set PREDICATE_BACKEND=oxigraph (default) and run 'predicate down' to stop the Fuseki container if you no longer need it.`);
  await src.close();
  await dst.close();
  return 0;
}
```

- [ ] **Step 2: Register the command**

Edit `packages/predicate-cli/src/index.ts` to add a case for `migrate`:

```ts
import { migrate } from './commands/migrate.js';
// ...
// in the dispatch switch:
case 'migrate': return migrate(rest);
```

- [ ] **Step 3: Write integration test**

Create `packages/predicate-cli/tests/migrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FusekiAdapter } from 'predicate-mcp/src/storage/fuseki.js';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { migrate } from '../src/commands/migrate.js';
import { GRAPH } from 'predicate-mcp/src/graphs.js';

describe('migrate fuseki → oxigraph', () => {
  it('round-trips a 1k-triple ABox with count parity', async () => {
    const cfg = loadConfig();
    const src = new FusekiAdapter(cfg);
    await src.ready();
    await src.clearGraph(GRAPH.abox);

    // Seed 1k triples.
    const inserts: string[] = [];
    for (let i = 0; i < 1000; i++) {
      inserts.push(`<urn:s${i}> <urn:p> "v${i}" .`);
    }
    await src.loadTurtle(inserts.join('\n'), GRAPH.abox);

    const rc = await migrate(['--from', 'fuseki', '--to', 'oxigraph']);
    expect(rc).toBe(0);

    const dst = new OxigraphAdapter({ storePath: cfg.oxigraphStorePath });
    await dst.ready();
    const r = await dst.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${GRAPH.abox}> { ?s ?p ?o } }`);
    expect(r.results.bindings[0]?.n?.value).toBe('1000');
  });
});
```

- [ ] **Step 4: Run**

Make sure Fuseki is up. Then:

Run: `pnpm --filter predicate-cli test tests/migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-cli/src/commands/migrate.ts packages/predicate-cli/src/index.ts packages/predicate-cli/tests/migrate.test.ts
git commit -m "feat(cli): predicate migrate --from fuseki --to oxigraph"
```

---

## Task 15: README updates

**Files:**
- Modify: `README.md`
- Modify: `packages/predicate-skill/README.md`

- [ ] **Step 1: Edit root README install section**

In `README.md`, find the line:

```
Prerequisites: **Docker** (for Fuseki) and **Node 20+**.
```

Replace with:

```
**Prerequisites: Node 20+.** That is all the default install needs. Docker is only required if you opt into the Fuseki backend (see "Alternative backends" below).
```

After the install section, add a new section:

```markdown
## Alternative backends

Predicate ships two storage adapters:

- **Oxigraph (default).** In-process, RocksDB on disk at `~/.predicate/store/`. No Docker, no daemon, sub-second cold start. This is what you get unless you set the env var below.
- **Fuseki (opt-in).** Apache Jena Fuseki in Docker — same as previous releases. Set `PREDICATE_BACKEND=fuseki`. Requires Docker.

To migrate an existing Fuseki install to Oxigraph in place:

```bash
predicate migrate --from fuseki --to oxigraph
unset PREDICATE_BACKEND   # or remove it from your shell rc
predicate down            # stop the Fuseki container, your data is in Oxigraph now
```
```

- [ ] **Step 2: Mirror the same edits in `packages/predicate-skill/README.md`**

Same two edits: prerequisites line and the "Alternative backends" section.

- [ ] **Step 3: Commit**

```bash
git add README.md packages/predicate-skill/README.md
git commit -m "docs: Node 20+ is the only prerequisite; Docker moves to opt-in"
```

---

## Task 16: CI matrix — run tests under both backends

**Files:**
- Modify (or create): `.github/workflows/test.yml`

- [ ] **Step 1: Check what CI file exists**

Run: `ls .github/workflows/ 2>/dev/null || echo "no workflows yet"`
Expected: see existing CI file name, or "no workflows yet".

- [ ] **Step 2: Update or create the workflow**

If a workflow file exists, add a job matrix:

```yaml
strategy:
  matrix:
    backend: [oxigraph, fuseki]
```

And set `BACKEND: ${{ matrix.backend }}` in the env for the test step. For the Fuseki leg, add a step before tests:

```yaml
- name: Start Fuseki
  if: matrix.backend == 'fuseki'
  run: docker compose -f packages/predicate-server/docker-compose.yml up -d
- name: Wait for Fuseki
  if: matrix.backend == 'fuseki'
  run: |
    for i in {1..30}; do
      curl -sf http://localhost:3030/$/ping && break || sleep 1
    done
```

If no workflow exists, create `.github/workflows/test.yml`:

```yaml
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        backend: [oxigraph, fuseki]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Start Fuseki
        if: matrix.backend == 'fuseki'
        run: docker compose -f packages/predicate-server/docker-compose.yml up -d
      - name: Wait for Fuseki
        if: matrix.backend == 'fuseki'
        run: |
          for i in {1..30}; do
            curl -sf http://localhost:3030/$/ping && break || sleep 1
          done
      - run: pnpm -r test
        env:
          BACKEND: ${{ matrix.backend }}
          PREDICATE_BACKEND: ${{ matrix.backend }}
```

- [ ] **Step 3: Verify it parses**

Run: `act -l 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml'))"`
Expected: no parse errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: run tests under BACKEND={oxigraph,fuseki}"
```

---

## Final smoke

After all 16 tasks land:

- [ ] **Step 1: Clean-room install on a machine with no Docker**

```bash
docker stop $(docker ps -q) 2>/dev/null  # ensure nothing is running
rm -rf ~/.predicate/store
unset PREDICATE_BACKEND
pnpm build
node packages/predicate-skill/cli.bundle.mjs up
node packages/predicate-skill/cli.bundle.mjs doctor
```

Expected: `predicate doctor` reports backend=oxigraph, all checks green, no Docker-related checks shown.

- [ ] **Step 2: Snapshot the MCP tool surface**

Run:

```bash
node packages/predicate-mcp/dist/src/index.js --list-tools > /tmp/tools-after.txt
diff /tmp/tools-before.txt /tmp/tools-after.txt
```

Expected: empty diff. (Assumes you captured `tools-before.txt` from `main` before starting. If not, eyeball that the list still contains `kg_ask`, `kg_assert`, `kg_explain`, `kg_explore_schema`, `kg_propose_schema`, `kg_research_goal`, `kg_stats`, `kg_maintain`, `kg_capture`, `kg_config_get`, `kg_config_set`.)

---

## Acceptance criteria check (from spec §16)

| Criterion | Verified by |
|---|---|
| Clean install with no Docker | Final smoke Step 1 |
| All tests pass under both BACKEND values | CI matrix (Task 16) |
| Conformance suite passes both | Tasks 3 and 7 |
| `predicate migrate` round-trips 10k+ triples | Task 14 test (1k baseline; expand to 10k in the test if desired before merging) |
| README requires only Node 20+ | Task 15 |
| MCP tool surface unchanged | Final smoke Step 2 |
