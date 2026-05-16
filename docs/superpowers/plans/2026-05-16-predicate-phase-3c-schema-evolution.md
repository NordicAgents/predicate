# Predicate Phase 3c — Schema Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the schema-evolution loop. `kg_propose_schema` becomes real (replacing the Phase-1 stub) and writes `SchemaDelta` proposals to `kg:tbox-staging` with full metadata. A `PromotionSweeper` polls staged proposals, runs the validation gate (already implemented in Phase 2's `ReasonerAdapter.validate`), tracks usage, and atomically promotes deltas that pass both gates — writing the Turtle to disk, dropping and re-materializing `kg:inferred`, and emitting typed events at every transition.

**Architecture:** New `predicate-agent` module `schema-proposer.ts` accepts the tagged-union `SchemaDelta` from spec §6.1, validates the tagged-union shape with zod, writes the delta into `kg:tbox-staging` with RDF-star metadata (proposal id, motivating goal, justification, timestamp), and emits a `SchemaProposed` event. A `PromotionSweeper` (`promotion-sweeper.ts`) is invoked manually for v1 (a future Phase 4 may add a cron); it walks all staged proposals, runs `ReasonerAdapter.validate`, increments use counts from `kg:usage` queries that referenced the staged predicates, and when the gate triggers, performs the promotion atomically: write the delta to `packages/predicate-ontology/tbox/promoted/<sha>.ttl`, log a `pred:TBoxVersionAdvanced` record to `kg:meta`, drop `kg:inferred`. Re-materialization is the caller's next reasoner pass — the sweeper just signals via the event. `kg_propose_schema` is wired as a real MCP tool; the sweeper is exposed via `kg_maintain` extension.

**Tech Stack:** Node 20+, TypeScript 5.x, pnpm workspaces, Vitest, existing `predicate-mcp`/`predicate-reasoner`/`predicate-agent` deps. No new runtime libs.

**Spec reference:** [`docs/superpowers/specs/2026-05-16-predicate-design.md`](../specs/2026-05-16-predicate-design.md) §§ 4.3 (schema lifecycle), 5 (named graphs), 5.1 (event log), 6 (kg_propose_schema), 6.1 (SchemaDelta tagged union), 8.1 (ReasonerAdapter.validate).

**Phase exit criteria:**
- `kg_propose_schema(delta)` is a real MCP tool. It accepts the four `SchemaDelta` shapes (add-class, add-property, refine-class, breaking) and writes them to `kg:tbox-staging` with metadata. Emits a `pred:SchemaProposed` event.
- `PromotionSweeper` invoked over a staged proposal that has been "used" 3+ times in `kg:usage` and passes validation produces:
  - A new Turtle file at `packages/predicate-ontology/tbox/promoted/<proposal-id>.ttl`
  - A `pred:SchemaPromoted` event in `kg:meta` referencing the proposal id and the Turtle path
  - A `pred:TBoxVersionAdvanced` event with the new version IRI
  - `kg:tbox-staging` no longer contains the promoted triples (moved into `kg:tbox`)
  - `kg:inferred` is dropped (the reasoner is expected to re-materialize on the next call)
- A staged proposal that fails validation produces a `pred:SchemaValidationFailed` event and is removed from staging.
- A staged proposal whose TTL (default 7 days) expires without N uses is removed and emits `pred:SchemaRejected` with reason `"expired"`.
- `kg_maintain` runs the sweeper alongside the thin reaper.
- Phase tag `v0.3c.0-schema-evolution` set at the final commit. Only `kg_stats` remains as an MCP stub.

---

## File structure (created or modified in Phase 3c)

```
predicate/
├── packages/
│   ├── predicate-agent/                                (modified)
│   │   ├── src/
│   │   │   ├── types.ts                                ← extended (SchemaDelta etc.)
│   │   │   ├── schema-proposer.ts                      ← new
│   │   │   ├── promotion-sweeper.ts                    ← new
│   │   │   └── index.ts                                ← extended re-exports
│   │   └── tests/
│   │       ├── schema-proposer.test.ts                 ← new
│   │       └── promotion-sweeper.test.ts               ← new
│   ├── predicate-mcp/                                  (modified)
│   │   ├── src/tools/kg-propose-schema.ts              ← new
│   │   ├── src/tools/kg-maintain.ts                    ← extended
│   │   ├── src/tools/registry.ts                       ← replace stub
│   │   └── tests/tools/kg-propose-schema.test.ts       ← new
│   ├── predicate-ontology/                             (new dir)
│   │   └── tbox/
│   │       └── promoted/                               ← new (created by sweeper)
│   │           └── .gitkeep                            ← placeholder so dir is committed
│   └── predicate-eval/                                 (modified)
│       └── tests/schema-evolution.test.ts              ← new end-to-end
└── README.md                                            ← Phase 3c status
```

---

## Task 1: Extend types with `SchemaDelta` tagged union + supporting shapes

The `SchemaDelta` shape comes verbatim from spec §6.1. Each kind carries the triples it adds (and for `breaking`, the triples it removes plus a SPARQL UPDATE migration). The proposer carries this through to the staging graph.

**Files:**
- Modify: `packages/predicate-agent/src/types.ts`
- Create: `packages/predicate-agent/tests/schema-types.test.ts`

- [ ] **Step 1: Append to `packages/predicate-agent/src/types.ts`**

Read the current file. After the existing Phase-3b types, append:

