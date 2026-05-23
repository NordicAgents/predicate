# Predicate v2.0 — Domain-Agnostic Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded codebase-TBox bootstrap with a 3-mode configurable init (community ontology / upload / empty), 5 bundled ontologies in a new catalog directory, and a runtime-toggleable schema-learning flag via two new MCP tools (`kg_config_set` / `kg_config_get`).

**Architecture:** Spec at `docs/superpowers/specs/2026-05-17-predicate-v2-domain-agnostic-bootstrap-design.md`. Add a `pred:Config` record in `kg:meta` that the sweeper + generalizer read. New `predicate init` CLI auto-runs on first `predicate up` (TTY) and writes the config. v1.13 users auto-migrate by sniffing for `codebase:File` in `kg:tbox`.

**Tech Stack:** Existing pnpm workspace (TypeScript 5, vitest, N3.js, Apache Jena Fuseki, Anthropic SDK). No new runtime deps.

---

## Self-review of this plan (done up front)

1. **Spec coverage:** All six decisions from the spec's Decisions Matrix have a task. The five bundled ontologies have a creation task (T2) + smoke tests (T3). Toggle mechanism = T4 (MCP tool) + T5 (sweeper/generalizer reads). init CLI = T6. bootstrap simplification + up legacy migration = T7 + T8. SKILL.md + dashboard badge + version bump = T10.
2. **Placeholder scan:** Every step shows complete code or exact commands. No "TBD".
3. **Type consistency:** `pred:Config` class is declared in T1, referenced in T4, T5, T6, T8 with the same property names (`initMode`, `initOntology`, `schemaLearningEnabled`, `initializedAt`).
4. **Breaking change accounting:** T9 explicitly refactors tests that assume codebase predicates exist into a shared fixture pattern. Without this, T7 (bootstrap simplification) would break ~50 existing tests.

---

### Task 1: Meta vocabulary — `pred:Config` class and its properties

**Files:**
- Modify: `packages/predicate-ontology/meta/predicate-meta.ttl`
- Modify: `packages/predicate-ontology/meta/version.json`

- [ ] **Step 1: Append the Config class declaration to predicate-meta.ttl**

Read the current file to confirm where the last block ends (likely after `pred:peerKind`). Append:

```turtle

# --- Bootstrap/init config (v2.0) --------------------------------

pred:Config           a owl:Class ; rdfs:label "Predicate runtime config singleton" .
pred:initMode         a owl:DatatypeProperty , owl:FunctionalProperty ;
                      rdfs:domain pred:Config ; rdfs:range xsd:string ;
                      rdfs:comment "One of: community | upload | empty" .
pred:initOntology     a owl:DatatypeProperty , owl:FunctionalProperty ;
                      rdfs:domain pred:Config ; rdfs:range xsd:string ;
                      rdfs:comment "Catalog name (e.g. codebase, foaf), or 'user' for upload, or 'top' for empty" .
pred:schemaLearningEnabled a owl:DatatypeProperty , owl:FunctionalProperty ;
                      rdfs:domain pred:Config ; rdfs:range xsd:boolean ;
                      rdfs:comment "When false, Generalizer skips auto-proposal generation (Sweeper still promotes existing staging)" .
pred:initializedAt    a owl:DatatypeProperty , owl:FunctionalProperty ;
                      rdfs:domain pred:Config ; rdfs:range xsd:dateTime .
```

- [ ] **Step 2: Bump meta version.json**

```bash
sed -i.bak 's/"version": "0.7.0"/"version": "0.8.0"/' packages/predicate-ontology/meta/version.json && rm packages/predicate-ontology/meta/version.json.bak
```

If the current version isn't 0.7.0, adapt the source value but bump to 0.8.0.

- [ ] **Step 3: Reload TBox + verify**

```bash
( cd packages/predicate-server && bash scripts/bootstrap-graphs.sh ) 2>&1 | tail -3
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://industriagents.com/predicate/meta#> ASK { GRAPH <kg:tbox> { pred:Config a <http://www.w3.org/2002/07/owl#Class> . pred:schemaLearningEnabled a <http://www.w3.org/2002/07/owl#DatatypeProperty> } }" \
  --header "Accept: application/sparql-results+json" | jq -r .boolean
```

Expected: `true`.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-ontology/meta/predicate-meta.ttl packages/predicate-ontology/meta/version.json
git commit -m "$(cat <<'EOF'
feat(ontology): v0.8.0 — add pred:Config class for v2.0 bootstrap

Adds pred:Config + four properties (initMode, initOntology,
schemaLearningEnabled, initializedAt). Backs the new predicate init
CLI and the kg_config_set/get MCP tools shipping in v2.0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create the catalog directory + 5 ontology files

**Files:**
- Create: `packages/predicate-ontology/catalog/catalog.json`
- Create: `packages/predicate-ontology/catalog/top.ttl`
- Create: `packages/predicate-ontology/catalog/foaf.ttl`
- Create: `packages/predicate-ontology/catalog/schema-org-lite.ttl`
- Create: `packages/predicate-ontology/catalog/fhir-core.ttl`
- Move: `packages/predicate-ontology/tbox/codebase.ttl` → `packages/predicate-ontology/catalog/codebase.ttl`
- Move: `packages/predicate-ontology/shapes/codebase.shacl.ttl` → `packages/predicate-ontology/catalog/codebase.shacl.ttl`

- [ ] **Step 1: Create the catalog directory + move codebase files**

```bash
mkdir -p packages/predicate-ontology/catalog
git mv packages/predicate-ontology/tbox/codebase.ttl packages/predicate-ontology/catalog/codebase.ttl
git mv packages/predicate-ontology/shapes/codebase.shacl.ttl packages/predicate-ontology/catalog/codebase.shacl.ttl
# Remove now-empty dirs (only if they're empty)
rmdir packages/predicate-ontology/tbox packages/predicate-ontology/shapes 2>/dev/null || true
```

- [ ] **Step 2: Create top.ttl**

```turtle
@prefix :     <https://industriagents.com/predicate/top#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

# Minimal upper ontology (Predicate v2.0 "start-empty" mode seed)

:Thing      a owl:Class ;
            rdfs:label "Thing" ;
            rdfs:comment "The universal class. Everything is a Thing." .

:dependsOn  a owl:ObjectProperty , owl:TransitiveProperty ;
            rdfs:domain :Thing ; rdfs:range :Thing ;
            rdfs:label "depends on" ;
            rdfs:comment "Asymmetric directional dependency. Transitive: A→B and B→C implies A→C." .

:relatedTo  a owl:ObjectProperty , owl:SymmetricProperty ;
            rdfs:domain :Thing ; rdfs:range :Thing ;
            rdfs:label "related to" ;
            rdfs:comment "Generic symmetric association." .
```

- [ ] **Step 3: Create foaf.ttl**

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

# FOAF (Friend Of A Friend) — minimal subset
# Upstream: http://xmlns.com/foaf/spec/  License: CC0

foaf:Person        a owl:Class ; rdfs:label "Person" .
foaf:Organization  a owl:Class ; rdfs:label "Organization" .
foaf:Group         a owl:Class ; rdfs:label "Group" .
foaf:Document      a owl:Class ; rdfs:label "Document" .
foaf:Image         a owl:Class ; rdfs:subClassOf foaf:Document ; rdfs:label "Image" .
foaf:OnlineAccount a owl:Class ; rdfs:label "Online Account" .

foaf:knows  a owl:ObjectProperty ;
            rdfs:domain foaf:Person ; rdfs:range foaf:Person ;
            rdfs:label "knows" .
foaf:member a owl:ObjectProperty ;
            rdfs:domain foaf:Group ; rdfs:range foaf:Person ;
            rdfs:label "member" .
foaf:made   a owl:ObjectProperty ;
            rdfs:domain foaf:Person ;
            rdfs:label "made" .
foaf:maker  a owl:ObjectProperty ;
            owl:inverseOf foaf:made ;
            rdfs:label "maker" .

foaf:name      a owl:DatatypeProperty ;
               rdfs:domain foaf:Person ; rdfs:label "name" .
foaf:firstName a owl:DatatypeProperty ;
               rdfs:domain foaf:Person ; rdfs:label "first name" .
foaf:lastName  a owl:DatatypeProperty ;
               rdfs:domain foaf:Person ; rdfs:label "last name" .
foaf:mbox      a owl:DatatypeProperty ;
               rdfs:domain foaf:Person ; rdfs:label "email" .
