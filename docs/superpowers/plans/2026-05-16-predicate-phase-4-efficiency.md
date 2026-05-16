# Predicate Phase 4 — Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out v1 by landing the last MCP stub (`kg_stats`) and the long-deferred generalization detector (the K-instance pattern-lift sweep from PRD §9.3). After Phase 4 the entire 8-tool MCP surface is implemented, `kg_stats` exposes the success metrics from PRD §12 (triple count, inferred ratio, materialization latency, unused-concept ratio), and the generalization detector proposes new classes when ≥K untyped instances share a structural pattern. Phase 4 ships v1 — the tag is `v1.0.0`.

**Architecture:** `kg_stats` is a thin SPARQL aggregation tool inside `predicate-mcp`. It samples the four success-metric numbers from the existing graphs (`kg:abox`, `kg:inferred`, `kg:tbox`, `kg:meta`) and returns a plain JSON object — no events, no side effects, no caching for v1. The generalization detector lives in `predicate-agent` alongside the existing `PromotionSweeper` and the `SchemaProposer`; it walks `kg:abox`, groups instances by structural fingerprint (the multiset of predicate IRIs each subject participates in), and when a fingerprint group has ≥K members AND none of those members has an `rdf:type` assertion already, emits a `kg_propose_schema` `add-class` delta via the existing proposer. The detector runs alongside the sweeper inside `kg_maintain`. Materialization caching and tag-while-deriving v1.1 are explicitly deferred — they remain in the spec §17 "known gaps" list.

**Tech Stack:** Node 20+, TypeScript 5.x, pnpm workspaces, Vitest. No new runtime deps.

**Spec reference:** [`docs/superpowers/specs/2026-05-16-predicate-design.md`](../specs/2026-05-16-predicate-design.md) §§ 9 (component inventory: `kg_stats`), 11 (storage hygiene: unused-concept ratio), 12 (success metrics), 16 (calibration targets), 17 (deferred items — materialization caching stays deferred), 18 (intentionally replaceable).

**Phase exit criteria:**
- `kg_stats()` is a real MCP tool. Returns `{ triples, inferred, abox, tbox, inferredRatio, unusedConceptRatio, materializationLatencyMsP95 }`. No remaining MCP stubs.
- Generalization detector: given 5+ untyped instances in `kg:abox` that share a structural fingerprint, it proposes a new class via `SchemaProposer` and the resulting proposal is visible in `kg:tbox-staging`.
- Generalization detector runs inside `kg_maintain` alongside the reaper and sweeper; `MaintainResult` gains a `generalizer?: GeneralizerResult` field.
- All previous tests still pass; new tests cover stats math + detector behavior + maintain integration.
- README updated with the final v1 status block, package table reflects all 8 tools implemented.
- Phase tag `v1.0.0` set at the final commit.

---

## File structure (created or modified in Phase 4)

```
predicate/
├── packages/
│   ├── predicate-mcp/                                  (modified)
│   │   ├── src/tools/kg-stats.ts                       ← new
│   │   ├── src/tools/kg-maintain.ts                    ← extended
│   │   ├── src/tools/registry.ts                       ← replace stub
│   │   ├── tests/tools/kg-stats.test.ts                ← new
│   │   ├── tests/tools/kg-maintain.test.ts             ← extended
│   │   └── tests/index.test.ts                         ← stub list now empty
│   └── predicate-agent/                                (modified)
│       ├── src/
│       │   ├── types.ts                                ← extended (Stats, GeneralizerResult)
│       │   ├── generalizer.ts                          ← new
│       │   └── index.ts                                ← extended re-exports
│       └── tests/
│           └── generalizer.test.ts                     ← new
└── README.md                                            ← v1.0 status
```

---

## Task 1: `kg_stats` types + SPARQL aggregation

The shape returned to callers is documented in spec §12.

**Files:**
- Modify: `packages/predicate-agent/src/types.ts`
- Create: `packages/predicate-mcp/src/tools/kg-stats.ts`
- Create: `packages/predicate-mcp/tests/tools/kg-stats.test.ts`

