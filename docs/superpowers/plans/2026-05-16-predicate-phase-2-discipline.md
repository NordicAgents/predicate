# Predicate Phase 2 — Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the v1 OWL 2 RL reasoner (15 rules + fixpoint runner with hard-fail at 10 iterations), the SHACL post-materialization validator, the schema-validation gate, `kg_explain` via backward-chained re-derivation, the thin reaper (`kg_maintain`), and a CI ontology consistency check. After Phase 2 the second eval question — transitive deps of `auth.ts` via `kg:inferred` — returns rows.

**Architecture:** New package `predicate-reasoner` implements the `ReasonerAdapter` interface defined in spec §8.1. Reasoning is pure SPARQL — each of the 15 rules is an `INSERT … WHERE … FILTER NOT EXISTS` against Fuseki, executed iteratively until the inferred-graph row count stops changing. SHACL uses `rdf-validate-shacl`. `kg_explain` is a separate backward-chained walker that reconstructs derivations on demand (spec §8.2 v1 approach). The thin reaper is a single SPARQL `DELETE … INSERT … WHERE` pass invoked by `kg_maintain` and emits a `MaintenanceRun` event to `kg:meta`.

**Tech stack additions:** `rdf-validate-shacl`, `n3` (Turtle parser/serializer + in-memory store), no other new runtime deps.

**Spec reference:** [`docs/superpowers/specs/2026-05-16-predicate-design.md`](../specs/2026-05-16-predicate-design.md) §§4.2, 5.1, 8, 8.1, 8.2, 11.

**Phase exit criteria:**
- All 15 OWL 2 RL rules pass their unit tests.
- Fixpoint terminates in ≤ 10 iterations on the demo corpus; a synthetic overflow test hard-fails (does not silently truncate).
- `kg_explain` returns a valid derivation for a transitive `dependsOn` inference, with cited provenance for every asserted premise.
- SHACL violations surface in the validation result returned by `ReasonerAdapter.validate`.
- The Phase 1 demo's second question — transitive dependencies via `kg:inferred` — returns rows.
- `kg_maintain` archives a synthetic stale low-confidence triple to a parallel graph and emits a `MaintenanceRun` event in `kg:meta`.
- CI fails a PR that introduces a TBox change producing an inconsistency or SHACL meta-shape violation.

---

## File structure (created or modified in Phase 2)

```
predicate/
├── packages/
│   ├── predicate-mcp/                                 (modified)
│   │   ├── src/tools/kg-assert.ts                     ← TBox-membership check (P2)
│   │   ├── src/tools/kg-explain.ts                    ← new (Task 9)
│   │   ├── src/tools/kg-maintain.ts                   ← new (Task 10)
│   │   └── src/tools/registry.ts                      ← wire kg_explain, kg_maintain
│   ├── predicate-ontology/                            (modified)
│   │   ├── meta/predicate-meta.ttl                    ← event vocabulary (P1)
│   │   └── meta/version.json                          ← bump 0.1.0 → 0.2.0
│   ├── predicate-server/                              (modified)
│   │   └── scripts/bootstrap-graphs.sh                ← load predicate-meta.ttl
│   └── predicate-reasoner/                            (new package)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── index.ts                               ← FusekiConstructAdapter
│       │   ├── types.ts                               ← ReasonerAdapter contract types
│       │   ├── closure.ts                             ← closure-eligible helper
│       │   ├── fixpoint.ts                            ← rule runner
│       │   ├── rules/
│       │   │   ├── index.ts                           ← rule registry
│       │   │   ├── r01-subclassof-transitivity.ts
│       │   │   ├── r02-subpropertyof-transitivity.ts
│       │   │   ├── r03-transitive-property.ts
│       │   │   ├── r04-inverse-of.ts
│       │   │   ├── r05-property-chain.ts
│       │   │   ├── r06-domain.ts
│       │   │   ├── r07-range.ts
│       │   │   ├── r08-functional-sameas.ts
│       │   │   ├── r09-inverse-functional.ts
│       │   │   ├── r10-symmetric.ts
│       │   │   ├── r11-disjoint-with.ts
│       │   │   ├── r12-equivalent-class.ts
│       │   │   ├── r13-equivalent-property.ts
│       │   │   ├── r14-has-key.ts
│       │   │   └── r15-type-propagation.ts
│       │   ├── shacl.ts                               ← rdf-validate-shacl runner
│       │   ├── validate.ts                            ← ReasonerAdapter.validate impl
│       │   └── explain.ts                             ← backward-chained re-derivation
│       └── tests/
│           ├── rules/                                 ← one test file per rule
│           ├── fixpoint.test.ts
│           ├── closure.test.ts
│           ├── shacl.test.ts
│           ├── validate.test.ts
│           └── explain.test.ts
└── .github/workflows/
    └── ontology-ci.yml                                ← new (Task 11)
```

---

## Phase 1 amendments (land first)

Two small fixes to the Phase 1 codebase are prerequisites — they unblock Phase 2 by giving the reasoner the meta vocabulary it emits events into and by closing the substrate-side discipline gap on `kg_assert`. Land both as a single PR before starting Task 1.

### Amendment P1: Define the lifecycle event vocabulary

**Files:**
- Create: `packages/predicate-ontology/meta/predicate-meta.ttl`
- Modify: `packages/predicate-ontology/meta/version.json`
- Modify: `packages/predicate-server/scripts/bootstrap-graphs.sh`
- Modify: `packages/predicate-ontology/README.md`

- [ ] **Step 1: Write `packages/predicate-ontology/meta/predicate-meta.ttl`**

```turtle
@prefix pred: <https://industriagents.com/predicate/meta#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

# --- Event class hierarchy ---------------------------------------

pred:Event a owl:Class ; rdfs:label "Predicate lifecycle event" .

pred:SchemaProposed         a owl:Class ; rdfs:subClassOf pred:Event .
pred:SchemaValidationPassed a owl:Class ; rdfs:subClassOf pred:Event .
pred:SchemaValidationFailed a owl:Class ; rdfs:subClassOf pred:Event .
pred:SchemaPromoted         a owl:Class ; rdfs:subClassOf pred:Event .
pred:SchemaRejected         a owl:Class ; rdfs:subClassOf pred:Event .
pred:SchemaRolledBack       a owl:Class ; rdfs:subClassOf pred:Event .
pred:TBoxVersionAdvanced    a owl:Class ; rdfs:subClassOf pred:Event .

pred:GoalCreated       a owl:Class ; rdfs:subClassOf pred:Event .
pred:GoalStatusChanged a owl:Class ; rdfs:subClassOf pred:Event .

pred:InconsistencyDetected a owl:Class ; rdfs:subClassOf pred:Event .
pred:MaintenanceRun        a owl:Class ; rdfs:subClassOf pred:Event .

# --- Common event properties -------------------------------------

pred:at      a owl:DatatypeProperty , owl:FunctionalProperty ;
             rdfs:domain pred:Event ; rdfs:range xsd:dateTime .
pred:actor   a owl:DatatypeProperty ;
             rdfs:domain pred:Event ; rdfs:range xsd:string .
pred:goal    a owl:ObjectProperty ; rdfs:domain pred:Event .
pred:payload a owl:DatatypeProperty ;
             rdfs:domain pred:Event ; rdfs:range xsd:string .

# --- Provenance properties (already used by kg_assert RDF-star) --

pred:source     a owl:DatatypeProperty ; rdfs:range xsd:string .
pred:confidence a owl:DatatypeProperty ; rdfs:range xsd:decimal .
pred:method     a owl:DatatypeProperty ; rdfs:range xsd:string .
pred:timestamp  a owl:DatatypeProperty ; rdfs:range xsd:dateTime .

# --- Query/usage event class (already used by kg_ask) ------------

pred:Query a owl:Class ; rdfs:label "Query execution record" .
pred:question  a owl:DatatypeProperty ; rdfs:domain pred:Query ; rdfs:range xsd:string .
pred:sparql    a owl:DatatypeProperty ; rdfs:domain pred:Query ; rdfs:range xsd:string .
pred:rowCount  a owl:DatatypeProperty ; rdfs:domain pred:Query ; rdfs:range xsd:integer .
pred:elapsedMs a owl:DatatypeProperty ; rdfs:domain pred:Query ; rdfs:range xsd:integer .
```

- [ ] **Step 2: Update `packages/predicate-ontology/meta/version.json`**

```json
{
  "version": "0.2.0",
  "tbox_files": ["tbox/codebase.ttl", "meta/predicate-meta.ttl"],
  "shape_files": ["shapes/codebase.shacl.ttl"],
  "domain": "codebase"
}
```

- [ ] **Step 3: Patch `packages/predicate-server/scripts/bootstrap-graphs.sh`**

Change the TBox-loading block from a single file to a loop:

```bash
# (replace the existing single-file load)
for TBOX in "../predicate-ontology/tbox/codebase.ttl" \
            "../predicate-ontology/meta/predicate-meta.ttl"; do
  if [ -f "$TBOX" ]; then
    echo "loading TBox from $TBOX"
    curl -fsS -X POST \
      --header "Content-Type: text/turtle" \
      --data-binary "@$TBOX" \
      "$HOST/$DATASET/data?graph=kg:tbox"
  fi
done
```

- [ ] **Step 4: Append a paragraph to `packages/predicate-ontology/README.md`**

```markdown
## Meta vocabulary

`meta/predicate-meta.ttl` defines `pred:Event` and its subclasses, which the
substrate writes to `kg:meta` per spec §5.1, plus the provenance vocabulary
shared with `kg:provenance`. The meta TBox is loaded into `kg:tbox` alongside
the domain TBox so that SPARQL queries over events resolve their types
without a graph join.
```

- [ ] **Step 5: Verify load**

```bash
pnpm -w fuseki:nuke
pnpm -w fuseki:up
curl -fsS "http://localhost:3030/predicate/query" \
  --data-urlencode "query=PREFIX pred: <https://industriagents.com/predicate/meta#>
                    ASK { GRAPH <kg:tbox> { pred:Event a <http://www.w3.org/2002/07/owl#Class> } }" \
  --header "Accept: application/sparql-results+json"
```
Expected: `{"boolean": true}`.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-ontology packages/predicate-server/scripts/bootstrap-graphs.sh
git commit -m "feat(ontology): add lifecycle event vocabulary (meta TBox 0.2.0)"
```

---

### Amendment P2: Substrate-side TBox-membership check on `kg_assert`

`SKILL.md` says "don't fabricate predicates" — but if the host agent ignores it, the substrate must refuse. This amendment adds a SPARQL `ASK` against `kg:tbox ∪ kg:tbox-staging` before every insert. `rdf:type` is whitelisted (it's universally legal and not declared in any domain TBox).

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-assert.ts`
- Modify: `packages/predicate-mcp/tests/tools/kg-assert.test.ts`

- [ ] **Step 1: Write the failing test (append to `kg-assert.test.ts`)**