foaf:age       a owl:DatatypeProperty ;
               rdfs:domain foaf:Person ; rdfs:label "age" .
foaf:homepage  a owl:DatatypeProperty ;
               rdfs:label "homepage" .
```

- [ ] **Step 4: Create schema-org-lite.ttl**

```turtle
@prefix schema: <https://schema.org/> .
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .

# Schema.org-lite — trimmed core subset
# Upstream: https://schema.org/  License: CC-BY-4.0

schema:Thing               a owl:Class ; rdfs:label "Thing" .
schema:Person              a owl:Class ; rdfs:subClassOf schema:Thing ; rdfs:label "Person" .
schema:Organization        a owl:Class ; rdfs:subClassOf schema:Thing ; rdfs:label "Organization" .
schema:Place               a owl:Class ; rdfs:subClassOf schema:Thing ; rdfs:label "Place" .
schema:Event               a owl:Class ; rdfs:subClassOf schema:Thing ; rdfs:label "Event" .
schema:Product             a owl:Class ; rdfs:subClassOf schema:Thing ; rdfs:label "Product" .

schema:CreativeWork        a owl:Class ; rdfs:subClassOf schema:Thing ; rdfs:label "Creative Work" .
schema:Article             a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Article" .
schema:Book                a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Book" .
schema:Movie               a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Movie" .
schema:Recipe              a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Recipe" .
schema:Review              a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Review" .
schema:WebPage             a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Web Page" .
schema:SoftwareApplication a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Software Application" .
schema:Dataset             a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Dataset" .
schema:ImageObject         a owl:Class ; rdfs:subClassOf schema:CreativeWork ; rdfs:label "Image Object" .

schema:name           a owl:DatatypeProperty ; rdfs:label "name" .
schema:description    a owl:DatatypeProperty ; rdfs:label "description" .
schema:url            a owl:DatatypeProperty ; rdfs:label "url" .
schema:identifier     a owl:DatatypeProperty ; rdfs:label "identifier" .
schema:datePublished  a owl:DatatypeProperty ; rdfs:label "date published" .
schema:dateCreated    a owl:DatatypeProperty ; rdfs:label "date created" .
schema:dateModified   a owl:DatatypeProperty ; rdfs:label "date modified" .

schema:author         a owl:ObjectProperty ; rdfs:range schema:Person ; rdfs:label "author" .
schema:publisher      a owl:ObjectProperty ; rdfs:range schema:Organization ; rdfs:label "publisher" .
schema:image          a owl:ObjectProperty ; rdfs:range schema:ImageObject ; rdfs:label "image" .
schema:about          a owl:ObjectProperty ; rdfs:range schema:Thing ; rdfs:label "about" .
schema:location       a owl:ObjectProperty ; rdfs:range schema:Place ; rdfs:label "location" .
```

- [ ] **Step 5: Create fhir-core.ttl**

```turtle
@prefix fhir: <http://hl7.org/fhir/> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

# FHIR core resources — HL7 R4 permitted subset
# Upstream: http://hl7.org/fhir/R4/  License: see HL7 terms

fhir:Resource              a owl:Class ; rdfs:label "Resource" .

fhir:Patient               a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Patient" .
fhir:Practitioner          a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Practitioner" .
fhir:Organization          a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Organization" .
fhir:Encounter             a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Encounter" .
fhir:Observation           a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Observation" .
fhir:Condition             a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Condition" .
fhir:Medication            a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Medication" .
fhir:MedicationRequest     a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Medication Request" .
fhir:Procedure             a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Procedure" .
fhir:DiagnosticReport      a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Diagnostic Report" .
fhir:AllergyIntolerance    a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Allergy Intolerance" .
fhir:Immunization          a owl:Class ; rdfs:subClassOf fhir:Resource ; rdfs:label "Immunization" .

fhir:subject               a owl:ObjectProperty ; rdfs:range fhir:Patient ; rdfs:label "subject" .
fhir:performer             a owl:ObjectProperty ; rdfs:range fhir:Practitioner ; rdfs:label "performer" .
fhir:encounter             a owl:ObjectProperty ; rdfs:range fhir:Encounter ; rdfs:label "encounter" .

fhir:status                a owl:DatatypeProperty ; rdfs:range xsd:string ; rdfs:label "status" .
fhir:effectiveDateTime     a owl:DatatypeProperty ; rdfs:range xsd:dateTime ; rdfs:label "effective date/time" .
fhir:code                  a owl:DatatypeProperty ; rdfs:range xsd:string ; rdfs:label "code" .
fhir:valueQuantity         a owl:DatatypeProperty ; rdfs:range xsd:decimal ; rdfs:label "value quantity" .
fhir:birthDate             a owl:DatatypeProperty ; rdfs:range xsd:date ; rdfs:label "birth date" .
```

- [ ] **Step 6: Create catalog.json**

```json
{
  "version": "1.0.0",
  "ontologies": [
    {
      "name": "top",
      "description": "Minimal upper ontology — Thing, dependsOn, relatedTo",
      "license": "CC0",
      "files": ["top.ttl"]
    },
    {
      "name": "codebase",
      "description": "Software code structure (files, symbols, calls, modifications)",
      "license": "Apache-2.0",
      "files": ["codebase.ttl"],
      "shapes": "codebase.shacl.ttl"
    },
    {
      "name": "foaf",
      "description": "Friend-of-a-friend — people and their relationships",
      "license": "CC0",
      "files": ["foaf.ttl"]
    },
    {
      "name": "schema-org-lite",
      "description": "Web entities — trimmed core slice of schema.org",
      "license": "CC-BY-4.0",
      "files": ["schema-org-lite.ttl"]
    },
    {
      "name": "fhir-core",
      "description": "Healthcare core resources — HL7 R4 subset",
      "license": "HL7",
      "files": ["fhir-core.ttl"]
    }
  ]
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-ontology/catalog/
git commit -m "$(cat <<'EOF'
feat(ontology): v2.0 — add catalog directory with 5 bundled ontologies

Moves tbox/codebase.ttl → catalog/codebase.ttl and adds top, foaf,
schema-org-lite, fhir-core. catalog.json registers all five with
license + description metadata. The catalog is what `predicate init`
reads to offer the community-ontology choice.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Catalog smoke tests (parse + load each)

**Files:**
- Create: `packages/predicate-ontology/tests/catalog.test.ts`
- Create: `packages/predicate-ontology/package.json` (if predicate-ontology doesn't already have one — check first)
- Create: `packages/predicate-ontology/vitest.config.ts` (same)

If predicate-ontology is currently a pure-data package without a test runner, the test could live under `packages/predicate-mcp/tests/` instead. Verify with `ls packages/predicate-ontology/` first and pick whichever location matches existing conventions.

- [ ] **Step 1: Pick test location**

```bash
ls packages/predicate-ontology/ 2>&1 | head
```

If there's no `package.json` or `tests/`, put the test in `packages/predicate-mcp/tests/catalog.test.ts` instead. Adjust paths in the test below accordingly.

- [ ] **Step 2: Write the catalog smoke test**

Path: `packages/predicate-mcp/tests/catalog.test.ts` (assuming we use the mcp tests dir).

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SparqlClient } from '../src/sparql/client.js';
import { loadConfig } from '../src/config.js';

const CATALOG_DIR = join(__dirname, '..', '..', 'predicate-ontology', 'catalog');
const client = new SparqlClient(loadConfig());

interface CatalogEntry { name: string; files: string[]; shapes?: string }
interface Catalog { ontologies: CatalogEntry[] }

const catalog: Catalog = JSON.parse(readFileSync(join(CATALOG_DIR, 'catalog.json'), 'utf8'));

async function resetTbox(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:tbox>`);
  await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
}

async function loadTtl(path: string): Promise<void> {
  const turtle = readFileSync(path, 'utf8');
  const cfg = loadConfig();
  const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/data?graph=kg:tbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/turtle',
      'Authorization': 'Basic ' + Buffer.from('admin:changeme').toString('base64'),
    },
    body: turtle,
  });
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status} ${await r.text()}`);
}

