# Judgment Layer v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `j:` judgment layer on top of Predicate's existing engine — vocabulary, two conflict-surfacing rules, a host-model capture tool, and a passing E1–E6 session-one eval — so the PRD's "judgments, not lookups" thesis is demonstrable in code.

**Architecture:** Additive overlay. Reuse the shipped reasoner (`r01`–`r19`), the eight named graphs, RDF-star provenance, and the `kg_assert` predicate gate. Add a `j:` ontology loaded by default, two derive-only rules (`r20` current-judgment, `r21` unresolved-conflict), a no-LLM `kg_extract_judgments` tool that hands the host model an extraction brief, and an eval that loads planted-contradiction corpora and asserts the reasoner materializes conflicts into `kg:inferred`.

**Tech Stack:** TypeScript (ESM, NodeNext), pnpm workspaces, Vitest, Oxigraph (default backend, in-process), SPARQL 1.1 Update/Query, OWL 2 RL via SPARQL `CONSTRUCT`/`INSERT`-to-fixpoint, SHACL via `rdf-validate-shacl`, Turtle.

**Key conventions discovered (follow exactly):**
- Rule files live in `packages/predicate-reasoner/src/rules/`, export a `Rule` (`{ id, name, insertWhere(cfg), backward? }`), and are registered in `rules/index.ts`'s `RULES` array. `RuleConfig = { tboxGraph, aboxGraphs, inferredGraph, closureCutoff }`. Model new rules on `r15-type-propagation.ts`.
- `kgAssert(client, { subject, predicate, object: { type: 'uri'|'literal', value, datatype? }, source, confidence, method })` — writes the triple to `kg:abox` and RDF-star provenance to `kg:provenance`. Rejects predicates not declared in `kg:tbox`/`kg:tbox-staging` (except `rdf:type`).
- MCP tools are registered in `packages/predicate-mcp/src/tools/registry.ts` inside `buildTools()`; each is `{ name, description, inputSchema (zod), handler }`.
- Reasoning is run via `new FusekiConstructAdapter(client).materialize({ tboxGraph, aboxGraphs, targetGraph, closureCutoff })`. Default `closureCutoff` is `0.5`. Materialize DROPs and rebuilds the inferred graph each call.
- Test fixture `packages/predicate-mcp/tests/fixtures/with-codebase.ts` shows the load-TBox-into-`kg:tbox` pattern via `client.loadTurtle(turtle, 'kg:tbox')`.
- Run a single package's tests: `pnpm --filter <pkg> test`. Run one file: `pnpm --filter <pkg> test <path>`. Build everything: `pnpm build`.

---

## File structure

**Create:**
- `packages/predicate-ontology/catalog/judgment.ttl` — the `j:` vocabulary overlay.
- `packages/predicate-ontology/catalog/judgment.shacl.ttl` — judgment integrity shapes.
- `packages/predicate-reasoner/src/rules/r20-current-judgment.ts` — `j:Current` materialization.
- `packages/predicate-reasoner/src/rules/r21-unresolved-conflict.ts` — `j:UnresolvedConflict` materialization + backward chaining.
- `packages/predicate-reasoner/tests/r20-r21.test.ts` — unit tests for the two rules.
- `packages/predicate-mcp/src/tools/kg-extract-judgments.ts` — the no-LLM capture tool.
- `packages/predicate-mcp/tests/tools/kg-extract-judgments.test.ts` — tool unit tests.
- `packages/predicate-eval/src/judgment-corpus.ts` — loader asserting the three planted-contradiction corpora (explicit `kgAssert` calls so per-triple confidence is controllable — see note in Task 8).
- `packages/predicate-eval/tests/session-one.test.ts` — the E1–E6 eval.
- `packages/predicate-mcp/tests/fixtures/with-judgment.ts` — load `judgment.ttl` (+ codebase + meta) into `kg:tbox` for tests.

**Modify:**
- `packages/predicate-ontology/catalog/catalog.json` — register the `judgment` overlay.
- `packages/predicate-cli/src/commands/init.ts` — always load the judgment overlay into `kg:tbox` regardless of seed mode.
- `packages/predicate-reasoner/src/rules/index.ts` — import and append `r20`, `r21` to `RULES`.
- `packages/predicate-mcp/src/tools/registry.ts` — register `kg_extract_judgments` (8 → 9 tools).
- `packages/predicate-skill/skills/predicate/SKILL.md` — judgment trigger, workflow, anti-patterns, worked example.
- `README.md` — add `kg_extract_judgments` to the MCP-tools table.

> **Deviation from spec §4.1 (intentional, recorded):** the spec lists `fixtures/judgments/*.ttl` files. We instead realize the corpora as a TypeScript loader (`judgment-corpus.ts`) using explicit `kgAssert` calls. Reason: E6 requires the "losing" reconciled source to be kept at **low confidence** so it is excluded from the inference closure; Turtle loaded via `loadTurtle` cannot carry per-triple confidence into `kg:provenance`, but `kgAssert` can. The planted contradictions remain just as visible, in the loader.

---

## Task 1: The `j:` ontology overlay

**Files:**
- Create: `packages/predicate-ontology/catalog/judgment.ttl`
- Create: `packages/predicate-mcp/tests/fixtures/with-judgment.ts`
- Test: `packages/predicate-reasoner/tests/r20-r21.test.ts` (created here, first test added in Task 4 — here we only prove the TTL parses/loads)

- [ ] **Step 1: Write `judgment.ttl`**

Create `packages/predicate-ontology/catalog/judgment.ttl`:

```turtle
@prefix j:    <https://predicate.dev/judgment#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

# --- Core classes ---
j:Judgment a owl:Class ;
    rdfs:label "Judgment" ;
    rdfs:comment "A reconciled conclusion the agent reached. No live source; exists only because the agent did the reasoning." .

j:Decision a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:label "Decision" ;
    rdfs:comment "A chosen option, with rejected alternatives recorded." .
j:Preference a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:label "Preference" ;
    rdfs:comment "A standing preference inferred from repeated observation." .
j:Reconciliation a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:label "Reconciliation" ;
    rdfs:comment "A judgment that settled a conflict between two or more sources." .
j:Assessment a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:label "Assessment" ;
    rdfs:comment "A qualitative call about an entity, e.g. 'this dependency is fragile'." .

# --- Derive-only classes (materialized into kg:inferred) ---
j:Current a owl:Class ;
    rdfs:label "Current" ;
    rdfs:comment "Derive-only (r20). A judgment with no j:supersededBy. Queries for the settled answer filter to j:Current." .
j:UnresolvedConflict a owl:Class ; rdfs:subClassOf j:Judgment ;
    rdfs:label "UnresolvedConflict" ;
    rdfs:comment "Derive-only (r21). Two current judgments disagree on a ConflictFunctionalProperty value; neither supersedes the other." .

# --- Conflict marker (drives r21; deliberately NOT owl:FunctionalProperty) ---
j:ConflictFunctionalProperty a owl:Class ;
    rdfs:label "ConflictFunctionalProperty" ;
    rdfs:comment "A property that must hold a single settled value per judgment-subject. NOT owl:FunctionalProperty: that would make r08 infer the conflicting values are owl:sameAs and merge distinct entities. r21 keys off this marker to surface a soft, queryable conflict instead." .

# --- Properties ---
j:about a owl:ObjectProperty ;
    rdfs:domain j:Judgment ;
    rdfs:label "about" ;
    rdfs:comment "The entity this judgment concerns." .

j:basedOn a owl:ObjectProperty ;
    rdfs:domain j:Judgment ;
    rdfs:label "basedOn" ;
    rdfs:comment "An input the judgment rests on. If it disappears or changes, the judgment is a retraction candidate (PRD 9.4)." .
j:reconciledFrom a owl:ObjectProperty ; rdfs:subPropertyOf j:basedOn ;
    rdfs:domain j:Reconciliation ;
    rdfs:label "reconciledFrom" ;
    rdfs:comment "A conflicting source this judgment settled. The losing source stays cited at lower confidence." .

j:rationale a owl:DatatypeProperty ;
    rdfs:domain j:Judgment ; rdfs:range xsd:string ;
    rdfs:label "rationale" ;
    rdfs:comment "The why, in the agent's own words." .

j:assertedFor a owl:ObjectProperty ;
    rdfs:domain j:Judgment ;
    rdfs:label "assertedFor" ;
    rdfs:comment "The goal (in kg:goals) that motivated this judgment." .

j:supersedes a owl:ObjectProperty , owl:TransitiveProperty ;
    rdfs:domain j:Judgment ; rdfs:range j:Judgment ;
    owl:inverseOf j:supersededBy ;
    rdfs:label "supersedes" .
j:supersededBy a owl:ObjectProperty ;
    rdfs:label "supersededBy" .

j:settledAs a owl:ObjectProperty , j:ConflictFunctionalProperty ;
    rdfs:domain j:Decision ;
    rdfs:label "settledAs" ;
    rdfs:comment "The chosen option. Conflict-functional: two different settled values for the same subject is an unresolved conflict (r21), not a silent overwrite." .
j:rejected a owl:ObjectProperty ;
    rdfs:domain j:Decision ;
    rdfs:label "rejected" ;
    rdfs:comment "An alternative considered and not chosen." .

j:prefers a owl:ObjectProperty , j:ConflictFunctionalProperty ;
    rdfs:domain j:Preference ;
    rdfs:label "prefers" ;
    rdfs:comment "Conflict-functional per choice-context: conflicting preferences on the same subject fire r21." .
j:over a owl:ObjectProperty ;
    rdfs:domain j:Preference ;
    rdfs:label "over" ;
    rdfs:comment "The dominated option in a preference." .

j:conflictsWith a owl:ObjectProperty , owl:SymmetricProperty ;
    rdfs:label "conflictsWith" ;
    rdfs:comment "Derive-only (r21). Links two judgments the reasoner found in unresolved conflict." .
```