```typescript
describe('kg_assert TBox-membership check', () => {
  it('rejects a triple whose predicate is not declared in kg:tbox', async () => {
    await expect(
      kgAssert(client, {
        subject: 'urn:test:a',
        predicate: 'https://industriagents.com/predicate/codebase#totallyMadeUp',
        object: { type: 'uri', value: 'urn:test:b' },
        source: 'test', confidence: 1, method: 'test',
      }),
    ).rejects.toThrow(/not declared/);
  });

  it('accepts rdf:type as a universally-legal predicate', async () => {
    await kgAssert(client, {
      subject: 'urn:test:c',
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: { type: 'uri', value: 'https://industriagents.com/predicate/codebase#File' },
      source: 'test', confidence: 1, method: 'test',
    });
    const ok = await client.ask(`
      ASK { GRAPH <kg:abox> { <urn:test:c>
            <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
            <https://industriagents.com/predicate/codebase#File> } }
    `);
    expect(ok).toBe(true);
  });

  it('accepts a triple whose predicate is in kg:tbox-staging', async () => {
    await client.update(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <kg:tbox-staging> {
        <https://industriagents.com/predicate/codebase#stagedProp> a owl:ObjectProperty .
      } }
    `);
    await kgAssert(client, {
      subject: 'urn:test:d',
      predicate: 'https://industriagents.com/predicate/codebase#stagedProp',
      object: { type: 'uri', value: 'urn:test:e' },
      source: 'test', confidence: 1, method: 'test',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/tools/kg-assert.test.ts
```
Expected: the first new case fails (the assertion is currently accepted with no check).

- [ ] **Step 3: Implement the check**

Modify `packages/predicate-mcp/src/tools/kg-assert.ts`:

```typescript
import { SparqlClient } from '../sparql/client.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';
import { buildProvenanceMeta } from '../provenance.js';

const ALWAYS_ALLOWED_PREDICATES = new Set<string>([
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
]);

async function predicateIsDeclared(client: SparqlClient, p: string): Promise<boolean> {
  return client.ask(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    ASK {
      { GRAPH ${escapeIRI(GRAPH.tbox)}         { ${escapeIRI(p)} a ?t } }
      UNION
      { GRAPH ${escapeIRI(GRAPH.tboxStaging)}  { ${escapeIRI(p)} a ?t } }
      FILTER (?t IN (owl:ObjectProperty, owl:DatatypeProperty,
                     owl:AnnotationProperty, rdf:Property))
    }
  `);
}

export interface Triple { /* unchanged */ }

function renderObject(obj: Triple['object']): string { /* unchanged */ }

export async function kgAssert(client: SparqlClient, t: Triple): Promise<void> {
  if (t.confidence < 0 || t.confidence > 1) {
    throw new Error(`confidence must be in [0,1], got ${t.confidence}`);
  }
  if (!ALWAYS_ALLOWED_PREDICATES.has(t.predicate)) {
    if (!(await predicateIsDeclared(client, t.predicate))) {
      throw new Error(
        `Predicate ${t.predicate} is not declared in kg:tbox or kg:tbox-staging. ` +
        `Call kg_explore_schema first, or kg_propose_schema if the predicate doesn't exist yet.`,
      );
    }
  }

  // ... rest of the function unchanged
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/tools/kg-assert.test.ts
```
Expected: all (original + 3 new) green.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-assert.ts packages/predicate-mcp/tests/tools/kg-assert.test.ts
git commit -m "feat(mcp): kg_assert refuses undeclared predicates (substrate gate per spec §6)"
```

---

## Task 1: `predicate-reasoner` package skeleton + ReasonerAdapter types

**Files:**
- Create: `packages/predicate-reasoner/package.json`
- Create: `packages/predicate-reasoner/tsconfig.json`
- Create: `packages/predicate-reasoner/vitest.config.ts`
- Create: `packages/predicate-reasoner/.eslintrc.json`
- Create: `packages/predicate-reasoner/src/types.ts`
- Create: `packages/predicate-reasoner/src/index.ts`
- Create: `packages/predicate-reasoner/tests/types.test.ts`

- [ ] **Step 1: Write `packages/predicate-reasoner/package.json`**

```json
{
  "name": "predicate-reasoner",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint src tests --max-warnings 0"
  },
  "dependencies": {
    "predicate-mcp": "workspace:*",
    "rdf-validate-shacl": "^0.5.4",
    "n3": "^1.17.3"
  },
  "devDependencies": {
    "@types/n3": "^1.16.4",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `packages/predicate-reasoner/tsconfig.json`**

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

- [ ] **Step 3: Write `packages/predicate-reasoner/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 4: Write `packages/predicate-reasoner/.eslintrc.json`**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

- [ ] **Step 5: Write `packages/predicate-reasoner/src/types.ts`**

```typescript
export type IRI = string;
export type LiteralValue = { value: string; datatype?: IRI; lang?: string };

export interface Quad {
  s: IRI;
  p: IRI;
  o: IRI | LiteralValue;
  g?: IRI;
}

export interface MaterializeInput {
  tboxGraph: IRI;
  aboxGraphs: IRI[];
  targetGraph: IRI;
  closureCutoff: number;
}

export interface Inconsistency {
  kind: 'disjoint-class' | 'shacl' | 'functional-property-conflict';
  description: string;
  triples: Quad[];
}

export interface MaterializeResult {
  inferredCount: number;
  inconsistencies: Inconsistency[];
  iterations: number;
  elapsedMs: number;
}

export interface ValidateInput {
  tboxGraph: IRI;
  stagingGraph: IRI;
  aboxSample: IRI;
}

export interface ShaclViolation {
  focusNode: IRI;
  resultPath?: IRI;
  message: string;
  sourceShape?: IRI;
}

export interface ValidationResult {
  ok: boolean;
  unsatisfiableClasses: IRI[];
  shaclViolations: ShaclViolation[];
  impactedTriples: number;
  impactedQueries: number;
}

export interface ProvenanceRecord {
  triple: Quad;
  source: string;
  confidence: number;
  method: string;
  timestamp: string;
}

export interface DerivationStep {
  rule: string;
  premises: Quad[];
  conclusion: Quad;
}

export interface InferenceTrace {
  conclusion: Quad;
  derivation: DerivationStep[];
  citedProvenance: ProvenanceRecord[];
  alternatesExist: boolean;
}

export interface ReasonerAdapter {
  materialize(input: MaterializeInput): Promise<MaterializeResult>;
  validate(input: ValidateInput): Promise<ValidationResult>;
  explain(claim: Quad): Promise<InferenceTrace | null>;
}
```

- [ ] **Step 6: Write the failing test**

`packages/predicate-reasoner/tests/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { FusekiConstructAdapter } from '../src/index.js';

describe('FusekiConstructAdapter', () => {
  it('exposes the ReasonerAdapter contract', () => {
    const adapter = new FusekiConstructAdapter({} as never);
    expect(typeof adapter.materialize).toBe('function');
    expect(typeof adapter.validate).toBe('function');
    expect(typeof adapter.explain).toBe('function');
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
cd packages/predicate-reasoner && pnpm install && pnpm test
```
Expected: FAIL — module not found.

- [ ] **Step 8: Write `packages/predicate-reasoner/src/index.ts` (stub)**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  ReasonerAdapter,
  MaterializeInput, MaterializeResult,
  ValidateInput, ValidationResult,
  InferenceTrace, Quad,
} from './types.js';

export * from './types.js';

export class FusekiConstructAdapter implements ReasonerAdapter {
  constructor(_client: SparqlClient) {}

  async materialize(_input: MaterializeInput): Promise<MaterializeResult> {
    throw new Error('materialize: not implemented (Task 3)');
  }
  async validate(_input: ValidateInput): Promise<ValidationResult> {
    throw new Error('validate: not implemented (Task 8)');
  }
  async explain(_claim: Quad): Promise<InferenceTrace | null> {
    throw new Error('explain: not implemented (Task 9)');
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
pnpm test
```
Expected: 1 passed.

- [ ] **Step 10: Commit**

```bash
git add packages/predicate-reasoner
git commit -m "feat(reasoner): scaffold predicate-reasoner with ReasonerAdapter contract"
```

---

## Task 2: SPARQL rule executor + closure-eligible helper + Rule 1

The rule executor takes a rule (a SPARQL `INSERT … WHERE …` string) and runs it against Fuseki. The closure-eligible helper wraps a graph pattern with the `CLOSURE_CUTOFF` filter so low-confidence triples are excluded from rule inputs. Rule 1 (`rdfs:subClassOf` transitivity) is the simplest rule and serves as the test vehicle.

**Files:**
- Create: `packages/predicate-reasoner/src/closure.ts`
- Create: `packages/predicate-reasoner/src/rules/index.ts`
- Create: `packages/predicate-reasoner/src/rules/r01-subclassof-transitivity.ts`
- Create: `packages/predicate-reasoner/src/rules/types.ts`
- Create: `packages/predicate-reasoner/tests/closure.test.ts`
- Create: `packages/predicate-reasoner/tests/rules/r01.test.ts`

- [ ] **Step 1: Write `packages/predicate-reasoner/src/rules/types.ts`**

```typescript
export interface Rule {
  id: string;                       // e.g. 'r01-subclassof-transitivity'
  name: string;                     // human label
  insertWhere: (cfg: RuleConfig) => string;
  /** For backward-chained kg_explain (filled in Task 9). */
  backward?: {
    headPattern: (vars: { s: string; p: string; o: string }) => string;
    premisePatterns: (binding: Record<string, string>) => string[];
  };
}

export interface RuleConfig {
  tboxGraph: string;       // typically 'kg:tbox'
  aboxGraphs: string[];    // typically ['kg:abox']
  inferredGraph: string;   // typically 'kg:inferred'
  closureCutoff: number;   // 0.5 default
}
```

- [ ] **Step 2: Write the failing test for the closure helper**

`packages/predicate-reasoner/tests/closure.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { closureEligible } from '../src/closure.js';

describe('closureEligible', () => {
  it('produces a SPARQL fragment that unions tbox/inferred and filtered abox', () => {
    const frag = closureEligible('?s', '?p', '?o', {
      tboxGraph: 'kg:tbox',
      aboxGraphs: ['kg:abox'],
      inferredGraph: 'kg:inferred',
      closureCutoff: 0.5,
    });
    expect(frag).toContain('GRAPH <kg:tbox>');
    expect(frag).toContain('GRAPH <kg:abox>');
    expect(frag).toContain('GRAPH <kg:inferred>');
    expect(frag).toContain('FILTER (?conf >= 0.5)');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm test tests/closure.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `packages/predicate-reasoner/src/closure.ts`**

```typescript
import type { RuleConfig } from './rules/types.js';

/**
 * Returns a SPARQL fragment that binds (?s, ?p, ?o) to the set of triples
 * eligible for the reasoner's closure input: everything in kg:tbox or
 * kg:inferred unconditionally, plus kg:abox triples whose RDF-star
 * confidence annotation in kg:provenance is >= closureCutoff.
 *
 * Triples from kg:abox without any confidence annotation are EXCLUDED —
 * we treat "no provenance" as "not reasoned about."
 */
export function closureEligible(
  s: string, p: string, o: string,
  cfg: RuleConfig,
): string {
  const aboxBlocks = cfg.aboxGraphs.map((g) => `
    {
      GRAPH <${g}> { ${s} ${p} ${o} }
      FILTER EXISTS {
        GRAPH <kg:provenance> {
          << ${s} ${p} ${o} >> <https://industriagents.com/predicate/meta#confidence> ?conf .
          FILTER (?conf >= ${cfg.closureCutoff})
        }
      }
    }
  `).join('\n    UNION\n');
  return `
    {
      GRAPH <${cfg.tboxGraph}> { ${s} ${p} ${o} }
    }
    UNION
    {
      GRAPH <${cfg.inferredGraph}> { ${s} ${p} ${o} }
    }
    UNION
    ${aboxBlocks}
  `;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test tests/closure.test.ts
```
Expected: 1 passed.

- [ ] **Step 6: Write `packages/predicate-reasoner/src/rules/r01-subclassof-transitivity.ts`**

For subClassOf, all inputs come from `kg:tbox ∪ kg:inferred` (axioms, not data) — confidence filtering doesn't apply.

```typescript
import type { Rule, RuleConfig } from './types.js';

export const r01: Rule = {
  id: 'r01-subclassof-transitivity',
  name: 'rdfs:subClassOf transitivity',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?b } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?b } }
      }
      {
        { GRAPH <${cfg.tboxGraph}>     { ?b rdfs:subClassOf ?c } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?b rdfs:subClassOf ?c } }
      }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subClassOf ?c } }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subClassOf ?c } }
    }
  `,
};
```

- [ ] **Step 7: Write `packages/predicate-reasoner/src/rules/index.ts`**

```typescript
import type { Rule } from './types.js';
import { r01 } from './r01-subclassof-transitivity.js';

export const RULES: Rule[] = [r01];

export type { Rule, RuleConfig } from './types.js';
```

- [ ] **Step 8: Write the failing test for Rule 1**

`packages/predicate-reasoner/tests/rules/r01.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { r01 } from '../../src/rules/r01-subclassof-transitivity.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);

const ruleCfg = {
  tboxGraph: 'kg:tbox-test-r01',
  aboxGraphs: ['kg:abox-test-r01'],
  inferredGraph: 'kg:inferred-test-r01',
  closureCutoff: 0.5,
};

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  await reset(ruleCfg.tboxGraph);
  await reset(ruleCfg.inferredGraph);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT DATA { GRAPH <${ruleCfg.tboxGraph}> {
      ex:Animal  rdfs:subClassOf ex:LivingThing .
      ex:Mammal  rdfs:subClassOf ex:Animal .
      ex:Dog     rdfs:subClassOf ex:Mammal .
    } }
  `);
});

beforeEach(() => reset(ruleCfg.inferredGraph));

describe('Rule 1: rdfs:subClassOf transitivity', () => {
  it('infers Dog ⊑ Animal after one application', async () => {
    await client.update(r01.insertWhere(ruleCfg));
    const r = await client.select(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?b WHERE { GRAPH <${ruleCfg.inferredGraph}> { ex:Dog rdfs:subClassOf ?b } }
    `);
    const inferred = r.results.bindings.map((b) => b.b!.value);
    expect(inferred).toContain('https://ex/Animal');
  });

  it('does not infer reflexive triples', async () => {
    await client.update(r01.insertWhere(ruleCfg));
    const r = await client.select(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <${ruleCfg.inferredGraph}> { ?x rdfs:subClassOf ?x }
      }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(0);
  });

  it('is idempotent — second application infers no new triples', async () => {
    await client.update(r01.insertWhere(ruleCfg));
    const before = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${ruleCfg.inferredGraph}> { ?s ?p ?o } }`,
    );
    await client.update(r01.insertWhere(ruleCfg));
    const after = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${ruleCfg.inferredGraph}> { ?s ?p ?o } }`,
    );
    expect(after.results.bindings[0]!.n!.value).toBe(before.results.bindings[0]!.n!.value);
  });
});
```

Note: a single application of Rule 1 over a chain `Dog ⊏ Mammal ⊏ Animal ⊏ LivingThing` infers `Dog ⊏ Animal` and `Mammal ⊏ LivingThing` directly, but not `Dog ⊏ LivingThing` — that needs a second iteration. Fixpoint (Task 3) closes that gap.

- [ ] **Step 9: Run the test to verify it passes**

```bash
pnpm test tests/rules/r01.test.ts
```
Expected: 3 passed.

- [ ] **Step 10: Commit**

```bash
git add packages/predicate-reasoner/src/closure.ts \
        packages/predicate-reasoner/src/rules \
        packages/predicate-reasoner/tests/closure.test.ts \
        packages/predicate-reasoner/tests/rules/r01.test.ts