describe('catalog.json', () => {
  it('declares at least 5 ontologies', () => {
    expect(catalog.ontologies.length).toBeGreaterThanOrEqual(5);
  });

  it('every ontology has a name, description, license, and files array', () => {
    for (const o of catalog.ontologies) {
      expect(o.name).toBeTypeOf('string');
      expect((o as { description?: string }).description).toBeTypeOf('string');
      expect((o as { license?: string }).license).toBeTypeOf('string');
      expect(Array.isArray(o.files)).toBe(true);
      expect(o.files.length).toBeGreaterThan(0);
    }
  });

  it('every declared file actually exists on disk', () => {
    const onDisk = new Set(readdirSync(CATALOG_DIR));
    for (const o of catalog.ontologies) {
      for (const f of o.files) {
        expect(onDisk.has(f), `${o.name} declares ${f} but it's not in catalog/`).toBe(true);
      }
      if (o.shapes) expect(onDisk.has(o.shapes), `${o.name} declares shapes ${o.shapes} missing`).toBe(true);
    }
  });
});

describe('each catalog ontology parses and loads into a fresh kg:tbox', () => {
  beforeEach(resetTbox);

  for (const o of catalog.ontologies) {
    it(`loads ${o.name} without errors`, async () => {
      for (const f of o.files) {
        await loadTtl(join(CATALOG_DIR, f));
      }
      const r = await client.select(
        `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox> { ?s ?p ?o } }`,
      );
      const n = parseInt(r.results.bindings[0]!.n!.value, 10);
      expect(n).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 3: Run the test**

```bash
pnpm --filter predicate-mcp test catalog
```

Expected: 3 + 5 = 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-mcp/tests/catalog.test.ts
git commit -m "$(cat <<'EOF'
test(catalog): smoke tests for the 5 bundled ontologies

Verifies catalog.json schema, every declared file exists on disk,
and each ontology loads into a fresh kg:tbox without Fuseki errors.
Acts as a regression net against future catalog edits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: kg_config MCP tool + tests

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-config.ts`
- Create: `packages/predicate-mcp/tests/tools/kg-config.test.ts`
- Modify: `packages/predicate-mcp/src/tools/registry.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/tools/kg-config.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgConfigGet, kgConfigSet } from '../../src/tools/kg-config.js';

const client = new SparqlClient(loadConfig());

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:meta>`);
  await client.update(`CREATE SILENT GRAPH <kg:meta>`);
}

describe('kg_config', () => {
  beforeEach(reset);

  it('set then get round-trips a boolean key', async () => {
    const setRes = await kgConfigSet(client, { key: 'schema-learning', value: false });
    expect(setRes.ok).toBe(true);
    const getRes = await kgConfigGet(client, { key: 'schema-learning' });
    expect(getRes.value).toBe(false);
  });

  it('set then get round-trips a string key', async () => {
    await kgConfigSet(client, { key: 'init-ontology', value: 'foaf' });
    const r = await kgConfigGet(client, { key: 'init-ontology' });
    expect(r.value).toBe('foaf');
  });

  it('rejects unknown keys', async () => {
    const r = await kgConfigSet(client, { key: 'bogus', value: 'x' } as never);
    expect(r.ok).toBe(false);
    expect((r as { error?: string }).error).toMatch(/unknown key/i);
  });

  it('rejects wrong value type for schema-learning (must be boolean)', async () => {
    const r = await kgConfigSet(client, { key: 'schema-learning', value: 'yes' as never });
    expect(r.ok).toBe(false);
    expect((r as { error?: string }).error).toMatch(/boolean/);
  });

  it('get with no key returns the full config object', async () => {
    await kgConfigSet(client, { key: 'schema-learning', value: true });
    await kgConfigSet(client, { key: 'init-ontology', value: 'codebase' });
    const r = await kgConfigGet(client, {});
    expect(r.config).toEqual({
      schemaLearningEnabled: true,
      initOntology: 'codebase',
    });
  });

  it('get of absent key returns value: null', async () => {
    const r = await kgConfigGet(client, { key: 'schema-learning' });
    expect(r.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter predicate-mcp test kg-config
```

Expected: FAIL (`Cannot find module '../../src/tools/kg-config.js'`).

- [ ] **Step 3: Implement kg-config.ts**

Create `packages/predicate-mcp/src/tools/kg-config.ts`:

```typescript
import { SparqlClient } from '../sparql/client.js';
import { escapeLiteral } from '../sparql/escape.js';

const META = 'https://industriagents.com/predicate/meta#';
const CONFIG_URI = 'urn:predicate:config';

// Map external key (kebab-case) ↔ internal property (camelCase)
const KEY_TO_PROP: Record<string, { prop: string; type: 'boolean' | 'string' }> = {
  'schema-learning':  { prop: 'schemaLearningEnabled', type: 'boolean' },
  'init-mode':        { prop: 'initMode',              type: 'string'  },
  'init-ontology':    { prop: 'initOntology',          type: 'string'  },
};

export interface KgConfigSetInput {
  key: 'schema-learning' | 'init-mode' | 'init-ontology';
  value: string | boolean;
}

export type KgConfigSetResult =
  | { ok: true; key: string; value: string | boolean }
  | { ok: false; error: string };

export interface KgConfigGetInput {
  key?: 'schema-learning' | 'init-mode' | 'init-ontology';
}

export interface KgConfigGetResult {
  config?: Record<string, string | boolean>;
  key?: string;
  value?: string | boolean | null;
}

function literalFor(value: string | boolean, type: 'boolean' | 'string'): string {
  if (type === 'boolean') {
    return `"${value}"^^<http://www.w3.org/2001/XMLSchema#boolean>`;
  }
  return escapeLiteral(String(value));
}

export async function kgConfigSet(
  client: SparqlClient,
  input: KgConfigSetInput,
): Promise<KgConfigSetResult> {
  const meta = KEY_TO_PROP[input.key];
  if (!meta) {
    return { ok: false, error: `unknown key '${input.key}'. Valid keys: ${Object.keys(KEY_TO_PROP).join(', ')}` };
  }
  if (meta.type === 'boolean' && typeof input.value !== 'boolean') {
    return { ok: false, error: `${input.key} expects boolean, got ${typeof input.value}` };
  }
  if (meta.type === 'string' && typeof input.value !== 'string') {
    return { ok: false, error: `${input.key} expects string, got ${typeof input.value}` };
  }
  const propIri = `<${META}${meta.prop}>`;
  const lit = literalFor(input.value, meta.type);
  await client.update(`
    PREFIX pred: <${META}>
    DELETE { GRAPH <kg:meta> { <${CONFIG_URI}> ${propIri} ?o } }
    WHERE  { GRAPH <kg:meta> { <${CONFIG_URI}> ${propIri} ?o } }
  `);
  await client.update(`
    PREFIX pred: <${META}>
    INSERT DATA { GRAPH <kg:meta> { <${CONFIG_URI}> ${propIri} ${lit} } }
  `);
  return { ok: true, key: input.key, value: input.value };
}

export async function kgConfigGet(
  client: SparqlClient,
  input: KgConfigGetInput,
): Promise<KgConfigGetResult> {
  if (input.key) {
    const meta = KEY_TO_PROP[input.key];
    if (!meta) return { key: input.key, value: null };
    const r = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?o WHERE { GRAPH <kg:meta> { <${CONFIG_URI}> <${META}${meta.prop}> ?o } }
    `);
    const b = r.results.bindings[0];
    if (!b) return { key: input.key, value: null };
    const raw = b['o']!.value;
    const value: string | boolean = meta.type === 'boolean' ? raw === 'true' : raw;
    return { key: input.key, value };
  }
  // All-config flavor
  const r = await client.select(`
    PREFIX pred: <${META}>
    SELECT ?p ?o WHERE { GRAPH <kg:meta> { <${CONFIG_URI}> ?p ?o } }
  `);
  const config: Record<string, string | boolean> = {};
  for (const b of r.results.bindings) {
    const propIri = b['p']!.value;
    const propLocal = propIri.slice(META.length);
    const externalKey = Object.entries(KEY_TO_PROP).find(([, v]) => v.prop === propLocal);
    if (!externalKey) continue;
    const [, kmeta] = externalKey;
    config[kmeta.prop] = kmeta.type === 'boolean' ? b['o']!.value === 'true' : b['o']!.value;
  }
  return { config };
}
```

- [ ] **Step 4: Register in the MCP tool registry**

Modify `packages/predicate-mcp/src/tools/registry.ts`. Add the import after the existing tool imports:

```typescript
import { kgConfigGet, kgConfigSet } from './kg-config.js';
```

Add two new entries inside `buildTools()` (place them after the kg_capture entry, before `...stubs()`):

```typescript
    {
      name: 'kg_config_get',
      description: "Read v2.0 runtime config from kg:meta. Pass {key} to get one value or {} to get the full config object.",
      inputSchema: z.object({
        key: z.enum(['schema-learning', 'init-mode', 'init-ontology']).optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          key: z.enum(['schema-learning', 'init-mode', 'init-ontology']).optional(),
        }).parse(raw);
        return kgConfigGet(client, args);
      },
    },
    {
      name: 'kg_config_set',
      description: "Write a v2.0 runtime config value into kg:meta. schema-learning is a boolean toggle for the auto-proposer; init-mode and init-ontology are usually written by `predicate init` but exposed for advanced use.",
      inputSchema: z.object({
        key: z.enum(['schema-learning', 'init-mode', 'init-ontology']),
        value: z.union([z.string(), z.boolean()]),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          key: z.enum(['schema-learning', 'init-mode', 'init-ontology']),
          value: z.union([z.string(), z.boolean()]),
        }).parse(raw);
        return kgConfigSet(client, args);
      },
    },
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter predicate-mcp test kg-config
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-config.ts packages/predicate-mcp/tests/tools/kg-config.test.ts packages/predicate-mcp/src/tools/registry.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add kg_config_get + kg_config_set MCP tools (v2.0)

10th + 11th MCP tools. Stores config triples under <urn:predicate:config>
in kg:meta. Allowlist on keys (schema-learning, init-mode, init-ontology)
prevents arbitrary writes. Sweeper and Generalizer read schemaLearningEnabled
in Task 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Generalizer + Sweeper toggle reads

**Files:**
- Modify: `packages/predicate-agent/src/generalizer.ts`
- Modify: `packages/predicate-agent/src/promotion-sweeper.ts`
- Modify: `packages/predicate-agent/tests/generalizer.test.ts` (extend)
- Modify: `packages/predicate-mcp/src/tools/kg-maintain.ts` — propagate `autoProposalsSkipped` flag

- [ ] **Step 1: Read current Generalizer and Sweeper**

```bash
head -40 packages/predicate-agent/src/generalizer.ts
head -40 packages/predicate-agent/src/promotion-sweeper.ts
```

Confirm the shape of `run()` and the `GeneralizerResult` / `SweeperResult` types.

- [ ] **Step 2: Write the failing test**

Add to `packages/predicate-agent/tests/generalizer.test.ts` (append; don't replace existing tests):

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { Generalizer } from '../src/generalizer.js';

describe('Generalizer toggle (v2.0)', () => {
  const client = new SparqlClient(loadConfig());

  async function setLearningEnabled(value: boolean): Promise<void> {
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      DELETE { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled ?o } }
      WHERE  { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled ?o } }
    `);
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      INSERT DATA { GRAPH <kg:meta> {
        <urn:predicate:config> pred:schemaLearningEnabled "${value}"^^<http://www.w3.org/2001/XMLSchema#boolean> .
      } }
    `);
  }

  it('skips proposal generation when schema-learning is disabled', async () => {
    await setLearningEnabled(false);
    const r = await new Generalizer(client, { k: 5 }).run();
    expect(r.autoProposalsSkipped).toBe(true);
    expect(r.proposals).toHaveLength(0);
  });

  it('runs normally when schema-learning is enabled', async () => {
    await setLearningEnabled(true);
    const r = await new Generalizer(client, { k: 5 }).run();
    expect(r.autoProposalsSkipped).toBeFalsy();
  });

  it('runs normally when the toggle is absent (defaults to enabled)', async () => {
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      DELETE { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled ?o } }
      WHERE  { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled ?o } }
    `);
    const r = await new Generalizer(client, { k: 5 }).run();
    expect(r.autoProposalsSkipped).toBeFalsy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter predicate-agent test generalizer
```

Expected: the new 3 tests fail with "autoProposalsSkipped is undefined" / "doesn't read toggle".

- [ ] **Step 4: Modify Generalizer to check the toggle**

In `packages/predicate-agent/src/generalizer.ts`, locate the existing `run()` method. Add a helper at the top of the class:

```typescript
private async isSchemaLearningEnabled(): Promise<boolean> {
  const r = await this.client.select(
    `PREFIX pred: <https://industriagents.com/predicate/meta#>
     SELECT ?v WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:schemaLearningEnabled ?v } }`,
  );
  const b = r.results.bindings[0];
  if (!b) return true;  // missing → default-on
  return b['v']!.value === 'true';
}
```

Then at the START of `run()`:

```typescript
async run(): Promise<GeneralizerResult> {
  if (!(await this.isSchemaLearningEnabled())) {
    return { proposals: [], autoProposalsSkipped: true } as GeneralizerResult;
  }
  // ... existing body unchanged
}
```

Update the `GeneralizerResult` type (likely in `packages/predicate-agent/src/types.ts`) to add the optional flag:

```typescript
export interface GeneralizerResult {
  proposals: Array<{ /* existing shape */ }>;
  autoProposalsSkipped?: boolean;   // <-- add
}
```

- [ ] **Step 5: Add the same flag to SweeperResult (propagation, no behavior change)**

The PromotionSweeper does NOT skip when learning is off (it still promotes existing staging). But its result type gains the `autoProposalsSkipped` field so kgMaintain can echo back the Generalizer's value at the top level. Add to the relevant types file:

```typescript
export interface SweeperResult {
  decisions: Array<{ /* existing shape */ }>;
  // (no new field on sweeper itself; only generalizer's flag propagates)
}
```

- [ ] **Step 6: Propagate the flag through kgMaintain**

Modify `packages/predicate-mcp/src/tools/kg-maintain.ts`. Find where the result is assembled (probably around the existing return statement). Add `autoProposalsSkipped` to `MaintainResult`:

```typescript
export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
  sweeper?: SweeperResult;
  generalizer?: GeneralizerResult;
  fixpoint?: { iterations: number; inferredCount: number };
  autoProposalsSkipped?: boolean;  // <-- new
}
```

And in the return statement:

```typescript
return {
  archivedCount,
  elapsedMs,
  eventId,
  sweeper,
  generalizer,
  fixpoint,
  autoProposalsSkipped: generalizer?.autoProposalsSkipped,  // <-- new
};
```

- [ ] **Step 7: Run all agent tests**

```bash
pnpm --filter predicate-agent test
pnpm --filter predicate-mcp test kg-maintain
```

Expected: all tests pass including the 3 new generalizer tests.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-agent/src/generalizer.ts packages/predicate-agent/tests/generalizer.test.ts packages/predicate-agent/src/types.ts packages/predicate-mcp/src/tools/kg-maintain.ts
git commit -m "$(cat <<'EOF'
feat(agent,mcp): generalizer reads schema-learning toggle (v2.0)

Generalizer.run() now checks kg:meta for pred:schemaLearningEnabled
before generating proposals. When false, returns
{proposals: [], autoProposalsSkipped: true}. PromotionSweeper is
deliberately unaffected — it still promotes existing staged proposals
because those came from explicit kg_propose_schema calls, not from
'learning'.

kgMaintain propagates autoProposalsSkipped to MaintainResult.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `predicate init` CLI

**Files:**
- Create: `packages/predicate-cli/src/commands/init.ts`
- Create: `packages/predicate-cli/tests/init.test.ts`
- Create: `packages/predicate-cli/tests/fixtures/bad-prefix.ttl`
- Create: `packages/predicate-cli/tests/fixtures/inconsistent.ttl`
- Create: `packages/predicate-cli/tests/fixtures/good.ttl`
- Modify: `packages/predicate-cli/src/index.ts` (register `init`)

- [ ] **Step 1: Create test fixtures**

`packages/predicate-cli/tests/fixtures/good.ttl`:
```turtle
@prefix : <https://example.com/test#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:Widget a owl:Class ; rdfs:label "Widget" .
:partOf a owl:ObjectProperty ; rdfs:domain :Widget ; rdfs:range :Widget .
```

`packages/predicate-cli/tests/fixtures/bad-prefix.ttl`:
```turtle
@prefix pred: <https://industriagents.com/predicate/meta#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
pred:HijackedClass a owl:Class .
```

`packages/predicate-cli/tests/fixtures/inconsistent.ttl`:
```turtle
@prefix : <https://example.com/test#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:A a owl:Class .
:B a owl:Class .
:A owl:disjointWith :B .
# Then declare X as both A and B (will fire R11 inconsistency)
:x a :A , :B .
```

- [ ] **Step 2: Write the failing tests**

Create `packages/predicate-cli/tests/init.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { init } from '../src/commands/init.js';

const client = new SparqlClient(loadConfig());
const FIXTURES = join(__dirname, 'fixtures');

async function fullReset(): Promise<void> {
  for (const g of ['kg:tbox', 'kg:tbox-staging', 'kg:abox', 'kg:inferred', 'kg:provenance', 'kg:goals', 'kg:usage', 'kg:meta']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
}

async function configExists(): Promise<boolean> {
  return client.ask(
    `PREFIX pred: <https://industriagents.com/predicate/meta#>
     ASK { GRAPH <kg:meta> { <urn:predicate:config> a pred:Config } }`,
  );
}

describe('predicate init', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await fullReset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('--mode community --ontology codebase loads codebase.ttl + meta', async () => {
    const code = await init(['--mode', 'community', '--ontology', 'codebase']);
    expect(code).toBe(0);
    expect(await configExists()).toBe(true);
    const cb = await client.ask(
      `PREFIX cb: <https://industriagents.com/predicate/codebase#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }`,
    );
    expect(cb).toBe(true);
  });

  it('--mode upload --file good.ttl loads the file', async () => {
    const code = await init(['--mode', 'upload', '--file', join(FIXTURES, 'good.ttl')]);
    expect(code).toBe(0);
    const ok = await client.ask(
      `ASK { GRAPH <kg:tbox> { <https://example.com/test#Widget> a <http://www.w3.org/2002/07/owl#Class> } }`,
    );
    expect(ok).toBe(true);
  });

  it('--mode upload --file bad-prefix.ttl rejects (uses pred: namespace)', async () => {
    const code = await init(['--mode', 'upload', '--file', join(FIXTURES, 'bad-prefix.ttl')]);
    expect(code).toBe(1);
    const errOutput = errSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(errOutput).toMatch(/reserved.*pred:/i);
    expect(await configExists()).toBe(false);
  });

  it('--mode empty loads meta + top only', async () => {
    const code = await init(['--mode', 'empty']);
    expect(code).toBe(0);
    const top = await client.ask(
      `ASK { GRAPH <kg:tbox> { <https://industriagents.com/predicate/top#Thing> a <http://www.w3.org/2002/07/owl#Class> } }`,
    );
    expect(top).toBe(true);
  });

  it('refuses re-init without --force', async () => {
    await init(['--mode', 'empty']);
    const code = await init(['--mode', 'community', '--ontology', 'codebase']);
    expect(code).toBe(2);
    const err = errSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/already initialized/i);
  });

  it('--force wipes and re-inits', async () => {
    await init(['--mode', 'empty']);
    const code = await init(['--mode', 'community', '--ontology', 'codebase', '--force']);
    expect(code).toBe(0);
    const cb = await client.ask(
      `PREFIX cb: <https://industriagents.com/predicate/codebase#>
       PREFIX owl: <http://www.w3.org/2002/07/owl#>
       ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }`,
    );
    expect(cb).toBe(true);
  });

  it('--mode community --ontology nonexistent fails with helpful message', async () => {
    const code = await init(['--mode', 'community', '--ontology', 'nope']);
    expect(code).toBe(2);
    const err = errSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/unknown ontology/i);
  });

  it('--help prints usage', async () => {
    const code = await init(['--help']);
    expect(code).toBe(0);
    const out = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('predicate init');
    expect(out).toContain('community');
    expect(out).toContain('upload');
    expect(out).toContain('empty');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
pnpm --filter predicate-cli test init
```

Expected: FAIL (`Cannot find module '../src/commands/init.js'`).

- [ ] **Step 4: Implement init.ts**

Create `packages/predicate-cli/src/commands/init.ts`:

```typescript
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://industriagents.com/predicate/meta#';
const CONFIG_URI = 'urn:predicate:config';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface CatalogEntry { name: string; description: string; license: string; files: string[]; shapes?: string }
interface Catalog { version: string; ontologies: CatalogEntry[] }

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}
function hasFlag(args: string[], name: string): boolean { return args.includes(name); }

function findCatalogDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', '..', '..', 'predicate-ontology', 'catalog'),
    join(here, '..', '..', 'predicate-ontology', 'catalog'),
    join(here, 'predicate-ontology', 'catalog'),
  ];
  for (const c of candidates) if (existsSync(join(c, 'catalog.json'))) return c;
  throw new Error(`catalog directory not found — checked ${candidates.join(', ')}`);
}