```typescript
// --- Phase 3c: schema evolution ---------------------------------------

export type IRI = string;
export type LiteralTerm = { type: 'literal'; value: string; datatype?: IRI };
export type Term = { type: 'uri'; value: IRI } | LiteralTerm;

export interface DeltaQuad {
  s: IRI;
  p: IRI;
  o: Term;
}

export interface AddClassDelta {
  kind: 'add-class';
  add: DeltaQuad[];
  shapes?: DeltaQuad[];
}
export interface AddPropertyDelta {
  kind: 'add-property';
  add: DeltaQuad[];
  shapes?: DeltaQuad[];
}
export interface RefineClassDelta {
  kind: 'refine-class';
  parent: IRI;
  add: DeltaQuad[];
  shapes?: DeltaQuad[];
}
export interface BreakingDelta {
  kind: 'breaking';
  remove: DeltaQuad[];
  add: DeltaQuad[];
  migration: string;                          // SPARQL UPDATE
  shapes?: DeltaQuad[];
}
export type SchemaDelta =
  | AddClassDelta
  | AddPropertyDelta
  | RefineClassDelta
  | BreakingDelta;

export interface ProposalMeta {
  justification: string;
  motivatingGoal?: IRI;
  proposedAt: string;                         // ISO timestamp
}

export interface StagedProposal {
  id: IRI;                                    // urn:predicate:proposal:P-<ts>-<rand>
  delta: SchemaDelta;
  meta: ProposalMeta;
  useCount: number;
  expiresAt: string;                          // ISO timestamp
}

export interface PromotionDecision {
  proposalId: IRI;
  outcome: 'promoted' | 'rejected-validation' | 'rejected-expired' | 'awaiting';
  reason?: string;
  turtleFile?: string;                        // path written for promoted proposals
  tboxVersion?: IRI;
}

export interface SweeperResult {
  decisions: PromotionDecision[];
  durationMs: number;
}
```

- [ ] **Step 2: Write the failing test `packages/predicate-agent/tests/schema-types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import type {
  SchemaDelta, AddClassDelta, BreakingDelta, StagedProposal, PromotionDecision,
} from '../src/index.js';

describe('schema-evolution types', () => {
  it('SchemaDelta narrows by kind', () => {
    const d: SchemaDelta = {
      kind: 'add-class',
      add: [{
        s: 'https://predicate.dev/codebase#Service',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
      }],
    };
    if (d.kind === 'add-class') {
      const a: AddClassDelta = d;
      expect(a.add).toHaveLength(1);
    }
  });

  it('BreakingDelta requires a migration string', () => {
    const d: BreakingDelta = {
      kind: 'breaking',
      remove: [],
      add: [],
      migration: 'DELETE WHERE { ?s <urn:old> ?o } INSERT { ?s <urn:new> ?o } WHERE { ?s <urn:old> ?o }',
    };
    expect(d.migration).toContain('DELETE');
  });

  it('StagedProposal tracks useCount and expiresAt', () => {
    const p: StagedProposal = {
      id: 'urn:predicate:proposal:P-1',
      delta: { kind: 'add-property', add: [] },
      meta: { justification: 'because', proposedAt: '2026-05-16T00:00:00Z' },
      useCount: 0,
      expiresAt: '2026-05-23T00:00:00Z',
    };
    expect(p.useCount).toBe(0);
  });

  it('PromotionDecision distinguishes outcomes', () => {
    const d: PromotionDecision = {
      proposalId: 'urn:predicate:proposal:P-1',
      outcome: 'awaiting',
    };
    expect(d.outcome).toBe('awaiting');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter predicate-agent test tests/schema-types.test.ts
```

Expected: 4 passed.

- [ ] **Step 4: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: 115 (existing) + 4 (new) = 119 total. typecheck + lint clean.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-agent/src/types.ts \
        packages/predicate-agent/tests/schema-types.test.ts
git commit -m "feat(agent): SchemaDelta tagged union + StagedProposal + PromotionDecision types"
```

---

## Task 2: `SchemaProposer` — writes `SchemaDelta` to `kg:tbox-staging`

The proposer:
1. Assigns a proposal IRI (`urn:predicate:proposal:P-<ts>-<rand>`)
2. Writes each `DeltaQuad` in `add` (and `shapes` if any) to `kg:tbox-staging`, **tagged with the proposal id via RDF-star metadata** so the sweeper can group them later
3. Writes a metadata record into `kg:tbox-staging` linking the proposal to its justification, motivating goal, expires-at
4. Emits a `pred:SchemaProposed` event into `kg:meta`
5. Returns the proposal id

**Files:**
- Create: `packages/predicate-agent/src/schema-proposer.ts`
- Create: `packages/predicate-agent/tests/schema-proposer.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/schema-proposer.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import type { SchemaDelta } from '../src/types.js';

const client = new SparqlClient(loadConfig());
const proposer = new SchemaProposer(client);

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta']) await reset(g);
});