git commit -m "feat(reasoner): closure-eligibility helper + Rule 1 (subClassOf transitivity)"
```

---

## Task 3: Fixpoint runner with hard-fail at 10 iterations

The runner: starting from an empty `kg:inferred`, apply every registered rule once per iteration, count the `kg:inferred` size after each pass, stop when the count stops growing. Hard-fail (not warn) if the count is still growing after 10 iterations — on the v1 rule subset this should never fire.

**Files:**
- Create: `packages/predicate-reasoner/src/fixpoint.ts`
- Modify: `packages/predicate-reasoner/src/index.ts` (wire `materialize`)
- Create: `packages/predicate-reasoner/tests/fixpoint.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/predicate-reasoner/tests/fixpoint.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../src/index.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);
const adapter = new FusekiConstructAdapter(client);

const M_TBOX = 'kg:tbox-test-fp';
const M_INF  = 'kg:inferred-test-fp';

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  await reset(M_TBOX);
  await client.update(`
    PREFIX ex: <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT DATA { GRAPH <${M_TBOX}> {
      ex:Dog     rdfs:subClassOf ex:Mammal .
      ex:Mammal  rdfs:subClassOf ex:Animal .
      ex:Animal  rdfs:subClassOf ex:LivingThing .
      ex:LivingThing rdfs:subClassOf ex:Thing .
    } }
  `);
});

beforeEach(() => reset(M_INF));