function findMetaTtl(catalogDir: string): string {
  // predicate-meta.ttl lives at predicate-ontology/meta/, sibling to catalog/
  return join(catalogDir, '..', 'meta', 'predicate-meta.ttl');
}

function help(): void {
  console.log(`predicate init [--mode community|upload|empty] [--ontology NAME] [--file PATH] [--force]

Initialize the Predicate knowledge graph with a chosen TBox.

Modes:
  community  Install one of the bundled ontologies (see catalog).
             Sub-option: --ontology NAME (top, codebase, foaf, schema-org-lite, fhir-core).
  upload     Load a user-supplied .ttl file.
             Sub-option: --file PATH (max 10 MB; cannot use the pred: namespace).
  empty      Load meta vocab + minimal top ontology (Thing, dependsOn, relatedTo).

Other options:
  --force    Wipe existing config + kg:tbox + abox/inferred/provenance/goals/usage
             and re-init. Required if already initialized.
  --help     Print this message.

Without flags + with TTY: runs an interactive prompt.

Examples:
  predicate init --mode community --ontology codebase
  predicate init --mode upload --file ./my-domain.ttl
  predicate init --mode empty
`);
}

async function checkConfigExists(client: SparqlClient): Promise<boolean> {
  return client.ask(`
    PREFIX pred: <${META}>
    ASK { GRAPH <kg:meta> { <${CONFIG_URI}> a pred:Config } }
  `);
}