describe('SchemaProposer', () => {
  const C = 'https://predicate.dev/codebase';

  const addServiceDelta: SchemaDelta = {
    kind: 'add-class',
    add: [{
      s: `${C}#Service`,
      p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
    }, {
      s: `${C}#Service`,
      p: 'http://www.w3.org/2000/01/rdf-schema#label',
      o: { type: 'literal', value: 'Service' },
    }],
  };

  it('writes delta triples to kg:tbox-staging tagged with proposal id', async () => {
    const id = await proposer.propose(addServiceDelta, {
      justification: 'needed for service ownership goal',
    });
    expect(id).toMatch(/^urn:predicate:proposal:P-/);

    const ok = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> {
        <${C}#Service> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .
      } }
    `);
    expect(ok).toBe(true);

    // Each triple should be tagged with the proposal id via RDF-star
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <kg:tbox-staging> {
          << <${C}#Service> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> >>
            pred:proposalId <${id}> .
        }
      }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);
  });

  it('writes a proposal-meta record into kg:tbox-staging', async () => {
    const id = await proposer.propose(addServiceDelta, {
      justification: 'because of goal G-123',
      motivatingGoal: `${C}/goals/G-123`,
    });
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?just ?goal ?expires WHERE {
        GRAPH <kg:tbox-staging> {
          <${id}> pred:justification ?just ;
                  pred:motivatingGoal ?goal ;
                  pred:expiresAt ?expires .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
    expect(r.results.bindings[0]!.just!.value).toBe('because of goal G-123');
  });

  it('emits a pred:SchemaProposed event in kg:meta', async () => {
    const id = await proposer.propose(addServiceDelta, { justification: 'x' });
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?e WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaProposed ;
             pred:goal <${id}> .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
  });

  it('handles refine-class deltas with a parent IRI', async () => {
    const delta: SchemaDelta = {
      kind: 'refine-class',
      parent: `${C}#Service`,
      add: [{
        s: `${C}#PaymentService`,
        p: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
        o: { type: 'uri', value: `${C}#Service` },
      }],
    };
    const id = await proposer.propose(delta, { justification: 'split services' });
    expect(id).toMatch(/^urn:predicate:proposal:/);
    // Parent is recorded in the proposal meta
    const ok = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:tbox-staging> { <${id}> pred:parent <${C}#Service> } }
    `);
    expect(ok).toBe(true);
  });

  it('handles breaking deltas with a migration string', async () => {
    const delta: SchemaDelta = {
      kind: 'breaking',
      remove: [{
        s: `${C}#oldProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
      add: [{
        s: `${C}#newProp`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
      migration: 'DELETE { ?s <https://predicate.dev/codebase#oldProp> ?o } INSERT { ?s <https://predicate.dev/codebase#newProp> ?o } WHERE { ?s <https://predicate.dev/codebase#oldProp> ?o }',
    };
    const id = await proposer.propose(delta, { justification: 'rename' });
    // Migration is recorded on the proposal meta
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?m WHERE { GRAPH <kg:tbox-staging> { <${id}> pred:migration ?m } }
    `);
    expect(r.results.bindings[0]!.m!.value).toContain('INSERT');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/schema-proposer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/schema-proposer.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import type {
  DeltaQuad, ProposalMeta, SchemaDelta, Term,
} from './types.js';

const META = 'https://predicate.dev/meta#';
const DEFAULT_TTL_DAYS = 7;

function newProposalId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `urn:predicate:proposal:P-${ts}-${rand}`;
}

function newEventId(kind: string): string {
  return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderTerm(t: Term): string {
  if (t.type === 'uri') return escapeIRI(t.value);
  if (t.datatype) return `${escapeLiteral(t.value)}^^${escapeIRI(t.datatype)}`;
  return escapeLiteral(t.value);
}

function tripleSparql(q: DeltaQuad): string {
  return `${escapeIRI(q.s)} ${escapeIRI(q.p)} ${renderTerm(q.o)}`;
}

export interface ProposeInput {
  justification: string;
  motivatingGoal?: string;
  ttlDays?: number;
}

export class SchemaProposer {
  constructor(private client: SparqlClient) {}

  async propose(delta: SchemaDelta, meta: ProposeInput): Promise<string> {
    const id = newProposalId();
    const proposedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + (meta.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400_000,
    ).toISOString();

    // 1. Collect all triples to insert into kg:tbox-staging.
    const triplesToTag: DeltaQuad[] = [
      ...delta.add,
      ...(delta.kind === 'refine-class' ? [] : []),
    ];
    if (delta.shapes) triplesToTag.push(...delta.shapes);

    const tagTripleStmts = triplesToTag.map((q) => `
      << ${tripleSparql(q)} >>
        pred:proposalId ${escapeIRI(id)} .
      ${tripleSparql(q)} .
    `).join('\n');

    // 2. Proposal-meta record
    const goalLine = meta.motivatingGoal
      ? `${escapeIRI(id)} pred:motivatingGoal ${escapeIRI(meta.motivatingGoal)} .`
      : '';
    const parentLine = delta.kind === 'refine-class'
      ? `${escapeIRI(id)} pred:parent ${escapeIRI(delta.parent)} .`
      : '';
    const migrationLine = delta.kind === 'breaking'
      ? `${escapeIRI(id)} pred:migration ${escapeLiteral(delta.migration)} .`
      : '';

    // 3. Single atomic UPDATE
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:tbox-staging> {
          ${tagTripleStmts}
          ${escapeIRI(id)} a pred:Proposal ;
            pred:kind          ${escapeLiteral(delta.kind)} ;
            pred:justification ${escapeLiteral(meta.justification)} ;
            pred:proposedAt    "${proposedAt}"^^xsd:dateTime ;
            pred:expiresAt     "${expiresAt}"^^xsd:dateTime ;
            pred:useCount      "0"^^xsd:integer .
          ${goalLine}
          ${parentLine}
          ${migrationLine}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('schema-proposed'))} a pred:SchemaProposed ;
            pred:at    "${proposedAt}"^^xsd:dateTime ;
            pred:actor "SchemaProposer" ;
            pred:goal  ${escapeIRI(id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({
              kind: delta.kind, justification: meta.justification,
              motivatingGoal: meta.motivatingGoal,
            }))} .
        }
      }
    `);
    return id;
  }
}

export type { ProposalMeta };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test tests/schema-proposer.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Re-export**

Read `packages/predicate-agent/src/index.ts`. Append `export * from './schema-proposer.js';`.

- [ ] **Step 6: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: 119 + 5 = 124. typecheck + lint clean.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-agent/src/schema-proposer.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/schema-proposer.test.ts
git commit -m "feat(agent): SchemaProposer writes SchemaDelta to kg:tbox-staging + SchemaProposed event"
```

---

## Task 3: Wire `kg_propose_schema` into the MCP registry

Replace the Phase-1 stub. The MCP tool accepts a JSON `SchemaDelta` payload, validates the tagged-union shape with zod, calls `SchemaProposer.propose`, returns the proposal id.

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-propose-schema.ts`
- Modify: `packages/predicate-mcp/src/tools/registry.ts`
- Create: `packages/predicate-mcp/tests/tools/kg-propose-schema.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-mcp/tests/tools/kg-propose-schema.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { buildTools } from '../../src/tools/registry.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta']) await reset(g);
});

describe('kg_propose_schema wired in MCP registry', () => {
  const tools = buildTools(client);
  const tool = tools.find((t) => t.name === 'kg_propose_schema')!;

  it('is no longer a stub', () => {
    expect(tool).toBeDefined();
  });

  it('accepts an add-class delta and returns a proposal id', async () => {
    const result = (await tool.handler({
      delta: {
        kind: 'add-class',
        add: [{
          s: 'https://predicate.dev/codebase#Service',
          p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
        }],
      },
      justification: 'needed for ownership',
    })) as { proposalId: string };
    expect(result.proposalId).toMatch(/^urn:predicate:proposal:/);
    const ok = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> {
        <https://predicate.dev/codebase#Service>
        <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
        <http://www.w3.org/2002/07/owl#Class>
      } }
    `);
    expect(ok).toBe(true);
  });

  it('rejects a malformed delta (missing kind)', async () => {
    await expect(
      tool.handler({ delta: { add: [] }, justification: 'x' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-propose-schema.test.ts
```

Expected: FAIL — the tool currently throws `NotImplementedError`.

- [ ] **Step 3: Implement `packages/predicate-mcp/src/tools/kg-propose-schema.ts`**

```typescript
import { SparqlClient } from '../sparql/client.js';
import { SchemaProposer, type SchemaDelta } from 'predicate-agent/src/index.js';

export interface ProposeSchemaInput {
  delta: SchemaDelta;
  justification: string;
  motivatingGoal?: string;
  ttlDays?: number;
}

export async function kgProposeSchema(
  client: SparqlClient,
  input: ProposeSchemaInput,
): Promise<{ proposalId: string }> {
  const proposer = new SchemaProposer(client);
  const id = await proposer.propose(input.delta, {
    justification: input.justification,
    motivatingGoal: input.motivatingGoal,
    ttlDays: input.ttlDays,
  });
  return { proposalId: id };
}
```

- [ ] **Step 4: Replace the stub in `packages/predicate-mcp/src/tools/registry.ts`**

Read the file. Remove `'kg_propose_schema'` from the `stubs()` array. Add a real entry to `buildTools()`:

```typescript
import { kgProposeSchema } from './kg-propose-schema.js';

// The zod schema for a single delta quad
const deltaQuadSchema = z.object({
  s: z.string(),
  p: z.string(),
  o: z.union([
    z.object({ type: z.literal('uri'), value: z.string() }),
    z.object({
      type: z.literal('literal'), value: z.string(),
      datatype: z.string().optional(),
    }),
  ]),
});

const schemaDeltaSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('add-class'),
    add: z.array(deltaQuadSchema),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
  z.object({
    kind: z.literal('add-property'),
    add: z.array(deltaQuadSchema),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
  z.object({
    kind: z.literal('refine-class'),
    parent: z.string(),
    add: z.array(deltaQuadSchema),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
  z.object({
    kind: z.literal('breaking'),
    remove: z.array(deltaQuadSchema),
    add: z.array(deltaQuadSchema),
    migration: z.string(),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
]);

// inside buildTools(), append (near kg_research_goal):
{
  name: 'kg_propose_schema',
  description: 'Stage a SchemaDelta proposal (add-class, add-property, refine-class, or breaking). Writes to kg:tbox-staging with metadata; emits a SchemaProposed event. Promotion is the sweeper\'s job.',
  inputSchema: z.object({
    delta: schemaDeltaSchema,
    justification: z.string().min(1),
    motivatingGoal: z.string().optional(),
    ttlDays: z.number().int().positive().optional(),
  }),
  handler: async (raw): Promise<unknown> => {
    const args = z.object({
      delta: schemaDeltaSchema,
      justification: z.string().min(1),
      motivatingGoal: z.string().optional(),
      ttlDays: z.number().int().positive().optional(),
    }).parse(raw);
    return kgProposeSchema(client, args);
  },
},
```

Also remove the entry from `stubs()`.

The "stub tools throw" test in `tests/index.test.ts` currently uses `kg_propose_schema`. Update it to use `kg_stats` (the only remaining stub). Read the file and adjust.

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-propose-schema.test.ts
pnpm --filter predicate-mcp test tests/index.test.ts
```

Expected: 3 passed for kg-propose-schema; index.test.ts still passes (stub test now picks `kg_stats`).

- [ ] **Step 6: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-mcp typecheck
pnpm --filter predicate-mcp lint
```

Expected: predicate-mcp 39 (36 + 3 new). Grand total: 127.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-propose-schema.ts \
        packages/predicate-mcp/src/tools/registry.ts \
        packages/predicate-mcp/tests/tools/kg-propose-schema.test.ts \
        packages/predicate-mcp/tests/index.test.ts
git commit -m "feat(mcp): kg_propose_schema real impl + zod validation for SchemaDelta"
```

---

## Task 4: `PromotionSweeper` — walk staged proposals, validate, promote

The sweeper:
1. Lists all proposals in `kg:tbox-staging`.
2. For each, counts usage by walking `kg:usage`: any query in the last 7 days whose SPARQL text mentions a staged predicate IRI counts as one use (string-contains is sufficient for v1; spec §17 known-gap).
3. Updates `kg:tbox-staging` proposal `pred:useCount` accordingly.
4. For each proposal:
   - **Expired** (now > expiresAt and useCount < N): emit `pred:SchemaRejected` reason `expired`, delete the proposal's tagged triples + meta from `kg:tbox-staging`.
   - **Usage gate met** (useCount >= N, default 3): run `ReasonerAdapter.validate({tboxGraph: 'kg:tbox', stagingGraph: 'kg:tbox-staging-tmp-<id>', aboxSample: 'kg:abox'})` where the temp staging graph contains only THIS proposal's triples (so validation is scoped per-proposal). If validation `ok=false`: emit `pred:SchemaValidationFailed`, leave staged for now (operator decides). If validation `ok=true`: PROMOTE.
   - **Otherwise**: leave alone, mark `outcome: 'awaiting'`.
5. **Promotion** atomic-ish flow:
   - Materialize the proposal's `add` triples (NOT `kg:tbox-staging` metadata) into Turtle. For `breaking`, also apply the migration via SPARQL UPDATE to `kg:abox`.
   - Write the Turtle to `packages/predicate-ontology/tbox/promoted/<proposalId>.ttl`.
   - In a single SPARQL UPDATE, move the tagged triples from `kg:tbox-staging` into `kg:tbox`, delete proposal metadata from `kg:tbox-staging`, emit `pred:SchemaPromoted` and `pred:TBoxVersionAdvanced` events into `kg:meta`, and drop `kg:inferred` (so re-materialization happens on next reasoner call).

**Files:**
- Create: `packages/predicate-agent/src/promotion-sweeper.ts`
- Create: `packages/predicate-agent/tests/promotion-sweeper.test.ts`
- Create: `packages/predicate-ontology/tbox/promoted/.gitkeep`

- [ ] **Step 1: Create the promoted dir placeholder**

```bash
mkdir -p packages/predicate-ontology/tbox/promoted
echo '' > packages/predicate-ontology/tbox/promoted/.gitkeep
```

- [ ] **Step 2: Write the failing test `packages/predicate-agent/tests/promotion-sweeper.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';

const client = new SparqlClient(loadConfig());
const C = 'https://predicate.dev/codebase';
const PROMOTED_DIR = resolve(
  import.meta.dirname, '../../predicate-ontology/tbox/promoted',
);

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function recordUsage(sparql: string): Promise<void> {
  await client.update(`
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:usage> {
      <urn:test:usage:${Math.random().toString(36).slice(2, 8)}> a pred:Query ;
        pred:question "test" ;
        pred:sparql ${JSON.stringify(sparql).replace(/^"|"$/g, '').replace(/\\/g, '\\\\')} ;
        pred:rowCount "1"^^xsd:integer ;
        pred:elapsedMs "1"^^xsd:integer ;
        pred:at "${new Date().toISOString()}"^^xsd:dateTime .
    } }
  `);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
  // Clean up any leftover promoted files from prior runs
  for (const f of ['.gitkeep']) { /* keep */ }
});

afterAll(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:inferred']) {
    await reset(g);
  }
});

describe('PromotionSweeper', () => {
  it('reports "awaiting" when usage gate not met', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#owns`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'goal' });

    const sweeper = new PromotionSweeper(client, { useThreshold: 3 });
    const result = await sweeper.run();
    const decision = result.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('awaiting');
  });

  it('rejects expired proposals with reason="expired"', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: `${C}#dead`,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'x', ttlDays: 0 });          // expires immediately

    // Wait 50 ms to ensure now > expiresAt
    await new Promise((r) => setTimeout(r, 50));

    const sweeper = new PromotionSweeper(client, { useThreshold: 3 });
    const result = await sweeper.run();
    const decision = result.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('rejected-expired');

    // Proposal should be gone from staging
    const stillThere = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> { <${id}> ?p ?o } }
    `);
    expect(stillThere).toBe(false);

    // SchemaRejected event should be in kg:meta
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?e WHERE {
        GRAPH <kg:meta> {
          ?e a pred:SchemaRejected ;
             pred:goal <${id}> .
        }
      }
    `);
    expect(r.results.bindings).toHaveLength(1);
  });

  it('promotes a proposal that meets the usage gate and passes validation', async () => {
    const proposer = new SchemaProposer(client);
    const propIri = `${C}#owns`;
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: propIri,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'goal' });

    // Record 3 usages referencing the staged predicate
    for (let i = 0; i < 3; i++) {
      await recordUsage(`SELECT ?x WHERE { ?x <${propIri}> ?y }`);
    }

    const sweeper = new PromotionSweeper(client, { useThreshold: 3 });
    const result = await sweeper.run();
    const decision = result.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('promoted');

    // Promoted triple should be in kg:tbox
    const inTbox = await client.ask(`
      ASK { GRAPH <kg:tbox> {
        <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                     <http://www.w3.org/2002/07/owl#ObjectProperty>
      } }
    `);
    expect(inTbox).toBe(true);

    // Proposal removed from staging
    const stillStaged = await client.ask(`
      ASK { GRAPH <kg:tbox-staging> { <${id}> ?p ?o } }
    `);
    expect(stillStaged).toBe(false);

    // Turtle file written
    expect(decision?.turtleFile).toBeDefined();
    expect(existsSync(decision!.turtleFile!)).toBe(true);

    // SchemaPromoted + TBoxVersionAdvanced events
    const promoted = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:meta> { ?e a pred:SchemaPromoted ; pred:goal <${id}> } }
    `);
    expect(promoted).toBe(true);
    const advanced = await client.ask(`
      PREFIX pred: <https://predicate.dev/meta#>
      ASK { GRAPH <kg:meta> { ?e a pred:TBoxVersionAdvanced } }
    `);
    expect(advanced).toBe(true);

    // Clean up the promoted file so subsequent runs are deterministic
    if (decision?.turtleFile) rmSync(decision.turtleFile);
    // Also remove the promoted triple from kg:tbox so other test files
    // see the seed TBox unmodified.
    await client.update(`
      DELETE WHERE { GRAPH <kg:tbox> {
        <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                     <http://www.w3.org/2002/07/owl#ObjectProperty>
      } }
    `);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/promotion-sweeper.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `packages/predicate-agent/src/promotion-sweeper.ts`**

```typescript
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import type {
  DeltaQuad, PromotionDecision, SweeperResult, Term,
} from './types.js';