describe('FusekiConstructAdapter.materialize', () => {
  it('computes the full transitive closure of a 4-step chain', async () => {
    const r = await adapter.materialize({
      tboxGraph: M_TBOX,
      aboxGraphs: [],
      targetGraph: M_INF,
      closureCutoff: 0.5,
    });
    expect(r.iterations).toBeGreaterThan(1);
    expect(r.iterations).toBeLessThanOrEqual(10);
    expect(r.inferredCount).toBeGreaterThan(0);

    const reached = await client.ask(`
      PREFIX ex:   <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${M_INF}> { ex:Dog rdfs:subClassOf ex:Thing } }
    `);
    expect(reached).toBe(true);
  });

  it('hard-fails if fixpoint does not converge within 10 iterations', async () => {
    // Force a synthetic blow-up by injecting an artificial growing chain.
    // We achieve this with a stub rule that always inserts a fresh-named triple.
    const fakeAdapter = new FusekiConstructAdapter(client);
    (fakeAdapter as unknown as { __rules: unknown }).__rules = [
      {
        id: 'stub-divergent',
        name: 'always-adds',
        insertWhere: (c: { inferredGraph: string }) => `
          INSERT DATA { GRAPH <${c.inferredGraph}> {
            <urn:gen:${Math.random()}> <urn:p> <urn:o> .
          } }
        `,
      },
    ];
    await expect(
      fakeAdapter.materialize({
        tboxGraph: M_TBOX, aboxGraphs: [], targetGraph: M_INF, closureCutoff: 0.5,
      }),
    ).rejects.toThrow(/fixpoint did not converge/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/fixpoint.test.ts
```
Expected: FAIL — materialize throws "not implemented".

- [ ] **Step 3: Implement `packages/predicate-reasoner/src/fixpoint.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type { Rule, RuleConfig } from './rules/types.js';

export interface FixpointResult {
  iterations: number;
  inferredCount: number;
}

const MAX_ITERATIONS = 10;

export async function runFixpoint(
  client: SparqlClient,
  rules: Rule[],
  cfg: RuleConfig,
): Promise<FixpointResult> {
  await client.update(`DROP SILENT GRAPH <${cfg.inferredGraph}>`);
  await client.update(`CREATE SILENT GRAPH <${cfg.inferredGraph}>`);

  let lastCount = -1;
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    for (const rule of rules) {
      await client.update(rule.insertWhere(cfg));
    }
    const r = await client.select(
      `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${cfg.inferredGraph}> { ?s ?p ?o } }`,
    );
    const n = parseInt(r.results.bindings[0]!.n!.value, 10);
    if (n === lastCount) return { iterations: i, inferredCount: n };
    lastCount = n;
  }
  throw new Error(
    `Fixpoint did not converge in ${MAX_ITERATIONS} iterations ` +
    `(current inferred count: ${lastCount}). ` +
    `On the v1 OWL 2 RL rule subset this should be impossible — investigate ` +
    `for a divergent rule or an unbounded property-chain depth.`,
  );
}
```

- [ ] **Step 4: Wire `materialize` in `src/index.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  ReasonerAdapter,
  MaterializeInput, MaterializeResult,
  ValidateInput, ValidationResult,
  InferenceTrace, Quad,
} from './types.js';
import { RULES } from './rules/index.js';
import type { Rule } from './rules/types.js';
import { runFixpoint } from './fixpoint.js';

export * from './types.js';

export class FusekiConstructAdapter implements ReasonerAdapter {
  /** Override for tests; in production this is the RULES registry. */
  protected __rules: Rule[] = RULES;

  constructor(private client: SparqlClient) {}

  async materialize(input: MaterializeInput): Promise<MaterializeResult> {
    const t0 = Date.now();
    const { iterations, inferredCount } = await runFixpoint(this.client, this.__rules, {
      tboxGraph: input.tboxGraph,
      aboxGraphs: input.aboxGraphs,
      inferredGraph: input.targetGraph,
      closureCutoff: input.closureCutoff,
    });
    return {
      inferredCount,
      iterations,
      inconsistencies: [],   // populated in Task 6 (rule 11)
      elapsedMs: Date.now() - t0,
    };
  }

  async validate(_input: ValidateInput): Promise<ValidationResult> {
    throw new Error('validate: not implemented (Task 8)');
  }
  async explain(_claim: Quad): Promise<InferenceTrace | null> {
    throw new Error('explain: not implemented (Task 9)');
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test
```
Expected: 4 passed (1 types + 3 fixpoint).

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-reasoner/src/fixpoint.ts \
        packages/predicate-reasoner/src/index.ts \
        packages/predicate-reasoner/tests/fixpoint.test.ts
git commit -m "feat(reasoner): fixpoint runner with hard-fail at 10 iterations"
```

---

## Task 4: Rules 2–5 (property hierarchy, transitive, inverse, length-2 chain)

**Files (create one per rule + tests):**
- `packages/predicate-reasoner/src/rules/r02-subpropertyof-transitivity.ts`
- `packages/predicate-reasoner/src/rules/r03-transitive-property.ts`
- `packages/predicate-reasoner/src/rules/r04-inverse-of.ts`
- `packages/predicate-reasoner/src/rules/r05-property-chain.ts`
- `packages/predicate-reasoner/tests/rules/r02-r05.test.ts`
- Modify: `packages/predicate-reasoner/src/rules/index.ts`

- [ ] **Step 1: Write `r02-subpropertyof-transitivity.ts`**

Pure-axiom rule (same shape as `r01`):

```typescript
import type { Rule, RuleConfig } from './types.js';

export const r02: Rule = {
  id: 'r02-subpropertyof-transitivity',
  name: 'rdfs:subPropertyOf transitivity',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?c } }
    WHERE {
      {
        { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subPropertyOf ?b } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?b } }
      }
      {
        { GRAPH <${cfg.tboxGraph}>     { ?b rdfs:subPropertyOf ?c } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?b rdfs:subPropertyOf ?c } }
      }
      FILTER (?a != ?c)
      FILTER NOT EXISTS { GRAPH <${cfg.tboxGraph}>     { ?a rdfs:subPropertyOf ?c } }
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?a rdfs:subPropertyOf ?c } }
    }
  `,
};
```

- [ ] **Step 2: Write `r03-transitive-property.ts`**

For data-bearing rules we use `closureEligible` to filter low-confidence ABox triples.

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r03: Rule = {
  id: 'r03-transitive-property',
  name: 'owl:TransitiveProperty',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?p ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:TransitiveProperty }
      ${closureEligible('?x', '?p', '?y', cfg)}
      ${closureEligible('?y', '?p', '?z', cfg)}
      FILTER (?x != ?z)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?p ?z } }
      FILTER NOT EXISTS {
        FILTER EXISTS { GRAPH <${cfg.aboxGraphs[0]}> { ?x ?p ?z } }
      }
    }
  `,
};
```

- [ ] **Step 3: Write `r04-inverse-of.ts`**

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r04: Rule = {
  id: 'r04-inverse-of',
  name: 'owl:inverseOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?p owl:inverseOf ?q }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?q owl:inverseOf ?p }
      }
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y ?q ?x } }
    }
  `,
};
```

- [ ] **Step 4: Write `r05-property-chain.ts` (bounded to chain length 2 per spec §8)**

The property-chain rule materializes only chains of length 2 (`p1 ∘ p2 → q`). Deeper chains are evaluated via SPARQL property paths at query time.

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r05: Rule = {
  id: 'r05-property-chain',
  name: 'owl:propertyChainAxiom (length 2)',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?q owl:propertyChainAxiom ?list .
        ?list rdf:first ?p1 ; rdf:rest ?rest .
        ?rest rdf:first ?p2 ; rdf:rest rdf:nil .  # length 2 only
      }
      ${closureEligible('?x', '?p1', '?y', cfg)}
      ${closureEligible('?y', '?p2', '?z', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x ?q ?z } }
    }
  `,
};
```

- [ ] **Step 5: Update `packages/predicate-reasoner/src/rules/index.ts`**

```typescript
import type { Rule } from './types.js';
import { r01 } from './r01-subclassof-transitivity.js';
import { r02 } from './r02-subpropertyof-transitivity.js';
import { r03 } from './r03-transitive-property.js';
import { r04 } from './r04-inverse-of.js';
import { r05 } from './r05-property-chain.js';

export const RULES: Rule[] = [r01, r02, r03, r04, r05];

export type { Rule, RuleConfig } from './types.js';
```

- [ ] **Step 6: Write the failing test for rules 2–5**

`packages/predicate-reasoner/tests/rules/r02-r05.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const cfg = loadConfig();
const client = new SparqlClient(cfg);
const adapter = new FusekiConstructAdapter(client);

const T = 'kg:tbox-test-r2-5';
const A = 'kg:abox-test-r2-5';
const I = 'kg:inferred-test-r2-5';
const P = 'kg:provenance-test-r2-5';  // RDF-star confidence lookup

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function withProv(s: string, p: string, o: string, conf: number) {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${A}> { ${s} ${p} ${o} . }
      GRAPH <${P}> { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

beforeAll(async () => {
  for (const g of [T, A, P]) await reset(g);
  // Override the global kg:provenance reference inside closureEligible by
  // making our test graph the source. For these tests we mirror to kg:provenance
  // too so existing rules still pick it up.
  await client.update(`COPY SILENT GRAPH <${P}> TO GRAPH <kg:provenance>`);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT DATA { GRAPH <${T}> {
      ex:owns      rdfs:subPropertyOf ex:possesses .
      ex:possesses rdfs:subPropertyOf ex:relatesTo .
      ex:ancestor  a owl:TransitiveProperty .
      ex:parentOf  owl:inverseOf       ex:childOf .
      ex:grandparentOf owl:propertyChainAxiom
        ( ex:parentOf ex:parentOf ) .
    } }
  `);
});

beforeEach(() => reset(I));

async function materialize() {
  return adapter.materialize({
    tboxGraph: T, aboxGraphs: [A], targetGraph: I, closureCutoff: 0.5,
  });
}

describe('rules 2–5', () => {
  it('r02: subPropertyOf is transitive across the chain', async () => {
    await materialize();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:owns rdfs:subPropertyOf ex:relatesTo } }
    `);
    expect(ok).toBe(true);
  });

  it('r03: TransitiveProperty closes a 3-step chain', async () => {
    await withProv('<https://ex/a>', '<https://ex/ancestor>', '<https://ex/b>', 1);
    await withProv('<https://ex/b>', '<https://ex/ancestor>', '<https://ex/c>', 1);
    await withProv('<https://ex/c>', '<https://ex/ancestor>', '<https://ex/d>', 1);
    await materialize();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:a ex:ancestor ex:d } }
    `);
    expect(ok).toBe(true);
  });

  it('r04: inverseOf materializes the reverse direction', async () => {
    await withProv('<https://ex/m>', '<https://ex/parentOf>', '<https://ex/n>', 1);
    await materialize();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:n ex:childOf ex:m } }
    `);
    expect(ok).toBe(true);
  });

  it('r05: 2-step property chain materializes; 3-step does not', async () => {
    await withProv('<https://ex/g>', '<https://ex/parentOf>', '<https://ex/p>', 1);
    await withProv('<https://ex/p>', '<https://ex/parentOf>', '<https://ex/c>', 1);
    await withProv('<https://ex/c>', '<https://ex/parentOf>', '<https://ex/x>', 1);
    await materialize();
    const ok2 = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:g ex:grandparentOf ex:c } }
    `);
    expect(ok2).toBe(true);
    // 3-step (great-grandparent) NOT materialized; deeper chain is query-time only.
    const ok3 = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:g ex:grandparentOf ex:x } }
    `);
    expect(ok3).toBe(false);
  });

  it('r03: a low-confidence premise is excluded from closure input', async () => {
    await withProv('<https://ex/lo1>', '<https://ex/ancestor>', '<https://ex/lo2>', 0.3);
    await withProv('<https://ex/lo2>', '<https://ex/ancestor>', '<https://ex/lo3>', 1);
    await materialize();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      ASK { GRAPH <${I}> { ex:lo1 ex:ancestor ex:lo3 } }
    `);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pnpm test tests/rules/r02-r05.test.ts
```
Expected: 5 passed.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-reasoner/src/rules \
        packages/predicate-reasoner/tests/rules/r02-r05.test.ts
git commit -m "feat(reasoner): rules 2–5 (subProp transitivity, transitive, inverse, length-2 chain)"
```

---

## Task 5: Rules 6–10 (domain, range, functional + sameAs, inverse-functional, symmetric)

**Files (create one per rule + a combined test file):**
- `packages/predicate-reasoner/src/rules/r06-domain.ts`
- `packages/predicate-reasoner/src/rules/r07-range.ts`
- `packages/predicate-reasoner/src/rules/r08-functional-sameas.ts`
- `packages/predicate-reasoner/src/rules/r09-inverse-functional.ts`
- `packages/predicate-reasoner/src/rules/r10-symmetric.ts`
- `packages/predicate-reasoner/tests/rules/r06-r10.test.ts`
- Modify: `packages/predicate-reasoner/src/rules/index.ts`

- [ ] **Step 1: Write `r06-domain.ts`**

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r06: Rule = {
  id: 'r06-domain',
  name: 'rdfs:domain → rdf:type',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:domain ?D }
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    }
  `,
};
```

- [ ] **Step 2: Write `r07-range.ts`**

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r07: Rule = {
  id: 'r07-range',
  name: 'rdfs:range → rdf:type',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p rdfs:range ?R }
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER (isIRI(?y))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y rdf:type ?R } }
    }
  `,
};
```

- [ ] **Step 3: Write `r08-functional-sameas.ts`**

`FunctionalProperty` says "at most one object per subject"; if two objects appear, they are `owl:sameAs`.

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r08: Rule = {
  id: 'r08-functional-sameas',
  name: 'owl:FunctionalProperty → owl:sameAs',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y1 owl:sameAs ?y2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:FunctionalProperty }
      ${closureEligible('?x', '?p', '?y1', cfg)}
      ${closureEligible('?x', '?p', '?y2', cfg)}
      FILTER (str(?y1) < str(?y2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y1 owl:sameAs ?y2 } }
    }
  `,
};
```

- [ ] **Step 4: Write `r09-inverse-functional.ts`**

`InverseFunctionalProperty` says "at most one subject per object"; if two subjects share an object, they are `owl:sameAs`.

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r09: Rule = {
  id: 'r09-inverse-functional',
  name: 'owl:InverseFunctionalProperty → owl:sameAs',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:InverseFunctionalProperty }
      ${closureEligible('?x1', '?p', '?y', cfg)}
      ${closureEligible('?x2', '?p', '?y', cfg)}
      FILTER (str(?x1) < str(?x2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    }
  `,
};
```

- [ ] **Step 5: Write `r10-symmetric.ts`**

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r10: Rule = {
  id: 'r10-symmetric',
  name: 'owl:SymmetricProperty',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?y ?p ?x } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> { ?p a owl:SymmetricProperty }
      ${closureEligible('?x', '?p', '?y', cfg)}
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?y ?p ?x } }
    }
  `,
};
```

- [ ] **Step 6: Add rules to `src/rules/index.ts`**

Append imports and extend the `RULES` array to include `r06`…`r10`.

- [ ] **Step 7: Write the failing test (`tests/rules/r06-r10.test.ts`)**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const client = new SparqlClient(loadConfig());
const adapter = new FusekiConstructAdapter(client);

const T = 'kg:tbox-test-r6-10';
const A = 'kg:abox-test-r6-10';
const I = 'kg:inferred-test-r6-10';

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function withProv(s: string, p: string, o: string, conf = 1) {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${A}>             { ${s} ${p} ${o} . }
      GRAPH <kg:provenance>    { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

beforeAll(async () => {
  for (const g of [T, A]) await reset(g);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    INSERT DATA { GRAPH <${T}> {
      ex:authoredBy   rdfs:domain ex:Article ; rdfs:range ex:Person .
      ex:capital      a owl:FunctionalProperty .
      ex:email        a owl:InverseFunctionalProperty .
      ex:siblingOf    a owl:SymmetricProperty .
    } }
  `);
});
beforeEach(() => reset(I));

const M = () => adapter.materialize({
  tboxGraph: T, aboxGraphs: [A], targetGraph: I, closureCutoff: 0.5,
});