async function loadTtlFile(client: SparqlClient, path: string): Promise<void> {
  const cfg = loadConfig();
  const turtle = readFileSync(path, 'utf8');
  const auth = 'Basic ' + Buffer.from(`admin:${process.env['PREDICATE_ADMIN_PASSWORD'] ?? 'changeme'}`).toString('base64');
  const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/data?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', 'Authorization': auth },
    body: turtle,
  });
  if (!r.ok) throw new Error(`Fuseki load failed for ${path}: ${r.status} ${await r.text()}`);
}

async function destructiveReset(client: SparqlClient): Promise<void> {
  for (const g of ['kg:tbox', 'kg:tbox-staging', 'kg:abox', 'kg:inferred', 'kg:provenance', 'kg:goals', 'kg:usage', 'kg:meta']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
}

async function writeConfig(
  client: SparqlClient,
  mode: 'community' | 'upload' | 'empty',
  ontology: string,
): Promise<void> {
  const now = new Date().toISOString();
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${CONFIG_URI}> a pred:Config ;
        pred:initMode             ${escapeLiteral(mode)} ;
        pred:initOntology         ${escapeLiteral(ontology)} ;
        pred:schemaLearningEnabled "true"^^xsd:boolean ;
        pred:initializedAt        "${now}"^^xsd:dateTime .
    } }
  `);
}

function validateUserUpload(turtle: string): { ok: boolean; error?: string } {
  // Reject any usage of the pred: namespace
  if (/https?:\/\/industriagents\.com\/predicate\/meta#/.test(turtle)) {
    return { ok: false, error: `Uploaded ontology uses the reserved 'pred:' namespace (https://industriagents.com/predicate/meta#). Rename or remove those triples.` };
  }
  return { ok: true };
}

async function doCommunity(client: SparqlClient, ontologyName: string): Promise<number> {
  const catalogDir = findCatalogDir();
  const catalog: Catalog = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8'));
  const entry = catalog.ontologies.find((o) => o.name === ontologyName);
  if (!entry) {
    console.error(`predicate init: unknown ontology '${ontologyName}'. Available: ${catalog.ontologies.map((o) => o.name).join(', ')}`);
    return 2;
  }
  await loadTtlFile(client, findMetaTtl(catalogDir));
  for (const f of entry.files) await loadTtlFile(client, join(catalogDir, f));
  if (entry.shapes) await loadTtlFile(client, join(catalogDir, entry.shapes));
  await writeConfig(client, 'community', ontologyName);
  console.log(`predicate init: ${ontologyName} ontology loaded (${entry.description}, license: ${entry.license}).`);
  return 0;
}

