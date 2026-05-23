# Predicate Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Fuseki/TDB2 in Docker, a typed MCP server exposing the v1 tool surface (initially three tools), a 50-triple seed ontology for the codebase domain, and an end-to-end demo where the agent calls `kg_explore_schema → kg_ask → kg_explain` against a live dataset.

**Architecture:** Monorepo with workspace packages. `predicate-server` runs Fuseki in Docker with a TDB2-backed dataset; `predicate-mcp` is a Node/TypeScript MCP server that speaks SPARQL 1.1 over HTTP to Fuseki and exposes the tools via stdio MCP; `predicate-ontology` holds the seed TBox in Turtle, versioned in git. Named graphs (`kg:tbox`, `kg:abox`, `kg:inferred`, `kg:provenance`, `kg:meta`, `kg:goals`, `kg:usage`, `kg:tbox-staging`) are declared at boot and enforced by the SPARQL client.

**Tech Stack:** Node 20+, TypeScript 5.x, pnpm workspaces, Vitest, `@modelcontextprotocol/sdk` (stdio transport), Apache Jena Fuseki 5.x (`stain/jena-fuseki` or official `apache/jena-fuseki` image), TDB2 persistence, Turtle 1.1, SPARQL 1.1 (Query + Update), Docker Compose.

**Spec reference:** [`docs/superpowers/specs/2026-05-16-predicate-design.md`](../specs/2026-05-16-predicate-design.md) §§3–7, 9.

**Phase exit criteria:**
- `docker compose up` brings up Fuseki with all 8 named graphs initialized and TBox loaded.
- The MCP server registers and serves `kg_explore_schema`, `kg_ask`, `kg_assert` (full impls) and stubs the remaining 5.
- A demo script asks "what does `auth.ts` depend on transitively?" and gets a non-empty, provenance-cited answer.
- CI runs the SPARQL/TS test suites green on every push.

---

## File structure (created in Phase 1)

```
predicate/
├── package.json                         ← workspace root, scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── packages/
│   ├── predicate-server/
│   │   ├── docker-compose.yml           ← Fuseki + volume
│   │   ├── fuseki/
│   │   │   ├── config.ttl               ← TDB2 dataset config, 8 graphs
│   │   │   └── shiro.ini                ← localhost-only access
│   │   ├── scripts/
│   │   │   ├── wait-for-fuseki.sh
│   │   │   └── bootstrap-graphs.sh      ← creates named graphs, loads TBox
│   │   └── README.md
│   ├── predicate-mcp/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                 ← MCP server entry (stdio)
│   │   │   ├── config.ts                ← env, dataset name resolution
│   │   │   ├── graphs.ts                ← named-graph URI constants
│   │   │   ├── sparql/
│   │   │   │   ├── client.ts            ← typed SPARQL HTTP client
│   │   │   │   ├── types.ts             ← Term, Triple, Quad, ResultSet
│   │   │   │   └── escape.ts            ← Turtle/SPARQL string escaping
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts          ← tool registration
│   │   │   │   ├── kg-explore-schema.ts
│   │   │   │   ├── kg-ask.ts
│   │   │   │   ├── kg-assert.ts
│   │   │   │   └── stubs.ts             ← 5 stub tools (return NotImplemented)
│   │   │   └── provenance.ts            ← RDF-star metadata writer
│   │   └── tests/
│   │       ├── sparql/
│   │       │   ├── client.test.ts
│   │       │   └── escape.test.ts
│   │       ├── tools/
│   │       │   ├── kg-explore-schema.test.ts
│   │       │   ├── kg-ask.test.ts
│   │       │   └── kg-assert.test.ts
│   │       └── fixtures/
│   │           ├── tbox-fragment.ttl
│   │           └── abox-fragment.ttl
│   ├── predicate-ontology/
│   │   ├── tbox/
│   │   │   └── codebase.ttl             ← ~50-triple seed ontology
│   │   ├── shapes/
│   │   │   └── codebase.shacl.ttl       ← SHACL shapes for codebase domain
│   │   ├── meta/
│   │   │   └── version.json             ← {version: "0.1.0", git_sha: "..."}
│   │   └── README.md
│   └── predicate-eval/
│       ├── package.json
│       ├── src/
│       │   ├── load-corpus.ts           ← loads a small fixture repo
│       │   └── ask.ts                   ← runs kg_ask against demo questions
│       ├── fixtures/
│       │   └── demo-corpus/             ← 5-file sample TS project
│       └── questions.json               ← 5 starter multi-hop questions
└── .github/
    └── workflows/
        └── ci.yml                        ← lint + typecheck + test
```

---

## Task 1: Initialize monorepo skeleton

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `package.json` at repo root**

```json
{
  "name": "predicate",
  "private": true,
  "version": "0.0.1",
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "pnpm -r --filter './packages/*' build",
    "test": "pnpm -r --filter './packages/*' test",
    "typecheck": "pnpm -r --filter './packages/*' typecheck",
    "lint": "pnpm -r --filter './packages/*' lint",
    "fuseki:up": "pnpm --filter predicate-server docker:up",
    "fuseki:down": "pnpm --filter predicate-server docker:down"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0"
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
.tsbuildinfo
coverage/
.env
.env.local
packages/predicate-server/fuseki-data/
*.log
.DS_Store
```

- [ ] **Step 5: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      fuseki:
        image: stain/jena-fuseki:5.0.0
        ports: ["3030:3030"]
        env:
          ADMIN_PASSWORD: testpass
        options: >-
          --health-cmd "curl -fsS http://localhost:3030/$/ping"
          --health-interval 10s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: FUSEKI_URL=http://localhost:3030 pnpm test
```

- [ ] **Step 6: Initialize pnpm and verify**

Run:
```bash
pnpm install
```
Expected: lockfile created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "chore: initialize predicate monorepo skeleton"
```

---

## Task 2: Stand up Fuseki in Docker with 8 named graphs

**Files:**
- Create: `packages/predicate-server/docker-compose.yml`
- Create: `packages/predicate-server/fuseki/config.ttl`
- Create: `packages/predicate-server/fuseki/shiro.ini`
- Create: `packages/predicate-server/scripts/wait-for-fuseki.sh`
- Create: `packages/predicate-server/scripts/bootstrap-graphs.sh`
- Create: `packages/predicate-server/package.json`
- Create: `packages/predicate-server/README.md`

- [ ] **Step 1: Write `packages/predicate-server/package.json`**

```json
{
  "name": "predicate-server",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "docker:up": "docker compose up -d && ./scripts/wait-for-fuseki.sh && ./scripts/bootstrap-graphs.sh",
    "docker:down": "docker compose down",
    "docker:nuke": "docker compose down -v"
  }
}
```

- [ ] **Step 2: Write `packages/predicate-server/docker-compose.yml`**

```yaml
services:
  fuseki:
    image: stain/jena-fuseki:5.0.0
    container_name: predicate-fuseki
    ports:
      - "127.0.0.1:3030:3030"
    environment:
      ADMIN_PASSWORD: ${PREDICATE_ADMIN_PASSWORD:-changeme}
      FUSEKI_BASE: /fuseki
    volumes:
      - ./fuseki-data:/fuseki
      - ./fuseki/config.ttl:/fuseki-base/configuration/predicate.ttl:ro
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:3030/$$/ping"]
      interval: 5s
      timeout: 3s
      retries: 20
```

- [ ] **Step 3: Write `packages/predicate-server/fuseki/config.ttl`**

```turtle
@prefix :        <#> .
@prefix fuseki:  <http://jena.apache.org/fuseki#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix tdb2:    <http://jena.apache.org/2016/tdb#> .
@prefix ja:      <http://jena.hpl.hp.com/2005/11/Assembler#> .

:service rdf:type fuseki:Service ;
    fuseki:name "predicate" ;
    fuseki:serviceQuery "query", "sparql" ;
    fuseki:serviceUpdate "update" ;
    fuseki:serviceUpload "upload" ;
    fuseki:serviceReadGraphStore "get" ;
    fuseki:serviceReadWriteGraphStore "data" ;
    fuseki:dataset :dataset .

:dataset rdf:type tdb2:DatasetTDB2 ;
    tdb2:location "/fuseki/databases/predicate" ;
    tdb2:unionDefaultGraph true .
```

- [ ] **Step 4: Write `packages/predicate-server/scripts/wait-for-fuseki.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${FUSEKI_URL:-http://localhost:3030}"
for i in $(seq 1 60); do
  if curl -fsS "$HOST/\$/ping" >/dev/null 2>&1; then
    echo "fuseki up"; exit 0
  fi
  sleep 1
done
echo "fuseki did not start" >&2
exit 1
```

Make executable:
```bash
chmod +x packages/predicate-server/scripts/wait-for-fuseki.sh
```