- [ ] **Step 2: Write the test fixture `with-judgment.ts`**

Create `packages/predicate-mcp/tests/fixtures/with-judgment.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../../src/storage/index.js';
import type { StorageAdapter } from '../../src/storage/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(here, '..', '..', '..', 'predicate-ontology', 'catalog');

/** Load meta + codebase + judgment ontologies into kg:tbox. Idempotent. */
export async function withJudgmentTBox(client: StorageAdapter = getAdapter()): Promise<void> {
  const present = await client.ask(`
    PREFIX j:   <https://predicate.dev/judgment#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    ASK { GRAPH <kg:tbox> { j:Judgment a owl:Class } }
  `);
  if (present) return;
  const meta = readFileSync(join(CATALOG, '..', 'meta', 'predicate-meta.ttl'), 'utf8');
  const cb = readFileSync(join(CATALOG, 'codebase.ttl'), 'utf8');
  const top = readFileSync(join(CATALOG, 'top.ttl'), 'utf8');
  const j = readFileSync(join(CATALOG, 'judgment.ttl'), 'utf8');
  const jShapes = readFileSync(join(CATALOG, 'judgment.shacl.ttl'), 'utf8');
  for (const turtle of [meta, top, cb, j, jShapes]) {
    await client.loadTurtle(turtle, 'kg:tbox');
  }
}
```

> Note: `judgment.shacl.ttl` is created in Task 2; if executing strictly in order, comment out the `jShapes` lines until Task 2, then re-enable. Simpler: do Task 2 Step 1 before running this fixture.

- [ ] **Step 3: Add a smoke test that the overlay parses and loads**

Create `packages/predicate-reasoner/tests/r20-r21.test.ts` with just this first:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';

const client = getAdapter();

beforeAll(async () => {
  await withJudgmentTBox(client);
});