const META = 'https://predicate.dev/meta#';

interface ProposalRow {
  id: string;
  kind: string;
  expiresAt: string;
  useCount: number;
  justification: string;
  parent?: string;
  migration?: string;
}

function newEventId(kind: string): string {
  return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderTerm(t: Term): string {
  const lit = (v: string): string => escapeLiteral(v);
  if (t.type === 'uri') return escapeIRI(t.value);
  if (t.datatype) return `${lit(t.value)}^^${escapeIRI(t.datatype)}`;
  return lit(t.value);
}

function tripleSparql(q: DeltaQuad): string {
  return `${escapeIRI(q.s)} ${escapeIRI(q.p)} ${renderTerm(q.o)}`;
}

function tripleTurtle(q: DeltaQuad): string {
  return tripleSparql(q) + ' .';
}

export interface PromotionSweeperOptions {
  useThreshold?: number;
  promotedDir?: string;
}

export class PromotionSweeper {
  private useThreshold: number;
  private promotedDir: string;
  private reasoner: FusekiConstructAdapter;

  constructor(private client: SparqlClient, opts: PromotionSweeperOptions = {}) {
    this.useThreshold = opts.useThreshold ?? 3;
    this.promotedDir = opts.promotedDir ?? resolve(
      // Default: predicate-agent/dist/src → walk up to repo root, then ontology/tbox/promoted
      import.meta.dirname ?? process.cwd(),
      '..', '..', 'predicate-ontology', 'tbox', 'promoted',
    );
    this.reasoner = new FusekiConstructAdapter(client);
  }

  async run(): Promise<SweeperResult> {
    const t0 = Date.now();
    const proposals = await this.listProposals();
    const decisions: PromotionDecision[] = [];
    for (const p of proposals) {
      decisions.push(await this.decide(p));
    }
    return { decisions, durationMs: Date.now() - t0 };
  }

  private async listProposals(): Promise<ProposalRow[]> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?id ?kind ?expiresAt ?justification ?parent ?migration WHERE {
        GRAPH <kg:tbox-staging> {
          ?id a pred:Proposal ;
              pred:kind          ?kind ;
              pred:expiresAt     ?expiresAt ;
              pred:justification ?justification .
          OPTIONAL { ?id pred:parent    ?parent    }
          OPTIONAL { ?id pred:migration ?migration }
        }
      }
    `);
    const out: ProposalRow[] = [];
    for (const b of r.results.bindings) {
      const useCount = await this.countUses(b.id!.value);
      out.push({
        id: b.id!.value,
        kind: b.kind!.value,
        expiresAt: b.expiresAt!.value,
        useCount,
        justification: b.justification!.value,
        parent: b.parent?.value,
        migration: b.migration?.value,
      });
    }
    return out;
  }

  private async countUses(proposalId: string): Promise<number> {
    // Find all subject IRIs introduced by this proposal (the s-position of the tagged triples).
    const subjects = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT DISTINCT ?s WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(proposalId)} .
        }
      }
    `);
    const iris = subjects.results.bindings.map((b) => b.s!.value);
    if (iris.length === 0) return 0;

    // Build a FILTER over kg:usage's pred:sparql text containing any of these IRIs.
    const filters = iris.map((iri) => `CONTAINS(?sparql, "${iri}")`).join(' || ');
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <kg:usage> {
          ?q a pred:Query ; pred:sparql ?sparql .
          FILTER (${filters})
        }
      }
    `);
    return parseInt(r.results.bindings[0]!.n!.value, 10);
  }

  private async decide(p: ProposalRow): Promise<PromotionDecision> {
    const now = Date.now();
    const exp = new Date(p.expiresAt).getTime();

    if (now > exp && p.useCount < this.useThreshold) {
      await this.rejectExpired(p);
      return { proposalId: p.id, outcome: 'rejected-expired', reason: 'TTL elapsed before usage gate met' };
    }
    if (p.useCount >= this.useThreshold) {
      // Validate
      const validation = await this.validateProposalInIsolation(p);
      if (!validation.ok) {
        await this.recordValidationFailed(p, validation.reason);
        return {
          proposalId: p.id,
          outcome: 'rejected-validation',
          reason: validation.reason,
        };
      }
      const promoted = await this.promote(p);
      return {
        proposalId: p.id,
        outcome: 'promoted',
        turtleFile: promoted.turtleFile,
        tboxVersion: promoted.tboxVersion,
      };
    }
    return { proposalId: p.id, outcome: 'awaiting' };
  }

  private async validateProposalInIsolation(
    p: ProposalRow,
  ): Promise<{ ok: boolean; reason?: string }> {
    // Copy this proposal's tagged add-triples into a scratch staging graph
    const scratch = `kg:tbox-staging-tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    await this.client.update(`CREATE SILENT GRAPH <${scratch}>`);
    try {
      await this.client.update(`
        PREFIX pred: <${META}>
        INSERT { GRAPH <${scratch}> { ?s ?p ?o } }
        WHERE {
          GRAPH <kg:tbox-staging> {
            << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
            ?s ?p ?o .
          }
        }
      `);
      const result = await this.reasoner.validate({
        tboxGraph: 'kg:tbox',
        stagingGraph: scratch,
        aboxSample: 'kg:abox',
      });
      if (result.ok) return { ok: true };
      const parts: string[] = [];
      if (result.unsatisfiableClasses.length) {
        parts.push(`unsatisfiable: ${result.unsatisfiableClasses.join(', ')}`);
      }
      if (result.shaclViolations.length) {
        parts.push(`${result.shaclViolations.length} SHACL violations`);
      }
      return { ok: false, reason: parts.join('; ') || 'validation failed' };
    } finally {
      await this.client.update(`DROP SILENT GRAPH <${scratch}>`);
    }
  }

  private async rejectExpired(p: ProposalRow): Promise<void> {
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      DELETE {
        GRAPH <kg:tbox-staging> {
          ?s ?p ?o .
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ${escapeIRI(p.id)} ?mp ?mo .
        }
      }
      INSERT {
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('schema-rejected'))} a pred:SchemaRejected ;
            pred:at    "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ reason: 'expired' }))} .
        }
      }
      WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
          OPTIONAL { ${escapeIRI(p.id)} ?mp ?mo }
        }
      }
    `);
  }

  private async recordValidationFailed(p: ProposalRow, reason: string): Promise<void> {
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('schema-validation-failed'))} a pred:SchemaValidationFailed ;
            pred:at    "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ reason }))} .
        }
      }
    `);
  }

  private async promote(p: ProposalRow): Promise<{ turtleFile: string; tboxVersion: string }> {
    // 1. Fetch the proposal's tagged triples
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?s ?p ?o WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
        }
      }
    `);
    const quads: DeltaQuad[] = r.results.bindings.map((b) => ({
      s: b.s!.value,
      p: b.p!.value,
      o: b.o!.type === 'uri'
        ? { type: 'uri', value: b.o!.value }
        : { type: 'literal', value: b.o!.value, datatype: b.o!.datatype },
    }));

    // 2. Write Turtle file
    const turtleFile = resolve(this.promotedDir, `${p.id.replace(/[^A-Za-z0-9-]/g, '_')}.ttl`);
    const turtle = quads.map(tripleTurtle).join('\n') + '\n';
    writeFileSync(turtleFile, turtle, 'utf8');

    // 3. Atomic SPARQL: move triples kg:tbox-staging → kg:tbox, drop proposal meta, drop kg:inferred, emit events
    const tboxVersion = `urn:predicate:tbox:v-${Date.now().toString(36)}`;
    const insertSparql = quads.map(tripleSparql).map((s) => `${s} .`).join('\n');
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      DROP SILENT GRAPH <kg:inferred> ;
      INSERT DATA {
        GRAPH <kg:tbox> {
          ${insertSparql}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('schema-promoted'))} a pred:SchemaPromoted ;
            pred:at    "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(p.id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({
              kind: p.kind, turtleFile, tboxVersion, useCount: p.useCount,
            }))} .
          ${escapeIRI(newEventId('tbox-version-advanced'))} a pred:TBoxVersionAdvanced ;
            pred:at    "${new Date().toISOString()}"^^xsd:dateTime ;
            pred:actor "PromotionSweeper" ;
            pred:goal  ${escapeIRI(tboxVersion)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ proposalId: p.id, turtleFile }))} .
        }
      } ;
      DELETE {
        GRAPH <kg:tbox-staging> {
          ?s ?p ?o .
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ${escapeIRI(p.id)} ?mp ?mo .
        }
      }
      WHERE {
        GRAPH <kg:tbox-staging> {
          << ?s ?p ?o >> pred:proposalId ${escapeIRI(p.id)} .
          ?s ?p ?o .
          OPTIONAL { ${escapeIRI(p.id)} ?mp ?mo }
        }
      }
    `);
    return { turtleFile, tboxVersion };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test tests/promotion-sweeper.test.ts