async function doUpload(client: SparqlClient, filePath: string): Promise<number> {
  const abs = resolve(filePath);
  if (!existsSync(abs)) {
    console.error(`predicate init: file not found: ${abs}`);
    return 1;
  }
  const sz = statSync(abs).size;
  if (sz > MAX_UPLOAD_BYTES) {
    console.error(`predicate init: file too large (${sz} bytes; max ${MAX_UPLOAD_BYTES})`);
    return 1;
  }
  const turtle = readFileSync(abs, 'utf8');
  const v = validateUserUpload(turtle);
  if (!v.ok) {
    console.error(`predicate init: ${v.error}`);
    return 1;
  }
  const catalogDir = findCatalogDir();
  await loadTtlFile(client, findMetaTtl(catalogDir));
  try {
    await loadTtlFile(client, abs);
  } catch (err) {
    // Roll back to meta-only state
    await client.update(`DROP SILENT GRAPH <kg:tbox>`);
    await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
    await loadTtlFile(client, findMetaTtl(catalogDir));
    console.error(`predicate init: upload failed during load: ${(err as Error).message}. kg:tbox rolled back to meta-only.`);
    return 1;
  }
  await writeConfig(client, 'upload', 'user');
  console.log(`predicate init: uploaded ${abs} (${sz} bytes). Schema-learning enabled.`);
  return 0;
}

async function doEmpty(client: SparqlClient): Promise<number> {
  const catalogDir = findCatalogDir();
  await loadTtlFile(client, findMetaTtl(catalogDir));
  await loadTtlFile(client, join(catalogDir, 'top.ttl'));
  await writeConfig(client, 'empty', 'top');
  console.log(`predicate init: empty mode (meta + top vocabulary loaded). The agent will propose new predicates as needed; sweeper promotes after 3 uses.`);
  return 0;
}

async function interactive(client: SparqlClient): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`Welcome to Predicate. Choose how to initialize the knowledge graph:

  (1) Install a community ontology  — pick one of our bundled vocabularies
  (2) Upload your own ontology      — load a custom .ttl file
  (3) Start empty                   — meta vocab only, agent grows the rest
`);
    const choice = (await rl.question('Your choice [1/2/3]: ')).trim();
    if (choice === '1') {
      const catalogDir = findCatalogDir();
      const catalog: Catalog = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8'));
      console.log('\nAvailable ontologies:');
      for (const o of catalog.ontologies) console.log(`  - ${o.name.padEnd(18)} ${o.description}`);
      const name = (await rl.question('\nWhich ontology? ')).trim();
      return doCommunity(client, name);
    }
    if (choice === '2') {
      const path = (await rl.question('Path to .ttl file: ')).trim();
      return doUpload(client, path);
    }
    if (choice === '3') {
      return doEmpty(client);
    }
    console.error(`predicate init: invalid choice '${choice}'. Run with --help for non-interactive flags.`);
    return 2;
  } finally {
    rl.close();
  }
}

export async function init(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const client = new SparqlClient(loadConfig());

  // Force-reset path
  if (hasFlag(args, '--force')) {
    await destructiveReset(client);
  } else if (await checkConfigExists(client)) {
    const cfg = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?m ?o WHERE { GRAPH <kg:meta> {
        <${CONFIG_URI}> pred:initMode ?m ; pred:initOntology ?o .
      } }
    `);
    const b = cfg.results.bindings[0];
    const mode = b?.m?.value ?? '?';
    const ont = b?.o?.value ?? '?';
    console.error(`predicate init: already initialized as '${mode}/${ont}'. Use --force to reset (destructive). Or kg_config_set to toggle individual fields.`);
    return 2;
  }

  const mode = parseFlag(args, '--mode');
  if (!mode) {
    if (process.stdin.isTTY) return interactive(client);
    console.error(`predicate init: --mode is required when stdin is not a TTY. Run with --help.`);
    return 2;
  }
  if (mode === 'community') {
    const ontology = parseFlag(args, '--ontology') ?? 'codebase';
    return doCommunity(client, ontology);
  }
  if (mode === 'upload') {
    const file = parseFlag(args, '--file');
    if (!file) { console.error(`predicate init: --mode upload requires --file PATH`); return 2; }
    return doUpload(client, file);
  }
  if (mode === 'empty') {
    return doEmpty(client);
  }
  console.error(`predicate init: invalid --mode '${mode}'. Must be one of: community, upload, empty.`);
  return 2;
}
```

- [ ] **Step 5: Wire into the CLI dispatcher**

Modify `packages/predicate-cli/src/index.ts`. Add the import:

```typescript
import { init } from './commands/init.js';
```

Add to help text under Commands:
```
  init           Initialize kg:tbox with a community ontology, an uploaded file, or empty.
```

Add to the switch:
```typescript
case 'init':         return init(process.argv.slice(3));
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter predicate-cli test init
```

Expected: all 8 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/init.ts packages/predicate-cli/tests/init.test.ts packages/predicate-cli/tests/fixtures/ packages/predicate-cli/src/index.ts
git commit -m "$(cat <<'EOF'
feat(cli): add `predicate init` command (v2.0)

Three modes: community (catalog ontology), upload (user .ttl), empty
(meta + top only). Interactive prompt when no flags + TTY; non-
interactive via --mode/--ontology/--file. Refuses re-init without
--force. Rejects uploads using the reserved pred: namespace.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Simplify `bootstrap-graphs.sh`

**Files:**
- Modify: `packages/predicate-server/scripts/bootstrap-graphs.sh`

- [ ] **Step 1: Replace the script**

Overwrite `packages/predicate-server/scripts/bootstrap-graphs.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${FUSEKI_URL:-http://localhost:3030}"
DATASET="predicate"
ADMIN_PASSWORD="${PREDICATE_ADMIN_PASSWORD:-changeme}"

for g in kg:tbox kg:tbox-staging kg:abox kg:inferred kg:provenance kg:goals kg:usage kg:meta kg:peers; do
  curl -fsS -u "admin:${ADMIN_PASSWORD}" -X POST \
    --header "Content-Type: application/sparql-update" \
    --data "CREATE SILENT GRAPH <$g>" \
    "$HOST/$DATASET/update"
done
echo "graphs created (kg:tbox empty — run \`predicate init\` to load an ontology)"
```

- [ ] **Step 2: Verify it still creates graphs**

```bash
bash packages/predicate-server/scripts/bootstrap-graphs.sh
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=SELECT (COUNT(?g) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } UNION { GRAPH ?g { } } }" \
  --header "Accept: application/sparql-results+json" | jq -r '.results.bindings[0].n.value'
```

Expected: number ≥ 0 (graphs exist even if empty).

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-server/scripts/bootstrap-graphs.sh
git commit -m "$(cat <<'EOF'
chore(server): simplify bootstrap-graphs.sh (v2.0)

No longer pre-loads codebase.ttl. Just creates the 9 named graphs.
TBox loading moves into `predicate init` (or its auto-migration path
in `predicate up`).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `predicate up` legacy migration + sessionstart banner

**Files:**
- Modify: `packages/predicate-cli/src/commands/up.ts`
- Modify: `packages/predicate-cli/src/commands/sessionstart.ts`
- Create: `packages/predicate-cli/tests/up.test.ts`
- Modify: `packages/predicate-cli/tests/sessionstart.test.ts`

- [ ] **Step 1: Write failing tests for `up.ts`**

Create `packages/predicate-cli/tests/up.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

vi.mock('../src/docker.js', () => ({
  findComposeDir: () => '/tmp',
  dockerAvailable: () => true,
  compose: () => Promise.resolve(0),
}));

import { up } from '../src/commands/up.js';

const client = new SparqlClient(loadConfig());

async function fullReset(): Promise<void> {
  for (const g of ['kg:tbox', 'kg:meta']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
}

describe('predicate up — v2.0 legacy migration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await fullReset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); });

  it('auto-adopts as codebase when kg:tbox has codebase:File but no config', async () => {
    // Simulate v1.13 state: codebase.ttl loaded, no config
    await client.update(`
      PREFIX cb:  <https://industriagents.com/predicate/codebase#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <kg:tbox> { cb:File a owl:Class } }
    `);
    await up();
    const configured = await client.ask(
      `PREFIX pred: <https://industriagents.com/predicate/meta#>
       ASK { GRAPH <kg:meta> { <urn:predicate:config> pred:initOntology "codebase" } }`,
    );
    expect(configured).toBe(true);
  });

  it('skips init when config already exists', async () => {
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      INSERT DATA { GRAPH <kg:meta> {
        <urn:predicate:config> a pred:Config ; pred:initOntology "foaf" .
      } }
    `);
    await up();
    const r = await client.select(
      `PREFIX pred: <https://industriagents.com/predicate/meta#>
       SELECT ?o WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:initOntology ?o } }`,
    );
    expect(r.results.bindings[0]!.o!.value).toBe('foaf');  // unchanged
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter predicate-cli test up
```

Expected: FAIL (up.ts doesn't yet do the sniff/auto-migration).

- [ ] **Step 3: Modify up.ts**

Read current `packages/predicate-cli/src/commands/up.ts`. Replace its body with:

```typescript
import { findComposeDir, dockerAvailable, compose } from '../docker.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { init } from './init.js';

const META = 'https://industriagents.com/predicate/meta#';
const CONFIG_URI = 'urn:predicate:config';

async function checkConfigExists(client: SparqlClient): Promise<boolean> {
  return client.ask(`
    PREFIX pred: <${META}>
    ASK { GRAPH <kg:meta> { <${CONFIG_URI}> a pred:Config } }
  `);
}

async function detectLegacyCodebase(client: SparqlClient): Promise<boolean> {
  return client.ask(`
    PREFIX cb:  <https://industriagents.com/predicate/codebase#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }
  `);
}

async function writeLegacyConfig(client: SparqlClient): Promise<void> {
  const now = new Date().toISOString();
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${CONFIG_URI}> a pred:Config ;
        pred:initMode              ${escapeLiteral('community')} ;
        pred:initOntology          ${escapeLiteral('codebase')} ;
        pred:schemaLearningEnabled "true"^^xsd:boolean ;
        pred:initializedAt         "${now}"^^xsd:dateTime .
    } }
  `);
}

export async function up(): Promise<number> {
  if (!dockerAvailable()) {
    console.error('Docker not found. Install Docker Desktop or Docker Engine first.');
    return 2;
  }
  const dir = findComposeDir();
  console.log(`bringing Fuseki up from ${dir}`);
  const rc = await compose(['up', '-d'], dir);
  if (rc !== 0) return rc;

  // v2.0: check config
  try {
    const client = new SparqlClient(loadConfig());
    if (await checkConfigExists(client)) return 0;
    if (await detectLegacyCodebase(client)) {
      await writeLegacyConfig(client);
      return 0;
    }
    if (process.stdin.isTTY) {
      return init([]);
    }
    console.error('predicate up: no init config and non-TTY stdin; defaulting to empty mode.');
    return init(['--mode', 'empty']);
  } catch (err) {
    console.error(`predicate up: post-bootstrap init check failed: ${(err as Error).message}`);
    return 0;  // Fuseki is up; init failure is non-fatal
  }
}
```