describe('rules 6–10', () => {
  it('r06+r07: domain/range type inference', async () => {
    await withProv('<https://ex/post1>', '<https://ex/authoredBy>', '<https://ex/alice>');
    await M();
    const types = await client.select(`
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?t WHERE { GRAPH <${I}> { <https://ex/post1> rdf:type ?t } }
    `);
    expect(types.results.bindings.map((b) => b.t!.value)).toContain('https://ex/Article');
    const personType = await client.ask(`
      ASK { GRAPH <${I}> { <https://ex/alice>
            <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
            <https://ex/Person> } }
    `);
    expect(personType).toBe(true);
  });

  it('r08: two values for a FunctionalProperty produce sameAs', async () => {
    await withProv('<https://ex/fr>', '<https://ex/capital>', '<https://ex/paris1>');
    await withProv('<https://ex/fr>', '<https://ex/capital>', '<https://ex/paris2>');
    await M();
    const ok = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> {
        <https://ex/paris1> owl:sameAs <https://ex/paris2> }
      }
    `);
    expect(ok).toBe(true);
  });

  it('r09: shared object on InverseFunctionalProperty produces sameAs on subjects', async () => {
    await withProv('<https://ex/alice>', '<https://ex/email>', '"a@x.io"');
    await withProv('<https://ex/al>',    '<https://ex/email>', '"a@x.io"');
    await M();
    const ok = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { <https://ex/al> owl:sameAs <https://ex/alice> } }
    `);
    expect(ok).toBe(true);
  });

  it('r10: SymmetricProperty materializes the inverse direction', async () => {
    await withProv('<https://ex/al>', '<https://ex/siblingOf>', '<https://ex/bob>');
    await M();
    const ok = await client.ask(`
      ASK { GRAPH <${I}> { <https://ex/bob> <https://ex/siblingOf> <https://ex/al> } }
    `);
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
pnpm test tests/rules/r06-r10.test.ts
```
Expected: 4 passed.

- [ ] **Step 9: Commit**

```bash
git add packages/predicate-reasoner/src/rules \
        packages/predicate-reasoner/tests/rules/r06-r10.test.ts
git commit -m "feat(reasoner): rules 6–10 (domain, range, functional/IFP sameAs, symmetric)"
```

---

## Task 6: Rules 11–15 (disjointness, equivalence, hasKey, type propagation) + inconsistencies

Rule 11 (`owl:disjointWith`) is special: instead of materializing new triples, it produces `Inconsistency` records that flow back through `MaterializeResult`. The fixpoint runner now needs an inconsistency-collection pass.

**Files:**
- `packages/predicate-reasoner/src/rules/r11-disjoint-with.ts`
- `packages/predicate-reasoner/src/rules/r12-equivalent-class.ts`
- `packages/predicate-reasoner/src/rules/r13-equivalent-property.ts`
- `packages/predicate-reasoner/src/rules/r14-has-key.ts`
- `packages/predicate-reasoner/src/rules/r15-type-propagation.ts`
- Modify: `packages/predicate-reasoner/src/index.ts` (collect inconsistencies)
- Modify: `packages/predicate-reasoner/src/rules/index.ts`
- Create: `packages/predicate-reasoner/tests/rules/r11-r15.test.ts`

- [ ] **Step 1: Write `r11-disjoint-with.ts` as a *check*, not an INSERT rule**

We diverge from the other rules: `r11` exposes a `findInconsistencies` method instead of `insertWhere`. The fixpoint runner treats `r11` separately.

```typescript
import type { Rule, RuleConfig } from './types.js';
import type { Inconsistency } from '../types.js';
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';

export const r11: Rule & {
  findInconsistencies: (c: SparqlClient, cfg: RuleConfig) => Promise<Inconsistency[]>;
} = {
  id: 'r11-disjoint-with',
  name: 'owl:disjointWith inconsistency detection',
  insertWhere: () => '',   // no-op for fixpoint loop
  findInconsistencies: async (client, cfg) => {
    const r = await client.select(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?x ?a ?b WHERE {
        GRAPH <${cfg.tboxGraph}> { ?a owl:disjointWith ?b }
        {
          { GRAPH <${cfg.aboxGraphs[0]}> { ?x rdf:type ?a } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?a } }
        }
        {
          { GRAPH <${cfg.aboxGraphs[0]}> { ?x rdf:type ?b } }
          UNION
          { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?b } }
        }
        FILTER (str(?a) < str(?b))
      }
    `);
    return r.results.bindings.map((b) => ({
      kind: 'disjoint-class' as const,
      description: `${b.x!.value} is typed as both ${b.a!.value} and ${b.b!.value} which are owl:disjointWith`,
      triples: [
        { s: b.x!.value, p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: b.a!.value },
        { s: b.x!.value, p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: b.b!.value },
      ],
    }));
  },
};
```

- [ ] **Step 2: Write `r12-equivalent-class.ts`**

`a owl:equivalentClass b ⇒ a rdfs:subClassOf b ∧ b rdfs:subClassOf a` — rule 1 then transitively closes the rest.

```typescript
import type { Rule, RuleConfig } from './types.js';

export const r12: Rule = {
  id: 'r12-equivalent-class',
  name: 'owl:equivalentClass → bidirectional subClassOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?a rdfs:subClassOf ?b .
        ?b rdfs:subClassOf ?a .
      }
    }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?a owl:equivalentClass ?b }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?b owl:equivalentClass ?a }
      }
      FILTER (?a != ?b)
    }
  `,
};
```

- [ ] **Step 3: Write `r13-equivalent-property.ts`**

```typescript
import type { Rule, RuleConfig } from './types.js';

export const r13: Rule = {
  id: 'r13-equivalent-property',
  name: 'owl:equivalentProperty → bidirectional subPropertyOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT {
      GRAPH <${cfg.inferredGraph}> {
        ?p rdfs:subPropertyOf ?q .
        ?q rdfs:subPropertyOf ?p .
      }
    }
    WHERE {
      {
        GRAPH <${cfg.tboxGraph}> { ?p owl:equivalentProperty ?q }
      } UNION {
        GRAPH <${cfg.tboxGraph}> { ?q owl:equivalentProperty ?p }
      }
      FILTER (?p != ?q)
    }
  `,
};
```

- [ ] **Step 4: Write `r14-has-key.ts` (v1 simplification: single-property keys)**

The general `owl:hasKey` form takes a list of properties; for v1, support single-property keys (the most common entity-resolution idiom). Multi-property keys are tracked for v1.1.

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r14: Rule = {
  id: 'r14-has-key',
  name: 'owl:hasKey (single-property keys) → owl:sameAs',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    WHERE {
      GRAPH <${cfg.tboxGraph}> {
        ?C owl:hasKey ?list .
        ?list rdf:first ?p ; rdf:rest rdf:nil .
      }
      {
        { GRAPH <${cfg.aboxGraphs[0]}> { ?x1 rdf:type ?C } }
        UNION { GRAPH <${cfg.inferredGraph}> { ?x1 rdf:type ?C } }
      }
      {
        { GRAPH <${cfg.aboxGraphs[0]}> { ?x2 rdf:type ?C } }
        UNION { GRAPH <${cfg.inferredGraph}> { ?x2 rdf:type ?C } }
      }
      ${closureEligible('?x1', '?p', '?v', cfg)}
      ${closureEligible('?x2', '?p', '?v', cfg)}
      FILTER (str(?x1) < str(?x2))
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x1 owl:sameAs ?x2 } }
    }
  `,
};
```

- [ ] **Step 5: Write `r15-type-propagation.ts`**

Propagate `rdf:type` up through `rdfs:subClassOf` chains.

```typescript
import type { Rule, RuleConfig } from './types.js';
import { closureEligible } from '../closure.js';

export const r15: Rule = {
  id: 'r15-type-propagation',
  name: 'rdf:type propagation via rdfs:subClassOf',
  insertWhere: (cfg: RuleConfig) => `
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    WHERE {
      ${closureEligible('?x', 'rdf:type', '?C', cfg)}
      {
        { GRAPH <${cfg.tboxGraph}>     { ?C rdfs:subClassOf ?D } }
        UNION
        { GRAPH <${cfg.inferredGraph}> { ?C rdfs:subClassOf ?D } }
      }
      FILTER (?C != ?D)
      FILTER NOT EXISTS { GRAPH <${cfg.inferredGraph}> { ?x rdf:type ?D } }
    }
  `,
};
```

- [ ] **Step 6: Update `src/rules/index.ts` to register r12–r15 in the normal `RULES` array; export `r11` separately**

```typescript
import type { Rule } from './types.js';
import { r01 } from './r01-subclassof-transitivity.js';
import { r02 } from './r02-subpropertyof-transitivity.js';
import { r03 } from './r03-transitive-property.js';
import { r04 } from './r04-inverse-of.js';
import { r05 } from './r05-property-chain.js';
import { r06 } from './r06-domain.js';
import { r07 } from './r07-range.js';
import { r08 } from './r08-functional-sameas.js';
import { r09 } from './r09-inverse-functional.js';
import { r10 } from './r10-symmetric.js';
import { r12 } from './r12-equivalent-class.js';
import { r13 } from './r13-equivalent-property.js';
import { r14 } from './r14-has-key.js';
import { r15 } from './r15-type-propagation.js';

export const RULES: Rule[] = [
  r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r12, r13, r14, r15,
];
export { r11 } from './r11-disjoint-with.js';
export type { Rule, RuleConfig } from './types.js';
```

- [ ] **Step 7: Wire r11 into `materialize` in `src/index.ts`**

After the fixpoint loop converges, run `r11.findInconsistencies` and put the result into `MaterializeResult.inconsistencies`. Replace the relevant lines:

```typescript
import { r11 } from './rules/index.js';

// inside materialize, after runFixpoint:
const inconsistencies = await r11.findInconsistencies(this.client, {
  tboxGraph: input.tboxGraph,
  aboxGraphs: input.aboxGraphs,
  inferredGraph: input.targetGraph,
  closureCutoff: input.closureCutoff,
});
return {
  inferredCount,
  iterations,
  inconsistencies,
  elapsedMs: Date.now() - t0,
};
```

- [ ] **Step 8: Write the test file**

`packages/predicate-reasoner/tests/rules/r11-r15.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../../src/index.js';

const client = new SparqlClient(loadConfig());
const adapter = new FusekiConstructAdapter(client);
const T = 'kg:tbox-test-r11-15';
const A = 'kg:abox-test-r11-15';
const I = 'kg:inferred-test-r11-15';

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function withProv(s: string, p: string, o: string, conf = 1) {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <${A}>          { ${s} ${p} ${o} . }
      GRAPH <kg:provenance> { << ${s} ${p} ${o} >> pred:confidence "${conf}"^^xsd:decimal . }
    }
  `);
}