describe('judgment overlay', () => {
  it('loads j:settledAs as a ConflictFunctionalProperty (not owl:FunctionalProperty)', async () => {
    const isMarker = await client.ask(`
      PREFIX j: <https://predicate.dev/judgment#>
      ASK { GRAPH <kg:tbox> { j:settledAs a j:ConflictFunctionalProperty } }
    `);
    const isOwlFunctional = await client.ask(`
      PREFIX j:   <https://predicate.dev/judgment#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { j:settledAs a owl:FunctionalProperty } }
    `);
    expect(isMarker).toBe(true);
    expect(isOwlFunctional).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter predicate-reasoner test r20-r21`
Expected: PASS (after Task 2 Step 1 exists). The marker is present; the OWL-functional assertion is absent — confirming the D4 footgun fix.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-ontology/catalog/judgment.ttl \
        packages/predicate-mcp/tests/fixtures/with-judgment.ts \
        packages/predicate-reasoner/tests/r20-r21.test.ts
git commit -m "feat(ontology): add j: judgment overlay (settledAs/prefers as ConflictFunctionalProperty, not owl:FunctionalProperty)"
```

---

## Task 2: Judgment SHACL shapes

**Files:**
- Create: `packages/predicate-ontology/catalog/judgment.shacl.ttl`
- Test: `packages/predicate-reasoner/tests/judgment-shacl.test.ts`

- [ ] **Step 1: Write the shapes**

Create `packages/predicate-ontology/catalog/judgment.shacl.ttl`:

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix j:    <https://predicate.dev/judgment#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

j:JudgmentShape a sh:NodeShape ;
    sh:targetClass j:Judgment ;
    sh:property [
        sh:path j:basedOn ;
        sh:minCount 1 ;
        sh:message "Every j:Judgment must cite at least one j:basedOn (its basis)." ;
    ] ;
    sh:property [
        sh:path j:rationale ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Every j:Judgment must record a j:rationale." ;
    ] .

j:ReconciliationShape a sh:NodeShape ;
    sh:targetClass j:Reconciliation ;
    sh:property [
        sh:path j:reconciledFrom ;
        sh:minCount 1 ;
        sh:message "A j:Reconciliation must cite at least one j:reconciledFrom source." ;
    ] .

j:DecisionShape a sh:NodeShape ;
    sh:targetClass j:Decision ;
    sh:property [
        sh:path j:settledAs ;
        sh:maxCount 1 ;
        sh:message "A single j:Decision settles on at most one value (cross-judgment conflict is r21's job)." ;
    ] .
```

- [ ] **Step 2: Write the failing test**

Create `packages/predicate-reasoner/tests/judgment-shacl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runShacl } from '../src/shacl.js';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(here, '..', '..', 'predicate-ontology', 'catalog');
const shapes = readFileSync(join(CATALOG, 'judgment.shacl.ttl'), 'utf8');
const ont = readFileSync(join(CATALOG, 'judgment.ttl'), 'utf8');

describe('judgment SHACL', () => {
  it('fails a judgment with no j:basedOn', async () => {
    const data = `${ont}
      @prefix j: <https://predicate.dev/judgment#> .
      @prefix ex: <https://predicate.dev/corpus/x#> .
      ex:j1 a j:Assessment ; j:rationale "fragile" ; j:about ex:svc .`;
    const r = await runShacl(data, shapes);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.resultPath?.includes('basedOn'))).toBe(true);
  });

  it('passes a well-formed judgment', async () => {
    const data = `${ont}
      @prefix j: <https://predicate.dev/judgment#> .
      @prefix ex: <https://predicate.dev/corpus/x#> .
      ex:j2 a j:Assessment ; j:rationale "fragile" ; j:about ex:svc ; j:basedOn ex:incident1 .`;
    const r = await runShacl(data, shapes);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify pass**

Run: `pnpm --filter predicate-reasoner test judgment-shacl`
Expected: PASS. (The shapes exist from Step 1; this confirms `j:basedOn` minCount fires and a well-formed judgment conforms.)

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-ontology/catalog/judgment.shacl.ttl \
        packages/predicate-reasoner/tests/judgment-shacl.test.ts
git commit -m "feat(ontology): SHACL shapes requiring j:basedOn + j:rationale on every judgment"
```

---

## Task 3: Register the overlay in the catalog + load it by default at init

**Files:**
- Modify: `packages/predicate-ontology/catalog/catalog.json`
- Modify: `packages/predicate-cli/src/commands/init.ts:164-190` (the `applyPlan` function)
- Test: `packages/predicate-cli/tests/init-judgment.test.ts`

- [ ] **Step 1: Register the overlay in `catalog.json`**

Add this object to the `ontologies` array in `packages/predicate-ontology/catalog/catalog.json` (after the `codebase` entry):

```json
    {
      "name": "judgment",
      "description": "Judgment layer — j:Decision/Preference/Reconciliation/Assessment, conflict surfacing (loaded by default)",
      "license": "Elastic-2.0",
      "files": ["judgment.ttl"],
      "shapes": "judgment.shacl.ttl"
    }
```

- [ ] **Step 2: Read `applyPlan` to see the load sequence**

Run: `sed -n '160,200p' packages/predicate-cli/src/commands/init.ts`
Expected: you see `applyPlan` loading `plan.entry.files` and `plan.entry.shapes` via `loadTtlFile`, plus meta. Confirm the function signature `applyPlan(client, plan, force)` and that `plan.catalogDir` is available.

- [ ] **Step 3: Add a default judgment-overlay load to `applyPlan`**

In `packages/predicate-cli/src/commands/init.ts`, inside `applyPlan`, after the meta TTL is loaded and before/after the seed ontology files load, always load the judgment overlay. Add this helper near the other file helpers (top of file, after `loadTtlFile` is defined):

```typescript
// The judgment layer is core vocabulary, loaded regardless of seed mode.
async function loadJudgmentOverlay(client: StorageAdapter, catalogDir: string): Promise<void> {
  await loadTtlFile(client, join(catalogDir, 'judgment.ttl'));
  await loadTtlFile(client, join(catalogDir, 'judgment.shacl.ttl'));
}
```

Then, inside `applyPlan`, immediately after the meta TTL load and before returning the count, call:

```typescript
  await loadJudgmentOverlay(client, plan.catalogDir);
```

(Place it so it runs for all three plan kinds — `community`, `upload`, `empty`. The simplest correct spot is right before `applyPlan` computes/returns its triple count, since `plan.catalogDir` is present on every plan variant.)

- [ ] **Step 4: Write the failing test**

Create `packages/predicate-cli/tests/init-judgment.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runInit } from '../src/commands/init.js'; // adjust to the actual exported entrypoint

const client = getAdapter();

beforeAll(async () => {
  await runInit(client, { mode: 'empty', force: true });
});

describe('init loads judgment overlay by default', () => {
  it('j:Judgment is in kg:tbox even with --mode empty', async () => {
    const ok = await client.ask(`
      PREFIX j:   <https://predicate.dev/judgment#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { j:Judgment a owl:Class } }
    `);
    expect(ok).toBe(true);
  });
});
```

> Before writing this test, confirm the real exported init entrypoint and its options shape:
> Run: `grep -n "export.*function\|export async\|export const" packages/predicate-cli/src/commands/init.ts`
> Adjust the import and the `runInit(...)` call to match (the function that takes a client + mode/force and runs the plan). If init only exposes a CLI `main`, export a small testable `runInit(client, opts)` wrapper around `applyPlan` + plan-building and use that.

- [ ] **Step 5: Run to verify it fails, then passes**

Run: `pnpm --filter predicate-cli test init-judgment`
Expected first (before Step 3 wired): FAIL — `j:Judgment` absent under `--mode empty`.
After Step 3: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-ontology/catalog/catalog.json \
        packages/predicate-cli/src/commands/init.ts \
        packages/predicate-cli/tests/init-judgment.test.ts
git commit -m "feat(cli): load j: judgment overlay into kg:tbox by default on init (all seed modes)"
```

---

## Task 4: Rule r20 — current judgment

**Files:**
- Create: `packages/predicate-reasoner/src/rules/r20-current-judgment.ts`
- Test: `packages/predicate-reasoner/tests/r20-r21.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append to `r20-r21.test.ts`)**

Add inside the file created in Task 1, a new `describe` block. It uses the reasoner adapter directly. Append:

```typescript
import { FusekiConstructAdapter } from '../src/index.js';

const J = 'https://predicate.dev/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

async function resetAbox(): Promise<void> {
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
}

async function materialize() {
  return new FusekiConstructAdapter(client).materialize({
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    targetGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });
}

describe('r20 current-judgment', () => {
  it('marks a non-superseded judgment as j:Current', async () => {
    await resetAbox();
    await client.update(`
      PREFIX j: <${J}>
      INSERT DATA { GRAPH <kg:abox> {
        <urn:jd:a> a j:Decision ; j:about <urn:x> ; j:settledAs <urn:opt1> .
      } }
    `);
    await materialize();
    const ok = await client.ask(`
      PREFIX j: <${J}>
      ASK { GRAPH <kg:inferred> { <urn:jd:a> a j:Current } }
    `);
    expect(ok).toBe(true);
  });

  it('excludes a superseded judgment from j:Current', async () => {
    await resetAbox();
    await client.update(`
      PREFIX j: <${J}>
      INSERT DATA { GRAPH <kg:abox> {
        <urn:jd:old> a j:Decision ; j:about <urn:x> ; j:settledAs <urn:opt1> .
        <urn:jd:new> a j:Decision ; j:about <urn:x> ; j:settledAs <urn:opt2> ;
                     j:supersedes <urn:jd:old> .
      } }
    `);
    await materialize();
    const oldCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <urn:jd:old> a j:Current } }`);
    const newCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <urn:jd:new> a j:Current } }`);
    expect(oldCurrent).toBe(false);
    expect(newCurrent).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter predicate-reasoner test r20-r21`
Expected: FAIL — `<urn:jd:a> a j:Current` not present (rule not written/registered yet).

- [ ] **Step 3: Write `r20-current-judgment.ts`**

Create `packages/predicate-reasoner/src/rules/r20-current-judgment.ts` (modeled on `r15`):

```typescript
import type { Rule, RuleConfig } from './types.js';

const J = 'https://predicate.dev/judgment#';

export const r20: Rule = {
  id: 'r20-current-judgment',
  name: 'j:Current — a judgment with no j:supersededBy',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
      PREFIX j: <${J}>
      INSERT { GRAPH <${cfg.inferredGraph}> { ?jd a j:Current } }
      WHERE {
        {
          { GRAPH <${abox}>                { ?jd a j:Judgment } }
          UNION
          { GRAPH <${cfg.inferredGraph}>   { ?jd a j:Judgment } }
        }
        FILTER NOT EXISTS { GRAPH <${abox}>              { ?jd j:supersededBy ?n } }
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?jd j:supersededBy ?n } }
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?jd a j:Current } }
      }
    `;
  },
};
```

> Why this works: `j:Judgment` membership for a `j:Decision`/`j:Preference` is produced by the existing `r15` (subclass type propagation) into `kg:inferred`, so we read both graphs. `j:supersededBy` is produced from an asserted `j:supersedes` by the existing `r04` (inverseOf) into `kg:inferred`, so we check both graphs. The fixpoint converges after `r04` and `r15` have run.

- [ ] **Step 4: Register r20 in the RULES array**

In `packages/predicate-reasoner/src/rules/index.ts`, add the import and append to `RULES`:

```typescript
import { r20 } from './r20-current-judgment.js';
```
and change the array to end with `r19, r20`:
```typescript
export const RULES: Rule[] = [
  r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r12, r13, r14, r15, r16,
  r17, r18, r19, r20,
];
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter predicate-reasoner test r20-r21`
Expected: PASS — both r20 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-reasoner/src/rules/r20-current-judgment.ts \
        packages/predicate-reasoner/src/rules/index.ts \
        packages/predicate-reasoner/tests/r20-r21.test.ts
git commit -m "feat(reasoner): r20 materializes j:Current for non-superseded judgments"
```

---

## Task 5: Rule r21 — unresolved conflict (forward)

**Files:**
- Create: `packages/predicate-reasoner/src/rules/r21-unresolved-conflict.ts`
- Test: `packages/predicate-reasoner/tests/r20-r21.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append to `r20-r21.test.ts`)**

```typescript
describe('r21 unresolved-conflict', () => {
  it('flags two current decisions with different settledAs about the same subject', async () => {
    await resetAbox();
    await client.update(`
      PREFIX j: <${J}>
      INSERT DATA { GRAPH <kg:abox> {
        <urn:jd:A> a j:Decision ; j:about <urn:payments> ; j:settledAs <urn:teamPlatform> .
        <urn:jd:B> a j:Decision ; j:about <urn:payments> ; j:settledAs <urn:teamCheckout> .
      } }
    `);
    await materialize();
    const aConflict = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <urn:jd:A> a j:UnresolvedConflict } }`);
    const bConflict = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <urn:jd:B> a j:UnresolvedConflict } }`);
    const linked = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <urn:jd:A> j:conflictsWith <urn:jd:B> } }`);
    expect(aConflict).toBe(true);
    expect(bConflict).toBe(true);
    expect(linked).toBe(true);
  });

  it('does NOT merge the conflicting values via owl:sameAs (D4 footgun guard)', async () => {
    // reuse state from previous test
    const merged = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:inferred> { <urn:teamPlatform> owl:sameAs <urn:teamCheckout> } }
    `);
    expect(merged).toBe(false);
  });

  it('suppresses the conflict once one judgment supersedes the other', async () => {
    await resetAbox();
    await client.update(`
      PREFIX j: <${J}>
      INSERT DATA { GRAPH <kg:abox> {
        <urn:jd:A> a j:Decision ; j:about <urn:payments> ; j:settledAs <urn:teamPlatform> .
        <urn:jd:B> a j:Decision ; j:about <urn:payments> ; j:settledAs <urn:teamCheckout> ;
                   j:supersedes <urn:jd:A> .
      } }
    `);
    await materialize();
    const anyConflict = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { ?x a j:UnresolvedConflict } }`);
    expect(anyConflict).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter predicate-reasoner test r20-r21`
Expected: FAIL — no `j:UnresolvedConflict` materialized (rule not yet written).

- [ ] **Step 3: Write `r21-unresolved-conflict.ts`**

Create `packages/predicate-reasoner/src/rules/r21-unresolved-conflict.ts`:

```typescript
import type { Rule, RuleConfig } from './types.js';
import type { Quad } from '../types.js';