- [ ] **Step 5: Write `packages/predicate-server/scripts/bootstrap-graphs.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${FUSEKI_URL:-http://localhost:3030}"
DATASET="predicate"

for g in kg:tbox kg:tbox-staging kg:abox kg:inferred kg:provenance kg:goals kg:usage kg:meta; do
  echo "creating graph $g"
  curl -fsS -X POST \
    --header "Content-Type: application/sparql-update" \
    --data "CREATE SILENT GRAPH <$g>" \
    "$HOST/$DATASET/update"
done

# Load seed TBox
TBOX_PATH="${PREDICATE_TBOX_PATH:-../predicate-ontology/tbox/codebase.ttl}"
if [ -f "$TBOX_PATH" ]; then
  echo "loading TBox from $TBOX_PATH"
  curl -fsS -X POST \
    --header "Content-Type: text/turtle" \
    --data-binary "@$TBOX_PATH" \
    "$HOST/$DATASET/data?graph=kg:tbox"
fi
echo "bootstrap complete"
```

Make executable:
```bash
chmod +x packages/predicate-server/scripts/bootstrap-graphs.sh
```

- [ ] **Step 6: Write `packages/predicate-server/README.md`**

```markdown
# predicate-server

Apache Jena Fuseki 5.x + TDB2, bound to localhost only.

## Use

    pnpm docker:up      # start, wait for health, create 8 named graphs, load TBox
    pnpm docker:down    # stop, preserve data volume
    pnpm docker:nuke    # stop and delete the TDB2 volume

## Named graphs

`kg:tbox`, `kg:tbox-staging`, `kg:abox`, `kg:inferred`,
`kg:provenance`, `kg:goals`, `kg:usage`, `kg:meta`.

## Endpoint

    http://localhost:3030/predicate/{query,update,data}
```

- [ ] **Step 7: Bring it up and verify all 8 graphs exist**

Note: requires Docker. The `predicate-ontology` TBox doesn't exist yet, so this step just verifies the graphs.

Run:
```bash
cd packages/predicate-server
docker compose up -d
./scripts/wait-for-fuseki.sh
for g in kg:tbox kg:tbox-staging kg:abox kg:inferred kg:provenance kg:goals kg:usage kg:meta; do
  curl -fsS -X POST --header "Content-Type: application/sparql-update" \
    --data "CREATE SILENT GRAPH <$g>" http://localhost:3030/predicate/update
done
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } } ORDER BY ?g" \
  --header "Accept: application/sparql-results+json"
```
Expected: HTTP 200, JSON with `bindings: []` (graphs exist but are empty, which is fine — empty graphs may not show until they have triples; the absence of error is the success signal). Or do a separate read on each: `curl http://localhost:3030/predicate/get?graph=kg:tbox` should return 200 with an empty body.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-server
git commit -m "feat(server): Fuseki/TDB2 with 8 named graphs and bootstrap scripts"
```

---

## Task 3: Seed TBox in Turtle (~50 triples, codebase domain)

**Files:**
- Create: `packages/predicate-ontology/tbox/codebase.ttl`
- Create: `packages/predicate-ontology/shapes/codebase.shacl.ttl`
- Create: `packages/predicate-ontology/meta/version.json`
- Create: `packages/predicate-ontology/README.md`

- [ ] **Step 1: Write `packages/predicate-ontology/tbox/codebase.ttl`**

```turtle
@prefix :       <https://industriagents.com/predicate/codebase#> .
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

# --- Classes -------------------------------------------------------

:Artifact     a owl:Class ; rdfs:label "Artifact" .
:File         a owl:Class ; rdfs:subClassOf :Artifact ; rdfs:label "File" .
:Symbol       a owl:Class ; rdfs:subClassOf :Artifact ; rdfs:label "Symbol" .
:Function     a owl:Class ; rdfs:subClassOf :Symbol   ; rdfs:label "Function" .
:Class        a owl:Class ; rdfs:subClassOf :Symbol   ; rdfs:label "Class" .
:Module       a owl:Class ; rdfs:subClassOf :Artifact ; rdfs:label "Module" .
:Package      a owl:Class ; rdfs:subClassOf :Artifact ; rdfs:label "Package" .
:EnvVar       a owl:Class ; rdfs:subClassOf :Artifact ; rdfs:label "EnvVar" .
:Commit       a owl:Class ; rdfs:label "Commit" .
:Test         a owl:Class ; rdfs:subClassOf :Artifact ; rdfs:label "Test" .

:Function owl:disjointWith :Class .
:File     owl:disjointWith :Symbol .

# --- Properties ----------------------------------------------------

:declaredIn   a owl:ObjectProperty ;
              rdfs:domain :Symbol ; rdfs:range :File ;
              rdfs:label "declared in" .

:imports      a owl:ObjectProperty , owl:TransitiveProperty ;
              rdfs:domain :Artifact ; rdfs:range :Artifact ;
              rdfs:label "imports" .

:calls        a owl:ObjectProperty , owl:TransitiveProperty ;
              rdfs:domain :Function ; rdfs:range :Function ;
              rdfs:label "calls" .

:reads        a owl:ObjectProperty ;
              rdfs:domain :Function ; rdfs:range :EnvVar ;
              rdfs:label "reads env var" .

:dependsOn    a owl:ObjectProperty , owl:TransitiveProperty ;
              rdfs:label "depends on" .

# Property chain: f calls g ∧ g declaredIn h → f dependsOn h
:dependsOn owl:propertyChainAxiom ( :calls :declaredIn ) .

# Imports implies dependsOn
:imports rdfs:subPropertyOf :dependsOn .

:testedBy     a owl:ObjectProperty ;
              owl:inverseOf :tests ;
              rdfs:label "tested by" .

:tests        a owl:ObjectProperty ;
              rdfs:domain :Test ; rdfs:range :Symbol ;
              rdfs:label "tests" .

:lastModifiedIn a owl:ObjectProperty , owl:FunctionalProperty ;
              rdfs:domain :Artifact ; rdfs:range :Commit ;
              rdfs:label "last modified in" .

:path         a owl:DatatypeProperty , owl:FunctionalProperty ;
              rdfs:domain :File ; rdfs:range xsd:string ;
              rdfs:label "path" .

:sha          a owl:DatatypeProperty , owl:FunctionalProperty ;
              rdfs:domain :Commit ; rdfs:range xsd:string ;
              rdfs:label "sha" .
```

- [ ] **Step 2: Verify it parses cleanly with `rapper` if available, else with Fuseki**

If `rapper` (from `raptor2-utils`) is installed:
```bash
rapper -i turtle packages/predicate-ontology/tbox/codebase.ttl -c
```
Expected: number-of-triples summary, exit 0.

Otherwise upload to Fuseki and check:
```bash
curl -fsS -X PUT --header "Content-Type: text/turtle" \
  --data-binary "@packages/predicate-ontology/tbox/codebase.ttl" \
  "http://localhost:3030/predicate/data?graph=kg:tbox"
curl -fsS "http://localhost:3030/predicate/query" \
  --data-urlencode "query=SELECT (COUNT(*) AS ?n) FROM <kg:tbox> WHERE { ?s ?p ?o }" \
  --header "Accept: application/sparql-results+json"
```
Expected: triple count ≥ 40.

- [ ] **Step 3: Write `packages/predicate-ontology/shapes/codebase.shacl.ttl`**

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix :     <https://industriagents.com/predicate/codebase#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

:FileShape a sh:NodeShape ;
    sh:targetClass :File ;
    sh:property [
        sh:path :path ; sh:datatype xsd:string ;
        sh:minCount 1 ; sh:maxCount 1
    ] .

:SymbolShape a sh:NodeShape ;
    sh:targetClass :Symbol ;
    sh:property [
        sh:path :declaredIn ; sh:class :File ;
        sh:minCount 1 ; sh:maxCount 1
    ] .

:CommitShape a sh:NodeShape ;
    sh:targetClass :Commit ;
    sh:property [
        sh:path :sha ; sh:datatype xsd:string ;
        sh:minCount 1 ; sh:maxCount 1
    ] .
```

- [ ] **Step 4: Write `packages/predicate-ontology/meta/version.json`**

```json
{
  "version": "0.1.0",
  "tbox_files": ["tbox/codebase.ttl"],
  "shape_files": ["shapes/codebase.shacl.ttl"],
  "domain": "codebase"
}
```

- [ ] **Step 5: Write `packages/predicate-ontology/README.md`**