- [ ] **Step 4: Modify sessionstart.ts to surface the ontology name**

Read current `packages/predicate-cli/src/commands/sessionstart.ts`. The existing query already reads tbox count + goals + prior-sessions. Extend to also read `pred:initOntology`. Add to the existing helper that reads kg:meta:

```typescript
// Inside sessionstart() — after the existing prior-sessions query, add:
const ontologyRes = await client.select(
  `PREFIX pred: <${META}>
   SELECT ?o WHERE { GRAPH <kg:meta> { <urn:predicate:config> pred:initOntology ?o } }`,
).catch(() => ({ results: { bindings: [] } }));
const ontology = ontologyRes.results.bindings[0]?.o?.value ?? '';
```

Then in the banner line, change:

```typescript
`Predicate ready: ${goals} active goals, ${classes} TBox classes.${sessionHint}`
```

to:

```typescript
const ontologyHint = ontology ? ` (${ontology} ontology)` : '';
`Predicate ready: ${goals} active goals, ${classes} TBox classes${ontologyHint}.${sessionHint}`
```

- [ ] **Step 5: Extend sessionstart test**

Add to `packages/predicate-cli/tests/sessionstart.test.ts` (within the existing describe):

```typescript
it('includes ontology name in banner when init config exists', async () => {
  const client = new SparqlClient(loadConfig());
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    INSERT DATA { GRAPH <kg:meta> {
      <urn:predicate:config> a pred:Config ; pred:initOntology "codebase" .
    } }
  `);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await sessionstart();
    const line = logSpy.mock.calls[0]![0] as string;
    expect(line).toContain('(codebase ontology)');
  } finally {
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      DELETE WHERE { GRAPH <kg:meta> { <urn:predicate:config> ?p ?o } }
    `);
  }
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter predicate-cli test
```

Expected: all CLI tests pass (init + up + sessionstart all green).

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/up.ts packages/predicate-cli/src/commands/sessionstart.ts packages/predicate-cli/tests/up.test.ts packages/predicate-cli/tests/sessionstart.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): up auto-runs init; v1.13 legacy auto-adopt; banner shows ontology (v2.0)

- predicate up checks kg:meta for config; if absent + kg:tbox has
  codebase:File, silently writes 'community/codebase' config (v1.13
  migration path)
- if absent + no legacy state + TTY: invokes init interactively
- if absent + non-TTY: defaults to empty mode with stderr warning
- sessionstart banner now includes "(<ontology> ontology)" when
  pred:initOntology is set

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Test fixture — `withCodebaseTBox()` + refactor existing tests

**Files:**
- Create: `packages/predicate-mcp/tests/fixtures/with-codebase.ts`
- Modify: every existing test file that asserts existence of `codebase:*` predicates

- [ ] **Step 1: Create the fixture helper**

```typescript
// packages/predicate-mcp/tests/fixtures/with-codebase.ts
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(here, '..', '..', '..', 'predicate-ontology', 'catalog');

export async function withCodebaseTBox(client: SparqlClient = new SparqlClient(loadConfig())): Promise<void> {
  // Idempotent: only load if cb:File isn't already present.
  const present = await client.ask(`
    PREFIX cb:  <https://industriagents.com/predicate/codebase#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }
  `);
  if (present) return;
  const meta = readFileSync(join(CATALOG, '..', 'meta', 'predicate-meta.ttl'), 'utf8');
  const cb = readFileSync(join(CATALOG, 'codebase.ttl'), 'utf8');
  const shapes = readFileSync(join(CATALOG, 'codebase.shacl.ttl'), 'utf8');
  const auth = 'Basic ' + Buffer.from(`admin:${process.env['PREDICATE_ADMIN_PASSWORD'] ?? 'changeme'}`).toString('base64');
  const cfg = loadConfig();
  for (const turtle of [meta, cb, shapes]) {
    await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/data?graph=kg:tbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle', 'Authorization': auth },
      body: turtle,
    });
  }
}
```

- [ ] **Step 2: Find tests that depend on codebase TBox**

```bash
grep -rln "codebase#\|cb:File\|cb:Function\|cb:imports\|cb:declaredIn\|cb:calls" packages/*/tests/ 2>&1 | head -30
```

Likely candidates: `kg-research-goal.test.ts`, `kg-explore-schema.test.ts`, reasoner rule tests, `extract.test.ts`, `sessions.test.ts` (uses cb:modifiedIn), `recall.test.ts`.

- [ ] **Step 3: Add the fixture import + `beforeAll` to each affected test**

For each file from Step 2, add at the top after the existing imports:

```typescript
import { withCodebaseTBox } from '<relative path to fixture>';
```

And add a `beforeAll`:

```typescript
beforeAll(async () => { await withCodebaseTBox(); });
```

The fixture is idempotent so running it many times is harmless.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test 2>&1 | grep -E "Tests +[0-9]"
```

Expected: all suites green. If any fail with `codebase:X not declared in TBox`, add the fixture call to that test.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/tests/fixtures/ packages/*/tests/
git commit -m "$(cat <<'EOF'
test: introduce withCodebaseTBox() fixture for v2.0 (no auto-load)

Phase 17 removes auto-loading of codebase.ttl during bootstrap.
Many existing tests assume cb:File / cb:imports / etc. exist in
kg:tbox. The withCodebaseTBox() fixture loads them on demand (and
is idempotent so concurrent test files are safe).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: SKILL.md + README + version bumps + tag v2.0.0 + push

**Files:**
- Modify: `packages/predicate-skill/skills/predicate/SKILL.md`
- Modify: `README.md`
- Modify: `packages/predicate-skill/README.md`
- Modify: `packages/predicate-skill/package.json` 1.13.0 → 2.0.0
- Modify: `packages/predicate-skill/.claude-plugin/plugin.json` 1.13.0 → 2.0.0
- Modify: `.claude-plugin/marketplace.json` 1.13.0 → 2.0.0
- Modify: `packages/predicate-skill/dashboard/index.html` — add ontology badge
- Regenerated: `packages/predicate-skill/cli.bundle.mjs` + `server.bundle.mjs`

- [ ] **Step 1: SKILL.md additions**

Modify `packages/predicate-skill/skills/predicate/SKILL.md`. Append a new section near the end (after the existing federation primer):

```markdown
## Schema-learning toggle (v2.0)