const J = 'https://predicate.dev/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const UNRESOLVED = `${J}UnresolvedConflict`;
const ABOUT = `${J}about`;
const BASED_ON = `${J}basedOn`;
const CONFLICTS_WITH = `${J}conflictsWith`;

export const r21: Rule = {
  id: 'r21-unresolved-conflict',
  name: 'j:UnresolvedConflict — two current judgments disagree on a ConflictFunctionalProperty',
  insertWhere: (cfg: RuleConfig) => {
    const abox = cfg.aboxGraphs[0] ?? 'kg:abox';
    return `
      PREFIX j:   <${J}>
      INSERT {
        GRAPH <${cfg.inferredGraph}> {
          ?a a j:UnresolvedConflict .
          ?b a j:UnresolvedConflict .
          ?a j:conflictsWith ?b .
        }
      }
      WHERE {
        GRAPH <${cfg.tboxGraph}>     { ?p a j:ConflictFunctionalProperty }
        GRAPH <${cfg.inferredGraph}> { ?a a j:Current . ?b a j:Current . }
        GRAPH <${abox}> {
          ?a j:about ?s ; ?p ?va .
          ?b j:about ?s ; ?p ?vb .
        }
        FILTER (str(?a) < str(?b))
        FILTER (?va != ?vb)
        FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a j:conflictsWith ?b } }
      }
    `;
  },
  backward: {
    matches: (q: Quad) =>
      q.p === RDF_TYPE &&
      (typeof q.o === 'string' ? q.o : (q.o as { value: string }).value) === UNRESOLVED,
    premiseQuery: (q: Quad) => `
      PREFIX j: <${J}>
      SELECT ?b ?s ?ba ?bb WHERE {
        { GRAPH <kg:inferred> { <${q.s}> j:conflictsWith ?b } }
        UNION
        { GRAPH <kg:inferred> { ?b j:conflictsWith <${q.s}> } }
        GRAPH <kg:abox> {
          <${q.s}> j:about ?s ; j:basedOn ?ba .
          ?b       j:about ?s ; j:basedOn ?bb .
        }
      } LIMIT 1
    `,
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => [
      { s: q.s, p: ABOUT, o: binding.s! },
      { s: q.s, p: BASED_ON, o: binding.ba! },
      { s: binding.b!, p: ABOUT, o: binding.s! },
      { s: binding.b!, p: BASED_ON, o: binding.bb! },
      { s: q.s, p: CONFLICTS_WITH, o: binding.b! },
    ],
  },
};
```

> Notes: We rely on `j:Current` (from r20) to exclude superseded judgments, so an explicit `j:supersedes` filter is unnecessary — a superseded judgment is not `j:Current` and cannot match. The idempotence guard is on `j:conflictsWith` (we insert it once per ordered pair). Backward `buildPremises` returns only **asserted** abox facts (`j:about`, `j:basedOn`) plus the `conflictsWith` link, so `kg_explain`'s recursion terminates at asserted triples and cites their provenance (E4).

- [ ] **Step 4: Register r21 in the RULES array**

In `packages/predicate-reasoner/src/rules/index.ts`:
```typescript
import { r21 } from './r21-unresolved-conflict.js';
```
and append to the array: `r17, r18, r19, r20, r21,`.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter predicate-reasoner test r20-r21`
Expected: PASS — conflict flagged on both, `conflictsWith` present, no `owl:sameAs` merge, and supersession suppresses the conflict.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-reasoner/src/rules/r21-unresolved-conflict.ts \
        packages/predicate-reasoner/src/rules/index.ts \
        packages/predicate-reasoner/tests/r20-r21.test.ts
git commit -m "feat(reasoner): r21 materializes soft queryable j:UnresolvedConflict (no sameAs merge); backward support for kg_explain"
```

---

## Task 6: kg_explain trace for a materialized conflict (E4 capability)

**Files:**
- Test: `packages/predicate-reasoner/tests/explain-conflict.test.ts`

This task adds no new code — it verifies r21's `backward` produces a cited trace. If it fails, fix `r21.backward` (Task 5 Step 3), not this test.

- [ ] **Step 1: Write the test**

Create `packages/predicate-reasoner/tests/explain-conflict.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';
import { FusekiConstructAdapter } from '../src/index.js';

const client = getAdapter();
const J = 'https://predicate.dev/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const adapter = new FusekiConstructAdapter(client);

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>');
  await client.update('CREATE SILENT GRAPH <kg:provenance>');
  // Two conflicting owner decisions, each with a cited basis, asserted with provenance.
  const { kgAssert } = await import('predicate-mcp/src/tools/kg-assert.js');
  for (const [jd, team, basis] of [
    ['urn:jd:A', 'urn:teamPlatform', 'urn:reorgDoc'],
    ['urn:jd:B', 'urn:teamCheckout', 'urn:pagerConfig'],
  ] as const) {
    await kgAssert(client, { subject: jd, predicate: RDF_TYPE, object: { type: 'uri', value: `${J}Decision` }, source: basis, confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: jd, predicate: `${J}about`, object: { type: 'uri', value: 'urn:payments' }, source: basis, confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: jd, predicate: `${J}settledAs`, object: { type: 'uri', value: team }, source: basis, confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: jd, predicate: `${J}rationale`, object: { type: 'literal', value: 'owner call' }, source: basis, confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: jd, predicate: `${J}basedOn`, object: { type: 'uri', value: basis }, source: basis, confidence: 0.9, method: 'test' });
  }
  await adapter.materialize({ tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5 });
});