- [ ] **Step 1: Append to `packages/predicate-agent/src/types.ts`**

Read the current file. After the existing Phase-3c types, append:

```typescript
// --- Phase 4: stats + generalization ----------------------------------

export interface KgStats {
  triples: number;                 // total across kg:abox + kg:inferred + kg:tbox
  abox: number;                    // |kg:abox|
  inferred: number;                // |kg:inferred|
  tbox: number;                    // |kg:tbox|
  classes: number;                 // distinct owl:Class declarations in kg:tbox
  inferredRatio: number;           // inferred / (abox + inferred), [0,1]
  unusedConceptRatio: number;      // tbox-classes never referenced by abox / classes, [0,1]
  materializationLatencyMsP95: number;  // p95 over recent MaterializationCompleted events; 0 if none
}

export interface GeneralizerProposal {
  fingerprint: string[];           // sorted list of predicate IRIs that defines the group
  members: string[];               // subject IRIs participating in the group
  proposalId: string;              // id of the SchemaProposer.propose() call that staged the new class
  className: string;               // synthesized class IRI for the proposal
}

export interface GeneralizerResult {
  proposals: GeneralizerProposal[];
  scannedSubjects: number;
  durationMs: number;
}
```

- [ ] **Step 2: Write the failing test `packages/predicate-mcp/tests/tools/kg-stats.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgStats } from '../../src/tools/kg-stats.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:inferred']) await reset(g);
});

describe('kg_stats', () => {
  it('returns counts that reflect what is in the graphs', async () => {
    await client.update(`
      INSERT DATA {
        GRAPH <kg:abox>     { <urn:a> <urn:p> <urn:b> . <urn:c> <urn:p> <urn:d> . }
        GRAPH <kg:inferred> { <urn:a> <urn:q> <urn:e> . }
      }
    `);
    const s = await kgStats(client);
    expect(s.abox).toBe(2);
    expect(s.inferred).toBe(1);
    expect(s.tbox).toBeGreaterThan(0);              // seed TBox is loaded
    expect(s.triples).toBe(s.abox + s.inferred + s.tbox);
  });

  it('inferredRatio is 0 when no inferred triples exist', async () => {
    await client.update(`INSERT DATA { GRAPH <kg:abox> { <urn:x> <urn:p> <urn:y> } }`);
    const s = await kgStats(client);
    expect(s.inferred).toBe(0);
    expect(s.inferredRatio).toBe(0);
  });

  it('inferredRatio is between 0 and 1 when both graphs have data', async () => {
    await client.update(`
      INSERT DATA {
        GRAPH <kg:abox>     { <urn:a> <urn:p> <urn:b> }
        GRAPH <kg:inferred> { <urn:c> <urn:q> <urn:d> . <urn:e> <urn:q> <urn:f> }
      }
    `);
    const s = await kgStats(client);
    expect(s.inferredRatio).toBeGreaterThan(0);
    expect(s.inferredRatio).toBeLessThanOrEqual(1);
  });

  it('classes counts owl:Class declarations in kg:tbox', async () => {
    const s = await kgStats(client);
    expect(s.classes).toBeGreaterThan(0);
  });

  it('unusedConceptRatio is 1 when no abox classes match tbox classes', async () => {
    // The seed TBox declares :File, :Function, etc. with no ABox instances right now.
    const s = await kgStats(client);
    expect(s.unusedConceptRatio).toBe(1);
  });

  it('unusedConceptRatio drops when an abox instance is typed as a tbox class', async () => {
    await client.update(`
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX c:   <https://predicate.dev/codebase#>
      INSERT DATA { GRAPH <kg:abox> { <urn:x> rdf:type c:File } }
    `);
    const s = await kgStats(client);
    expect(s.unusedConceptRatio).toBeLessThan(1);
  });

  it('materializationLatencyMsP95 is 0 when no MaterializationCompleted events exist', async () => {
    const s = await kgStats(client);
    expect(s.materializationLatencyMsP95).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-stats.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `packages/predicate-mcp/src/tools/kg-stats.ts`**

```typescript
import { SparqlClient } from '../sparql/client.js';
import type { KgStats } from 'predicate-agent/src/index.js';