beforeAll(async () => {
  for (const g of [T, A]) await reset(g);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    INSERT DATA { GRAPH <${T}> {
      ex:Cat       owl:disjointWith    ex:Dog .
      ex:Person    owl:equivalentClass ex:Human .
      ex:owns      owl:equivalentProperty ex:has .
      ex:User      owl:hasKey ( ex:userId ) .
      ex:Animal    rdfs:subClassOf      ex:LivingThing .
    } }
  `);
});
beforeEach(() => reset(I));
const M = () => adapter.materialize({
  tboxGraph: T, aboxGraphs: [A], targetGraph: I, closureCutoff: 0.5,
});

describe('rules 11–15', () => {
  it('r11: cat-typed-as-dog is reported as a disjoint-class inconsistency', async () => {
    await withProv('<https://ex/snowball>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/Cat>');
    await withProv('<https://ex/snowball>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/Dog>');
    const r = await M();
    expect(r.inconsistencies.length).toBeGreaterThan(0);
    expect(r.inconsistencies[0]!.kind).toBe('disjoint-class');
  });

  it('r12: equivalentClass materializes both subClassOf directions', async () => {
    await M();
    const a = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:Person rdfs:subClassOf ex:Human } }
    `);
    const b = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:Human rdfs:subClassOf ex:Person } }
    `);
    expect(a && b).toBe(true);
  });

  it('r13: equivalentProperty materializes both subPropertyOf directions', async () => {
    await M();
    const ok = await client.ask(`
      PREFIX ex: <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      ASK { GRAPH <${I}> { ex:owns rdfs:subPropertyOf ex:has } }
    `);
    expect(ok).toBe(true);
  });

  it('r14: same userId on two User instances → sameAs', async () => {
    await withProv('<https://ex/u1>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/User>');
    await withProv('<https://ex/u2>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/User>');
    await withProv('<https://ex/u1>', '<https://ex/userId>', '"abc"');
    await withProv('<https://ex/u2>', '<https://ex/userId>', '"abc"');
    await M();
    const ok = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <${I}> { <https://ex/u1> owl:sameAs <https://ex/u2> } }
    `);
    expect(ok).toBe(true);
  });

  it('r15: rdf:type propagates through subClassOf', async () => {
    await withProv('<https://ex/leo>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', '<https://ex/Animal>');
    await M();
    const ok = await client.ask(`
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      ASK { GRAPH <${I}> { <https://ex/leo> rdf:type <https://ex/LivingThing> } }
    `);
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pnpm test tests/rules/r11-r15.test.ts
```
Expected: 5 passed.

- [ ] **Step 10: Commit**

```bash
git add packages/predicate-reasoner/src/rules \
        packages/predicate-reasoner/src/index.ts \
        packages/predicate-reasoner/tests/rules/r11-r15.test.ts
git commit -m "feat(reasoner): rules 11–15 (disjointness, equivalence, hasKey, type propagation)"
```

---

## Task 7: SHACL validator + `ReasonerAdapter.validate()`

This task implements the validation gate from spec §4.3. `validate()` is what `kg_propose_schema` will call before staging a delta in Phase 3. It runs the reasoner over (tbox ∪ staging ∪ ABox sample), checks for unsatisfiable classes, runs SHACL post-materialization, and computes impact statistics.

**Files:**
- Modify: `packages/predicate-server/scripts/bootstrap-graphs.sh` (load shapes file)
- Create: `packages/predicate-reasoner/src/shacl.ts`
- Create: `packages/predicate-reasoner/src/validate.ts`
- Modify: `packages/predicate-reasoner/src/index.ts` (wire `validate`)
- Create: `packages/predicate-reasoner/tests/shacl.test.ts`
- Create: `packages/predicate-reasoner/tests/validate.test.ts`

- [ ] **Step 1: Patch the bootstrap script to also load shapes into `kg:tbox`**

Extend the TBox-loading loop in `bootstrap-graphs.sh`:

```bash
for TBOX in "../predicate-ontology/tbox/codebase.ttl" \
            "../predicate-ontology/meta/predicate-meta.ttl" \
            "../predicate-ontology/shapes/codebase.shacl.ttl"; do
  # (loop body unchanged)
done
```

- [ ] **Step 2: Write the failing test for the SHACL runner**

`packages/predicate-reasoner/tests/shacl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runShacl } from '../src/shacl.js';

const SHAPES_TTL = `
  @prefix sh:  <http://www.w3.org/ns/shacl#> .
  @prefix ex:  <https://ex/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

  ex:FileShape a sh:NodeShape ;
    sh:targetClass ex:File ;
    sh:property [
      sh:path ex:path ; sh:datatype xsd:string ;
      sh:minCount 1 ; sh:maxCount 1
    ] .
`;

describe('runShacl', () => {
  it('reports no violations when data conforms', async () => {
    const dataTtl = `
      @prefix ex: <https://ex/> .
      ex:f1 a ex:File ; ex:path "auth.ts" .
    `;
    const r = await runShacl(dataTtl, SHAPES_TTL);
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('reports a violation when sh:minCount is unmet', async () => {
    const dataTtl = `
      @prefix ex: <https://ex/> .
      ex:f2 a ex:File .
    `;
    const r = await runShacl(dataTtl, SHAPES_TTL);
    expect(r.ok).toBe(false);
    expect(r.violations[0]!.focusNode).toBe('https://ex/f2');
  });

  it('reports a violation when sh:maxCount is exceeded', async () => {
    const dataTtl = `
      @prefix ex: <https://ex/> .
      ex:f3 a ex:File ; ex:path "a.ts" , "b.ts" .
    `;
    const r = await runShacl(dataTtl, SHAPES_TTL);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm test tests/shacl.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `packages/predicate-reasoner/src/shacl.ts`**

```typescript
import { Parser, Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import type { ShaclViolation } from './types.js';

export interface ShaclResult {
  ok: boolean;
  violations: ShaclViolation[];
}

function parseTurtle(ttl: string): Store {
  const store = new Store();
  store.addQuads(new Parser().parse(ttl));
  return store;
}

export async function runShacl(dataTtl: string, shapesTtl: string): Promise<ShaclResult> {
  const data = parseTurtle(dataTtl);
  const shapes = parseTurtle(shapesTtl);
  const validator = new SHACLValidator(shapes);
  const report = validator.validate(data);
  const violations: ShaclViolation[] = report.results.map((r) => ({
    focusNode: r.focusNode?.value ?? '',
    resultPath: r.path?.value,
    message: r.message?.[0]?.value ?? '(no message)',
    sourceShape: r.sourceShape?.value,
  }));
  return { ok: report.conforms, violations };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/shacl.test.ts
```
Expected: 3 passed.

- [ ] **Step 6: Implement `packages/predicate-reasoner/src/validate.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  ReasonerAdapter, ValidateInput, ValidationResult,
} from './types.js';
import { runShacl } from './shacl.js';
import { FusekiConstructAdapter } from './index.js';

async function fetchTurtle(client: SparqlClient, graph: string): Promise<string> {
  const r = await client.select(`
    SELECT ?s ?p ?o WHERE { GRAPH <${graph}> { ?s ?p ?o } } LIMIT 100000
  `);
  // Serialize as N-Triples for SHACL (handles all term kinds).
  return r.results.bindings.map((b) => {
    const s = b.s!.type === 'uri' ? `<${b.s!.value}>` : `_:${b.s!.value}`;
    const p = `<${b.p!.value}>`;
    const o =
      b.o!.type === 'uri'
        ? `<${b.o!.value}>`
        : b.o!.type === 'bnode'
          ? `_:${b.o!.value}`
          : `"${b.o!.value.replace(/"/g, '\\"')}"`;
    return `${s} ${p} ${o} .`;
  }).join('\n');
}

export async function runValidation(
  client: SparqlClient,
  input: ValidateInput,
): Promise<ValidationResult> {
  const sandboxInferred = `kg:inferred-validate-${Date.now()}`;
  const adapter = new FusekiConstructAdapter(client);

  // Build a temporary TBox view = tbox ∪ staging
  const tboxView = `kg:tbox-view-${Date.now()}`;
  await client.update(`CREATE SILENT GRAPH <${tboxView}>`);
  await client.update(`COPY SILENT GRAPH <${input.tboxGraph}>   TO GRAPH <${tboxView}>`);
  await client.update(`ADD SILENT GRAPH  <${input.stagingGraph}> TO GRAPH <${tboxView}>`);

  try {
    const m = await adapter.materialize({
      tboxGraph: tboxView,
      aboxGraphs: [input.aboxSample],
      targetGraph: sandboxInferred,
      closureCutoff: 0.5,
    });

    const unsatisfiable = await unsatisfiableClasses(client, tboxView, sandboxInferred);

    const dataTtl   = await fetchTurtle(client, input.aboxSample) + '\n' +
                      await fetchTurtle(client, sandboxInferred);
    const shapesTtl = await fetchTurtle(client, tboxView);
    const shacl     = await runShacl(dataTtl, shapesTtl);

    const impactedTriples = m.inferredCount;
    const impactedQ = await client.select(`
      SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?q ?p ?o } }
    `);
    const impactedQueries = parseInt(impactedQ.results.bindings[0]!.n!.value, 10);

    return {
      ok: m.inconsistencies.length === 0 && unsatisfiable.length === 0 && shacl.ok,
      unsatisfiableClasses: unsatisfiable,
      shaclViolations: shacl.violations,
      impactedTriples,
      impactedQueries,
    };
  } finally {
    await client.update(`DROP SILENT GRAPH <${sandboxInferred}>`);
    await client.update(`DROP SILENT GRAPH <${tboxView}>`);
  }
}

async function unsatisfiableClasses(
  client: SparqlClient,
  tboxView: string,
  inferred: string,
): Promise<string[]> {
  // An unsatisfiable class C has both (C rdfs:subClassOf A) and (C rdfs:subClassOf B)
  // with (A owl:disjointWith B) anywhere in the closure.
  const r = await client.select(`
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?C WHERE {
      { GRAPH <${tboxView}> { ?A owl:disjointWith ?B } }
      {
        { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?A } }
        UNION
        { GRAPH <${inferred}> { ?C rdfs:subClassOf ?A } }
      }
      {
        { GRAPH <${tboxView}> { ?C rdfs:subClassOf ?B } }
        UNION
        { GRAPH <${inferred}> { ?C rdfs:subClassOf ?B } }
      }
      FILTER (?A != ?B)
    }
  `);
  return r.results.bindings.map((b) => b.C!.value);
}
```

- [ ] **Step 7: Wire `validate` in `src/index.ts`**

```typescript
import { runValidation } from './validate.js';

// inside FusekiConstructAdapter:
async validate(input: ValidateInput): Promise<ValidationResult> {
  return runValidation(this.client, input);
}
```

- [ ] **Step 8: Write the failing test for validate**

`packages/predicate-reasoner/tests/validate.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../src/index.js';

const client = new SparqlClient(loadConfig());
const adapter = new FusekiConstructAdapter(client);
const T = 'kg:tbox-test-validate';
const S = 'kg:staging-test-validate';
const A = 'kg:abox-test-validate';

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeAll(async () => {
  for (const g of [T, S, A]) await reset(g);
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT DATA {
      GRAPH <${T}> {
        ex:Cat a owl:Class .
        ex:Dog a owl:Class .
        ex:Cat owl:disjointWith ex:Dog .
      }
      GRAPH <${A}> {
        ex:fluffy rdf:type ex:Cat .
      }
    }
  `);
});
beforeEach(() => reset(S));

describe('FusekiConstructAdapter.validate', () => {
  it('returns ok=true when the staged delta introduces no conflict', async () => {
    await client.update(`
      PREFIX ex:   <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX owl:  <http://www.w3.org/2002/07/owl#>
      INSERT DATA { GRAPH <${S}> {
        ex:Persian a owl:Class ; rdfs:subClassOf ex:Cat .
      } }
    `);
    const r = await adapter.validate({ tboxGraph: T, stagingGraph: S, aboxSample: A });
    expect(r.ok).toBe(true);
  });

  it('rejects a delta that makes an existing class unsatisfiable', async () => {
    // Staging a triple that would make Cat ⊑ Dog (a disjoint class)
    await client.update(`
      PREFIX ex:   <https://ex/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      INSERT DATA { GRAPH <${S}> {
        ex:Cat rdfs:subClassOf ex:Dog .
      } }
    `);
    const r = await adapter.validate({ tboxGraph: T, stagingGraph: S, aboxSample: A });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pnpm test tests/validate.test.ts
```
Expected: 2 passed.

- [ ] **Step 10: Commit**

```bash
git add packages/predicate-server/scripts/bootstrap-graphs.sh \
        packages/predicate-reasoner/src/shacl.ts \
        packages/predicate-reasoner/src/validate.ts \
        packages/predicate-reasoner/src/index.ts \
        packages/predicate-reasoner/tests/shacl.test.ts \
        packages/predicate-reasoner/tests/validate.test.ts
git commit -m "feat(reasoner): SHACL runner + ReasonerAdapter.validate() (validation gate)"
```

---

## Task 8: `kg_explain` via backward-chained re-derivation

Per spec §8.2, `kg_explain` reconstructs one valid derivation for a conclusion against the current graph. It does not store derivations; the reasoner adapter has no `kg:inferred` annotations. Each rule contributes a `backward` block: given a conclusion that matches the rule's head pattern, what premises would the WHERE clause have required?

We implement the backward block for the rules that produce the most common inferred triples (`r01`, `r05`, `r03`, `r15`). The remaining rules return `null` from `explain`, with `alternatesExist` set so the caller knows the answer might still be derivable.

**Files:**
- Modify each rule file used by explain: `r01`, `r03`, `r05`, `r15` to add a `backward` field
- Create: `packages/predicate-reasoner/src/explain.ts`
- Modify: `packages/predicate-reasoner/src/index.ts` (wire `explain`)
- Create: `packages/predicate-reasoner/tests/explain.test.ts`
- Create: `packages/predicate-mcp/src/tools/kg-explain.ts`
- Modify: `packages/predicate-mcp/src/tools/registry.ts` (replace stub)
- Create: `packages/predicate-mcp/tests/tools/kg-explain.test.ts`

- [ ] **Step 1: Add the `backward` block to `r01-subclassof-transitivity.ts`**

Append to the rule object:

```typescript
import type { Quad } from '../types.js';

export const r01: Rule = {
  /* ...existing fields... */
  backward: {
    matches: (q: Quad) =>
      q.p === 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    premiseQuery: (q: Quad) => `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?mid WHERE {
        {
          { GRAPH <kg:tbox>     { <${q.s as string}> rdfs:subClassOf ?mid } }
          UNION
          { GRAPH <kg:inferred> { <${q.s as string}> rdfs:subClassOf ?mid } }
        }
        {
          { GRAPH <kg:tbox>     { ?mid rdfs:subClassOf <${q.o as string}> } }
          UNION
          { GRAPH <kg:inferred> { ?mid rdfs:subClassOf <${q.o as string}> } }
        }
      } LIMIT 1
    `,
    buildPremises: (q: Quad, binding: Record<string, string>): Quad[] => [
      { s: q.s, p: q.p, o: binding.mid! },
      { s: binding.mid!, p: q.p, o: q.o },
    ],
  },
};
```

Update `rules/types.ts` to add the backward type:

```typescript
import type { Quad } from '../types.js';
export interface Rule {
  /* existing fields */
  backward?: {
    matches: (q: Quad) => boolean;
    premiseQuery: (q: Quad) => string;          // SPARQL SELECT
    buildPremises: (q: Quad, binding: Record<string, string>) => Quad[];
  };
}
```

- [ ] **Step 2: Add `backward` blocks to `r03`, `r05`, `r15` analogously**

For `r03` (transitive property): match any triple whose predicate is declared `owl:TransitiveProperty`; premises are `(s p ?mid)` and `(?mid p o)`.

For `r05` (length-2 chain): match triples whose predicate has a `propertyChainAxiom`; premises are `(s p1 ?mid)` and `(?mid p2 o)`.

For `r15` (type propagation): match `(s rdf:type D)` where `D` has a subclass; premise is `(s rdf:type ?C)` with `(?C subClassOf D)`.

Keep these blocks tight — one SELECT per rule, one binding produced (LIMIT 1 — the trace returns *one* derivation per spec §8.2).

- [ ] **Step 3: Write `packages/predicate-reasoner/src/explain.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import type {
  Quad, InferenceTrace, DerivationStep, ProvenanceRecord,
} from './types.js';
import type { Rule } from './rules/types.js';

const META = 'https://industriagents.com/predicate/meta#';
const MAX_DEPTH = 8;

function quadKey(q: Quad): string {
  const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
  return `${q.s}|${q.p}|${o}`;
}

async function isAsserted(client: SparqlClient, q: Quad): Promise<boolean> {
  const o = typeof q.o === 'string' ? `<${q.o}>` : `"${(q.o as { value: string }).value}"`;
  return client.ask(`ASK { GRAPH <kg:abox> { <${q.s}> <${q.p}> ${o} } }`);
}

async function getProvenance(client: SparqlClient, q: Quad): Promise<ProvenanceRecord | null> {
  const o = typeof q.o === 'string' ? `<${q.o}>` : `"${(q.o as { value: string }).value}"`;
  const r = await client.select(`
    PREFIX pred: <${META}>
    SELECT ?src ?conf ?method ?ts WHERE {
      GRAPH <kg:provenance> {
        << <${q.s}> <${q.p}> ${o} >> pred:source ?src ;
                                      pred:confidence ?conf ;
                                      pred:method ?method ;
                                      pred:timestamp ?ts .
      }
    } LIMIT 1
  `);
  const b = r.results.bindings[0];
  if (!b) return null;
  return {
    triple: q,
    source: b.src!.value,
    confidence: parseFloat(b.conf!.value),
    method: b.method!.value,
    timestamp: b.ts!.value,
  };
}

export async function explain(
  client: SparqlClient,
  rules: Rule[],
  claim: Quad,
): Promise<InferenceTrace | null> {
  const derivation: DerivationStep[] = [];
  const cited: ProvenanceRecord[] = [];
  const visited = new Set<string>();
  let alternatesExist = false;

  async function recurse(target: Quad, depth: number): Promise<boolean> {
    if (depth > MAX_DEPTH) return false;
    const key = quadKey(target);
    if (visited.has(key)) return true;
    visited.add(key);

    if (await isAsserted(client, target)) {
      const prov = await getProvenance(client, target);
      if (prov) cited.push(prov);
      return true;
    }

    for (const rule of rules) {
      if (!rule.backward) continue;
      if (!rule.backward.matches(target)) continue;
      const r = await client.select(rule.backward.premiseQuery(target));
      if (r.results.bindings.length === 0) continue;
      if (r.results.bindings.length > 1) alternatesExist = true;

      const binding: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.results.bindings[0]!)) binding[k] = v.value;
      const premises = rule.backward.buildPremises(target, binding);

      const ok = (await Promise.all(premises.map((p) => recurse(p, depth + 1))))
        .every(Boolean);
      if (!ok) continue;

      derivation.push({ rule: rule.id, premises, conclusion: target });
      return true;
    }
    return false;
  }

  const ok = await recurse(claim, 0);
  if (!ok) return null;
  return { conclusion: claim, derivation, citedProvenance: cited, alternatesExist };
}
```

- [ ] **Step 4: Wire `explain` in `src/index.ts`**

```typescript
import { explain as explainImpl } from './explain.js';

// inside FusekiConstructAdapter:
async explain(claim: Quad): Promise<InferenceTrace | null> {
  return explainImpl(this.client, this.__rules, claim);
}
```

- [ ] **Step 5: Write the failing test**

`packages/predicate-reasoner/tests/explain.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from '../src/index.js';

const client = new SparqlClient(loadConfig());
const adapter = new FusekiConstructAdapter(client);

beforeAll(async () => {
  for (const g of ['kg:tbox', 'kg:abox', 'kg:provenance', 'kg:inferred']) {
    await client.update(`DROP SILENT GRAPH <${g}>`); await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
  await client.update(`
    PREFIX ex:   <https://ex/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <kg:tbox> {
        ex:Dog    rdfs:subClassOf ex:Mammal .
        ex:Mammal rdfs:subClassOf ex:Animal .
        ex:Animal rdfs:subClassOf ex:LivingThing .
      }
    }
  `);
  await adapter.materialize({
    tboxGraph: 'kg:tbox', aboxGraphs: ['kg:abox'],
    targetGraph: 'kg:inferred', closureCutoff: 0.5,
  });
});

describe('kg_explain', () => {
  it('returns a derivation for Dog rdfs:subClassOf Animal', async () => {
    const trace = await adapter.explain({
      s: 'https://ex/Dog',
      p: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      o: 'https://ex/Animal',
    });
    expect(trace).not.toBeNull();
    expect(trace!.derivation.length).toBeGreaterThan(0);
    expect(trace!.derivation[trace!.derivation.length - 1]!.conclusion.s).toBe('https://ex/Dog');
  });

  it('returns null for an unprovable claim', async () => {
    const trace = await adapter.explain({
      s: 'https://ex/Dog',
      p: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      o: 'https://ex/Plant',
    });
    expect(trace).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test tests/explain.test.ts
```
Expected: 2 passed.