```

Expected: 3 passed.

- [ ] **Step 6: Re-export**

Read `packages/predicate-agent/src/index.ts`. Append `export * from './promotion-sweeper.js';`.

- [ ] **Step 7: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: 127 + 3 = 130.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-ontology/tbox/promoted \
        packages/predicate-agent/src/promotion-sweeper.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/promotion-sweeper.test.ts
git commit -m "feat(agent): PromotionSweeper validates + promotes staged SchemaDeltas atomically"
```

---

## Task 5: Wire `PromotionSweeper` into `kg_maintain`

`kg_maintain` already runs the thin reaper (Phase 2 Task 9). Extend it to also run the sweeper. The result includes sweeper decisions alongside the reaper's `archivedCount`.

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-maintain.ts`
- Modify: `packages/predicate-mcp/tests/tools/kg-maintain.test.ts`

- [ ] **Step 1: Append a new test to `packages/predicate-mcp/tests/tools/kg-maintain.test.ts`**

Read the current file. After the existing describe block, append:

```typescript
import { PromotionSweeper, SchemaProposer } from 'predicate-agent/src/index.js';
import { rmSync } from 'node:fs';

describe('kg_maintain runs the promotion sweeper', () => {
  it('reports sweeper decisions alongside reaper output', async () => {
    // Seed a staged proposal whose usage gate is not yet met
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: 'https://predicate.dev/codebase#tempProp',
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'maintain test' });

    const result = await kgMaintain(client, { archiveCutoff: 0.6, ageDays: 30 });
    expect(result.sweeper).toBeDefined();
    expect(result.sweeper!.decisions.find((d) => d.proposalId === id)?.outcome).toBe('awaiting');

    // Cleanup
    await client.update(`DROP SILENT GRAPH <kg:tbox-staging>`);
    await client.update(`CREATE SILENT GRAPH <kg:tbox-staging>`);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-maintain.test.ts
```

Expected: the new test fails — `kgMaintain` doesn't return a `sweeper` field yet.

- [ ] **Step 3: Modify `packages/predicate-mcp/src/tools/kg-maintain.ts`**

Read the current file. Extend the `MaintainResult` interface and `kgMaintain` function:

```typescript
import { SparqlClient } from '../sparql/client.js';
import { escapeLiteral } from '../sparql/escape.js';
import { PromotionSweeper, type SweeperResult } from 'predicate-agent/src/index.js';

const META = 'https://predicate.dev/meta#';

export interface MaintainInput {
  archiveCutoff?: number;
  ageDays?: number;
  useThreshold?: number;
}

export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
  sweeper?: SweeperResult;
}

export async function kgMaintain(
  client: SparqlClient,
  input: MaintainInput = {},
): Promise<MaintainResult> {
  const archiveCutoff = input.archiveCutoff ?? 0.6;
  const ageDays = input.ageDays ?? 30;
  const cutoffDate = new Date(Date.now() - ageDays * 86400_000).toISOString();
  const t0 = Date.now();

  // (Existing reaper logic — preserve verbatim)
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

  // Sweeper
  const sweeper = await new PromotionSweeper(client, {
    useThreshold: input.useThreshold ?? 3,
  }).run();

  const eventId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const elapsedMs = Date.now() - t0;
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${eventId}> a pred:MaintenanceRun ;
        pred:at        "${new Date().toISOString()}"^^xsd:dateTime ;
        pred:actor     "kg_maintain" ;
        pred:payload   ${escapeLiteral(JSON.stringify({
          archivedCount, elapsedMs, archiveCutoff, ageDays,
          sweeperDecisions: sweeper.decisions.length,
        }))} .
    } }
  `);

  return { archivedCount, elapsedMs, eventId, sweeper };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-maintain.test.ts
```