describe('kg_explain on a materialized conflict (E4)', () => {
  it('explains UnresolvedConflict and cites both bases', async () => {
    const trace = await adapter.explain(
      { s: 'urn:jd:A', p: RDF_TYPE, o: `${J}UnresolvedConflict` },
    );
    expect(trace).not.toBeNull();
    const cited = trace!.citedProvenance.map((p) => p.source);
    expect(cited).toContain('urn:reorgDoc');
    expect(cited).toContain('urn:pagerConfig');
  });
});
```

> Confirm the adapter `explain` signature first: `grep -n "explain" packages/predicate-reasoner/src/index.ts`. The shipped adapter exposes `explain(claim: Quad)`. Adjust the call if the public method takes `(rules, claim)` — the registry's `kgExplain` shows the real call shape; mirror it.

- [ ] **Step 2: Run**

Run: `pnpm --filter predicate-reasoner test explain-conflict`
Expected: PASS — trace is non-null and cites both `urn:reorgDoc` and `urn:pagerConfig`. If null, the `r21.backward.premiseQuery`/`buildPremises` need correction (most likely the abox `j:basedOn` selection or the `conflictsWith` direction).

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-reasoner/tests/explain-conflict.test.ts
git commit -m "test(reasoner): kg_explain cites both bases of a materialized conflict (E4)"
```

---

## Task 7: kg_extract_judgments tool (no LLM call)

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-extract-judgments.ts`
- Test: `packages/predicate-mcp/tests/tools/kg-extract-judgments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/tools/kg-extract-judgments.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { withJudgmentTBox } from '../fixtures/with-judgment.js';
import { kgExtractJudgments } from '../../src/tools/kg-extract-judgments.js';
import { kgAssert } from '../../src/tools/kg-assert.js';

const client = getAdapter();
const J = 'https://predicate.dev/judgment#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>');
  await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:inferred>');
  await client.update('CREATE SILENT GRAPH <kg:inferred>');
});