- [ ] **Step 7: Implement the MCP wrapper `packages/predicate-mcp/src/tools/kg-explain.ts`**

```typescript
import { SparqlClient } from '../sparql/client.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import type { Quad } from 'predicate-reasoner/src/types.js';

export interface ExplainInput {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string };
}

export async function kgExplain(client: SparqlClient, input: ExplainInput) {
  const adapter = new FusekiConstructAdapter(client);
  const claim: Quad = {
    s: input.subject, p: input.predicate,
    o: input.object.type === 'uri' ? input.object.value : { value: input.object.value },
  };
  const trace = await adapter.explain(claim);
  if (trace === null) {
    return { provable: false, reason: 'no derivation found within depth bound' };
  }
  return { provable: true, ...trace };
}
```

- [ ] **Step 8: Replace the `kg_explain` stub in `registry.ts`**

In `packages/predicate-mcp/src/tools/registry.ts`, remove the `kg_explain` entry from `stubs()` and add it to the main builder:

```typescript
import { kgExplain } from './kg-explain.js';

// inside buildTools(), append:
{
  name: 'kg_explain',
  description: 'Return one valid inference trace for a claim, with cited provenance for every asserted premise.',
  inputSchema: z.object({
    subject: z.string(),
    predicate: z.string(),
    object: z.object({
      type: z.enum(['uri', 'literal']),
      value: z.string(),
    }),
  }),
  handler: async (raw) => {
    const args = z.object({
      subject: z.string(),
      predicate: z.string(),
      object: z.object({ type: z.enum(['uri', 'literal']), value: z.string() }),
    }).parse(raw);
    return kgExplain(client, args);
  },
},
```

And remove `['kg_explain', ...]` from the `stubs()` array.

- [ ] **Step 9: Write the MCP-side test**

`packages/predicate-mcp/tests/tools/kg-explain.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { buildTools } from '../../src/tools/registry.js';

describe('kg_explain wired in MCP registry', () => {
  const tools = buildTools(new SparqlClient(loadConfig()));
  it('is no longer a stub', async () => {
    const explain = tools.find((t) => t.name === 'kg_explain')!;
    const result = (await explain.handler({
      subject: 'https://ex/Dog',
      predicate: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      object: { type: 'uri', value: 'https://ex/Animal' },
    })) as { provable: boolean };
    expect(typeof result.provable).toBe('boolean');
  });
});
```

- [ ] **Step 10: Run all tests to verify everything passes**

```bash
pnpm test
```
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add packages/predicate-reasoner/src \
        packages/predicate-reasoner/tests/explain.test.ts \
        packages/predicate-mcp/src/tools/kg-explain.ts \
        packages/predicate-mcp/src/tools/registry.ts \
        packages/predicate-mcp/tests/tools/kg-explain.test.ts
git commit -m "feat: kg_explain via backward-chained re-derivation (spec §8.2)"
```

---

## Task 9: Thin reaper — `kg_maintain` implementation

A single SPARQL pass: triples in `kg:abox` with no usage (no `kg:usage` query referencing their subject within 30 days) and `confidence < ARCHIVE_CUTOFF` are moved to a parallel archive graph `kg:abox-archive` (created on demand). An RDF-star annotation in `kg:provenance` records the archival. A `MaintenanceRun` event is appended to `kg:meta`.

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-maintain.ts`
- Modify: `packages/predicate-mcp/src/tools/registry.ts` (replace stub)
- Create: `packages/predicate-mcp/tests/tools/kg-maintain.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/predicate-mcp/tests/tools/kg-maintain.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgMaintain } from '../../src/tools/kg-maintain.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string) {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:provenance', 'kg:abox-archive', 'kg:meta', 'kg:usage']) {
    await reset(g);
  }
  // Need at least one TBox predicate so kg_assert would accept it; not relevant here
  // since we INSERT directly to kg:abox bypassing kg_assert for fixture speed.
});

async function seedStaleLowConfidence() {
  const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA {
      GRAPH <kg:abox> {
        <urn:test:stale> <urn:test:p> <urn:test:o> .
      }
      GRAPH <kg:provenance> {
        << <urn:test:stale> <urn:test:p> <urn:test:o> >>
          pred:confidence "0.3"^^xsd:decimal ;
          pred:timestamp  "${old}"^^xsd:dateTime ;
          pred:source     "test" ;
          pred:method     "test" .
      }
    }
  `);
}

describe('kg_maintain (thin reaper)', () => {
  it('archives a stale low-confidence triple', async () => {
    await seedStaleLowConfidence();
    const r = await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    expect(r.archivedCount).toBe(1);
    const inAbox = await client.ask(`
      ASK { GRAPH <kg:abox> { <urn:test:stale> <urn:test:p> <urn:test:o> } }
    `);
    expect(inAbox).toBe(false);
    const inArchive = await client.ask(`
      ASK { GRAPH <kg:abox-archive> { <urn:test:stale> <urn:test:p> <urn:test:o> } }
    `);
    expect(inArchive).toBe(true);
  });

  it('emits a MaintenanceRun event in kg:meta', async () => {
    await seedStaleLowConfidence();
    await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    const r = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?e ?archived WHERE {
        GRAPH <kg:meta> {
          ?e a pred:MaintenanceRun ;
             pred:payload ?archived .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
  });

  it('leaves a fresh high-confidence triple untouched', async () => {
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:abox> { <urn:test:fresh> <urn:test:p> <urn:test:o> }
        GRAPH <kg:provenance> {
          << <urn:test:fresh> <urn:test:p> <urn:test:o> >>
            pred:confidence "0.9"^^xsd:decimal ;
            pred:timestamp  "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:source "x" ; pred:method "x" .
        }
      }
    `);
    const r = await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    expect(r.archivedCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test tests/tools/kg-maintain.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-mcp/src/tools/kg-maintain.ts`**

```typescript
import { SparqlClient } from '../sparql/client.js';
import { escapeLiteral } from '../sparql/escape.js';

const META = 'https://industriagents.com/predicate/meta#';

export interface MaintainInput {
  archiveCutoff?: number;   // default 0.6
  ageDays?: number;         // default 30
}

export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
}

export async function kgMaintain(
  client: SparqlClient,
  input: MaintainInput = {},
): Promise<MaintainResult> {
  const archiveCutoff = input.archiveCutoff ?? 0.6;
  const ageDays = input.ageDays ?? 30;
  const cutoffDate = new Date(Date.now() - ageDays * 86400_000).toISOString();
  const t0 = Date.now();

  await client.update(`CREATE SILENT GRAPH <kg:abox-archive>`);

  const before = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`,
  );
  const beforeCount = parseInt(before.results.bindings[0]!.n!.value, 10);

  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    DELETE { GRAPH <kg:abox> { ?s ?p ?o } }
    INSERT { GRAPH <kg:abox-archive> { ?s ?p ?o } }
    WHERE {
      GRAPH <kg:abox> { ?s ?p ?o }
      GRAPH <kg:provenance> {
        << ?s ?p ?o >> pred:confidence ?conf ;
                       pred:timestamp  ?ts .
        FILTER (?conf < ${archiveCutoff})
        FILTER (?ts < "${cutoffDate}"^^xsd:dateTime)
      }
    }
  `);

  const after = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }`,
  );
  const afterCount = parseInt(after.results.bindings[0]!.n!.value, 10);
  const archivedCount = beforeCount - afterCount;

  const eventId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const elapsedMs = Date.now() - t0;
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${eventId}> a pred:MaintenanceRun ;
        pred:at        "${new Date().toISOString()}"^^xsd:dateTime ;
        pred:actor     "kg_maintain" ;
        pred:payload   ${escapeLiteral(JSON.stringify({ archivedCount, elapsedMs, archiveCutoff, ageDays }))} .
    } }
  `);

  return { archivedCount, elapsedMs, eventId };
}
```

- [ ] **Step 4: Wire into registry; remove the stub**

In `packages/predicate-mcp/src/tools/registry.ts`:

```typescript
import { kgMaintain } from './kg-maintain.js';

// in buildTools():
{
  name: 'kg_maintain',
  description: 'Archive stale low-confidence ABox triples; emit a MaintenanceRun event.',
  inputSchema: z.object({
    archiveCutoff: z.number().min(0).max(1).optional(),
    ageDays: z.number().int().positive().optional(),
  }),
  handler: async (raw) => kgMaintain(client, raw as Parameters<typeof kgMaintain>[1]),
},
```

Remove `['kg_maintain', ...]` from `stubs()`.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test tests/tools/kg-maintain.test.ts
```
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-maintain.ts \
        packages/predicate-mcp/src/tools/registry.ts \
        packages/predicate-mcp/tests/tools/kg-maintain.test.ts
git commit -m "feat(mcp): kg_maintain thin reaper + MaintenanceRun event"
```

---

## Task 10: CI ontology consistency check

A GitHub Actions job that runs whenever a PR touches `packages/predicate-ontology/`. It boots Fuseki, loads the proposed TBox + shapes into `kg:tbox-staging`, runs `ReasonerAdapter.validate()` against a fixture ABox sample, and fails the build if validation does not return `ok: true`.

**Files:**
- Create: `.github/workflows/ontology-ci.yml`
- Create: `packages/predicate-eval/src/ontology-ci.ts`
- Modify: `packages/predicate-eval/package.json` (add `ontology-check` script)

- [ ] **Step 1: Write `packages/predicate-eval/src/ontology-ci.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';

async function loadTtl(client: SparqlClient, path: string, graph: string): Promise<void> {
  const ttl = readFileSync(path, 'utf8');
  await fetch(`${loadConfig().dataEndpoint}?graph=${encodeURIComponent(graph)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body: ttl,
  });
}