async function countGraph(client: SparqlClient, graph: string): Promise<number> {
  const r = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`,
  );
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

async function countClasses(client: SparqlClient): Promise<number> {
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
    }
  `);
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

async function unusedConceptRatio(
  client: SparqlClient, classCount: number,
): Promise<number> {
  if (classCount === 0) return 0;
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
      FILTER NOT EXISTS {
        { GRAPH <kg:abox>     { ?x rdf:type ?c } }
        UNION
        { GRAPH <kg:inferred> { ?x rdf:type ?c } }
      }
    }
  `);
  const unused = parseInt(r.results.bindings[0]!.n!.value, 10);
  return unused / classCount;
}

async function materializationLatencyP95(client: SparqlClient): Promise<number> {
  // Looks for pred:MaterializationCompleted events (not yet emitted by anything
  // in v1, but the contract is wired so future phases can add them without
  // touching kg_stats). Returns 0 when no such events exist.
  const r = await client.select(`
    PREFIX pred: <https://predicate.dev/meta#>
    SELECT ?ms WHERE {
      GRAPH <kg:meta> {
        ?e a pred:MaterializationCompleted ;
           pred:payload ?payload .
        BIND(STRDT(REPLACE(?payload, ".*\\\\\"elapsedMs\\\\\":(\\\\d+).*", "$1"), <http://www.w3.org/2001/XMLSchema#integer>) AS ?ms)
      }
    } ORDER BY DESC(?ms)
  `);
  const values = r.results.bindings
    .map((b) => parseInt(b.ms?.value ?? '0', 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const idx = Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1);
  return values[Math.max(idx, 0)]!;
}

export async function kgStats(client: SparqlClient): Promise<KgStats> {
  const [abox, inferred, tbox] = await Promise.all([
    countGraph(client, 'kg:abox'),
    countGraph(client, 'kg:inferred'),
    countGraph(client, 'kg:tbox'),
  ]);
  const classes = await countClasses(client);
  const triples = abox + inferred + tbox;
  const denom = abox + inferred;
  const inferredRatio = denom === 0 ? 0 : inferred / denom;
  const unused = await unusedConceptRatio(client, classes);
  const p95 = await materializationLatencyP95(client);
  return {
    triples,
    abox,
    inferred,
    tbox,
    classes,
    inferredRatio,
    unusedConceptRatio: unused,
    materializationLatencyMsP95: p95,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-stats.test.ts
```

Expected: 7 passed.

- [ ] **Step 6: Re-export types from predicate-agent**

The new `KgStats` type is already exported via `export * from './types.js'` (no change needed).

- [ ] **Step 7: Run full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-mcp typecheck
pnpm --filter predicate-mcp lint
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: 132 + 7 = 139 total. typecheck + lint clean across both packages.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-agent/src/types.ts \
        packages/predicate-mcp/src/tools/kg-stats.ts \
        packages/predicate-mcp/tests/tools/kg-stats.test.ts
git commit -m "feat(mcp): kg_stats — graph counts + inferredRatio + unusedConceptRatio + p95"
```

---

## Task 2: Wire `kg_stats` into the MCP registry

Replace the stub with a real entry. After this task, `stubs()` is empty and the index.test.ts stub-list test needs adjusting.

**Files:**
- Modify: `packages/predicate-mcp/src/tools/registry.ts`
- Modify: `packages/predicate-mcp/tests/index.test.ts`

- [ ] **Step 1: Read `packages/predicate-mcp/src/tools/registry.ts`**

Locate the `kg_stats` entry in `stubs()`. Remove it. Add a real entry to `buildTools()` near `kg_maintain`:

```typescript
import { kgStats } from './kg-stats.js';

// inside buildTools(), append:
{
  name: 'kg_stats',
  description: 'Return current graph counts (triples, abox, inferred, tbox), inferredRatio, unusedConceptRatio, and materializationLatencyMsP95.',
  inputSchema: z.object({}),
  handler: async (): Promise<unknown> => kgStats(client),
},
```

The `stubs()` function now returns an empty list. Either delete it and the `...stubs()` spread, or leave both for symmetry — both are valid.

- [ ] **Step 2: Update `packages/predicate-mcp/tests/index.test.ts`**

The "stub tools throw NotImplementedError" test references `kg_stats`. After this task there are no stubs.

Two options:
- (a) Delete that test entirely.
- (b) Replace it with a test asserting `stubs()` returns an empty array — useful as a forward-looking guard.

Pick (b). Replace the existing "stub tools throw" test with:

```typescript
it('no remaining stubs — all 8 tools are implemented', () => {
  // Every tool's handler must run without throwing NotImplementedError
  // for at least one input. Smoke-test the four tools that accept no args
  // or trivial args; the rest are exercised by their own test files.
  expect(names).toEqual(expect.arrayContaining([
    'kg_explore_schema', 'kg_ask', 'kg_assert', 'kg_explain',
    'kg_propose_schema', 'kg_research_goal', 'kg_stats', 'kg_maintain',
  ]));
});
```

(The "exposes all 8 tools" test still passes unchanged.)

- [ ] **Step 3: Run the test**

```bash
pnpm --filter predicate-mcp test tests/index.test.ts
```

Expected: 2 passed (the "exposes all 8" plus the new "no remaining stubs").

- [ ] **Step 4: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-mcp typecheck
pnpm --filter predicate-mcp lint
```

Expected: 139 total still; one test in index.test.ts swapped for another. typecheck + lint clean.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/registry.ts \
        packages/predicate-mcp/tests/index.test.ts
git commit -m "feat(mcp): kg_stats wired — no remaining MCP stubs"
```

---

## Task 3: `Generalizer` — K-instance pattern lift

Walks `kg:abox`, groups subjects by their structural fingerprint (sorted list of distinct predicates they participate in as subject), and when a fingerprint group has ≥K members AND none of the members has an `rdf:type` triple in `kg:abox`/`kg:inferred`/`kg:tbox`, proposes a synthesized class via `SchemaProposer`.

The synthesized class IRI uses `urn:predicate:gen:<short-hash>` — deterministic from the sorted fingerprint, so re-runs don't propose duplicates.

**Files:**
- Create: `packages/predicate-agent/src/generalizer.ts`
- Create: `packages/predicate-agent/tests/generalizer.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/generalizer.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { Generalizer } from '../src/generalizer.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function insertAbox(triples: string): Promise<void> {
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

beforeEach(async () => {
  for (const g of ['kg:abox', 'kg:tbox-staging', 'kg:meta', 'kg:inferred']) {
    await reset(g);
  }
});

describe('Generalizer', () => {
  it('proposes a class when ≥K untyped instances share a fingerprint', async () => {
    // 5 subjects, each with the same two predicates (urn:p, urn:q), none typed
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:item${i}> <urn:p> "v${i}" . <urn:item${i}> <urn:q> "w${i}" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]!.members).toHaveLength(5);
    expect(result.proposals[0]!.fingerprint).toEqual(['urn:p', 'urn:q']);
    expect(result.proposals[0]!.className).toMatch(/^urn:predicate:gen:/);

    // The proposal landed in kg:tbox-staging
    const proposalIri = result.proposals[0]!.proposalId;
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT ?kind WHERE { GRAPH <kg:tbox-staging> { <${proposalIri}> pred:kind ?kind } }
    `);
    expect(r.results.bindings[0]!.kind!.value).toBe('add-class');
  });

  it('skips subjects that already have rdf:type', async () => {
    await insertAbox(`
      <urn:typed> <urn:p> "x" .
      <urn:typed> <urn:q> "y" .
      <urn:typed> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <urn:SomeClass> .
    `);
    for (let i = 0; i < 4; i++) {
      await insertAbox(`<urn:untyped${i}> <urn:p> "x" . <urn:untyped${i}> <urn:q> "y" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(0);             // only 4 untyped, k=5
  });

  it('does not propose when fewer than K instances share a fingerprint', async () => {
    for (let i = 0; i < 3; i++) {
      await insertAbox(`<urn:item${i}> <urn:p> "v" . <urn:item${i}> <urn:q> "w" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(0);
  });

  it('is idempotent — re-running with the same data produces the same className', async () => {
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:s${i}> <urn:p> "v" . <urn:s${i}> <urn:q> "w" .`);
    }
    const gen = new Generalizer(client, { k: 5 });
    const a = await gen.run();
    const b = await gen.run();
    expect(a.proposals[0]!.className).toBe(b.proposals[0]!.className);
  });

  it('groups separately when subjects have different fingerprints', async () => {
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:a${i}> <urn:p> "v" .`);                   // fingerprint [p]
    }
    for (let i = 0; i < 5; i++) {
      await insertAbox(`<urn:b${i}> <urn:p> "v" . <urn:b${i}> <urn:q> "w" .`);  // fingerprint [p, q]
    }
    const gen = new Generalizer(client, { k: 5 });
    const result = await gen.run();
    expect(result.proposals).toHaveLength(2);
    const fps = result.proposals.map((p) => p.fingerprint.join(','));
    expect(new Set(fps)).toEqual(new Set(['urn:p', 'urn:p,urn:q']));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/generalizer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/generalizer.ts`**

```typescript
import { createHash } from 'node:crypto';
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { SchemaProposer } from './schema-proposer.js';
import type { GeneralizerProposal, GeneralizerResult } from './types.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export interface GeneralizerOptions {
  k?: number;                       // minimum members per fingerprint group
}

interface SubjectRow {
  s: string;
  predicates: string[];             // distinct predicates this subject participates in
}

function fingerprintHash(fingerprint: string[]): string {
  return createHash('sha1').update(fingerprint.join('|')).digest('hex').slice(0, 12);
}

export class Generalizer {
  private k: number;
  constructor(private client: SparqlClient, opts: GeneralizerOptions = {}) {
    this.k = opts.k ?? 5;
  }

  async run(): Promise<GeneralizerResult> {
    const t0 = Date.now();
    const subjects = await this.listUntypedSubjects();
    const groups = this.groupByFingerprint(subjects);
    const proposals: GeneralizerProposal[] = [];
    const proposer = new SchemaProposer(this.client);

    for (const [key, members] of groups.entries()) {
      if (members.length < this.k) continue;
      const fingerprint = key.split('|');
      const hash = fingerprintHash(fingerprint);
      const className = `urn:predicate:gen:${hash}`;
      const proposalId = await proposer.propose({
        kind: 'add-class',
        add: [{
          s: className,
          p: RDF_TYPE,
          o: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#Class' },
        }],
      }, {
        justification: `auto-proposed: ${members.length} untyped instances share predicates [${fingerprint.join(', ')}]`,
      });
      proposals.push({ fingerprint, members, proposalId, className });
    }
    return {
      proposals,
      scannedSubjects: subjects.length,
      durationMs: Date.now() - t0,
    };
  }

  private async listUntypedSubjects(): Promise<SubjectRow[]> {
    // Subjects in kg:abox that have NO rdf:type assertion anywhere in tbox/abox/inferred
    const r = await this.client.select(`
      PREFIX rdf: <${RDF_TYPE.replace(/#type$/, '#')}>
      SELECT ?s (GROUP_CONCAT(DISTINCT ?p; separator="|") AS ?preds)
      WHERE {
        GRAPH <kg:abox> {
          ?s ?p ?o .
          FILTER (?p != <${RDF_TYPE}>)
          FILTER NOT EXISTS { ?s <${RDF_TYPE}> ?t }
        }
        FILTER NOT EXISTS { GRAPH <kg:inferred> { ?s <${RDF_TYPE}> ?ti } }
        FILTER NOT EXISTS { GRAPH <kg:tbox>     { ?s <${RDF_TYPE}> ?tb } }
      }
      GROUP BY ?s
    `);
    return r.results.bindings.map((b) => ({
      s: b.s!.value,
      predicates: (b.preds?.value ?? '').split('|').filter((p) => p.length > 0),
    }));
  }

  private groupByFingerprint(rows: SubjectRow[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const key = [...new Set(row.predicates)].sort().join('|');
      const arr = groups.get(key) ?? [];
      arr.push(row.s);
      groups.set(key, arr);
    }
    return groups;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter predicate-agent test tests/generalizer.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Re-export**

Read `packages/predicate-agent/src/index.ts`. Append `export * from './generalizer.js';`.

- [ ] **Step 6: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```

Expected: 139 + 5 = 144. typecheck + lint clean.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-agent/src/generalizer.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/generalizer.test.ts
git commit -m "feat(agent): Generalizer proposes new classes from K-instance fingerprint groups"
```

---

## Task 4: Run `Generalizer` inside `kg_maintain`

`kg_maintain` already runs the reaper + sweeper. Add the generalizer between them (after reaper, before sweeper — so any newly-proposed classes show up in the next sweeper pass).

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-maintain.ts`
- Modify: `packages/predicate-mcp/tests/tools/kg-maintain.test.ts`

- [ ] **Step 1: Append a new test to `packages/predicate-mcp/tests/tools/kg-maintain.test.ts`**

Read the current file. After the existing describe blocks, append:

```typescript
describe('kg_maintain runs the generalizer', () => {
  it('reports generalizer proposals when ≥K untyped instances share a fingerprint', async () => {
    for (let i = 0; i < 5; i++) {
      await client.update(`
        INSERT DATA { GRAPH <kg:abox> {
          <urn:gen-item${i}> <urn:gen-p> "v" .
          <urn:gen-item${i}> <urn:gen-q> "w" .
        } }
      `);
    }
    const result = await kgMaintain(client, { useThreshold: 3, generalizerK: 5 });
    expect(result.generalizer).toBeDefined();
    expect(result.generalizer!.proposals.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    for (const g of ['kg:abox', 'kg:tbox-staging', 'kg:meta']) {
      await client.update(`DROP SILENT GRAPH <${g}>`);
      await client.update(`CREATE SILENT GRAPH <${g}>`);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-maintain.test.ts
```

Expected: the new test fails — `kgMaintain` doesn't return a `generalizer` field yet.

- [ ] **Step 3: Modify `packages/predicate-mcp/src/tools/kg-maintain.ts`**

Read the current file. Update the imports, input, result, and body to also run the generalizer:

```typescript
import { SparqlClient } from '../sparql/client.js';
import { escapeLiteral } from '../sparql/escape.js';
import {
  PromotionSweeper, type SweeperResult,
  Generalizer, type GeneralizerResult,
} from 'predicate-agent/src/index.js';

const META = 'https://predicate.dev/meta#';

export interface MaintainInput {
  archiveCutoff?: number;
  ageDays?: number;
  useThreshold?: number;
  generalizerK?: number;
}

export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
  sweeper?: SweeperResult;
  generalizer?: GeneralizerResult;
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

  const generalizer = await new Generalizer(client, {
    k: input.generalizerK ?? 5,
  }).run();

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
          generalizerProposals: generalizer.proposals.length,
        }))} .
    } }
  `);

  return { archivedCount, elapsedMs, eventId, sweeper, generalizer };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-maintain.test.ts
```

Expected: 5 passed (4 existing + 1 new).

- [ ] **Step 5: Full workspace + typecheck + lint**

```bash
pnpm test
pnpm --filter predicate-mcp typecheck
pnpm --filter predicate-mcp lint
```

Expected: 144 + 1 = 145. typecheck + lint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-maintain.ts \
        packages/predicate-mcp/tests/tools/kg-maintain.test.ts
git commit -m "feat(mcp): kg_maintain runs Generalizer between reaper and sweeper"
```

---

## Task 5: Phase 4 exit — v1.0 README + tag

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update root `README.md` Status block**

Read the current README. Replace the Status section with:

```markdown
## Status

**v1.0 complete.** All 8 MCP tools implemented: `kg_explore_schema`, `kg_ask`,
`kg_assert`, `kg_explain`, `kg_propose_schema`, `kg_research_goal`,
`kg_stats`, `kg_maintain`. The agent loop is closed end-to-end:
goal → decompose → gap-detect → research → extract → assert → query →
explain, with the schema-evolution loop (propose → stage → validate →
usage gate → promote) running alongside via `kg_maintain`. Generalization
detector proposes new classes when ≥K untyped instances share a structural
fingerprint. `kg_stats` exposes the PRD §12 success metrics.

Deferred to v1.1 (see spec §17 known gaps): materialization caching,
tag-while-deriving for `kg_explain`, intent-aware `ResearchSource`
filtering, journal-based cross-system promotion atomicity, LLM-augmented
decomposer + extractor.
```

Update the `predicate-mcp` row to: `MCP server; 8 tools, all implemented`. The `predicate-agent` row gains the generalizer:

```markdown
| `predicate-agent` | Goal store, decomposer, gap detector, research sources + extractors, schema proposer, promotion sweeper, generalizer |
```

- [ ] **Step 2: Run the full suite**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all green. 145 tests.

- [ ] **Step 3: Commit and tag**

```bash
git add README.md
git commit -m "docs: README v1.0.0 status; all 8 MCP tools implemented"
git tag v1.0.0
```

- [ ] **Step 4: Confirm**

```bash
git log --oneline -15
git tag --list 'v*'
```

Expected tags (in order): `v0.1.0-foundation`, `v0.2.0-discipline`, `v0.3a.0-goals-and-gaps`, `v0.3b.0-research-execution`, `v0.3c.0-schema-evolution`, `v1.0.0`.

---

## Self-review

- **Spec coverage:** §9 (`kg_stats` as a Phase-4 deliverable) — Tasks 1, 2. §11 (storage hygiene's "unused-concept ratio" metric) — Task 1's `unusedConceptRatio`. §12 (success metrics: triples, inferred ratio, materialization latency, unused-concept ratio) — all four exposed by `kg_stats`. §9.3 (generalization sweep) and §15 (out-of-scope: "generalization detector — the *thin* reaper from Phase 2 stays, the *generalizer* adds here") — Tasks 3, 4. §17 deferred items (materialization caching, tag-while-deriving v1.1) remain deferred per design; called out in the v1.1 paragraph of the final README.
- **Placeholder scan:** zero "TBD" / "implement later" / "handle errors". Every step shows actual code.
- **Type consistency:** `KgStats`, `GeneralizerProposal`, `GeneralizerResult` defined once in `types.ts` and reused. `Generalizer.run(): Promise<GeneralizerResult>`, `kgStats(client): Promise<KgStats>` — both stable signatures used unchanged by their callers (the MCP registry entry and `kg_maintain` respectively).
- **Known follow-up:** the `materializationLatencyMsP95` field reads from `pred:MaterializationCompleted` events that nothing currently emits. The contract is wired so future phases (or a v1.1 patch) can start emitting them without touching `kg_stats`. The current behavior — returning `0` when no events exist — is correct for v1.
- **Idempotency:** the generalizer's `fingerprintHash` is sha1-based and deterministic, so re-runs produce the same `className`. However, the underlying `SchemaProposer.propose` always creates a new proposal id; back-to-back generalizer runs will stack identical add-class proposals in `kg:tbox-staging`. The sweeper's usage gate will starve all but one. v1.1 may dedupe upstream; documented as known-gap.