describe('kg_extract_judgments', () => {
  it('returns the j: schema slice and a brief, makes no LLM call, never throws on empty graph', async () => {
    const out = await kgExtractJudgments(client, {});
    const classIris = out.judgmentSchema.classes.map((c) => c.iri);
    expect(classIris).toContain(`${J}Decision`);
    expect(out.brief).toMatch(/j:basedOn/);
    expect(Array.isArray(out.currentJudgments)).toBe(true);
    expect(out.currentJudgments).toHaveLength(0);
  });

  it('returns existing current judgments about a touched entity', async () => {
    await kgAssert(client, { subject: 'urn:jd:x', predicate: RDF_TYPE, object: { type: 'uri', value: `${J}Decision` }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}about`, object: { type: 'uri', value: 'urn:entity1' }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}settledAs`, object: { type: 'uri', value: 'urn:opt' }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}rationale`, object: { type: 'literal', value: 'r' }, source: 's', confidence: 0.9, method: 'test' });
    await kgAssert(client, { subject: 'urn:jd:x', predicate: `${J}basedOn`, object: { type: 'uri', value: 'urn:b' }, source: 's', confidence: 0.9, method: 'test' });
    // materialize so r20 marks it Current
    const { FusekiConstructAdapter } = await import('predicate-reasoner/src/index.js');
    await new FusekiConstructAdapter(client).materialize({ tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5 });

    const out = await kgExtractJudgments(client, { touchedEntities: ['urn:entity1'] });
    expect(out.currentJudgments.map((j) => j.judgment)).toContain('urn:jd:x');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter predicate-mcp test kg-extract-judgments`
Expected: FAIL — module not found / `kgExtractJudgments` undefined.

- [ ] **Step 3: Write the tool**

Create `packages/predicate-mcp/src/tools/kg-extract-judgments.ts`:

```typescript
import type { StorageAdapter } from '../storage/index.js';
import { kgExploreSchema, type SchemaSlice } from './kg-explore-schema.js';
import { escapeIRI } from '../sparql/escape.js';

const J = 'https://predicate.dev/judgment#';

export interface JudgmentSummary {
  judgment: string;   // the j:Judgment IRI
  about: string;      // the entity it concerns
  rationale?: string;
}

export interface ExtractJudgmentsInput {
  touchedEntities?: string[];   // entity IRIs this session worked with
  sessionId?: string;           // optional, for provenance/source labelling by the host
}

export interface ExtractJudgmentsOutput {
  judgmentSchema: SchemaSlice;
  currentJudgments: JudgmentSummary[];
  brief: string;
}

const BRIEF = [
  'Distill JUDGMENTS from this session — reconciled conclusions with no live source.',
  'For each decision, standing preference, qualitative assessment, or reconciliation you made:',
  '  1. Choose the j: subclass (j:Decision | j:Preference | j:Assessment | j:Reconciliation).',
  '  2. kg_assert it with: j:about <entity>, a j:rationale (your "why"), and >=1 j:basedOn <input>.',
  '     Decisions add j:settledAs <chosen> and j:rejected <alternative>; preferences add j:prefers/j:over.',
  '  3. If your new judgment conflicts with one already listed in currentJudgments, also',
  '     kg_assert <new> j:supersedes <old> so the reasoner retires the old one.',
  'Do NOT store lookups (anything re-derivable from a live source). Never assert a judgment without j:basedOn.',
  'Use only j: predicates shown in judgmentSchema; do not invent predicates.',
].join('\n');

export async function kgExtractJudgments(
  client: StorageAdapter,
  input: ExtractJudgmentsInput,
): Promise<ExtractJudgmentsOutput> {
  const judgmentSchema = await kgExploreSchema(client, `${J}Judgment`);

  const touched = input.touchedEntities ?? [];
  let currentJudgments: JudgmentSummary[] = [];
  if (touched.length > 0) {
    const values = touched.map((e) => escapeIRI(e)).join(' ');
    const r = await client.select(`
      PREFIX j: <${J}>
      SELECT ?jd ?about ?rationale WHERE {
        GRAPH <kg:inferred> { ?jd a j:Current }
        GRAPH <kg:abox> {
          ?jd j:about ?about .
          OPTIONAL { ?jd j:rationale ?rationale }
          VALUES ?about { ${values} }
        }
      }
    `);
    currentJudgments = r.results.bindings.map((b) => ({
      judgment: b.jd!.value,
      about: b.about!.value,
      rationale: b.rationale?.value,
    }));
  }

  return { judgmentSchema, currentJudgments, brief: BRIEF };
}
```

> Confirm `kgExploreSchema` accepts a full IRI (it does — `resolveConcept` returns the input unchanged when it starts with `http(s)://`; our `J...Judgment` IRI qualifies). Confirm `escapeIRI` is exported from `../sparql/escape.js` (it is — used by `kg-explore-schema.ts`).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter predicate-mcp test kg-extract-judgments`
Expected: PASS — schema slice contains `j:Decision`, brief mentions `j:basedOn`, empty graph returns `[]`, and a touched-entity lookup returns the current judgment.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-extract-judgments.ts \
        packages/predicate-mcp/tests/tools/kg-extract-judgments.test.ts
git commit -m "feat(mcp): kg_extract_judgments — host-model capture brief + j: schema + current judgments (no LLM call)"
```

---

## Task 8: Register kg_extract_judgments in the MCP registry

**Files:**
- Modify: `packages/predicate-mcp/src/tools/registry.ts`
- Test: `packages/predicate-mcp/tests/tools/registry-count.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/tools/registry-count.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { buildTools } from '../../src/tools/registry.js';

describe('tool registry', () => {
  it('exposes 9 tools including kg_extract_judgments', () => {
    const tools = buildTools(getAdapter());
    const names = tools.map((t) => t.name);
    expect(names).toContain('kg_extract_judgments');
    expect(tools).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter predicate-mcp test registry-count`
Expected: FAIL — `kg_extract_judgments` absent, length 8.

- [ ] **Step 3: Register the tool**

In `packages/predicate-mcp/src/tools/registry.ts`:
- Add import near the others (line ~11):
```typescript
import { kgExtractJudgments } from './kg-extract-judgments.js';
```
- Add this entry to the array returned by `buildTools`, before `...stubs()`:
```typescript
    {
      name: 'kg_extract_judgments',
      description: 'Return the j: schema slice, current judgments about touched entities, and a brief instructing you (the host model) to distill this session\'s judgments and assert them via kg_assert. Makes no LLM call. Call near session end when you made a decision, formed a preference/assessment, or reconciled conflicting sources.',
      inputSchema: z.object({
        touchedEntities: z.array(z.string()).optional(),
        sessionId: z.string().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          touchedEntities: z.array(z.string()).optional(),
          sessionId: z.string().optional(),
        }).parse(raw);
        return kgExtractJudgments(client, args);
      },
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter predicate-mcp test registry-count`
Expected: PASS — 9 tools, includes `kg_extract_judgments`.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/registry.ts \
        packages/predicate-mcp/tests/tools/registry-count.test.ts
git commit -m "feat(mcp): register kg_extract_judgments (8 -> 9 tools)"
```

---

## Task 9: The judgment corpus loader

**Files:**
- Create: `packages/predicate-eval/src/judgment-corpus.ts`
- Test: covered by Task 10's session-one test (loader is exercised there). Add a minimal smoke test here.
- Test: `packages/predicate-eval/tests/judgment-corpus.test.ts`

- [ ] **Step 1: Confirm predicate-eval can import predicate-reasoner**

Run: `cat packages/predicate-eval/package.json`
Expected: `predicate-mcp` is a dependency. If `predicate-reasoner` is **not** listed, add it: `"predicate-reasoner": "workspace:*"` to `dependencies`, then `pnpm install`.

- [ ] **Step 2: Write the loader**

Create `packages/predicate-eval/src/judgment-corpus.ts`. This asserts the three planted-contradiction corpora from the judgment-layer doc §3, with explicit per-triple confidence (the losing reconciled source is low-confidence so it is excluded from the inference closure — E6).

```typescript
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';

const J = 'https://predicate.dev/judgment#';
const TOP = 'https://predicate.dev/top#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const cb = 'https://predicate.dev/corpus/codebase#';
const ops = 'https://predicate.dev/corpus/ops#';
const per = 'https://predicate.dev/corpus/personal#';

type Obj = { type: 'uri' | 'literal'; value: string };
function uri(v: string): Obj { return { type: 'uri', value: v }; }
function lit(v: string): Obj { return { type: 'literal', value: v }; }

async function a(client: StorageAdapter, s: string, p: string, o: Obj, conf = 0.9, src = 'judgment-corpus'): Promise<void> {
  await kgAssert(client, { subject: s, predicate: p, object: o, source: src, confidence: conf, method: 'corpus' });
}

export async function loadJudgmentCorpus(client: StorageAdapter = getAdapter()): Promise<void> {
  // ---------- Codebase: abandoned approach + ownership conflict ----------
  await a(client, `${cb}eventStoreDecision`, RDF_TYPE, uri(`${J}Decision`));
  await a(client, `${cb}eventStoreDecision`, `${J}about`, uri(`${cb}eventStore`));
  await a(client, `${cb}eventStoreDecision`, `${J}settledAs`, uri(`${cb}kafkaOption`));
  await a(client, `${cb}eventStoreDecision`, `${J}rejected`, uri(`${cb}postgresOption`));
  await a(client, `${cb}eventStoreDecision`, `${J}rationale`,
    lit('Postgres trialled 2026-02; abandoned — write amplification under fan-out exceeded budget. Kafka chosen for the append path.'));
  await a(client, `${cb}eventStoreDecision`, `${J}basedOn`, uri(`${cb}loadTest_2026_02`));
  await a(client, `${cb}eventStoreDecision`, `${J}basedOn`, uri(`${cb}incident_4471`));

  await a(client, `${cb}authFragility`, RDF_TYPE, uri(`${J}Assessment`));
  await a(client, `${cb}authFragility`, `${J}about`, uri(`${cb}authService`));
  await a(client, `${cb}authFragility`, `${J}rationale`,
    lit('Fragile: token refresh has no retry and shares a connection pool with billing; failed twice during billing spikes.'));
  await a(client, `${cb}authFragility`, `${J}basedOn`, uri(`${cb}incident_4471`));
  await a(client, `${cb}authFragility`, `${J}basedOn`, uri(`${cb}incident_4520`));

  // PLANTED CONTRADICTION: two decisions settle different owners for payments.
  await a(client, `${cb}ownerJudgmentA`, RDF_TYPE, uri(`${J}Decision`));
  await a(client, `${cb}ownerJudgmentA`, `${J}about`, uri(`${cb}paymentsModule`));
  await a(client, `${cb}ownerJudgmentA`, `${J}settledAs`, uri(`${cb}teamPlatform`));
  await a(client, `${cb}ownerJudgmentA`, `${J}rationale`, lit('Platform owns payments per 2026-03 reorg.'));
  await a(client, `${cb}ownerJudgmentA`, `${J}basedOn`, uri(`${cb}reorgDoc`));
  await a(client, `${cb}ownerJudgmentB`, RDF_TYPE, uri(`${J}Decision`));
  await a(client, `${cb}ownerJudgmentB`, `${J}about`, uri(`${cb}paymentsModule`));
  await a(client, `${cb}ownerJudgmentB`, `${J}settledAs`, uri(`${cb}teamCheckout`));
  await a(client, `${cb}ownerJudgmentB`, `${J}rationale`, lit('Checkout owns payments per on-call rotation.'));
  await a(client, `${cb}ownerJudgmentB`, `${J}basedOn`, uri(`${cb}pagerConfig`));

  // ---------- Ops: transitive topology + reconciled owner ----------
  // top:dependsOn is transitive (top.ttl) -> r03 gives blast radius.
  await a(client, `${ops}checkout`, `${TOP}dependsOn`, uri(`${ops}billingEvents`));
  await a(client, `${ops}billingEvents`, `${TOP}dependsOn`, uri(`${ops}ledger`));
  await a(client, `${ops}dunning`, `${TOP}dependsOn`, uri(`${ops}billingEvents`));

  await a(client, `${ops}dunningOwner`, RDF_TYPE, uri(`${J}Reconciliation`));
  await a(client, `${ops}dunningOwner`, `${J}about`, uri(`${ops}dunningConsumer`));
  await a(client, `${ops}dunningOwner`, `${J}settledAs`, uri(`${ops}teamBilling`));
  await a(client, `${ops}dunningOwner`, `${J}reconciledFrom`, uri(`${ops}runbookA`));
  await a(client, `${ops}dunningOwner`, `${J}reconciledFrom`, uri(`${ops}runbookB`));
  await a(client, `${ops}dunningOwner`, `${J}rationale`,
    lit('runbookA (current) overrides runbookB (last edited 14 months ago). Confirmed against the deploy that moved the consumer.'));
  // The losing source kept at LOW confidence -> excluded from inference closure (E6).
  await a(client, `${ops}runbookB`, `${ops}claimsOwner`, uri(`${ops}teamGrowth`), 0.3, 'runbookB');

  // ---------- Personal: standing preference (Tuesday) ----------
  await a(client, `${per}errandPref`, RDF_TYPE, uri(`${J}Preference`));
  await a(client, `${per}errandPref`, `${J}about`, uri(`${per}errandScheduling`));
  await a(client, `${per}errandPref`, `${J}prefers`, uri(`${per}tuesday`));
  await a(client, `${per}errandPref`, `${J}over`, uri(`${per}thursday`));
  await a(client, `${per}errandPref`, `${J}rationale`,
    lit('Tuesdays: lowest observed traffic on the route + a recurring free 2pm block. Inferred over ~3 months of calendar + traffic data.'));
  await a(client, `${per}errandPref`, `${J}basedOn`, uri(`${per}trafficObservations`));
  await a(client, `${per}errandPref`, `${J}basedOn`, uri(`${per}calendarPattern`));
}

// E2 helper: assert the newer conflicting preference (Thursday). Called by the eval after E1.
export async function assertThursdayPreference(client: StorageAdapter): Promise<void> {
  await a(client, `${per}errandPrefNew`, RDF_TYPE, uri(`${J}Preference`));
  await a(client, `${per}errandPrefNew`, `${J}about`, uri(`${per}errandScheduling`));
  await a(client, `${per}errandPrefNew`, `${J}prefers`, uri(`${per}thursday`));
  await a(client, `${per}errandPrefNew`, `${J}rationale`, lit('Recent: user moved standing 2pm meeting to Tuesdays.'));
  await a(client, `${per}errandPrefNew`, `${J}basedOn`, uri(`${per}calendarChange_2026_05`));
}

// E2 reconcile step: the new preference supersedes the old.
export async function supersedeErrandPref(client: StorageAdapter): Promise<void> {
  await a(client, `${per}errandPrefNew`, `${J}supersedes`, uri(`${per}errandPref`));
}

export const CORPUS_IRIS = { J, TOP, cb, ops, per };
```

> The two `claimsOwner`/`runbookB` predicate: `ops:claimsOwner` is a corpus-local predicate. Because `kgAssert` rejects undeclared predicates, **declare it** — simplest is to assert it as `rdf:type rdf:Property` in `kg:tbox-staging` at the top of `loadJudgmentCorpus`, OR (cleaner) drop the `claimsOwner` triple and instead represent runbookB's losing claim as a low-confidence `j:reconciledFrom` target detail. To keep the eval honest and simple: replace that one line with asserting `${ops}runbookB a j:Reconciliation`-adjacent low-confidence note is overkill. **Chosen approach:** add `ops:claimsOwner a rdf:Property` to `top.ttl` is wrong (top is generic). Instead, in this loader, before the `runbookB` assert, declare the predicate in staging:
> ```typescript
> await client.update(`INSERT DATA { GRAPH <kg:tbox-staging> {
>   <https://predicate.dev/corpus/ops#claimsOwner> a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> } }`);
> ```
> (`kgAssert`'s gate accepts predicates declared in `kg:tbox` **or** `kg:tbox-staging`.) Add this line in Step 2 before the `runbookB` assertion.

- [ ] **Step 3: Write the smoke test**

Create `packages/predicate-eval/tests/judgment-corpus.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';
import { loadJudgmentCorpus, CORPUS_IRIS } from '../src/judgment-corpus.js';

const client = getAdapter();

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>'); await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>'); await client.update('CREATE SILENT GRAPH <kg:provenance>');
  await loadJudgmentCorpus(client);
});

describe('judgment corpus', () => {
  it('loads the abandoned-Postgres decision with its rationale', async () => {
    const r = await client.select(`
      PREFIX j: <${CORPUS_IRIS.J}>
      SELECT ?why WHERE { GRAPH <kg:abox> {
        <${CORPUS_IRIS.cb}eventStoreDecision> j:rationale ?why } }
    `);
    expect(r.results.bindings[0]?.why?.value).toMatch(/Postgres/);
  });
});
```

- [ ] **Step 4: Run**

Run: `pnpm --filter predicate-eval test judgment-corpus`
Expected: PASS — the decision and its rationale load (proves `kgAssert`'s predicate gate accepts every `j:` predicate, i.e. the overlay is loaded).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-eval/src/judgment-corpus.ts \
        packages/predicate-eval/tests/judgment-corpus.test.ts \
        packages/predicate-eval/package.json
git commit -m "feat(eval): planted-contradiction judgment corpus (codebase/ops/personal) via kgAssert"
```

---

## Task 10: The E1–E6 session-one eval

**Files:**
- Create: `packages/predicate-eval/tests/session-one.test.ts`

- [ ] **Step 1: Write the eval**

Create `packages/predicate-eval/tests/session-one.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import {
  loadJudgmentCorpus, assertThursdayPreference, supersedeErrandPref, CORPUS_IRIS,
} from '../src/judgment-corpus.js';

const client = getAdapter();
const { J, TOP, cb, ops, per } = CORPUS_IRIS;
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const adapter = new FusekiConstructAdapter(client);

async function materialize() {
  return adapter.materialize({ tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'], targetGraph: 'kg:inferred', closureCutoff: 0.5 });
}

beforeAll(async () => {
  await withJudgmentTBox(client);
  await client.update('DROP SILENT GRAPH <kg:abox>'); await client.update('CREATE SILENT GRAPH <kg:abox>');
  await client.update('DROP SILENT GRAPH <kg:provenance>'); await client.update('CREATE SILENT GRAPH <kg:provenance>');
  await loadJudgmentCorpus(client);
  await materialize();
});

describe('session-one eval (PRD leading indicator)', () => {
  it('E1: why Tuesdays — returns the preference + rationale (no live source)', async () => {
    const r = await client.select(`
      PREFIX j: <${J}>
      SELECT ?why WHERE { GRAPH <kg:abox> {
        ?p a j:Preference ; j:about <${per}errandScheduling> ; j:rationale ?why } }
    `);
    expect(r.results.bindings[0]?.why?.value).toMatch(/Tuesdays/);
  });

  it('E3: why not Postgres — returns the rejected option + rationale', async () => {
    const r = await client.select(`
      PREFIX j: <${J}>
      SELECT ?rej ?why WHERE { GRAPH <kg:abox> {
        <${cb}eventStoreDecision> j:rejected ?rej ; j:rationale ?why } }
    `);
    expect(r.results.bindings[0]?.rej?.value).toBe(`${cb}postgresOption`);
    expect(r.results.bindings[0]?.why?.value).toMatch(/write amplification/);
  });

  it('E4: payments owner — reasoner MATERIALIZES UnresolvedConflict in kg:inferred', async () => {
    const aConf = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${cb}ownerJudgmentA> a j:UnresolvedConflict } }`);
    const bConf = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${cb}ownerJudgmentB> a j:UnresolvedConflict } }`);
    const merged = await client.ask(`PREFIX owl: <http://www.w3.org/2002/07/owl#> ASK { GRAPH <kg:inferred> { <${cb}teamPlatform> owl:sameAs <${cb}teamCheckout> } }`);
    expect(aConf).toBe(true);
    expect(bConf).toBe(true);
    expect(merged).toBe(false); // D4: not merged
  });

  it('E5: blast radius — transitive dependsOn returns checkout + dunning (+ ledger)', async () => {
    const r = await client.select(`
      PREFIX top: <${TOP}>
      SELECT ?dep WHERE {
        { GRAPH <kg:abox> { ?dep top:dependsOn <${ops}billingEvents> } }
        UNION
        { GRAPH <kg:inferred> { ?dep top:dependsOn <${ops}billingEvents> } }
      }
    `);
    const deps = r.results.bindings.map((b) => b.dep!.value);
    expect(deps).toContain(`${ops}checkout`);
    expect(deps).toContain(`${ops}dunning`);
  });

  it('E6: dunning owner — settled owner returned; losing source kept at low confidence', async () => {
    const settled = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:abox> { <${ops}dunningOwner> j:settledAs <${ops}teamBilling> } }`);
    expect(settled).toBe(true);
    // runbookB's losing claim is present in abox...
    const present = await client.ask(`ASK { GRAPH <kg:abox> { <${ops}runbookB> <${ops}claimsOwner> <${ops}teamGrowth> } }`);
    expect(present).toBe(true);
    // ...but excluded from the inference closure (confidence 0.3 < cutoff 0.5): no inferred type for runbookB's claim object.
    const inferredLeak = await client.ask(`ASK { GRAPH <kg:inferred> { <${ops}runbookB> <${ops}claimsOwner> <${ops}teamGrowth> } }`);
    expect(inferredLeak).toBe(false);
  });

  it('E2: preference conflict then reconcile via supersession', async () => {
    // Conflict appears once the Thursday preference is asserted.
    await assertThursdayPreference(client);
    await materialize();
    const conflictBefore = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { ?x a j:UnresolvedConflict ; j:about <${per}errandScheduling> } }`);
    expect(conflictBefore).toBe(true);

    // Reconcile: new supersedes old. Conflict clears; Thursday pref is the sole Current.
    await supersedeErrandPref(client);
    await materialize();
    const conflictAfter = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { ?x a j:UnresolvedConflict ; j:about <${per}errandScheduling> } }`);
    expect(conflictAfter).toBe(false);
    const oldCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${per}errandPref> a j:Current } }`);
    const newCurrent = await client.ask(`PREFIX j: <${J}> ASK { GRAPH <kg:inferred> { <${per}errandPrefNew> a j:Current } }`);
    expect(oldCurrent).toBe(false);
    expect(newCurrent).toBe(true);
  });
});
```

> E2 runs last because it mutates the graph (asserts the Thursday pref + supersession). If your runner randomizes test order, split E2 into its own file with a fresh `beforeAll`. Vitest preserves declaration order within a file by default.

- [ ] **Step 2: Run the eval**

Run: `pnpm --filter predicate-eval test session-one`
Expected: PASS — all six. If E4/E2 conflict assertions fail, the bug is in r21/r20 (Tasks 4–5), not the eval. If E5 returns only direct deps, check that `top.ttl`'s `dependsOn` is `owl:TransitiveProperty` and that `r03` ran (it's in `RULES`).

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-eval/tests/session-one.test.ts
git commit -m "test(eval): E1-E6 session-one eval — conflicts materialized by the reasoner in kg:inferred"
```