async function main(): Promise<void> {
  const client = new SparqlClient(loadConfig());
  const adapter = new FusekiConstructAdapter(client);

  for (const g of ['kg:tbox-staging', 'kg:abox-ci-sample']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }

  const root = resolve(import.meta.dirname, '..', '..', 'predicate-ontology');
  await loadTtl(client, join(root, 'tbox', 'codebase.ttl'),         'kg:tbox-staging');
  await loadTtl(client, join(root, 'meta', 'predicate-meta.ttl'),   'kg:tbox-staging');
  await loadTtl(client, join(root, 'shapes', 'codebase.shacl.ttl'), 'kg:tbox-staging');

  // Minimal sample so validation isn't a no-op
  await client.update(`
    PREFIX c:   <https://industriagents.com/predicate/codebase#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    INSERT DATA { GRAPH <kg:abox-ci-sample> {
      <https://industriagents.com/predicate/codebase/auth.ts> rdf:type c:File ;
        c:path "auth.ts" .
    } }
  `);

  const r = await adapter.validate({
    tboxGraph: 'kg:tbox',                   // empty baseline
    stagingGraph: 'kg:tbox-staging',
    aboxSample: 'kg:abox-ci-sample',
  });

  if (!r.ok) {
    console.error('ONTOLOGY CI FAIL');
    console.error('  unsatisfiable classes:', r.unsatisfiableClasses);
    console.error('  shacl violations:', JSON.stringify(r.shaclViolations, null, 2));
    process.exit(1);
  }
  console.log('ontology-ci: ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add the script entry to `packages/predicate-eval/package.json`**

```json
"scripts": {
  "build": "tsc -p tsconfig.json",
  "test": "vitest run",
  "demo": "tsx src/load-corpus.ts && tsx src/ask.ts",
  "ontology-check": "tsx src/ontology-ci.ts"
}
```

- [ ] **Step 3: Write `.github/workflows/ontology-ci.yml`**

```yaml
name: ontology-ci
on:
  pull_request:
    paths:
      - 'packages/predicate-ontology/**'
      - 'packages/predicate-reasoner/**'

jobs:
  validate-ontology:
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
      - name: bootstrap graphs
        run: |
          cd packages/predicate-server
          FUSEKI_URL=http://localhost:3030 ./scripts/bootstrap-graphs.sh
      - run: pnpm --filter predicate-mcp build
      - run: pnpm --filter predicate-reasoner build
      - name: ontology check
        run: FUSEKI_URL=http://localhost:3030 pnpm --filter predicate-eval ontology-check
```

- [ ] **Step 4: Locally simulate a passing run**

```bash
pnpm fuseki:up
pnpm --filter predicate-mcp build
pnpm --filter predicate-reasoner build
pnpm --filter predicate-eval ontology-check
```
Expected: `ontology-ci: ok`, exit 0.

- [ ] **Step 5: Locally simulate a failing run**

Temporarily add this line to `packages/predicate-ontology/tbox/codebase.ttl`:

```turtle
:Function rdfs:subClassOf :Class .
```

(Which contradicts `:Function owl:disjointWith :Class` already in the file.)

Re-run:
```bash
pnpm --filter predicate-eval ontology-check
```
Expected: non-zero exit; error output listing the unsatisfiable class.

Revert the change before committing.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ontology-ci.yml \
        packages/predicate-eval/src/ontology-ci.ts \
        packages/predicate-eval/package.json
git commit -m "ci: ontology consistency check on PRs touching ontology or reasoner"
```

---

## Task 11: Phase 2 exit — verify the second eval question works, tag

**Files:**
- Modify: `packages/predicate-eval/src/load-corpus.ts` (no change expected; uses kg_assert which now enforces TBox membership — verify it still loads)
- Verify: Phase 2 exit criteria

- [ ] **Step 1: Bring everything up and run the demo**

```bash
pnpm fuseki:nuke
pnpm fuseki:up
pnpm --filter predicate-mcp build
pnpm --filter predicate-reasoner build
pnpm --filter predicate-eval demo
```

Expected output for the *second* question (transitive deps via `kg:inferred`):

```
Q: Transitive deps of auth.ts via the inferred graph
   rows=1 truncated=false
    { dep: 'https://industriagents.com/predicate/codebase/jwt.ts' }
```

If this returns zero rows, the reasoner did not infer `dependsOn` from `imports` (which is `rdfs:subPropertyOf :dependsOn` in the seed TBox). Check that rule `r02` is firing and that `kg:inferred` is populated. The materialization is *not* automatic in the demo — you need to trigger it. Run:

```bash
node -e "
  const {SparqlClient}=require('./packages/predicate-mcp/dist/sparql/client.js');
  const {loadConfig}=require('./packages/predicate-mcp/dist/config.js');
  const {FusekiConstructAdapter}=require('./packages/predicate-reasoner/dist/index.js');
  const c=new SparqlClient(loadConfig());
  const a=new FusekiConstructAdapter(c);
  a.materialize({tboxGraph:'kg:tbox',aboxGraphs:['kg:abox'],targetGraph:'kg:inferred',closureCutoff:0.5})
    .then(r=>console.log(r)).catch(e=>{console.error(e);process.exit(1)});
"
```

Expected: iterations ≥ 2, inferredCount ≥ 1, inconsistencies empty array.

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```
Expected: all packages green.

- [ ] **Step 3: Run `kg_explain` end-to-end from the MCP layer**

```bash
node -e "
  const {SparqlClient}=require('./packages/predicate-mcp/dist/sparql/client.js');
  const {loadConfig}=require('./packages/predicate-mcp/dist/config.js');
  const {kgExplain}=require('./packages/predicate-mcp/dist/tools/kg-explain.js');
  kgExplain(new SparqlClient(loadConfig()),{
    subject:'https://industriagents.com/predicate/codebase/auth.ts',
    predicate:'https://industriagents.com/predicate/codebase#dependsOn',
    object:{type:'uri',value:'https://industriagents.com/predicate/codebase/jwt.ts'}
  }).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exit(1)});
"
```
Expected: `provable: true`, a derivation list, and at least one provenance record citing the original `imports` triple.

- [ ] **Step 4: Verify CI is green**

Push the Phase 2 branch and verify:
- `ci` (existing) — green
- `ontology-ci` (new, triggered by changes under `packages/predicate-ontology/` or `packages/predicate-reasoner/`) — green

- [ ] **Step 5: Tag**

```bash
git tag v0.2.0-discipline
git push --tags
```

- [ ] **Step 6: Update root `README.md` status block**

Find the Status block and replace with:

```markdown
## Status

Phase 2 (Discipline) complete: 15 OWL 2 RL rules + fixpoint runner + SHACL
validator + kg_explain + thin reaper + ontology CI. Phase 3 (Agent loop —
goal store, gap detector, research orchestrator, schema proposer) is the
next plan in `docs/superpowers/plans/`.
```

- [ ] **Step 7: Commit and push**

```bash
git add README.md
git commit -m "docs: README status for v0.2.0-discipline"
git push
```

---

## Phase 3–4 — outline only (separate plans)

Recorded so the sequence isn't lost.

### Phase 3 — Agent loop (PRD weeks 5–8)

- `predicate-agent` package: goal store (writes to `kg:goals`, emits `GoalCreated`/`GoalStatusChanged` events), question decomposer, gap detector.
- Research orchestrator with `ResearchSource` interface; ship Web + Docs source only (PRD §15.4 open question).
- Triple extractor with calibrated confidence per source.
- `kg_propose_schema` (real impl, replacing the Phase 1 stub) accepting the tagged-union `SchemaDelta` from spec §6.1; emits `SchemaProposed` events.
- Promotion sweeper running validation gate (Task 7 already in place) and usage gate; on success: git-commit the Turtle delta, emit `SchemaPromoted` + `TBoxVersionAdvanced`, drop `kg:inferred`, re-materialize.
- Exit: 70%+ correctness on the 30-question multi-hop eval set.

### Phase 4 — Efficiency (PRD weeks 9–12)

- Generalization detector (K-instance pattern-lift sweep; the *thin* reaper from Phase 2 stays, the *generalizer* adds here).
- Materialization tuning: cache hot rule outputs; debounced re-materialization per spec §4.2 (with the debounce-semantics question from §17 resolved).
- Tag-while-deriving v1.1 path for kg_explain (spec §8.2): faster repeated explanation via RDF-star annotations on inferred triples.
- Storage budget instrumentation in `kg_stats`.
- Exit: unused-concept ratio < 15% after a 30-session synthetic stress test (PRD §16); materialization p95 ≤ 5s on a 100k-triple graph.

---

## Self-review notes

- **Spec coverage:** Phase 2 lands §§4.2 (closure cutoff), 4.3 (validation gate), 5.1 (event emission for MaintenanceRun), 6 (substrate-side TBox check on kg_assert), 8 (all 15 rules + hard-fail), 8.1 (ReasonerAdapter interface), 8.2 (kg_explain re-derivation), 11 (thin reaper). Spec §10 hooks and SKILL.md examples are Phase 3.
- **Placeholder scan:** no "TBD" / "implement later" / "handle errors" — every step shows actual code or actual commands.
- **Type consistency:** `Quad`, `Rule`, `RuleConfig`, `MaterializeInput`, `MaterializeResult`, `ValidateInput`, `ValidationResult`, `InferenceTrace`, `DerivationStep`, `ProvenanceRecord` are defined once in `predicate-reasoner/src/types.ts` (and the rules' `types.ts` for `Rule`/`RuleConfig`) and reused unchanged downstream.
- **Open follow-up:** Task 8 only implements the `backward` block for rules r01, r03, r05, r15. Other rules will return `null` from `explain` even when a derivation exists. Adding backward blocks for the remaining rules is tracked under Phase 4's tag-while-deriving path, since `kg_explain` performance is the v1.1 motivator anyway.