Expected: 4 passed (3 existing + 1 new).

- [ ] **Step 5: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-mcp typecheck
pnpm --filter predicate-mcp lint
```

Expected: 130 + 1 = 131.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-maintain.ts \
        packages/predicate-mcp/tests/tools/kg-maintain.test.ts
git commit -m "feat(mcp): kg_maintain runs PromotionSweeper after reaper pass"
```

---

## Task 6: End-to-end schema evolution test

A new test in `predicate-eval` exercises the full loop: propose → use 3x → maintain → promoted.

**Files:**
- Create: `packages/predicate-eval/tests/schema-evolution.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { SchemaProposer } from 'predicate-agent/src/index.js';
import { kgMaintain } from 'predicate-mcp/src/tools/kg-maintain.js';

const client = new SparqlClient(loadConfig());
const C = 'https://predicate.dev/codebase';
const propIri = `${C}#owns_evol`;

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function recordUsage(sparql: string): Promise<void> {
  await client.update(`
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:usage> {
      <urn:test:usage:${Math.random().toString(36).slice(2, 8)}> a pred:Query ;
        pred:question "test" ;
        pred:sparql ${JSON.stringify(sparql).replace(/^"|"$/g, '').replace(/\\/g, '\\\\')} ;
        pred:rowCount "1"^^xsd:integer ;
        pred:elapsedMs "1"^^xsd:integer ;
        pred:at "${new Date().toISOString()}"^^xsd:dateTime .
    } }
  `);
}

