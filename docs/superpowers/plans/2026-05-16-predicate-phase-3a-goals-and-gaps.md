# Predicate Phase 3a — Goals & Gap Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the agent-loop foundations. `GoalStore` persists goals as RDF in `kg:goals` and emits typed lifecycle events to `kg:meta`. `Decomposer` (deterministic, heuristic) breaks a multi-hop question into structured sub-questions. `GapDetector` reports which predicates each sub-question needs and which are missing from the live TBox. `kg_research_goal` (now real, replacing its Phase-1 stub) composes them and returns a `GoalPlan` — the structured precursor to research execution (which lands in Phase 3b).

**Architecture:** New `predicate-agent` package depending on `predicate-mcp` and `predicate-reasoner`. GoalStore is a thin wrapper over `SparqlClient` that maps `Goal` objects to/from RDF in `kg:goals` and emits typed `GoalCreated`/`GoalStatusChanged` events to `kg:meta` (using the vocabulary added in Phase-2 P1). Decomposer is regex/keyword-based — LLM-driven decomposition is deferred to Phase 4. GapDetector calls `kg_explore_schema` per sub-question's intent and produces a flat report. `kg_research_goal` orchestrates the three and returns the `GoalPlan` without executing any research. Research execution + extraction + schema proposal land in Phase 3b/3c.

**Tech Stack:** Node 20+, TypeScript 5.x, pnpm workspaces, Vitest, `predicate-mcp` + `predicate-reasoner` workspace deps. No new runtime libs.

**Spec reference:** [`docs/superpowers/specs/2026-05-16-predicate-design.md`](../specs/2026-05-16-predicate-design.md) §§ 4.3, 5.1, 6, 6.1, 10, 17.

**Phase exit criteria:**
- A goal can be created, read back, and transitioned through `active → dormant → done`, with one `GoalCreated` and one `GoalStatusChanged` event per transition landing in `kg:meta`.
- Decomposer handles three canonical patterns — *"why did X break"*, *"what calls Y (transitively)"*, *"what depends on Z"* — and falls through to `unknown` for anything else.
- GapDetector identifies the predicates each known-pattern sub-question requires against `kg:tbox`, and reports missing predicates with stable names.
- `kg_research_goal(goal)` returns a `GoalPlan` with `goalId`, `subQuestions[]`, and `gaps[]`. It is no longer a stub.
- Eval expansion: 5 new multi-hop questions in the codebase domain exercise the loop and confirm structured plans come back. Existing demo + tests still green.
- Phase tag `v0.3a.0-goals-and-gaps` set at the final commit.

---

## File structure (created or modified in Phase 3a)

```
predicate/
├── packages/
│   ├── predicate-agent/                                (new package)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── .eslintrc.json
│   │   ├── src/
│   │   │   ├── index.ts                                ← re-exports
│   │   │   ├── types.ts                                ← Goal, SubQuestion, GoalPlan, etc.
│   │   │   ├── goal-store.ts                           ← GoalStore class
│   │   │   ├── decomposer.ts                           ← Decomposer (heuristic)
│   │   │   ├── gap-detector.ts                         ← GapDetector
│   │   │   └── research-goal.ts                        ← orchestrator
│   │   └── tests/
│   │       ├── goal-store.test.ts
│   │       ├── decomposer.test.ts
│   │       ├── gap-detector.test.ts
│   │       └── research-goal.test.ts
│   ├── predicate-mcp/                                  (modified)
│   │   ├── package.json                                ← add predicate-agent dep
│   │   ├── src/tools/kg-research-goal.ts               ← new MCP wrapper
│   │   ├── src/tools/registry.ts                       ← replace stub
│   │   ├── tests/tools/kg-research-goal.test.ts        ← new
│   │   └── tests/index.test.ts                         ← update stub-list test
│   └── predicate-eval/                                 (modified)
│       ├── src/research-questions.ts                   ← new: the 5 multi-hop questions
│       └── tests/research-loop.test.ts                 ← new
└── README.md                                            ← Phase 3a status
```

---

## Task 1: `predicate-agent` package skeleton + types

**Files:**
- Create: `packages/predicate-agent/package.json`
- Create: `packages/predicate-agent/tsconfig.json`
- Create: `packages/predicate-agent/vitest.config.ts`
- Create: `packages/predicate-agent/.eslintrc.json`
- Create: `packages/predicate-agent/src/types.ts`
- Create: `packages/predicate-agent/src/index.ts`
- Create: `packages/predicate-agent/tests/types.test.ts`

This task mirrors the `predicate-reasoner` scaffold pattern. Strict ESM, `noUncheckedIndexedAccess`, `fileParallelism: false`, `ESLINT_USE_FLAT_CONFIG=false`.

- [ ] **Step 1: Write `packages/predicate-agent/package.json`**

```json
{
  "name": "predicate-agent",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/src/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "ESLINT_USE_FLAT_CONFIG=false eslint src tests --max-warnings 0"
  },
  "dependencies": {
    "predicate-mcp": "workspace:*",
    "predicate-reasoner": "workspace:*"
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

- [ ] **Step 2: Write `packages/predicate-agent/tsconfig.json`**

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

- [ ] **Step 3: Write `packages/predicate-agent/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 4: Write `packages/predicate-agent/.eslintrc.json`**

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

- [ ] **Step 5: Write `packages/predicate-agent/src/types.ts`**