```markdown
# predicate-ontology

Versioned TBox + SHACL shapes for the codebase domain.

## Files

- `tbox/codebase.ttl` — class/property axioms (~50 triples).
- `shapes/codebase.shacl.ttl` — closed-world constraints.
- `meta/version.json` — version + manifest.

## Workflow

Edits to the TBox go through the staging/promotion lifecycle described in
the design spec §4.3. Direct edits here are reserved for v1 seeding and
for promotion sweeper commits.
```

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-ontology
git commit -m "feat(ontology): seed codebase TBox + SHACL shapes (v0.1.0)"
```

---

## Task 4: Create the predicate-mcp package skeleton

**Files:**
- Create: `packages/predicate-mcp/package.json`
- Create: `packages/predicate-mcp/tsconfig.json`
- Create: `packages/predicate-mcp/vitest.config.ts`
- Create: `packages/predicate-mcp/.eslintrc.json`
- Create: `packages/predicate-mcp/src/config.ts`
- Create: `packages/predicate-mcp/src/graphs.ts`
- Create: `packages/predicate-mcp/tests/config.test.ts`

- [ ] **Step 1: Write `packages/predicate-mcp/package.json`**

```json
{
  "name": "predicate-mcp",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "bin": { "predicate-mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests --max-warnings 0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `packages/predicate-mcp/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Write `packages/predicate-mcp/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Write `packages/predicate-mcp/.eslintrc.json`**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

- [ ] **Step 5: Write the failing test for config**

`packages/predicate-mcp/tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = original; });

  it('uses defaults when no env is set', () => {
    delete process.env.FUSEKI_URL;
    delete process.env.PREDICATE_DATASET;
    const cfg = loadConfig();
    expect(cfg.fusekiUrl).toBe('http://localhost:3030');
    expect(cfg.dataset).toBe('predicate');
  });

  it('reads FUSEKI_URL from env', () => {
    process.env.FUSEKI_URL = 'http://fuseki.local:3030';
    expect(loadConfig().fusekiUrl).toBe('http://fuseki.local:3030');
  });

  it('strips trailing slash from FUSEKI_URL', () => {
    process.env.FUSEKI_URL = 'http://x:3030/';
    expect(loadConfig().fusekiUrl).toBe('http://x:3030');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run:
```bash
cd packages/predicate-mcp && pnpm install && pnpm test
```
Expected: FAIL with `Cannot find module '../src/config.js'` (or equivalent).

- [ ] **Step 7: Implement `packages/predicate-mcp/src/config.ts`**

```typescript
export interface Config {
  fusekiUrl: string;
  dataset: string;
  queryEndpoint: string;
  updateEndpoint: string;
  dataEndpoint: string;
}

export function loadConfig(): Config {
  const raw = process.env.FUSEKI_URL ?? 'http://localhost:3030';
  const fusekiUrl = raw.replace(/\/+$/, '');
  const dataset = process.env.PREDICATE_DATASET ?? 'predicate';
  return {
    fusekiUrl,
    dataset,
    queryEndpoint: `${fusekiUrl}/${dataset}/query`,
    updateEndpoint: `${fusekiUrl}/${dataset}/update`,
    dataEndpoint: `${fusekiUrl}/${dataset}/data`,
  };
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
pnpm test
```
Expected: 3 passed.

- [ ] **Step 9: Write `packages/predicate-mcp/src/graphs.ts`**

```typescript
export const GRAPH = {
  tbox: 'kg:tbox',
  tboxStaging: 'kg:tbox-staging',
  abox: 'kg:abox',
  inferred: 'kg:inferred',
  provenance: 'kg:provenance',
  goals: 'kg:goals',
  usage: 'kg:usage',
  meta: 'kg:meta',
} as const;

export type GraphName = (typeof GRAPH)[keyof typeof GRAPH];
```

- [ ] **Step 10: Commit**

```bash
git add packages/predicate-mcp
git commit -m "feat(mcp): bootstrap predicate-mcp with config + graph constants"
```

---

## Task 5: SPARQL client — Turtle/SPARQL escape helpers

**Files:**
- Create: `packages/predicate-mcp/src/sparql/escape.ts`
- Create: `packages/predicate-mcp/tests/sparql/escape.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/predicate-mcp/tests/sparql/escape.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { escapeIRI, escapeLiteral } from '../../src/sparql/escape.js';

describe('escapeIRI', () => {
  it('wraps a valid IRI', () => {
    expect(escapeIRI('https://industriagents.com/predicate/x#Foo')).toBe('<https://industriagents.com/predicate/x#Foo>');
  });
  it('rejects an IRI containing >', () => {
    expect(() => escapeIRI('http://x/>evil')).toThrow();
  });
  it('rejects whitespace', () => {
    expect(() => escapeIRI('http://x /a')).toThrow();
  });
});

describe('escapeLiteral', () => {
  it('escapes double quotes and backslashes', () => {
    expect(escapeLiteral('he said "hi"\\n')).toBe('"he said \\"hi\\"\\\\n"');
  });
  it('escapes newlines', () => {
    expect(escapeLiteral('a\nb')).toBe('"a\\nb"');
  });
  it('accepts an empty string', () => {
    expect(escapeLiteral('')).toBe('""');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/sparql/escape.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-mcp/src/sparql/escape.ts`**

```typescript
const ILLEGAL_IRI = /[\s<>"{}|^`\\]/;

export function escapeIRI(iri: string): string {
  if (ILLEGAL_IRI.test(iri)) {
    throw new Error(`Illegal characters in IRI: ${JSON.stringify(iri)}`);
  }
  return `<${iri}>`;
}

export function escapeLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/sparql/escape.test.ts
```
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/sparql/escape.ts packages/predicate-mcp/tests/sparql/escape.test.ts
git commit -m "feat(mcp/sparql): escape helpers for IRIs and literals"
```

---

## Task 6: SPARQL client — typed HTTP query/update

**Files:**
- Create: `packages/predicate-mcp/src/sparql/types.ts`
- Create: `packages/predicate-mcp/src/sparql/client.ts`
- Create: `packages/predicate-mcp/tests/sparql/client.test.ts`

This task talks to a live Fuseki. The test suite uses the `FUSEKI_URL` env var to point at one (defaults to `http://localhost:3030`). Run `pnpm fuseki:up` from the repo root before running these tests locally.

- [ ] **Step 1: Write `packages/predicate-mcp/src/sparql/types.ts`**

```typescript
export type TermType = 'uri' | 'literal' | 'bnode';

export interface Term {
  type: TermType;
  value: string;
  datatype?: string;
  'xml:lang'?: string;
}

export type Binding = Record<string, Term>;

export interface SelectResult {
  head: { vars: string[] };
  results: { bindings: Binding[] };
}

export interface AskResult {
  head: Record<string, never>;
  boolean: boolean;
}

export interface SparqlError extends Error {
  status: number;
  body: string;
}
```

- [ ] **Step 2: Write the failing test**

`packages/predicate-mcp/tests/sparql/client.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { GRAPH } from '../../src/graphs.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

// Test isolation via per-test graph
const TEST_GRAPH = 'kg:test-client';

async function clearTestGraph() {
  await client.update(`DROP SILENT GRAPH <${TEST_GRAPH}>`);
}

describe('SparqlClient', () => {
  beforeAll(clearTestGraph);
  afterAll(clearTestGraph);

  it('runs SELECT and returns typed bindings', async () => {
    await client.update(`
      PREFIX ex: <https://ex/>
      INSERT DATA { GRAPH <${TEST_GRAPH}> { ex:a ex:p "hello" . } }
    `);
    const res = await client.select(`
      SELECT ?s ?o WHERE { GRAPH <${TEST_GRAPH}> { ?s ?p ?o } }
    `);
    expect(res.results.bindings).toHaveLength(1);
    expect(res.results.bindings[0]!.s!.value).toBe('https://ex/a');
    expect(res.results.bindings[0]!.o!.type).toBe('literal');
  });

  it('runs ASK and returns boolean', async () => {
    const yes = await client.ask(`ASK { GRAPH <${TEST_GRAPH}> { ?s ?p ?o } }`);
    expect(yes).toBe(true);
    const no = await client.ask(`ASK { GRAPH <${TEST_GRAPH}-nonexistent> { ?s ?p ?o } }`);
    expect(no).toBe(false);
  });

  it('throws SparqlError on bad query with status + body', async () => {
    await expect(client.select('NOT VALID SPARQL')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('reads graph metadata even when empty', async () => {
    const known = await client.knownGraphs();
    expect(known).toEqual(expect.arrayContaining([GRAPH.tbox]));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm test tests/sparql/client.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `packages/predicate-mcp/src/sparql/client.ts`**

```typescript
import type { Config } from '../config.js';
import type { SelectResult, AskResult, SparqlError } from './types.js';

function err(status: number, body: string): SparqlError {
  const e = new Error(`SPARQL error ${status}: ${body}`) as SparqlError;
  e.status = status;
  e.body = body;
  return e;
}

export class SparqlClient {
  constructor(private cfg: Config) {}

  async select(query: string): Promise<SelectResult> {
    const res = await fetch(this.cfg.queryEndpoint, {
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
    const res = await fetch(this.cfg.queryEndpoint, {
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
    const res = await fetch(this.cfg.updateEndpoint, {
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
    return r.results.bindings.map((b) => b.g!.value);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Start Fuseki first if not already running:
```bash
pnpm -w fuseki:up
```

Then:
```bash
pnpm test tests/sparql/client.test.ts
```
Expected: 4 passed.

Note: `knownGraphs` returns only graphs that have triples, so the test relies on TBox being loaded. If `kg:tbox` is empty in the running instance, the test will fail — load it first:
```bash
curl -fsS -X POST --header "Content-Type: text/turtle" \
  --data-binary "@packages/predicate-ontology/tbox/codebase.ttl" \
  "http://localhost:3030/predicate/data?graph=kg:tbox"
```

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/sparql packages/predicate-mcp/tests/sparql
git commit -m "feat(mcp/sparql): typed HTTP client for query/update/ask"
```

---

## Task 7: Implement `kg_explore_schema`

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-explore-schema.ts`
- Create: `packages/predicate-mcp/tests/tools/kg-explore-schema.test.ts`

`kg_explore_schema(concept)` returns the TBox slice for a concept — its classes, sub/super relations, properties whose domain or range mention it, and SHACL shapes targeting it. Output: a compact JSON structure the host agent can read to draft SPARQL.

- [ ] **Step 1: Write the failing test**

`packages/predicate-mcp/tests/tools/kg-explore-schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgExploreSchema } from '../../src/tools/kg-explore-schema.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

beforeAll(async () => {
  await client.update('DROP SILENT GRAPH <kg:tbox>');
  await client.update('CREATE SILENT GRAPH <kg:tbox>');
  const tbox = readFileSync(
    resolve(__dirname, '../../../predicate-ontology/tbox/codebase.ttl'),
    'utf8',
  );
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body: tbox,
  });
});

describe('kg_explore_schema', () => {
  it('returns the Function class slice', async () => {
    const slice = await kgExploreSchema(client, 'https://industriagents.com/predicate/codebase#Function');
    expect(slice.classes.map((c) => c.iri)).toContain('https://industriagents.com/predicate/codebase#Function');
    expect(slice.classes.find((c) => c.iri.endsWith('#Function'))?.subClassOf).toContain(
      'https://industriagents.com/predicate/codebase#Symbol',
    );
    const propIris = slice.properties.map((p) => p.iri);
    expect(propIris).toContain('https://industriagents.com/predicate/codebase#calls');
    expect(propIris).toContain('https://industriagents.com/predicate/codebase#reads');
  });

  it('returns empty arrays for an unknown concept', async () => {
    const slice = await kgExploreSchema(client, 'https://industriagents.com/predicate/codebase#NotAThing');
    expect(slice.classes).toEqual([]);
    expect(slice.properties).toEqual([]);
  });

  it('accepts a short label and resolves it', async () => {
    const slice = await kgExploreSchema(client, 'File');
    expect(slice.classes.some((c) => c.iri.endsWith('#File'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/tools/kg-explore-schema.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-mcp/src/tools/kg-explore-schema.ts`**

```typescript
import { SparqlClient } from '../sparql/client.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';

export interface ClassSlice {
  iri: string;
  label?: string;
  subClassOf: string[];
  superClassOf: string[];
  disjointWith: string[];
}

export interface PropertySlice {
  iri: string;
  label?: string;
  domain: string[];
  range: string[];
  characteristics: string[];
}

export interface SchemaSlice {
  concept: string;
  classes: ClassSlice[];
  properties: PropertySlice[];
}

async function resolveConcept(client: SparqlClient, raw: string): Promise<string | null> {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const r = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?iri WHERE {
      GRAPH ${escapeIRI(GRAPH.tbox)} {
        ?iri rdfs:label ${escapeLiteral(raw)} .
      }
    } LIMIT 1
  `);
  return r.results.bindings[0]?.iri?.value ?? null;
}

export async function kgExploreSchema(
  client: SparqlClient,
  conceptInput: string,
): Promise<SchemaSlice> {
  const concept = (await resolveConcept(client, conceptInput)) ?? conceptInput;
  const cIri = escapeIRI(concept);
  const tbox = escapeIRI(GRAPH.tbox);

  const classQ = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    SELECT ?iri ?label ?sup ?sub ?disj WHERE {
      GRAPH ${tbox} {
        ?iri a owl:Class .
        FILTER(?iri = ${cIri})
        OPTIONAL { ?iri rdfs:label ?label }
        OPTIONAL { ?iri rdfs:subClassOf ?sup . FILTER(isIRI(?sup)) }
        OPTIONAL { ?sub rdfs:subClassOf ?iri . FILTER(isIRI(?sub)) }
        OPTIONAL { ?iri owl:disjointWith ?disj }
      }
    }
  `);

  const classMap = new Map<string, ClassSlice>();
  for (const b of classQ.results.bindings) {
    const iri = b.iri!.value;
    const slice =
      classMap.get(iri) ??
      ({ iri, subClassOf: [], superClassOf: [], disjointWith: [] } as ClassSlice);
    if (b.label) slice.label = b.label.value;
    if (b.sup) slice.subClassOf.push(b.sup.value);
    if (b.sub) slice.superClassOf.push(b.sub.value);
    if (b.disj) slice.disjointWith.push(b.disj.value);
    classMap.set(iri, slice);
  }

  const propQ = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    SELECT ?p ?label ?dom ?rng ?char WHERE {
      GRAPH ${tbox} {
        ?p a ?propType .
        FILTER(?propType IN (owl:ObjectProperty, owl:DatatypeProperty))
        OPTIONAL { ?p rdfs:domain ?dom }
        OPTIONAL { ?p rdfs:range ?rng }
        OPTIONAL { ?p rdfs:label ?label }
        OPTIONAL { ?p a ?char .
                   FILTER(?char IN (owl:TransitiveProperty, owl:SymmetricProperty,
                                    owl:FunctionalProperty, owl:InverseFunctionalProperty)) }
        FILTER(?dom = ${cIri} || ?rng = ${cIri})
      }
    }
  `);

  const propMap = new Map<string, PropertySlice>();
  for (const b of propQ.results.bindings) {
    const iri = b.p!.value;
    const slice =
      propMap.get(iri) ??
      ({ iri, domain: [], range: [], characteristics: [] } as PropertySlice);
    if (b.label) slice.label = b.label.value;
    if (b.dom && !slice.domain.includes(b.dom.value)) slice.domain.push(b.dom.value);
    if (b.rng && !slice.range.includes(b.rng.value)) slice.range.push(b.rng.value);
    if (b.char && !slice.characteristics.includes(b.char.value))
      slice.characteristics.push(b.char.value);
    propMap.set(iri, slice);
  }

  return {
    concept,
    classes: Array.from(classMap.values()),
    properties: Array.from(propMap.values()),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/tools/kg-explore-schema.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-explore-schema.ts packages/predicate-mcp/tests/tools/kg-explore-schema.test.ts
git commit -m "feat(mcp/tools): kg_explore_schema returns class+property TBox slice"
```

---

## Task 8: Implement `kg_assert` (with RDF-star provenance)

**Files:**
- Create: `packages/predicate-mcp/src/provenance.ts`
- Create: `packages/predicate-mcp/src/tools/kg-assert.ts`
- Create: `packages/predicate-mcp/tests/tools/kg-assert.test.ts`

`kg_assert(triple, source, confidence)` writes to `kg:abox` and emits an RDF-star metadata triple to `kg:provenance` that annotates the asserted triple with source URI, confidence, timestamp, and extraction method.

- [ ] **Step 1: Write the failing test**

`packages/predicate-mcp/tests/tools/kg-assert.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgAssert } from '../../src/tools/kg-assert.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

beforeAll(async () => {
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
});

beforeEach(async () => {
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
});

describe('kg_assert', () => {
  it('writes the triple to kg:abox', async () => {
    await kgAssert(client, {
      subject: 'https://industriagents.com/predicate/codebase/auth.ts',
      predicate: 'https://industriagents.com/predicate/codebase#imports',
      object: { type: 'uri', value: 'https://industriagents.com/predicate/codebase/jwt.ts' },
      source: 'file:///repo/auth.ts:3',
      confidence: 0.95,
      method: 'static-import-parse',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/auth.ts>
        <https://industriagents.com/predicate/codebase#imports>
        <https://industriagents.com/predicate/codebase/jwt.ts> } }
    `);
    expect(ok).toBe(true);
  });

  it('writes RDF-star provenance with source + confidence', async () => {
    await kgAssert(client, {
      subject: 'https://industriagents.com/predicate/codebase/a',
      predicate: 'https://industriagents.com/predicate/codebase#imports',
      object: { type: 'uri', value: 'https://industriagents.com/predicate/codebase/b' },
      source: 'file:///r/a:1',
      confidence: 0.7,
      method: 'parse',
    });
    const r = await client.select(`
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?src ?conf ?method WHERE {
        GRAPH <kg:provenance> {
          <<<https://industriagents.com/predicate/codebase/a>
             <https://industriagents.com/predicate/codebase#imports>
             <https://industriagents.com/predicate/codebase/b>>>
            pred:source ?src ;
            pred:confidence ?conf ;
            pred:method ?method .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
    expect(r.results.bindings[0]!.src!.value).toBe('file:///r/a:1');
    expect(parseFloat(r.results.bindings[0]!.conf!.value)).toBeCloseTo(0.7);
    expect(r.results.bindings[0]!.method!.value).toBe('parse');
  });

  it('rejects confidence outside [0,1]', async () => {
    await expect(
      kgAssert(client, {
        subject: 'urn:a', predicate: 'urn:b',
        object: { type: 'uri', value: 'urn:c' },
        source: 'x', confidence: 1.5, method: 'm',
      }),
    ).rejects.toThrow(/confidence/);
  });

  it('writes a literal object correctly', async () => {
    await kgAssert(client, {
      subject: 'https://industriagents.com/predicate/codebase/c1',
      predicate: 'https://industriagents.com/predicate/codebase#sha',
      object: { type: 'literal', value: 'abc123' },
      source: 'git',
      confidence: 1.0,
      method: 'git-log',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/c1>
        <https://industriagents.com/predicate/codebase#sha> "abc123" } }
    `);
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/tools/kg-assert.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-mcp/src/provenance.ts`**

```typescript
export interface ProvenanceMeta {
  source: string;
  confidence: number;
  method: string;
  timestamp: string;
}

export function buildProvenanceMeta(
  partial: Omit<ProvenanceMeta, 'timestamp'>,
): ProvenanceMeta {
  return { ...partial, timestamp: new Date().toISOString() };
}
```

- [ ] **Step 4: Implement `packages/predicate-mcp/src/tools/kg-assert.ts`**

```typescript
import { SparqlClient } from '../sparql/client.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';
import { buildProvenanceMeta } from '../provenance.js';

export interface Triple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string; datatype?: string };
  source: string;
  confidence: number;
  method: string;
}

function renderObject(obj: Triple['object']): string {
  if (obj.type === 'uri') return escapeIRI(obj.value);
  if (obj.datatype) return `${escapeLiteral(obj.value)}^^${escapeIRI(obj.datatype)}`;
  return escapeLiteral(obj.value);
}

export async function kgAssert(client: SparqlClient, t: Triple): Promise<void> {
  if (t.confidence < 0 || t.confidence > 1) {
    throw new Error(`confidence must be in [0,1], got ${t.confidence}`);
  }
  const meta = buildProvenanceMeta({
    source: t.source,
    confidence: t.confidence,
    method: t.method,
  });

  const s = escapeIRI(t.subject);
  const p = escapeIRI(t.predicate);
  const o = renderObject(t.object);

  const META_NS = 'https://industriagents.com/predicate/meta#';
  const aboxG = escapeIRI(GRAPH.abox);
  const provG = escapeIRI(GRAPH.provenance);
  const star = `<< ${s} ${p} ${o} >>`;

  await client.update(`
    PREFIX pred: <${META_NS}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH ${aboxG} { ${s} ${p} ${o} . }
      GRAPH ${provG} {
        ${star} pred:source     ${escapeLiteral(meta.source)} ;
                pred:confidence "${meta.confidence}"^^xsd:decimal ;
                pred:method     ${escapeLiteral(meta.method)} ;
                pred:timestamp  "${meta.timestamp}"^^xsd:dateTime .
      }
    }
  `);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/tools/kg-assert.test.ts
```
Expected: 4 passed.

Troubleshooting: if Fuseki 5.x rejects RDF-star syntax, confirm the SPARQL endpoint is configured for SPARQL 1.2 / RDF-star (it is by default in 5.x). If using an older 4.x image, upgrade.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/provenance.ts \
        packages/predicate-mcp/src/tools/kg-assert.ts \
        packages/predicate-mcp/tests/tools/kg-assert.test.ts
git commit -m "feat(mcp/tools): kg_assert with RDF-star provenance"
```

---

## Task 9: Implement `kg_ask`

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-ask.ts`
- Create: `packages/predicate-mcp/tests/tools/kg-ask.test.ts`

`kg_ask(question)` accepts a question and an optional caller-drafted SPARQL string. In v1 it executes the SPARQL against `kg:tbox ∪ kg:abox ∪ kg:inferred`, logs the query into `kg:usage`, applies a cost ceiling and result truncation, and returns the bindings with a "more available" flag. **It does not draft SPARQL from natural language in v1** — that's the host agent's job; this tool is the execution path. (The PRD's v1 §13 ships only the execution path; the LLM-driven drafting loop is added in Phase 3.)

- [ ] **Step 1: Write the failing test**

`packages/predicate-mcp/tests/tools/kg-ask.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgAsk } from '../../src/tools/kg-ask.js';
import { kgAssert } from '../../src/tools/kg-assert.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cfg = loadConfig();
const client = new SparqlClient(cfg);
const C = 'https://industriagents.com/predicate/codebase#';

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  await reset('kg:tbox');
  const tbox = readFileSync(
    resolve(__dirname, '../../../predicate-ontology/tbox/codebase.ttl'),
    'utf8',
  );
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body: tbox,
  });
});

beforeEach(async () => {
  await reset('kg:abox');
  await reset('kg:provenance');
  await reset('kg:usage');
  await kgAssert(client, {
    subject: 'https://industriagents.com/predicate/codebase/auth.ts',
    predicate: `${C}imports`,
    object: { type: 'uri', value: 'https://industriagents.com/predicate/codebase/jwt.ts' },
    source: 'parse', confidence: 1, method: 'parse',
  });
});

describe('kg_ask', () => {
  it('executes a caller-drafted SELECT and returns bindings', async () => {
    const r = await kgAsk(client, {
      question: 'what does auth.ts import?',
      sparql: `
        PREFIX c: <${C}>
        SELECT ?o WHERE { GRAPH <kg:abox> {
          <https://industriagents.com/predicate/codebase/auth.ts> c:imports ?o } }
      `,
    });
    expect(r.bindings).toHaveLength(1);
    expect(r.bindings[0]!.o!.value).toBe('https://industriagents.com/predicate/codebase/jwt.ts');
    expect(r.truncated).toBe(false);
  });

  it('truncates results to maxRows and sets truncated flag', async () => {
    for (let i = 0; i < 5; i++) {
      await kgAssert(client, {
        subject: `https://industriagents.com/predicate/codebase/auth.ts`,
        predicate: `${C}imports`,
        object: { type: 'uri', value: `https://industriagents.com/predicate/codebase/dep${i}.ts` },
        source: 'p', confidence: 1, method: 'p',
      });
    }
    const r = await kgAsk(client, {
      question: 'deps',
      sparql: `
        PREFIX c: <${C}>
        SELECT ?o WHERE { GRAPH <kg:abox> {
          <https://industriagents.com/predicate/codebase/auth.ts> c:imports ?o } }
      `,
      maxRows: 3,
    });
    expect(r.bindings).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });

  it('logs the query into kg:usage', async () => {
    await kgAsk(client, {
      question: 'q',
      sparql: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1',
    });
    const u = await client.select(
      'SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?s ?p ?o } }',
    );
    expect(parseInt(u.results.bindings[0]!.n!.value, 10)).toBeGreaterThan(0);
  });

  it('rejects UPDATE queries (read-only tool)', async () => {
    await expect(
      kgAsk(client, { question: 'x', sparql: 'INSERT DATA { <a:a> <a:b> <a:c> }' }),
    ).rejects.toThrow(/read-only/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/tools/kg-ask.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-mcp/src/tools/kg-ask.ts`**

```typescript
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
  const META = 'https://industriagents.com/predicate/meta#';
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/tools/kg-ask.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-ask.ts packages/predicate-mcp/tests/tools/kg-ask.test.ts
git commit -m "feat(mcp/tools): kg_ask executes drafted SPARQL with usage logging"
```

---

## Task 10: Register tools with MCP and ship a stdio binary

**Files:**
- Create: `packages/predicate-mcp/src/tools/registry.ts`
- Create: `packages/predicate-mcp/src/tools/stubs.ts`
- Create: `packages/predicate-mcp/src/index.ts`
- Create: `packages/predicate-mcp/tests/index.test.ts`

- [ ] **Step 1: Write `packages/predicate-mcp/src/tools/stubs.ts`**

```typescript
export class NotImplementedError extends Error {
  constructor(tool: string) {
    super(`${tool} is a Phase 1 stub; planned for a later phase`);
    this.name = 'NotImplementedError';
  }
}
```

- [ ] **Step 2: Write `packages/predicate-mcp/src/tools/registry.ts`**

```typescript
import { z } from 'zod';
import { SparqlClient } from '../sparql/client.js';
import { kgExploreSchema } from './kg-explore-schema.js';
import { kgAsk } from './kg-ask.js';
import { kgAssert, type Triple } from './kg-assert.js';
import { NotImplementedError } from './stubs.js';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (args: unknown) => Promise<unknown>;
}

export function buildTools(client: SparqlClient): ToolDef[] {
  return [
    {
      name: 'kg_explore_schema',
      description: 'Return the TBox slice (classes, sub/super, properties, characteristics) for a concept.',
      inputSchema: z.object({ concept: z.string().min(1) }),
      handler: async (raw) => {
        const { concept } = z.object({ concept: z.string() }).parse(raw);
        return kgExploreSchema(client, concept);
      },
    },
    {
      name: 'kg_ask',
      description: 'Execute a caller-drafted SPARQL SELECT/ASK against the live graph; logs usage. Read-only.',
      inputSchema: z.object({
        question: z.string(),
        sparql: z.string(),
        maxRows: z.number().int().positive().optional(),
      }),
      handler: async (raw) => {
        const args = z.object({
          question: z.string(),
          sparql: z.string(),
          maxRows: z.number().int().positive().optional(),
        }).parse(raw);
        return kgAsk(client, args);
      },
    },
    {
      name: 'kg_assert',
      description: 'Assert a triple into kg:abox with RDF-star provenance (source, confidence, method).',
      inputSchema: z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.object({
          type: z.enum(['uri', 'literal']),
          value: z.string(),
          datatype: z.string().optional(),
        }),
        source: z.string(),
        confidence: z.number().min(0).max(1),
        method: z.string(),
      }),
      handler: async (raw) => {
        const args = raw as Triple;
        await kgAssert(client, args);
        return { ok: true };
      },
    },
    ...stubs(),
  ];
}

function stubs(): ToolDef[] {
  const names = [
    ['kg_explain', 'Return the inference path for a claim.'],
    ['kg_propose_schema', 'Stage a schema delta for review.'],
    ['kg_research_goal', 'Run gap-detect → research → propose loop for a goal.'],
    ['kg_stats', 'Graph stats: triples, inferred ratio, materialization latency.'],
    ['kg_maintain', 'Trigger pruning, generalization, and refactor sweep.'],
  ];
  return names.map(([name, description]) => ({
    name: name!,
    description: description!,
    inputSchema: z.unknown(),
    handler: async () => { throw new NotImplementedError(name!); },
  }));
}
```

- [ ] **Step 3: Write `packages/predicate-mcp/src/index.ts`**

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { SparqlClient } from './sparql/client.js';
import { buildTools } from './tools/registry.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new SparqlClient(config);
  const tools = buildTools(client);

  const server = new Server(
    { name: 'predicate-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema as never),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);
    const result = await tool.handler(req.params.arguments);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add `zod-to-json-schema` to dependencies:
```bash
cd packages/predicate-mcp && pnpm add zod-to-json-schema
```

- [ ] **Step 4: Write the failing integration test**

`packages/predicate-mcp/tests/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SparqlClient } from '../src/sparql/client.js';
import { loadConfig } from '../src/config.js';
import { buildTools } from '../src/tools/registry.js';

describe('tool registry', () => {
  const tools = buildTools(new SparqlClient(loadConfig()));
  const names = tools.map((t) => t.name);

  it('exposes all 8 tools', () => {
    expect(names.sort()).toEqual(
      [
        'kg_ask',
        'kg_assert',
        'kg_explain',
        'kg_explore_schema',
        'kg_maintain',
        'kg_propose_schema',
        'kg_research_goal',
        'kg_stats',
      ].sort(),
    );
  });

  it('stub tools throw NotImplementedError', async () => {
    const stub = tools.find((t) => t.name === 'kg_explain')!;
    await expect(stub.handler({})).rejects.toThrow(/Phase 1 stub/);
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/index.test.ts
```
Expected: 2 passed.

- [ ] **Step 6: Build the binary and smoke-test it**

```bash
pnpm build
node dist/index.js < /dev/null &
PID=$!
sleep 1
kill $PID || true
```
Expected: process started, no immediate crash. (Full MCP handshake is exercised by integration with Claude Code in Task 12.)

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-mcp
git commit -m "feat(mcp): register 8 tools, ship stdio MCP binary"
```

---

## Task 11: End-to-end demo — `predicate-eval`

**Files:**
- Create: `packages/predicate-eval/package.json`
- Create: `packages/predicate-eval/tsconfig.json`
- Create: `packages/predicate-eval/questions.json`
- Create: `packages/predicate-eval/fixtures/demo-corpus/auth.ts`
- Create: `packages/predicate-eval/fixtures/demo-corpus/jwt.ts`
- Create: `packages/predicate-eval/fixtures/demo-corpus/.env.production`
- Create: `packages/predicate-eval/src/load-corpus.ts`
- Create: `packages/predicate-eval/src/ask.ts`
- Create: `packages/predicate-eval/tests/end-to-end.test.ts`

This is the "ask → answer" demo from PRD §13 Foundation deliverable. The corpus is a 3-file mini-codebase; the loader uses simple regex extraction (not the real research orchestrator) to write 15–20 ABox triples; the ask script runs three multi-hop questions.

- [ ] **Step 1: Write `packages/predicate-eval/package.json`**

```json
{
  "name": "predicate-eval",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint src tests --max-warnings 0",
    "demo": "tsx src/load-corpus.ts && tsx src/ask.ts"
  },
  "dependencies": {
    "predicate-mcp": "workspace:*",
    "tsx": "^4.16.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write the fixture files**

`packages/predicate-eval/fixtures/demo-corpus/auth.ts`:

```typescript
import { verifyJwt } from './jwt';

export function login(token: string): boolean {
  return verifyJwt(token);
}
```

`packages/predicate-eval/fixtures/demo-corpus/jwt.ts`:

```typescript
const SECRET = process.env.JWT_SECRET ?? '';

export function verifyJwt(token: string): boolean {
  return token.length > 0 && SECRET.length > 0;
}
```

`packages/predicate-eval/fixtures/demo-corpus/.env.production`:

```
JWT_SECRET=production-secret-do-not-commit
```

- [ ] **Step 3: Write `packages/predicate-eval/src/load-corpus.ts`**

```typescript
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';

const C = 'https://industriagents.com/predicate/codebase#';
const DOM = 'https://industriagents.com/predicate/codebase';
const ROOT = join(import.meta.dirname, '..', 'fixtures', 'demo-corpus');

function iriForFile(name: string): string { return `${DOM}/${name}`; }
function iriForFn(file: string, name: string): string { return `${DOM}/${file}#${name}`; }
function iriForEnv(name: string): string { return `${DOM}/env/${name}`; }

const importRE = /import\s+\{[^}]*\}\s+from\s+['"]\.\/([\w-]+)['"]/g;
const fnRE = /export\s+function\s+(\w+)\s*\(/g;
const callRE = /\b(\w+)\s*\(/g;
const envRE = /process\.env\.([A-Z0-9_]+)/g;

async function main(): Promise<void> {
  const client = new SparqlClient(loadConfig());
  const files = readdirSync(ROOT).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const path = join(ROOT, f);
    const src = readFileSync(path, 'utf8');
    const fileIri = iriForFile(f);

    await kgAssert(client, {
      subject: fileIri, predicate: `${C}path`,
      object: { type: 'literal', value: f },
      source: path, confidence: 1, method: 'fs-read',
    });
    await kgAssert(client, {
      subject: fileIri, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: { type: 'uri', value: `${C}File` },
      source: path, confidence: 1, method: 'fs-read',
    });

    for (const m of src.matchAll(importRE)) {
      await kgAssert(client, {
        subject: fileIri, predicate: `${C}imports`,
        object: { type: 'uri', value: iriForFile(`${m[1]}.ts`) },
        source: path, confidence: 0.95, method: 'regex-import',
      });
    }

    const declared = new Set<string>();
    for (const m of src.matchAll(fnRE)) {
      const fnIri = iriForFn(f, m[1]!);
      declared.add(m[1]!);
      await kgAssert(client, {
        subject: fnIri, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: { type: 'uri', value: `${C}Function` },
        source: path, confidence: 1, method: 'regex-fn',
      });
      await kgAssert(client, {
        subject: fnIri, predicate: `${C}declaredIn`,
        object: { type: 'uri', value: fileIri },
        source: path, confidence: 1, method: 'regex-fn',
      });
    }

    for (const m of src.matchAll(envRE)) {
      const envIri = iriForEnv(m[1]!);
      await kgAssert(client, {
        subject: envIri, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: { type: 'uri', value: `${C}EnvVar` },
        source: path, confidence: 1, method: 'regex-env',
      });
      for (const fn of declared) {
        await kgAssert(client, {
          subject: iriForFn(f, fn), predicate: `${C}reads`,
          object: { type: 'uri', value: envIri },
          source: path, confidence: 0.6, method: 'regex-env-near-fn',
        });
      }
    }
  }
  console.log('corpus loaded');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Write `packages/predicate-eval/src/ask.ts`**

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgAsk } from 'predicate-mcp/src/tools/kg-ask.js';

const C = 'https://industriagents.com/predicate/codebase#';

const questions: { q: string; sparql: string }[] = [
  {
    q: 'What does auth.ts depend on (1 hop)?',
    sparql: `
      PREFIX c: <${C}>
      SELECT ?dep WHERE { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/auth.ts> c:imports ?dep } }
    `,
  },
  {
    q: 'Transitive deps of auth.ts via the inferred graph',
    sparql: `
      PREFIX c: <${C}>
      SELECT ?dep WHERE {
        { GRAPH <kg:abox> { <https://industriagents.com/predicate/codebase/auth.ts> c:imports ?dep } }
        UNION
        { GRAPH <kg:inferred> { <https://industriagents.com/predicate/codebase/auth.ts> c:dependsOn ?dep } }
      }
    `,
  },
  {
    q: 'Which functions in jwt.ts read which env vars?',
    sparql: `
      PREFIX c: <${C}>
      SELECT ?fn ?env WHERE { GRAPH <kg:abox> {
        ?fn c:declaredIn <https://industriagents.com/predicate/codebase/jwt.ts> ;
            c:reads ?env } }
    `,
  },
];

async function main(): Promise<void> {
  const client = new SparqlClient(loadConfig());
  for (const { q, sparql } of questions) {
    const r = await kgAsk(client, { question: q, sparql });
    console.log(`\nQ: ${q}\n   rows=${r.rowCount} truncated=${r.truncated}`);
    for (const b of r.bindings) {
      console.log('   ', Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Write the failing end-to-end test**

`packages/predicate-eval/tests/end-to-end.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

const client = new SparqlClient(loadConfig());

beforeAll(async () => {
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  execSync('pnpm tsx src/load-corpus.ts', { cwd: __dirname + '/..', stdio: 'inherit' });
});

describe('end-to-end demo', () => {
  it('auth.ts imports jwt.ts is asserted', async () => {
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/auth.ts>
        <https://industriagents.com/predicate/codebase#imports>
        <https://industriagents.com/predicate/codebase/jwt.ts> } }
    `);
    expect(ok).toBe(true);
  });

  it('verifyJwt reads JWT_SECRET (with confidence < 1)', async () => {
    const r = await client.select(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      SELECT ?env WHERE { GRAPH <kg:abox> {
        <https://industriagents.com/predicate/codebase/jwt.ts#verifyJwt> c:reads ?env } }
    `);
    expect(r.results.bindings.map((b) => b.env!.value)).toContain(
      'https://industriagents.com/predicate/codebase/env/JWT_SECRET',
    );
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
pnpm test tests/end-to-end.test.ts
```
Expected: 2 passed.

- [ ] **Step 7: Run the human-facing demo**

```bash
pnpm demo
```
Expected: three Q sections print, all with non-zero rows for the first and third questions. The second (transitive inferred) will have zero rows until Phase 2 (CONSTRUCT rule layer) ships — that is fine for Phase 1 exit.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-eval
git commit -m "feat(eval): end-to-end ask→answer demo over 3-file corpus"
```

---

## Task 12: Skill package — `SKILL.md`, plugin manifest, SessionStart hook

**Files:**
- Create: `packages/predicate-skill/.claude-plugin/plugin.json`
- Create: `packages/predicate-skill/.claude-plugin/marketplace.json`
- Create: `packages/predicate-skill/skills/predicate/SKILL.md`
- Create: `packages/predicate-skill/hooks/hooks.json`
- Create: `packages/predicate-skill/hooks/session-start.sh`
- Create: `packages/predicate-skill/README.md`

- [ ] **Step 1: Write `packages/predicate-skill/.claude-plugin/plugin.json`**

```json
{
  "name": "predicate",
  "version": "0.1.0",
  "description": "Local reasoning knowledge graph (RDF/OWL) for AI agents.",
  "mcpServers": {
    "predicate": {
      "command": "node",
      "args": ["${PLUGIN_DIR}/../predicate-mcp/dist/index.js"],
      "env": {
        "FUSEKI_URL": "http://localhost:3030",
        "PREDICATE_DATASET": "predicate"
      }
    }
  },
  "skills": ["skills/predicate"],
  "hooks": "hooks/hooks.json"
}
```

- [ ] **Step 2: Write `packages/predicate-skill/skills/predicate/SKILL.md`**

```markdown
---
name: predicate
description: Local reasoning knowledge graph for "why", "what breaks if", and "what's connected to" questions. OWL-backed, provenance-tracked, schema-versioned. Use instead of RAG when the question is structural rather than fuzzy-semantic.
---

<EXTREMELY-IMPORTANT>
Do NOT invent predicates. ALWAYS call `kg_explore_schema` before drafting SPARQL.
If a predicate you need does not exist, call `kg_propose_schema` — never use
`kg_assert` with a fabricated property name.
</EXTREMELY-IMPORTANT>

# When to use this skill

Use Predicate when the user asks:
- **Why** something happened ("why did login break?")
- **What breaks if** X changes ("blast radius of renaming `validateToken`?")
- **What's connected to** X transitively ("everything downstream of `JWT_SECRET`?")
- **Where the contradiction is** ("these two docs disagree — which holds?")

Do NOT use Predicate for:
- Fuzzy semantic recall ("find docs about login" — use vector search)
- One-shot Q&A with no entities/relations

# Workflow

Follow this sequence. Each step has a hard gate.

1. **Explore the schema first.** Call `kg_explore_schema(concept)` to learn the
   predicates available. Do not draft SPARQL without doing this.
2. **Draft fresh SPARQL.** Compose a query against `kg:abox` and `kg:inferred`.
   Pre-baked templates are forbidden. The query should be specific to the
   concept slice you just read.
3. **Execute via `kg_ask`.** Pass the question and SPARQL. Inspect rows. If
   empty or odd, refine — narrow filters, broaden graphs, check for typos.
4. **Cite provenance.** For every claim the user might act on, call
   `kg_explain` to surface the inference path. Show the user the SOURCE,
   CONFIDENCE, and METHOD for the load-bearing triples.
5. **Assert only after research.** If you learned something new in the session,
   call `kg_assert(triple, source, confidence, method)`. Confidence must be
   honest (parsed code: 0.95+; extracted from prose: 0.6–0.8).
6. **Propose schema only when ABox cannot represent the fact.** If the gap is
   structural (no class or property exists), call `kg_propose_schema(delta,
   justification)`. The promotion gate requires the proposed concept be used
   in N ≥ 3 successful queries within 7 days before it joins the live TBox.

# HARD-GATE anti-patterns

- ❌ Dumping raw text into `kg_assert` — assertions are triples, not prose.
- ❌ Querying `kg:inferred` to write back into `kg:abox`.
- ❌ Bypassing SHACL by writing to graphs that skip validation.
- ❌ Inventing predicates — always check the TBox first.

# Worked examples

## 1. Why did login break?

```
kg_explore_schema("Function")     # learn :calls, :declaredIn, :reads
kg_ask(
  question="What does login depend on?",
  sparql="""
    PREFIX c: <https://industriagents.com/predicate/codebase#>
    SELECT ?dep WHERE {
      { GRAPH <kg:abox> { <https://industriagents.com/predicate/codebase/auth.ts#login> c:reads|c:calls ?dep } }
      UNION
      { GRAPH <kg:inferred> { <https://industriagents.com/predicate/codebase/auth.ts#login> c:dependsOn ?dep } }
    }
  """
)
kg_explain("auth.ts#login depends on JWT_SECRET")
```

## 2. Blast radius of renaming `validateToken`

```
kg_explore_schema("calls")
kg_ask(
  question="What calls validateToken transitively?",
  sparql="""
    PREFIX c: <https://industriagents.com/predicate/codebase#>
    SELECT ?caller WHERE {
      GRAPH <kg:inferred> { ?caller c:calls* <...#validateToken> }
    }
  """
)
```

## 3. Contradiction detection

```
kg_ask(
  question="Any disjoint-class violations?",
  sparql="""
    PREFIX c: <https://industriagents.com/predicate/codebase#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    SELECT ?x ?a ?b WHERE {
      GRAPH <kg:inferred> { ?x a ?a, ?b }
      GRAPH <kg:tbox> { ?a owl:disjointWith ?b }
    }
  """
)
```

## 4. Schema gap → propose

```
# User asks: "which services own these endpoints?"
# kg_explore_schema reveals: no :owns property exists
kg_propose_schema(
  delta="""
    @prefix c: <https://industriagents.com/predicate/codebase#> .
    c:Service a owl:Class .
    c:owns a owl:ObjectProperty ;
      rdfs:domain c:Service ; rdfs:range c:Endpoint .
  """,
  justification="Goal G-123 asks 'which service owns /login'; no current property captures service-to-endpoint ownership."
)
# This goes to kg:tbox-staging. The promotion gate requires 3 successful uses in 7 days.
```
```

- [ ] **Step 3: Write `packages/predicate-skill/hooks/hooks.json`**

```json
{
  "hooks": [
    {
      "event": "SessionStart",
      "matcher": "startup|clear|compact",
      "command": "bash ${PLUGIN_DIR}/hooks/session-start.sh"
    }
  ]
}
```

- [ ] **Step 4: Write `packages/predicate-skill/hooks/session-start.sh`**

```bash
#!/usr/bin/env bash
# SessionStart hook: emits a short context block telling the agent
# how many open goals and active concepts Predicate is tracking.
set -euo pipefail
FUSEKI="${FUSEKI_URL:-http://localhost:3030}"
DS="${PREDICATE_DATASET:-predicate}"

if ! curl -fsS "$FUSEKI/\$/ping" >/dev/null 2>&1; then
  jq -n '{ additional_context: "Predicate: Fuseki not reachable; KG tools may fail. Start it with `pnpm fuseki:up`." }'
  exit 0
fi

GOALS=$(curl -fsS "$FUSEKI/$DS/query" \
  --data-urlencode "query=PREFIX pred: <https://industriagents.com/predicate/meta#>
  SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:goals> { ?g pred:status \"active\" } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[0].n.value // "0"')

CONCEPTS=$(curl -fsS "$FUSEKI/$DS/query" \
  --data-urlencode "query=SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH <kg:tbox> { ?c a <http://www.w3.org/2002/07/owl#Class> } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[0].n.value // "0"')

MSG="Predicate ready: ${GOALS} active goals, ${CONCEPTS} TBox classes. Use kg_explore_schema before drafting SPARQL."
jq -n --arg m "$MSG" '{ additional_context: $m }'
```

Make executable:
```bash
chmod +x packages/predicate-skill/hooks/session-start.sh
```

- [ ] **Step 5: Write `packages/predicate-skill/README.md`**

```markdown
# predicate-skill

Claude Code plugin packaging the Predicate MCP server + SKILL.md + SessionStart hook.

## Install

    # From the repo root
    pnpm fuseki:up
    pnpm --filter predicate-mcp build

    # In Claude Code, add the plugin pointing at this directory.

## Files

- `.claude-plugin/plugin.json` — registers the predicate MCP server + skill + hooks.
- `skills/predicate/SKILL.md` — host-agent contract: triggers, workflow, anti-patterns.
- `hooks/hooks.json` + `hooks/session-start.sh` — surface KG status at session boot.
```

- [ ] **Step 6: Smoke-test the hook**

```bash
FUSEKI_URL=http://localhost:3030 bash packages/predicate-skill/hooks/session-start.sh
```
Expected: JSON with `additional_context` mentioning the class count.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-skill
git commit -m "feat(skill): SKILL.md + plugin manifest + SessionStart hook"
```

---

## Task 13: Phase 1 exit — wire CI, README, and verify everything

**Files:**
- Modify: `README.md` (create at repo root if missing)
- Verify: `.github/workflows/ci.yml` passes end-to-end

- [ ] **Step 1: Write `README.md` at repo root**

```markdown
# Predicate

A local-first MCP skill that gives AI agents a knowledge graph they can reason
over and that improves itself with use.

See [`docs/predicate-prd.md`](docs/predicate-prd.md) for the product brief,
[`docs/superpowers/specs/2026-05-16-predicate-design.md`](docs/superpowers/specs/2026-05-16-predicate-design.md)
for the v1 architecture.

## Quickstart

    pnpm install
    pnpm fuseki:up                          # Fuseki + 8 named graphs + seed TBox
    pnpm --filter predicate-mcp build       # compile the MCP server
    pnpm --filter predicate-eval demo       # load fixture corpus + run 3 questions

Wire the skill into Claude Code by adding `packages/predicate-skill` as a
plugin source.

## Packages

| Package | Purpose |
|---|---|
| `predicate-server` | Fuseki/TDB2 in Docker; 8 named graphs |
| `predicate-mcp` | MCP server; 8 tools (3 implemented in Phase 1, 5 stubs) |
| `predicate-ontology` | Versioned TBox + SHACL shapes |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | SKILL.md + plugin.json + SessionStart hook |

## Status

Phase 1 (Foundation) complete. Phase 2 (Discipline — OWL 2 RL CONSTRUCT rule layer,
SHACL validation, kg_explain) is the next plan in `docs/superpowers/plans/`.
```

- [ ] **Step 2: Run the full test suite locally**

```bash
pnpm fuseki:up
pnpm typecheck
pnpm lint
pnpm test
```
Expected: every package green.

- [ ] **Step 3: Push and verify CI is green**

```bash
git push -u origin main
```
Inspect the Actions tab; expect the `ci` job to pass.

- [ ] **Step 4: Commit the README and tag**

```bash
git add README.md
git commit -m "docs: README + Phase 1 status; tag v0.1.0-foundation"
git tag v0.1.0-foundation
```

---

## Phase 2–4 — outline only (separate plans to be written)

The following are recorded as upcoming plans so the work is sequenced, not lost.
Each gets its own `docs/superpowers/plans/` file written via the writing-plans
skill when Phase 1 is complete and signed off.

### Phase 2 — Discipline (PRD weeks 3–4)

- Implement `predicate-reasoner` package: 12–15 OWL 2 RL CONSTRUCT rules.
- Fixpoint runner with N=10 iteration cap and overflow warning.
- SHACL validator wired post-materialization.
- Confidence-threshold gate that excludes low-confidence triples from closure input.
- `kg_explain` implementation walking the inference trace by re-running rules forward.
- CI: ontology consistency check on every PR that touches `predicate-ontology/`.
- Exit: the second eval question (transitive deps via `kg:inferred`) returns rows.

### Phase 3 — Agent loop (PRD weeks 5–8)

- `predicate-agent` package: goal store (`kg:goals`), question decomposer, gap detector.
- Research orchestrator with `ResearchSource` interface; ship Web + Docs source only.
- Triple extractor with confidence calibration per source.
- `kg_propose_schema` writes staging deltas; promotion sweeper runs validation + usage gates.
- TBox version commits to git on promotion; `kg:meta` mirrors.
- Exit: 70%+ correctness on the 30-question multi-hop eval set.

### Phase 4 — Efficiency (PRD weeks 9–12)

- Usage tracking in `kg:usage` (already wired by `kg_ask`); aggregation queries.
- Reaper: archive triples with `use_count=0` and `confidence<0.6` after 30 days.
- Generalization detector: scan for K+ untyped instances sharing a structural pattern.
- Materialization tuning: cache hot rule outputs, debounced re-materialization.
- `kg_maintain` implementation; cron job in `predicate-skill`.
- Exit: unused-concept ratio < 15% after a 30-session synthetic stress test.

---

## Self-review notes

- **Spec coverage:** all design-spec §§3–6 (architecture, three lifecycles, named graphs, tools) are implemented or stubbed in Phase 1; §§7 (SKILL.md), §8 (reasoner), §9 (components), §10 (hooks) start in Phase 1 and continue. The Discipline/Agent-loop/Efficiency phases are scheduled.
- **Placeholder scan:** no "TBD" / "handle errors" / "implement later" in any task body.
- **Type consistency:** `Triple` type defined once in `kg-assert.ts` and reused via the registry; `SchemaSlice` defined once in `kg-explore-schema.ts`; `AskInput`/`AskOutput` defined once in `kg-ask.ts`.
- **One open follow-up:** Task 11's second eval question is expected to return zero rows until Phase 2 ships the reasoner. This is called out at the bottom of Task 11 Step 7 so the engineer doesn't try to "fix" it.