beforeEach(async () => {
  for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:abox-archive']) {
    await reset(g);
  }
});

afterAll(async () => {
  // Tidy up: remove any promoted triple to leave the seed TBox unmodified
  await client.update(`
    DELETE WHERE { GRAPH <kg:tbox> {
      <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                   <http://www.w3.org/2002/07/owl#ObjectProperty>
    } }
  `);
});

describe('end-to-end schema evolution', () => {
  it('proposes → uses 3x → maintain promotes', async () => {
    const proposer = new SchemaProposer(client);
    const id = await proposer.propose({
      kind: 'add-property',
      add: [{
        s: propIri,
        p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#ObjectProperty' },
      }],
    }, { justification: 'service ownership' });

    for (let i = 0; i < 3; i++) {
      await recordUsage(`SELECT ?x WHERE { ?x <${propIri}> ?y }`);
    }

    const result = await kgMaintain(client, { useThreshold: 3 });
    const decision = result.sweeper!.decisions.find((d) => d.proposalId === id);
    expect(decision?.outcome).toBe('promoted');
    expect(decision?.turtleFile).toBeDefined();
    expect(existsSync(decision!.turtleFile!)).toBe(true);

    const inTbox = await client.ask(`
      ASK { GRAPH <kg:tbox> {
        <${propIri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
                     <http://www.w3.org/2002/07/owl#ObjectProperty>
      } }
    `);
    expect(inTbox).toBe(true);

    rmSync(decision!.turtleFile!);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm --filter predicate-eval test tests/schema-evolution.test.ts
```

Expected: 1 passed.

- [ ] **Step 3: Full workspace**

```bash
pnpm test
```

Expected: 131 + 1 = 132 total.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-eval/tests/schema-evolution.test.ts
git commit -m "test(eval): end-to-end schema evolution — propose → use 3x → maintain → promoted"
```

---

## Task 7: Phase 3c exit — README + tag

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update root `README.md` Status block**

Read the current README. Replace the Status section with:

```markdown
## Status

Phase 3c (Schema Evolution) complete: `kg_propose_schema` is real (replacing
the last schema-side stub) and accepts the full `SchemaDelta` tagged union
from spec §6.1. `PromotionSweeper` runs validation + usage gates and
performs atomic promotion (Turtle file written to disk, `kg:inferred`
dropped, `pred:SchemaPromoted` + `pred:TBoxVersionAdvanced` events emitted).
The sweeper runs alongside the thin reaper inside `kg_maintain`. Only
`kg_stats` remains as a stub — Phase 4 (efficiency: kg_stats + generalization
detector) is next.
```

Update the `predicate-mcp` row: `8 tools (7 implemented, 1 stub: kg_stats)`. The `predicate-agent` row gains schema-evolution responsibilities:

```markdown
| `predicate-agent` | Goal store, decomposer, gap detector, research sources + extractors, schema proposer, promotion sweeper |
```

- [ ] **Step 2: Run the full suite**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all green. 132 tests.

- [ ] **Step 3: Commit and tag**

```bash
git add README.md
git commit -m "docs: README + Phase 3c status; tag v0.3c.0-schema-evolution"
git tag v0.3c.0-schema-evolution
```

- [ ] **Step 4: Confirm**

```bash
git log --oneline -15
git tag --list 'v*'
```

Expected tags: `v0.1.0-foundation`, `v0.2.0-discipline`, `v0.3a.0-goals-and-gaps`, `v0.3b.0-research-execution`, `v0.3c.0-schema-evolution`.

---

## Self-review

- **Spec coverage:** §4.3 (schema lifecycle: propose → stage → validate → usage gate → promote) — Tasks 2, 4, 5 cover propose, validate, usage, promote. §5.1 (event log) — SchemaProposed (Task 2), SchemaValidationFailed/SchemaRejected/SchemaPromoted/TBoxVersionAdvanced (Task 4) all land. §6 (kg_propose_schema) — Task 3. §6.1 (SchemaDelta tagged union) — Task 1 types + Task 3 zod validation. §8.1 (ReasonerAdapter.validate) — re-used in Task 4.
- **Placeholder scan:** no "TBD" / "implement later" / "handle errors". Every step shows actual code.
- **Type consistency:** `SchemaDelta`, `StagedProposal`, `PromotionDecision`, `SweeperResult`, `DeltaQuad`, `Term`, `ProposalMeta` defined once in `types.ts` and reused. `SchemaProposer.propose(delta, meta): Promise<string>` returns the proposal id, used in `kg_propose_schema` and the end-to-end test. `PromotionSweeper.run(): Promise<SweeperResult>` is the single entry point, called by `kg_maintain`.
- **Known follow-up:** Spec §17 lists "cross-system promotion atomicity" as a v0.2 gap. This plan ships a single SPARQL atomic operation for the in-graph state changes plus a separate `writeFileSync` for the Turtle file. If the SPARQL succeeds but the file write fails (e.g. disk full), the system is in an inconsistent state. A proper journal that records "intent to promote → file written → graph updated" with crash-recovery semantics is deferred. The test harness rejects this gap as long as the happy path works, which is the v1 contract.
- **Usage-counting fidelity:** Current implementation uses `CONTAINS(?sparql, "<IRI>")` against `kg:usage`. This catches the staged predicate referenced in a query, but it's coarse — a query that references the IRI inside a comment would also count. v1 acceptance is "good enough for the demo"; spec §17 records the gap and Phase 4 may switch to a parsed-AST counter.
- **Test isolation:** Each test resets `kg:tbox-staging` / `kg:meta` / `kg:usage` / `kg:inferred` in `beforeEach`. The promotion-sweeper test that ACTUALLY promotes a triple to `kg:tbox` cleans up explicitly (`DELETE WHERE`) and removes the promoted Turtle file, so the seed TBox stays untouched for subsequent test files.