```typescript
export type GoalStatus = 'active' | 'dormant' | 'done';

export interface Goal {
  id: string;                  // IRI, e.g. urn:predicate:goal:G-<timestamp>-<random>
  statement: string;           // the user's question or intent
  status: GoalStatus;
  createdAt: string;           // ISO 8601
  updatedAt: string;
  source: 'user' | 'inferred';
  parentGoal?: string;         // optional parent goal IRI
}

export interface SubQuestionIntent {
  kind:
    | 'why-broken'
    | 'find-callers'
    | 'find-dependencies'
    | 'find-readers-of'
    | 'find-symbol-in-file'
    | 'unknown';
  // Free-form payload — each kind defines its own shape; consumers narrow on `kind`.
  payload: Record<string, string | boolean>;
}

export interface SubQuestion {
  id: string;                  // local to the goal (e.g. SQ-1)
  text: string;                // the natural-language sub-question
  intent: SubQuestionIntent;
}

export interface MissingPredicate {
  iri: string;
  reason: string;              // human-readable explanation
}

export interface GapReport {
  subQuestionId: string;
  answerable: boolean;         // true if all required predicates exist in kg:tbox
  missingPredicates: MissingPredicate[];
}

export interface GoalPlan {
  goalId: string;
  subQuestions: SubQuestion[];
  gaps: GapReport[];
}
```

- [ ] **Step 6: Write `packages/predicate-agent/src/index.ts`**

```typescript
export * from './types.js';
```

- [ ] **Step 7: Write the failing test `packages/predicate-agent/tests/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import type { Goal, GoalPlan, SubQuestion } from '../src/index.js';

describe('predicate-agent types', () => {
  it('Goal is structurally typed', () => {
    const g: Goal = {
      id: 'urn:predicate:goal:test',
      statement: 'why did login break',
      status: 'active',
      createdAt: '2026-05-16T00:00:00Z',
      updatedAt: '2026-05-16T00:00:00Z',
      source: 'user',
    };
    expect(g.status).toBe('active');
  });

  it('GoalPlan composes SubQuestions and gaps', () => {
    const sq: SubQuestion = {
      id: 'SQ-1',
      text: 'what does login depend on?',
      intent: { kind: 'find-dependencies', payload: { symbol: 'login', transitive: true } },
    };
    const p: GoalPlan = {
      goalId: 'urn:predicate:goal:test',
      subQuestions: [sq],
      gaps: [{ subQuestionId: 'SQ-1', answerable: true, missingPredicates: [] }],
    };
    expect(p.subQuestions).toHaveLength(1);
  });
});
```

- [ ] **Step 8: Run install + tests**

From the worktree root:
```bash
pnpm install
pnpm --filter predicate-agent test
```
Expected: 2 passed.

Full workspace:
```bash
pnpm test
```
Expected: 33 (mcp) + 29 (reasoner) + 2 (agent) + 2 (eval) = 66.

- [ ] **Step 9: Run typecheck + lint**

```bash
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```
Expected: both clean.

- [ ] **Step 10: Commit**

```bash
git add packages/predicate-agent pnpm-lock.yaml
git commit -m "feat(agent): scaffold predicate-agent package with Goal/SubQuestion/GoalPlan types"
```

---

## Task 2: `GoalStore` — CRUD + lifecycle events

`GoalStore` is the only writer to `kg:goals` and the only emitter of `GoalCreated` / `GoalStatusChanged` events to `kg:meta`. RDF mapping uses the meta vocabulary from Phase-2 P1.