---

## Task 11: SKILL.md judgment guidance + bundle rebuild

**Files:**
- Modify: `packages/predicate-skill/skills/predicate/SKILL.md`
- Modify (regenerated): `packages/predicate-skill/server.bundle.mjs`, `packages/predicate-skill/cli.bundle.mjs`

- [ ] **Step 1: Read the current SKILL.md structure**

Run: `sed -n '1,60p' packages/predicate-skill/skills/predicate/SKILL.md`
Expected: you see the existing Triggers / Workflow / Anti-patterns / Examples sections. Match their heading style and tone.

- [ ] **Step 2: Add the judgment section**

Append a new section to `packages/predicate-skill/skills/predicate/SKILL.md` (place it after the existing workflow, before the examples appendix). Use the file's existing heading level:

```markdown
## Capturing judgments

A **judgment** is a reconciled conclusion you reached that has no live source — a decision and why, a standing preference, a fragility assessment, a reconciliation of conflicting sources. Lookups (anything re-derivable from a file or config) do NOT belong in the graph.

**Trigger:** At the end of a session in which you made a non-obvious decision, formed a standing preference or qualitative assessment, or reconciled two conflicting sources — call `kg_extract_judgments` (pass `touchedEntities` with the IRIs you worked on), then assert each judgment.

**Workflow:**
1. `kg_extract_judgments` → read the returned `judgmentSchema`, `currentJudgments`, and `brief`.
2. For each judgment, `kg_assert` it with `j:about <entity>`, a `j:rationale`, and ≥1 `j:basedOn <input>`. Decisions add `j:settledAs`/`j:rejected`; preferences add `j:prefers`/`j:over`.
3. If a new judgment conflicts with one already in `currentJudgments`, also `kg_assert <new> j:supersedes <old>`.

**Anti-patterns:** do not store lookups; never assert a judgment without `j:basedOn`; do not invent `j:` predicates (use what `judgmentSchema` shows).

**Worked example — abandoned approach:**
```
kg_assert(ex:eventStoreDecision a j:Decision)
kg_assert(ex:eventStoreDecision j:about ex:eventStore)
kg_assert(ex:eventStoreDecision j:settledAs ex:kafkaOption)
kg_assert(ex:eventStoreDecision j:rejected ex:postgresOption)
kg_assert(ex:eventStoreDecision j:rationale "Postgres abandoned: write amplification under fan-out exceeded budget.")
kg_assert(ex:eventStoreDecision j:basedOn ex:loadTest_2026_02)
```
Later, "why didn't we use Postgres?" is answerable from the graph alone — the reason lives in no file.
```