The autonomous proposer (Generalizer) runs by default — when the agent
asserts a triple using a not-yet-declared pattern that appears in ≥ K
instances, it auto-stages a `kg_propose_schema` candidate. The sweeper
promotes after 3 successful uses.

To pause that loop (e.g., the user says "stop adding new predicates"):

\`\`\`
kg_config_set({ key: "schema-learning", value: false })
\`\`\`

When off:
- The Generalizer skips proposal generation.
- `kg_propose_schema` (explicit MCP calls) STILL works.
- The PromotionSweeper STILL promotes existing staged proposals.

Re-enable with `kg_config_set({ key: "schema-learning", value: true })`.
Read current state with `kg_config_get({ key: "schema-learning" })`.

## Init / bootstrap (v2.0)

Predicate v2.0 boots empty. On first `predicate up`, the user picks one
of three modes via `predicate init` (interactive prompt or flags):

- **community**: bundled ontology (codebase, foaf, schema-org-lite, fhir-core)
- **upload**: user-supplied .ttl
- **empty**: meta + minimal top vocab; agent grows it via propose → 3-use → promote

The chosen mode is stored at `<urn:predicate:config>` in kg:meta and the
SessionStart banner reflects it.
```

- [ ] **Step 2: Update README Status section**

Top-level `README.md`. Replace the existing Status section with:

```markdown
## Status

**v2.0 — domain-agnostic bootstrap.** Predicate is no longer hard-coded
to the codebase domain. On first `predicate up`, choose one of three
init modes: install a bundled community ontology (top, codebase, foaf,
schema-org-lite, fhir-core), upload your own .ttl, or start empty and
let the agent grow vocabulary via the propose-validate-3-use gate.
Schema-learning is toggleable at runtime via the new
`kg_config_set` / `kg_config_get` MCP tools (10th + 11th tools).

v1.13.0 installs auto-migrate silently — the legacy codebase.ttl
state is detected and the config is written for you.

Earlier milestones (in order): v0.1.0-foundation → v0.2.0-discipline →
v0.3a.0-goals-and-gaps → v0.3b.0-research-execution →
v0.3c.0-schema-evolution → v1.0.0 → v1.1.0-distribution →
v1.2.0-multiplatform → v1.3.0-platform-hooks → v1.4.0-tool-capture →
v1.5.0-stop-extract → v1.5.1-real-transcript → v1.6.0-sessions-cli →
v1.6.1-skill-session-workflow → v1.6.2-fix-hook-variable →
v1.6.3-hooks-json-schema → v1.7.0-reasoning-bridge →
v1.8.0-cross-platform-stop → v1.9.0-captures-recall → v1.10.0-dashboard →
v1.11.0-federation-mvp → v1.12.0-external-ld → v1.13.0-llm-decomposer →
v2.0.0-domain-agnostic-bootstrap.

Deferred to v2.x: network-fetched community ontologies, multi-ontology
composition, per-project workspaces, schema versioning for uploads.
```

- [ ] **Step 3: Update package README**

`packages/predicate-skill/README.md` — bump the Current version line to 2.0.0; mention the new init command in CLI table.

- [ ] **Step 4: Add ontology badge to dashboard**

Modify `packages/predicate-skill/dashboard/index.html`. Find the existing header `<div class="sub">...</div>` and update the JS that fills `#ep` to also fetch and show the ontology name. Quick approach — add to the existing `loadStats()` function:

```javascript
const cfg = await ask(`
  PREFIX pred: <https://industriagents.com/predicate/meta#>
  SELECT ?ontology ?learning WHERE {
    GRAPH <kg:meta> {
      OPTIONAL { <urn:predicate:config> pred:initOntology ?ontology }
      OPTIONAL { <urn:predicate:config> pred:schemaLearningEnabled ?learning }
    }
  }
`);
const c = cfg[0] ?? {};
const ontology = c.ontology?.value ?? '(uninitialized)';
const learning = c.learning?.value === 'true' ? 'on' : 'off';
document.title = `Predicate Dashboard — ${ontology}`;
const subEl = document.querySelector('.sub');
subEl.innerHTML = `Session-history + reasoning over Fuseki @ <span id="ep">${location.host}</span> · ontology: <b>${ontology}</b> · learning: <b>${learning}</b>`;
```

- [ ] **Step 5: Bump versions**

```bash
sed -i.bak 's/"version": "1.13.0"/"version": "2.0.0"/' packages/predicate-skill/package.json && rm packages/predicate-skill/package.json.bak
sed -i.bak 's/"version": "1.13.0"/"version": "2.0.0"/' packages/predicate-skill/.claude-plugin/plugin.json && rm packages/predicate-skill/.claude-plugin/plugin.json.bak
sed -i.bak 's/"version": "1.13.0"/"version": "2.0.0"/g' .claude-plugin/marketplace.json && rm .claude-plugin/marketplace.json.bak
```

- [ ] **Step 6: Rebuild bundles + full suite**

```bash
pnpm --filter predicate-skill run bundle 2>&1 | tail -2
pnpm test 2>&1 | grep -E "Tests +[0-9]"
```

Expected: total ~268+ tests passing (246 prior + ~22 new from this phase). May vary slightly if Task 9's fixture refactor consolidates anything.

- [ ] **Step 7: Smoke-test the full v2.0 flow**

```bash
# Full reset
predicate down
# (manually wipe Docker volume so kg:meta is empty: docker volume rm <vol> if needed)
predicate up
# Should run init interactively
# Pick option 3 (empty), confirm:
predicate sessionstart   # should mention "(top ontology)"
# Then switch ontology:
predicate init --force --mode community --ontology foaf
predicate sessionstart   # should mention "(foaf ontology)"
# Toggle learning off via the new MCP tool (use the CLI bundle directly):
node packages/predicate-skill/cli.bundle.mjs ...   # if you've added a kg_config CLI shim; otherwise verify via SPARQL
```

- [ ] **Step 8: Commit + tag + merge + push**

```bash
git add README.md packages/predicate-skill/README.md packages/predicate-skill/package.json .claude-plugin/marketplace.json packages/predicate-skill/.claude-plugin/plugin.json packages/predicate-skill/dashboard/index.html packages/predicate-skill/skills/predicate/SKILL.md packages/predicate-skill/cli.bundle.mjs packages/predicate-skill/server.bundle.mjs
git commit -m "$(cat <<'EOF'
chore(release): v2.0.0 — domain-agnostic bootstrap

- SKILL.md: schema-learning toggle + init/bootstrap sections
- README: v2.0 Status with migration note
- Dashboard: ontology + learning badges in header
- Bump package.json + plugin.json + marketplace.json to 2.0.0
- Rebuild bundles (cli + server) with the new kg_config_set/get tools,
  predicate init command, and toggle-aware Generalizer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git tag -a v2.0.0-domain-agnostic-bootstrap -m "Predicate v2.0.0 — domain-agnostic bootstrap (init / catalog / toggle)"
# Merge to main + push:
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git checkout main
git merge worktree-phase-17-v2 --no-ff -m "Merge Phase 17 — v2.0 domain-agnostic bootstrap"
git push origin main --follow-tags
```

If `--follow-tags` doesn't push the tag (credential-manager-core warning), run explicitly:
```bash
git push origin v2.0.0-domain-agnostic-bootstrap
```

---

## Open assumptions (carried from spec)

- N3.js is already a transitive dep of the reasoner (`predicate-reasoner`). If `predicate init --mode upload` needs ahead-of-load TTL parsing for stricter validation (currently it relies on Fuseki to reject malformed Turtle), import N3 in init.ts and add a parse step before the POST to Fuseki.
- 10 MB upload cap is hardcoded; promote to `PREDICATE_INIT_UPLOAD_MAX_BYTES` env var if real-world ontologies are larger.
- Reasoner consistency check on uploaded TBoxes is currently implicit (Fuseki accepts whatever); a Phase 17.1 follow-up could run `runFixpoint` after the upload and roll back if the inferred graph reports `unsatisfiableClass > 0`.
- The schema-org and FHIR slices are subjective. We ship ~30 classes/properties each as a starting point; growth happens via PRs.