**Files:**
- Create: `packages/predicate-agent/src/goal-store.ts`
- Create: `packages/predicate-agent/tests/goal-store.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/goal-store.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { GoalStore } from '../src/goal-store.js';

const client = new SparqlClient(loadConfig());
const store = new GoalStore(client);

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

afterAll(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('GoalStore', () => {
  it('creates a goal and emits a GoalCreated event', async () => {
    const g = await store.create({
      statement: 'why did login break',
      source: 'user',
    });
    expect(g.status).toBe('active');
    expect(g.id).toMatch(/^urn:predicate:goal:/);

    const readBack = await store.get(g.id);
    expect(readBack?.statement).toBe('why did login break');

    const events = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?e WHERE { GRAPH <kg:meta> { ?e a pred:GoalCreated } }
    `);
    expect(events.results.bindings).toHaveLength(1);
  });

  it('transitions status active → dormant → done and emits one event per change', async () => {
    const g = await store.create({ statement: 'q', source: 'user' });
    await store.setStatus(g.id, 'dormant');
    await store.setStatus(g.id, 'done');

    const final = await store.get(g.id);
    expect(final?.status).toBe('done');

    const r = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:meta> { ?e a pred:GoalStatusChanged } }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(2);
  });

  it('returns null for an unknown goal id', async () => {
    expect(await store.get('urn:predicate:goal:does-not-exist')).toBeNull();
  });

  it('lists active goals only', async () => {
    const a = await store.create({ statement: 'a', source: 'user' });
    const b = await store.create({ statement: 'b', source: 'user' });
    await store.setStatus(b.id, 'done');
    const active = await store.listActive();
    expect(active.map((g) => g.id)).toEqual([a.id]);
  });

  it('setStatus on an unknown goal throws', async () => {
    await expect(
      store.setStatus('urn:predicate:goal:missing', 'done'),
    ).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/goal-store.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/goal-store.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { escapeLiteral, escapeIRI } from 'predicate-mcp/src/sparql/escape.js';
import type { Goal, GoalStatus } from './types.js';

const META = 'https://industriagents.com/predicate/meta#';

function newGoalId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `urn:predicate:goal:G-${ts}-${rand}`;
}

function newEventId(kind: string): string {
  return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateGoalInput {
  statement: string;
  source: 'user' | 'inferred';
  parentGoal?: string;
}

export class GoalStore {
  constructor(private client: SparqlClient) {}

  async create(input: CreateGoalInput): Promise<Goal> {
    const id = newGoalId();
    const now = new Date().toISOString();
    const goal: Goal = {
      id,
      statement: input.statement,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      source: input.source,
      parentGoal: input.parentGoal,
    };

    const parentTriple = input.parentGoal
      ? `${escapeIRI(id)} pred:parentGoal ${escapeIRI(input.parentGoal)} .`
      : '';

    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:goals> {
          ${escapeIRI(id)} a pred:Goal ;
            pred:statement ${escapeLiteral(input.statement)} ;
            pred:status    "active" ;
            pred:createdAt "${now}"^^xsd:dateTime ;
            pred:updatedAt "${now}"^^xsd:dateTime ;
            pred:source    "${input.source}" .
          ${parentTriple}
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('goal-created'))} a pred:GoalCreated ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor "GoalStore" ;
            pred:goal  ${escapeIRI(id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ statement: input.statement, source: input.source }))} .
        }
      }
    `);
    return goal;
  }

  async get(id: string): Promise<Goal | null> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?statement ?status ?createdAt ?updatedAt ?source ?parent WHERE {
        GRAPH <kg:goals> {
          ${escapeIRI(id)} pred:statement ?statement ;
                            pred:status    ?status ;
                            pred:createdAt ?createdAt ;
                            pred:updatedAt ?updatedAt ;
                            pred:source    ?source .
          OPTIONAL { ${escapeIRI(id)} pred:parentGoal ?parent }
        }
      } LIMIT 1
    `);
    const b = r.results.bindings[0];
    if (!b) return null;
    return {
      id,
      statement: b.statement!.value,
      status: b.status!.value as GoalStatus,
      createdAt: b.createdAt!.value,
      updatedAt: b.updatedAt!.value,
      source: b.source!.value as 'user' | 'inferred',
      parentGoal: b.parent?.value,
    };
  }

  async setStatus(id: string, newStatus: GoalStatus): Promise<void> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Goal not found: ${id}`);
    const now = new Date().toISOString();

    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      DELETE { GRAPH <kg:goals> { ${escapeIRI(id)} pred:status ?old ; pred:updatedAt ?ts } }
      INSERT {
        GRAPH <kg:goals> {
          ${escapeIRI(id)} pred:status "${newStatus}" ;
                            pred:updatedAt "${now}"^^xsd:dateTime .
        }
        GRAPH <kg:meta> {
          ${escapeIRI(newEventId('goal-status-changed'))} a pred:GoalStatusChanged ;
            pred:at    "${now}"^^xsd:dateTime ;
            pred:actor "GoalStore" ;
            pred:goal  ${escapeIRI(id)} ;
            pred:payload ${escapeLiteral(JSON.stringify({ from: existing.status, to: newStatus }))} .
        }
      }
      WHERE { GRAPH <kg:goals> { ${escapeIRI(id)} pred:status ?old ; pred:updatedAt ?ts } }
    `);
  }

  async listActive(): Promise<Goal[]> {
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?id WHERE {
        GRAPH <kg:goals> { ?id pred:status "active" }
      }
    `);
    const ids = r.results.bindings.map((b) => b.id!.value);
    const goals = await Promise.all(ids.map((id) => this.get(id)));
    return goals.filter((g): g is Goal => g !== null);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test tests/goal-store.test.ts
```
Expected: 5 passed.

- [ ] **Step 5: Update `src/index.ts` to re-export GoalStore**

```typescript
export * from './types.js';
export * from './goal-store.js';
```

- [ ] **Step 6: Run typecheck + lint**

```bash
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-agent/src/goal-store.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/goal-store.test.ts
git commit -m "feat(agent): GoalStore CRUD + GoalCreated/GoalStatusChanged events"
```

---

## Task 3: `Decomposer` — heuristic question → sub-questions

The decomposer is **deterministic** in v1 — regex/keyword patterns covering three canonical multi-hop shapes, with a passthrough `unknown` for everything else. LLM-based decomposition is a Phase 4 upgrade.

**Files:**
- Create: `packages/predicate-agent/src/decomposer.ts`
- Create: `packages/predicate-agent/tests/decomposer.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/decomposer.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Decomposer } from '../src/decomposer.js';

const decomposer = new Decomposer();

describe('Decomposer', () => {
  it('decomposes "why did X break" into structured sub-questions', () => {
    const subs = decomposer.decompose('why did login break');
    const kinds = subs.map((s) => s.intent.kind);
    expect(kinds).toContain('why-broken');
    expect(kinds).toContain('find-dependencies');
    const why = subs.find((s) => s.intent.kind === 'why-broken')!;
    expect(why.intent.payload.symbol).toBe('login');
  });

  it('decomposes "what calls Y transitively" with transitive=true', () => {
    const subs = decomposer.decompose('what calls validateToken transitively');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.intent.kind).toBe('find-callers');
    expect(subs[0]!.intent.payload.symbol).toBe('validateToken');
    expect(subs[0]!.intent.payload.transitive).toBe(true);
  });

  it('decomposes "what calls Y" non-transitively', () => {
    const subs = decomposer.decompose('what calls validateToken');
    expect(subs[0]!.intent.payload.transitive).toBe(false);
  });

  it('decomposes "what depends on Z" as find-dependencies', () => {
    const subs = decomposer.decompose('what depends on JWT_SECRET');
    expect(subs[0]!.intent.kind).toBe('find-dependencies');
    expect(subs[0]!.intent.payload.symbol).toBe('JWT_SECRET');
  });

  it('falls through to "unknown" for unmatched questions', () => {
    const subs = decomposer.decompose('how is the weather today');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.intent.kind).toBe('unknown');
    expect(subs[0]!.intent.payload.raw).toBe('how is the weather today');
  });

  it('assigns stable SQ-N ids in order', () => {
    const subs = decomposer.decompose('why did login break');
    expect(subs.map((s) => s.id)).toEqual(subs.map((_, i) => `SQ-${i + 1}`));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/decomposer.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/decomposer.ts`**

```typescript
import type { SubQuestion, SubQuestionIntent } from './types.js';

interface Pattern {
  regex: RegExp;
  build: (m: RegExpMatchArray) => SubQuestion[];
}

const PATTERNS: Pattern[] = [
  {
    // "why did X break"
    regex: /^why\s+did\s+(\w[\w./-]*)\s+break\b/i,
    build: (m) => {
      const symbol = m[1]!;
      return [
        {
          id: 'PLACEHOLDER',
          text: `what is happening with ${symbol}`,
          intent: { kind: 'why-broken', payload: { symbol } },
        },
        {
          id: 'PLACEHOLDER',
          text: `what does ${symbol} depend on transitively`,
          intent: { kind: 'find-dependencies', payload: { symbol, transitive: true } },
        },
      ];
    },
  },
  {
    // "what calls Y [transitively]"
    regex: /^what\s+calls\s+(\w[\w./-]*)(\s+transitively)?\b/i,
    build: (m) => {
      const symbol = m[1]!;
      const transitive = Boolean(m[2]);
      return [
        {
          id: 'PLACEHOLDER',
          text: `find callers of ${symbol}${transitive ? ' (transitive)' : ''}`,
          intent: { kind: 'find-callers', payload: { symbol, transitive } },
        },
      ];
    },
  },
  {
    // "what depends on Z [transitively]"
    regex: /^what\s+depends\s+on\s+(\w[\w./-]*)(\s+transitively)?\b/i,
    build: (m) => {
      const symbol = m[1]!;
      const transitive = Boolean(m[2]);
      return [
        {
          id: 'PLACEHOLDER',
          text: `find things depending on ${symbol}${transitive ? ' (transitive)' : ''}`,
          intent: { kind: 'find-dependencies', payload: { symbol, transitive } },
        },
      ];
    },
  },
];

export class Decomposer {
  decompose(question: string): SubQuestion[] {
    const trimmed = question.trim();
    for (const p of PATTERNS) {
      const m = trimmed.match(p.regex);
      if (m) return this.assignIds(p.build(m));
    }
    return this.assignIds([
      {
        id: 'PLACEHOLDER',
        text: trimmed,
        intent: { kind: 'unknown', payload: { raw: trimmed } } as SubQuestionIntent,
      },
    ]);
  }

  private assignIds(subs: SubQuestion[]): SubQuestion[] {
    return subs.map((s, i) => ({ ...s, id: `SQ-${i + 1}` }));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test tests/decomposer.test.ts
```
Expected: 6 passed.

- [ ] **Step 5: Re-export from `src/index.ts`**

```typescript
export * from './types.js';
export * from './goal-store.js';
export * from './decomposer.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-agent/src/decomposer.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/decomposer.test.ts
git commit -m "feat(agent): Decomposer — heuristic question → SubQuestion[]"
```

---

## Task 4: `GapDetector` — required predicates vs. live TBox

For each sub-question kind, the gap detector knows which predicates are required to answer it. It calls `kg_explore_schema` (or queries `kg:tbox` directly) to check whether each required predicate is declared. The result is a flat `GapReport`.

The mapping kind → required predicates:

| `SubQuestionIntent.kind` | Required predicates (IRIs) |
|---|---|
| `why-broken` | `:dependsOn`, `:lastModifiedIn` |
| `find-callers` | `:calls` |
| `find-dependencies` (non-transitive) | `:imports` |
| `find-dependencies` (transitive) | `:dependsOn` (which is `:imports rdfs:subPropertyOf :dependsOn` in TBox) |
| `find-readers-of` | `:reads` |
| `find-symbol-in-file` | `:declaredIn` |
| `unknown` | (no predicates inferable) |

(All `:` prefixes are `https://industriagents.com/predicate/codebase#`.)

**Files:**
- Create: `packages/predicate-agent/src/gap-detector.ts`
- Create: `packages/predicate-agent/tests/gap-detector.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/gap-detector.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { GapDetector } from '../src/gap-detector.js';
import type { SubQuestion } from '../src/types.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const client = new SparqlClient(loadConfig());
const detector = new GapDetector(client);

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function loadTbox(file: string): Promise<void> {
  const ttl = readFileSync(resolve(import.meta.dirname, '../../', file), 'utf8');
  const cfg = loadConfig();
  const auth = 'Basic ' + Buffer.from(
    `${process.env.PREDICATE_ADMIN_USER ?? 'admin'}:${process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme'}`,
  ).toString('base64');
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', Authorization: auth },
    body: ttl,
  });
}