- [ ] **Step 3: Rebuild the bundles**

Run: `pnpm build`
Expected: the build regenerates `server.bundle.mjs` and `cli.bundle.mjs` (these are committed artifacts per repo convention). No errors.

- [ ] **Step 4: Sanity-check the new tool is in the server bundle**

Run: `grep -c "kg_extract_judgments" packages/predicate-skill/server.bundle.mjs`
Expected: ≥ 1 (the tool name appears in the bundled registry).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-skill/skills/predicate/SKILL.md \
        packages/predicate-skill/server.bundle.mjs \
        packages/predicate-skill/cli.bundle.mjs
git commit -m "docs(skill): judgment capture trigger/workflow/example; rebuild bundles with kg_extract_judgments"
```

---

## Task 12: README MCP-tools table + full verification

**Files:**
- Modify: `README.md:222-233` (the MCP tools table)

- [ ] **Step 1: Add the tool to the README table**

In `README.md`, add this row to the MCP-tools table (after the `kg_propose_schema` row):

```markdown
| `kg_extract_judgments` | Returns the `j:` schema slice, current judgments about touched entities, and a brief instructing the host model to distill and assert this session's judgments. Makes no LLM call. |
```

Also update the prose count if the README states a tool count (search for "8 tools" / "8-tool" / "8 named" — change tool-surface mentions to 9; leave "8 named graphs" untouched).

Run: `grep -n "8 tool\|8-tool\|eight tool\|8 named" README.md`
Expected: review each hit; bump the **tool-surface** counts to 9, leave the **named-graph** count at 8.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: all packages green on the default Oxigraph backend, no Docker. Pay attention to `predicate-reasoner`, `predicate-mcp`, `predicate-eval`, `predicate-cli`.

- [ ] **Step 3: Build once more to confirm a clean tree**

Run: `pnpm build`
Expected: clean build, no type errors across the workspace.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document kg_extract_judgments (9-tool surface)"
```

---

## Self-review (completed by plan author)

**Spec coverage:**
- §4.1 `judgment.ttl` + `catalog.json` → Tasks 1, 3. ✓
- §4.1 `judgment.shacl.ttl` → Task 2. ✓
- §5.3 r20 → Task 4. §5.4 r21 + backward → Tasks 5, 6. ✓
- §5.5 `kg_extract_judgments` (no LLM call) → Tasks 7, 8. ✓
- §5.6 SKILL.md → Task 11. ✓
- §5.7 corpora + E1–E6 → Tasks 9, 10. ✓
- §6 explicit supersession + basis recorded → modeled in `judgment.ttl` (`j:supersedes`, `j:basedOn`), exercised by E2 (Task 10). ✓
- §8 acceptance: default-load (Task 3 test), 9 tools (Task 8 test), eval green (Task 10), pre-existing tests green (Task 12). ✓
- Default backend Oxigraph, no Docker → every test run uses `getAdapter()` default. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" left. The two spots requiring repo confirmation (`runInit` export name in Task 3 Step 4; adapter `explain` signature in Task 6 Step 1) include the exact `grep` to resolve them and the fallback. ✓

**Type consistency:** `kgAssert` object shape `{ type, value, datatype? }` matches the registry zod schema and `load-corpus.ts`. `SchemaSlice` reused from `kg-explore-schema.ts`. Rule `backward` shape matches `rules/types.ts`. `materialize({ tboxGraph, aboxGraphs, targetGraph, closureCutoff })` matches `index.ts`. ✓

**Out-of-scope guard:** No task touches the dashboard, property-chain/`hasKey` completeness, contract-adherence metric, continuous inference, or provenance query surface — those are the separate follow-on spec. ✓