beforeAll(async () => {
  await reset('kg:tbox');
  await loadTbox('predicate-ontology/tbox/codebase.ttl');
  await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
  await loadTbox('predicate-ontology/shapes/codebase.shacl.ttl');
});

afterAll(async () => {
  // Leave kg:tbox as the seed TBox so subsequent tests see the codebase ontology.
});

describe('GapDetector', () => {
  it('reports answerable=true for find-callers with :calls in TBox', async () => {
    const sq: SubQuestion = {
      id: 'SQ-1', text: 'find callers of x',
      intent: { kind: 'find-callers', payload: { symbol: 'x', transitive: false } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(true);
    expect(r.missingPredicates).toEqual([]);
  });

  it('reports answerable=true for find-dependencies transitive (uses :dependsOn)', async () => {
    const sq: SubQuestion = {
      id: 'SQ-2', text: 'transitive deps',
      intent: { kind: 'find-dependencies', payload: { symbol: 'x', transitive: true } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(true);
  });

  it('reports answerable=true for find-readers-of (uses :reads)', async () => {
    const sq: SubQuestion = {
      id: 'SQ-3', text: 'who reads SECRET',
      intent: { kind: 'find-readers-of', payload: { envVar: 'SECRET' } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(true);
  });

  it('reports answerable=false and lists missing predicates when TBox lacks them', async () => {
    // Drop :calls from kg:tbox to simulate a missing predicate
    await client.update(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      DELETE { GRAPH <kg:tbox> { c:calls ?p ?o } }
      INSERT { GRAPH <kg:meta> { <urn:test:saved-calls> ?p ?o } }
      WHERE  { GRAPH <kg:tbox> { c:calls ?p ?o } }
    `);
    const sq: SubQuestion = {
      id: 'SQ-4', text: 'find callers of f',
      intent: { kind: 'find-callers', payload: { symbol: 'f' } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(false);
    expect(r.missingPredicates.map((m) => m.iri)).toContain('https://industriagents.com/predicate/codebase#calls');

    // Restore :calls so subsequent tests see it. Re-load the TBox.
    await client.update(`DROP SILENT GRAPH <kg:tbox>`);
    await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
    await loadTbox('predicate-ontology/tbox/codebase.ttl');
    await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
    await loadTbox('predicate-ontology/shapes/codebase.shacl.ttl');
  });

  it('reports answerable=false for "unknown" sub-questions with a generic gap', async () => {
    const sq: SubQuestion = {
      id: 'SQ-5', text: 'random text',
      intent: { kind: 'unknown', payload: { raw: 'random text' } },
    };
    const r = await detector.detect(sq);
    expect(r.answerable).toBe(false);
    expect(r.missingPredicates).toHaveLength(1);
    expect(r.missingPredicates[0]!.reason).toMatch(/cannot decompose/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/gap-detector.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/gap-detector.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { escapeIRI } from 'predicate-mcp/src/sparql/escape.js';
import type { GapReport, MissingPredicate, SubQuestion } from './types.js';

const C = 'https://industriagents.com/predicate/codebase#';

const REQUIRED_PREDICATES: Record<string, string[]> = {
  'why-broken':                [`${C}dependsOn`, `${C}lastModifiedIn`],
  'find-callers':              [`${C}calls`],
  'find-dependencies-direct':  [`${C}imports`],
  'find-dependencies-trans':   [`${C}dependsOn`],
  'find-readers-of':           [`${C}reads`],
  'find-symbol-in-file':       [`${C}declaredIn`],
};

function requiredPredicates(sq: SubQuestion): string[] {
  switch (sq.intent.kind) {
    case 'why-broken':         return REQUIRED_PREDICATES['why-broken']!;
    case 'find-callers':       return REQUIRED_PREDICATES['find-callers']!;
    case 'find-readers-of':    return REQUIRED_PREDICATES['find-readers-of']!;
    case 'find-symbol-in-file':return REQUIRED_PREDICATES['find-symbol-in-file']!;
    case 'find-dependencies':
      return sq.intent.payload.transitive === true
        ? REQUIRED_PREDICATES['find-dependencies-trans']!
        : REQUIRED_PREDICATES['find-dependencies-direct']!;
    case 'unknown':            return [];
    default:                   return [];
  }
}

export class GapDetector {
  constructor(private client: SparqlClient) {}

  async detect(sq: SubQuestion): Promise<GapReport> {
    if (sq.intent.kind === 'unknown') {
      return {
        subQuestionId: sq.id,
        answerable: false,
        missingPredicates: [{
          iri: '',
          reason: 'cannot decompose: question pattern not recognized by v1 decomposer',
        }],
      };
    }
    const required = requiredPredicates(sq);
    if (required.length === 0) {
      return { subQuestionId: sq.id, answerable: true, missingPredicates: [] };
    }
    const missing: MissingPredicate[] = [];
    for (const iri of required) {
      const present = await this.client.ask(`
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        ASK {
          GRAPH <kg:tbox> {
            ${escapeIRI(iri)} a ?t .
            FILTER (?t IN (owl:ObjectProperty, owl:DatatypeProperty,
                           owl:AnnotationProperty, rdf:Property))
          }
        }
      `);
      if (!present) {
        missing.push({ iri, reason: `predicate not declared in kg:tbox` });
      }
    }
    return {
      subQuestionId: sq.id,
      answerable: missing.length === 0,
      missingPredicates: missing,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test tests/gap-detector.test.ts
```
Expected: 5 passed.

- [ ] **Step 5: Re-export from `src/index.ts`**

```typescript
export * from './types.js';
export * from './goal-store.js';
export * from './decomposer.js';
export * from './gap-detector.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-agent/src/gap-detector.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/gap-detector.test.ts
git commit -m "feat(agent): GapDetector reports missing predicates per SubQuestion"
```

---

## Task 5: `kg_research_goal` orchestrator (no research yet)

Composes GoalStore, Decomposer, GapDetector. Creates a goal, decomposes it, runs gap detection on each sub-question, and returns a `GoalPlan`. Does NOT execute research (that's Phase 3b).

**Files:**
- Create: `packages/predicate-agent/src/research-goal.ts`
- Create: `packages/predicate-agent/tests/research-goal.test.ts`

- [ ] **Step 1: Write the failing test `packages/predicate-agent/tests/research-goal.test.ts`**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { researchGoal } from '../src/research-goal.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function loadTbox(file: string): Promise<void> {
  const ttl = readFileSync(resolve(import.meta.dirname, '../../', file), 'utf8');
  const cfg = loadConfig();
  const auth = 'Basic ' + Buffer.from(
    `${process.env.PREDICATE_ADMIN_USER ?? 'admin'}:${process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme'}`,
  ).toString('base64');
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', Authorization: auth },
    body: ttl,
  });
}

beforeAll(async () => {
  await reset('kg:tbox');
  await loadTbox('predicate-ontology/tbox/codebase.ttl');
  await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
});

beforeEach(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('researchGoal', () => {
  it('creates a goal, decomposes it, returns sub-questions + gaps', async () => {
    const plan = await researchGoal(client, {
      goal: 'why did login break',
      source: 'user',
    });
    expect(plan.goalId).toMatch(/^urn:predicate:goal:/);
    expect(plan.subQuestions.length).toBeGreaterThan(0);
    expect(plan.gaps).toHaveLength(plan.subQuestions.length);
    // All sub-questions of "why did login break" are answerable with the seed TBox.
    expect(plan.gaps.every((g) => g.answerable)).toBe(true);
  });

  it('reports gaps when the TBox is missing a required predicate', async () => {
    await client.update(`
      PREFIX c: <https://industriagents.com/predicate/codebase#>
      DELETE { GRAPH <kg:tbox> { c:calls ?p ?o } }
      INSERT { GRAPH <kg:meta> { <urn:test:saved> ?p ?o } }
      WHERE  { GRAPH <kg:tbox> { c:calls ?p ?o } }
    `);
    const plan = await researchGoal(client, {
      goal: 'what calls validateToken',
      source: 'user',
    });
    expect(plan.gaps[0]!.answerable).toBe(false);
    expect(plan.gaps[0]!.missingPredicates[0]!.iri)
      .toBe('https://industriagents.com/predicate/codebase#calls');
    // Restore the predicate so later tests pass.
    await reset('kg:tbox');
    await loadTbox('predicate-ontology/tbox/codebase.ttl');
    await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
  });

  it('the created goal exists in kg:goals with GoalCreated in kg:meta', async () => {
    const plan = await researchGoal(client, { goal: 'why did x break', source: 'user' });
    const ok = await client.ask(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      ASK { GRAPH <kg:goals> { <${plan.goalId}> a pred:Goal } }
    `);
    expect(ok).toBe(true);
    const evt = await client.ask(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      ASK { GRAPH <kg:meta> { ?e a pred:GoalCreated ; pred:goal <${plan.goalId}> } }
    `);
    expect(evt).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test tests/research-goal.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/predicate-agent/src/research-goal.ts`**

```typescript
import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { GoalStore } from './goal-store.js';
import { Decomposer } from './decomposer.js';
import { GapDetector } from './gap-detector.js';
import type { GoalPlan } from './types.js';

export interface ResearchGoalInput {
  goal: string;
  source: 'user' | 'inferred';
  parentGoal?: string;
}

export async function researchGoal(
  client: SparqlClient,
  input: ResearchGoalInput,
): Promise<GoalPlan> {
  const store = new GoalStore(client);
  const decomposer = new Decomposer();
  const detector = new GapDetector(client);

  const goal = await store.create({
    statement: input.goal,
    source: input.source,
    parentGoal: input.parentGoal,
  });

  const subQuestions = decomposer.decompose(input.goal);
  const gaps = await Promise.all(subQuestions.map((sq) => detector.detect(sq)));

  return { goalId: goal.id, subQuestions, gaps };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test tests/research-goal.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Re-export**

```typescript
// packages/predicate-agent/src/index.ts
export * from './types.js';
export * from './goal-store.js';
export * from './decomposer.js';
export * from './gap-detector.js';
export * from './research-goal.js';
```

- [ ] **Step 6: Run full agent suite + typecheck + lint**

```bash
pnpm --filter predicate-agent test
pnpm --filter predicate-agent typecheck
pnpm --filter predicate-agent lint
```
Expected: 16 tests passed (2 types + 5 goal-store + 6 decomposer + 5 gap-detector + 3 research-goal), typecheck/lint clean.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-agent/src/research-goal.ts \
        packages/predicate-agent/src/index.ts \
        packages/predicate-agent/tests/research-goal.test.ts
git commit -m "feat(agent): researchGoal orchestrator returns GoalPlan (no research yet)"
```

---

## Task 6: Wire `kg_research_goal` into the MCP registry

Replace the Phase-1 stub with a real handler that calls `researchGoal` from the agent package.

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-research-goal.ts`
- Modify: `packages/predicate-mcp/src/tools/registry.ts`
- Modify: `packages/predicate-mcp/package.json` (add `predicate-agent` dep)
- Create: `packages/predicate-mcp/tests/tools/kg-research-goal.test.ts`
- Modify: `packages/predicate-mcp/tests/index.test.ts` (stub list)

- [ ] **Step 1: Add `predicate-agent` as a workspace dep of `predicate-mcp`**

```bash
cd packages/predicate-mcp && pnpm add 'predicate-agent@workspace:*'
```

Then re-install at the worktree root:
```bash
cd ../.. && pnpm install
```

- [ ] **Step 2: Write the failing test `packages/predicate-mcp/tests/tools/kg-research-goal.test.ts`**

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
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('kg_research_goal wired in MCP registry', () => {
  const tools = buildTools(client);

  it('is no longer a stub', async () => {
    const tool = tools.find((t) => t.name === 'kg_research_goal')!;
    expect(tool).toBeDefined();
    const result = (await tool.handler({
      goal: 'why did login break',
      source: 'user',
    })) as { goalId: string; subQuestions: unknown[]; gaps: unknown[] };
    expect(typeof result.goalId).toBe('string');
    expect(Array.isArray(result.subQuestions)).toBe(true);
    expect(Array.isArray(result.gaps)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter predicate-mcp test tests/tools/kg-research-goal.test.ts
```
Expected: FAIL — the tool is currently a stub throwing `NotImplementedError`.

- [ ] **Step 4: Implement `packages/predicate-mcp/src/tools/kg-research-goal.ts`**

```typescript
import { SparqlClient } from '../sparql/client.js';
import { researchGoal } from 'predicate-agent/src/index.js';

export interface ResearchGoalToolInput {
  goal: string;
  source?: 'user' | 'inferred';
  parentGoal?: string;
}

export async function kgResearchGoal(
  client: SparqlClient,
  input: ResearchGoalToolInput,
): Promise<unknown> {
  return researchGoal(client, {
    goal: input.goal,
    source: input.source ?? 'user',
    parentGoal: input.parentGoal,
  });
}
```

- [ ] **Step 5: Replace the stub in `packages/predicate-mcp/src/tools/registry.ts`**

Read the current file. Locate the `kg_research_goal` entry in `stubs()` and remove it. Add a real entry to `buildTools()` (alongside `kg_explain`, `kg_assert`, etc.):

```typescript
import { kgResearchGoal } from './kg-research-goal.js';

// in buildTools(), append (or wherever logical):
{
  name: 'kg_research_goal',
  description: 'Decompose a goal and report which predicates the live TBox can/cannot answer; returns a GoalPlan.',
  inputSchema: z.object({
    goal: z.string().min(1),
    source: z.enum(['user', 'inferred']).optional(),
    parentGoal: z.string().optional(),
  }),
  handler: async (raw): Promise<unknown> => {
    const args = z.object({
      goal: z.string(),
      source: z.enum(['user', 'inferred']).optional(),
      parentGoal: z.string().optional(),
    }).parse(raw);
    return kgResearchGoal(client, args);
  },
},
```

Remove `['kg_research_goal', ...]` from the `stubs()` array.

- [ ] **Step 6: Update the stub-list test in `tests/index.test.ts`**

After Phase 2, the stub test used `kg_propose_schema`. That tool is still a stub in 3a — keep using it. The "exposes all 8 tools" test should continue to pass without changes (we haven't removed any tools). Verify by reading the file; no edit may be needed.

- [ ] **Step 7: Run tests to verify they pass**

```bash
pnpm --filter predicate-mcp test
```
Expected: 33 + 1 (new kg_research_goal test) = 34 passing.

Full workspace:
```bash
pnpm test
```
Expected: 34 (mcp) + 29 (reasoner) + 16 (agent) + 2 (eval) = 81.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-research-goal.ts \
        packages/predicate-mcp/src/tools/registry.ts \
        packages/predicate-mcp/tests/tools/kg-research-goal.test.ts \
        packages/predicate-mcp/package.json \
        pnpm-lock.yaml
git commit -m "feat(mcp): kg_research_goal real impl (replaces Phase-1 stub)"
```

---

## Task 7: Eval expansion — 5 multi-hop questions exercise the goal loop

**Files:**
- Create: `packages/predicate-eval/src/research-questions.ts`
- Create: `packages/predicate-eval/tests/research-loop.test.ts`

- [ ] **Step 1: Write `packages/predicate-eval/src/research-questions.ts`**

```typescript
export interface ResearchQuestion {
  question: string;
  // Expected outcome:
  //   answerable=true means: GapDetector reports all required predicates present in seed TBox
  //   answerable=false means: GapDetector reports at least one missing predicate
  expectedAnswerable: boolean;
  // The kind of intent expected in at least one of the decomposed sub-questions.
  expectedIntentKinds: string[];
}

export const RESEARCH_QUESTIONS: ResearchQuestion[] = [
  {
    question: 'why did login break',
    expectedAnswerable: true,
    expectedIntentKinds: ['why-broken', 'find-dependencies'],
  },
  {
    question: 'what calls validateToken transitively',
    expectedAnswerable: true,
    expectedIntentKinds: ['find-callers'],
  },
  {
    question: 'what depends on JWT_SECRET',
    expectedAnswerable: true,
    expectedIntentKinds: ['find-dependencies'],
  },
  {
    question: 'what depends on auth.ts transitively',
    expectedAnswerable: true,
    expectedIntentKinds: ['find-dependencies'],
  },
  {
    question: 'how do I cook a pancake',
    expectedAnswerable: false,
    expectedIntentKinds: ['unknown'],
  },
];
```

- [ ] **Step 2: Write the failing test `packages/predicate-eval/tests/research-loop.test.ts`**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { researchGoal } from 'predicate-agent/src/index.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RESEARCH_QUESTIONS } from '../src/research-questions.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function loadTbox(file: string): Promise<void> {
  const ttl = readFileSync(resolve(import.meta.dirname, '../../', file), 'utf8');
  const cfg = loadConfig();
  const auth = 'Basic ' + Buffer.from(
    `${process.env.PREDICATE_ADMIN_USER ?? 'admin'}:${process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme'}`,
  ).toString('base64');
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', Authorization: auth },
    body: ttl,
  });
}

beforeAll(async () => {
  await reset('kg:tbox');
  await loadTbox('predicate-ontology/tbox/codebase.ttl');
  await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
});

beforeEach(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('research loop over the 5 starter questions', () => {
  for (const { question, expectedAnswerable, expectedIntentKinds } of RESEARCH_QUESTIONS) {
    it(`${question}`, async () => {
      const plan = await researchGoal(client, { goal: question, source: 'user' });
      const intentKinds = plan.subQuestions.map((s) => s.intent.kind);
      for (const k of expectedIntentKinds) expect(intentKinds).toContain(k);
      const allAnswerable = plan.gaps.every((g) => g.answerable);
      expect(allAnswerable).toBe(expectedAnswerable);
    });
  }
});
```

- [ ] **Step 3: Run the test**

```bash
pnpm --filter predicate-eval test tests/research-loop.test.ts
```
Expected: 5 passed.

Full workspace:
```bash
pnpm test
```
Expected: 34 (mcp) + 29 (reasoner) + 16 (agent) + 7 (eval: 2 existing + 5 new) = 86.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-eval/src/research-questions.ts \
        packages/predicate-eval/tests/research-loop.test.ts
git commit -m "test(eval): research loop over 5 multi-hop questions"
```

---

## Task 8: Phase 3a exit — README, verify, tag

**Files:**
- Modify: `README.md` (status block)

- [ ] **Step 1: Update root `README.md` status block**

Read the current README. Replace the Status section with:

```markdown
## Status

Phase 3a (Goals & Gap Detection) complete: GoalStore + Decomposer + GapDetector +
`kg_research_goal` real impl. `predicate-agent` package introduced as the agent-loop
layer. The remaining Phase 3 work — research execution (3b) and the schema-evolution
loop (3c) — is outlined in `docs/superpowers/plans/`.
```

(Update the package table too if needed — add `predicate-agent`.)

The package table should now include:

```markdown
| Package | Purpose |
|---|---|
| `predicate-server` | Fuseki/TDB2 in Docker; 8 named graphs |
| `predicate-mcp` | MCP server; 8 tools (5 implemented, 3 stubs: kg_propose_schema, kg_stats, plus deferred items) |
| `predicate-reasoner` | OWL 2 RL reasoner (16 rules) + SHACL + kg_explain |
| `predicate-agent` | Goal store, decomposer, gap detector, research orchestrator |
| `predicate-ontology` | Versioned TBox + SHACL shapes + meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | SKILL.md + plugin.json + SessionStart hook |
```

(Adjust the "5 implemented" count to match reality — `kg_explore_schema`, `kg_ask`, `kg_assert`, `kg_explain`, `kg_maintain`, `kg_research_goal` is 6; `kg_propose_schema`, `kg_stats` are 2 stubs.)

- [ ] **Step 2: Run the full suite**

```bash
pnpm typecheck
pnpm lint
pnpm test
```
Expected: all green. Test total: 86.

- [ ] **Step 3: Commit and tag**

```bash
git add README.md
git commit -m "docs: README + Phase 3a status; tag v0.3a.0-goals-and-gaps"
git tag v0.3a.0-goals-and-gaps
```

- [ ] **Step 4: Confirm final state**

```bash
git log --oneline -15
git tag --list 'v*'
```
Expected: `v0.1.0-foundation`, `v0.2.0-discipline`, `v0.3a.0-goals-and-gaps` all present.

---

## Phase 3b / 3c — outline only (separate plans)

Recorded so the sequence isn't lost.

### Phase 3b — Research execution (PRD weeks 5–6 of the agent loop)

- `ResearchSource` interface in `predicate-agent`.
- `DocsResearchSource` impl: takes a glob, returns file contents as `ResearchArtifact[]`. Deterministic, fully testable.
- `Extractor` (regex-based v1): maps `ResearchArtifact` + `SubQuestionIntent` → candidate triples with calibrated confidence per source/method.
- `kg_research_goal` enhanced: in addition to returning the plan, it now executes the loop — fetches research, runs the extractor, asserts triples via `kg_assert` (which already enforces TBox membership).
- Exit: a `find-dependencies` goal against the demo corpus actually adds 5+ new triples to `kg:abox`.

### Phase 3c — Schema evolution loop (PRD weeks 7–8 of the agent loop)

- `kg_propose_schema` real impl (replacing the Phase-1 stub). Accepts the tagged-union `SchemaDelta` from spec §6.1. Writes to `kg:tbox-staging` and emits a `SchemaProposed` event.
- `PromotionSweeper` (cron-style, also runnable via `kg_maintain`): walks `kg:tbox-staging`, runs `ReasonerAdapter.validate()` (already in place), checks the usage gate against `kg:usage`, promotes successful candidates via a journal-based atomic operation (git commit + `kg:meta` event + drop+rematerialize `kg:inferred`).
- Eval: an end-to-end test where the agent encounters a gap (per Phase 3a), the test injects a synthetic schema proposal, the proposal validates + meets the usage gate + promotes, and subsequent queries can use the new predicate.
- Exit: 30-question multi-hop eval at ≥70% correctness vs. RAG baseline.

---

## Self-review

- **Spec coverage:** §§ 4.3 (goal lifecycle as the first lifecycle clock), 5.1 (event log including GoalCreated/GoalStatusChanged), 6 (kg_research_goal real impl), 6.1 (SchemaDelta — referenced but unused in 3a; lands in 3c), 10 (no hook changes in 3a; existing SessionStart hook already surfaces active goal count). 3a is correctly scoped to the goal/gap subset.
- **Placeholder scan:** zero "TBD" / "implement later" / "handle errors". Every step shows actual code.
- **Type consistency:** `Goal`, `SubQuestion`, `SubQuestionIntent`, `GapReport`, `GoalPlan`, `GoalStatus` all defined once in `types.ts`. `researchGoal(client, input): GoalPlan` is the single orchestrator entry point. `GoalStore.create / get / setStatus / listActive` is the only mutation surface against `kg:goals`. `Decomposer.decompose(question: string): SubQuestion[]` and `GapDetector.detect(sq: SubQuestion): GapReport` have stable signatures used unchanged by `researchGoal` and the MCP tool.
- **Known follow-up:** Decomposer is regex-based and brittle by design. Cases like *"why is login failing"* (not "break") will fall through to `unknown`. Phase 4 lands an LLM-augmented decomposer. The eval set is deliberately tuned to known patterns so Phase 3a has a clean exit.
