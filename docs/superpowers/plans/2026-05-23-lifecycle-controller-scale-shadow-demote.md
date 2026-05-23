# Lifecycle Controller — Scale-Gate + Shadow Harness + Programmatic Demote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing schema-evolution loop in one control strategy — scale-gate the cost machinery, shadow-log gate decisions counterfactually, and make promotions reversible by id — built on a shared `LifecycleController` substrate.

**Architecture:** A new `LifecycleController` (`predicate-agent`) owns three primitives: `scaleSignal()` (tier from total triple count), `move()` (the one atomic graph-move + drop-inferred + emit-event used by reaper and demote), and a pure `decideCounterfactual()` used by a `ShadowEvaluator`. `kg_maintain` consults the controller to suppress reaper/generalizer below threshold and to run the shadow harness; a new `kg_demote` tool reverses a promotion through `move()`.

**Tech Stack:** Node 20+, TypeScript 5.x (ESM, `.js` import suffixes), pnpm workspaces, Vitest, Zod. No new runtime deps. Storage via `StorageAdapter` (`getAdapter()`); SPARQL escaping via `escapeIRI`/`escapeLiteral`.

**Spec reference:** [`docs/superpowers/specs/2026-05-23-lifecycle-controller-scale-shadow-demote-design.md`](../specs/2026-05-23-lifecycle-controller-scale-shadow-demote-design.md)

---

## Conventions (read once before starting)

- **Meta namespace:** `const META = 'https://industriagents.com/predicate/meta#';`
- **Event id helper** (copy from `promotion-sweeper.ts:23`): `urn:predicate:event:<kind>-<base36-ts>-<rand>`.
- **Counted data graphs** (scaleSignal): `kg:abox`, `kg:tbox`, `kg:inferred`, `kg:goals`, `kg:usage`. **Excluded:** `kg:meta`, all `*-archive` / `*-demoted` graphs.
- **Tests** use `getAdapter()` against the in-process WASM adapter; reset graphs with `DROP SILENT GRAPH` + `CREATE SILENT GRAPH` in `beforeEach` (pattern: `packages/predicate-agent/tests/promotion-sweeper.test.ts:18-44`).
- **Run a single test file:** `pnpm --filter predicate-agent test -- <file>` (agent pkg) / `pnpm --filter predicate-mcp test -- <file>` (mcp pkg). Run all: `pnpm -r test`.
- **Commit after every task** with the message shown in its final step.

## File structure

```
packages/predicate-agent/src/
  lifecycle-controller.ts        ← NEW: scaleSignal, move, ScaleTier, MoveSelector
  shadow-evaluator.ts            ← NEW: decideCounterfactual (pure) + ShadowEvaluator
  types.ts                       ← MODIFY: ScaleTier, GateShadowRecord, CounterfactualCell, DemoteDecision
  index.ts                       ← MODIFY: export the two new modules
  promotion-sweeper.ts           ← MODIFY (Task 11 only): route promote()'s graph-move through move()
packages/predicate-mcp/src/tools/
  kg-config.ts                   ← MODIFY: numeric key support + 'scale-gate-triples'
  kg-maintain.ts                 ← MODIFY: scale-gate reaper+generalizer; run shadow; route reaper through move()
  kg-demote.ts                   ← NEW: kg_demote tool
  kg-stats.ts                    ← MODIFY: tier, shadow rollup, demote survival
  registry.ts                    ← MODIFY: register kg_demote; widen kg_config schema
packages/predicate-cli/src/commands/
  schema.ts                      ← MODIFY: `demote <iri>` verb
  shadow-report.ts               ← NEW: print shadow rollup
packages/predicate-cli/src/index.ts ← MODIFY: route `shadow-report`; help text for `schema demote`
packages/predicate-agent/tests/
  lifecycle-controller.test.ts   ← NEW
  shadow-evaluator.test.ts       ← NEW
  demote.test.ts                 ← NEW (integration: promote→demote round-trip)
packages/predicate-mcp/tests/tools/
  kg-config-scale.test.ts        ← NEW
  kg-maintain-scale-gate.test.ts ← NEW
packages/predicate-ontology/tbox/
  demoted/.gitkeep               ← NEW
```

---

# PHASE 1 — Controller substrate + scale-gate

## Task 1: Add lifecycle types

**Files:**
- Modify: `packages/predicate-agent/src/types.ts` (append after the Phase-4 stats block, end of file)

- [ ] **Step 1: Append the new types**

```typescript
// --- Lifecycle controller: scale / shadow / demote --------------------

export type ScaleTier = 'Seedling' | 'Active';

/** One cell of the usage-gate counterfactual grid. */
export interface CounterfactualCell {
  n: number;                                 // use-count threshold
  ttlDays: number;                           // staging TTL
  decision: 'promote' | 'wait' | 'expire';
}

/** Payload of a pred:GateShadow event (JSON-serialised into pred:payload). */
export interface GateShadowRecord {
  proposalId: string;
  passTimestamp: string;                     // ISO 8601
  tier: ScaleTier;
  goalSource: 'explicit' | 'inferred';
  liveDecision: 'promote' | 'wait' | 'expire';
  currentUseCount: number;
  ageInStagingDays: number;
  counterfactual: CounterfactualCell[];
}

export interface DemoteDecision {
  proposalId: string;
  outcome: 'demoted' | 'not-found';
  reason?: string;
  demotedFile?: string;
  tboxVersion?: string;
}
```

- [ ] **Step 2: Run the package typecheck to confirm it still compiles**

Run: `pnpm --filter predicate-agent exec tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-agent/src/types.ts
git commit -m "feat(agent): lifecycle types (ScaleTier, GateShadowRecord, DemoteDecision)"
```

## Task 2: `LifecycleController.scaleSignal()`

**Files:**
- Create: `packages/predicate-agent/src/lifecycle-controller.ts`
- Test: `packages/predicate-agent/tests/lifecycle-controller.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { LifecycleController } from '../src/lifecycle-controller.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function insertAbox(n: number): Promise<void> {
  const triples = Array.from({ length: n }, (_, i) =>
    `<urn:test:s${i}> <urn:test:p> <urn:test:o${i}> .`).join('\n');
  await client.update(`INSERT DATA { GRAPH <kg:abox> { ${triples} } }`);
}

describe('LifecycleController.scaleSignal', () => {
  beforeEach(async () => {
    for (const g of ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage']) {
      await reset(g);
    }
  });

  it('returns Seedling below the threshold', async () => {
    await insertAbox(5);
    const ctrl = new LifecycleController(client, { scaleGateTriples: 10 });
    const sig = await ctrl.scaleSignal();
    expect(sig.tier).toBe('Seedling');
    expect(sig.tripleCount).toBe(5);
  });

  it('returns Active at/above the threshold', async () => {
    await insertAbox(10);
    const ctrl = new LifecycleController(client, { scaleGateTriples: 10 });
    const sig = await ctrl.scaleSignal();
    expect(sig.tier).toBe('Active');
    expect(sig.tripleCount).toBe(10);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-agent test -- lifecycle-controller`
Expected: FAIL — cannot find module `../src/lifecycle-controller.js`

- [ ] **Step 3: Implement `scaleSignal`**

Create `packages/predicate-agent/src/lifecycle-controller.ts`:

```typescript
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type { ScaleTier } from './types.js';

const COUNTED_GRAPHS = ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage'];

export interface LifecycleControllerOptions {
  /** Total-triple threshold. At/above => Active; below => Seedling. */
  scaleGateTriples?: number;
}

export interface ScaleSignal {
  tier: ScaleTier;
  tripleCount: number;
  threshold: number;
}

export class LifecycleController {
  private scaleGateTriples: number;

  constructor(private client: StorageAdapter, opts: LifecycleControllerOptions = {}) {
    this.scaleGateTriples = opts.scaleGateTriples ?? 25000;
  }

  async scaleSignal(): Promise<ScaleSignal> {
    let tripleCount = 0;
    for (const g of COUNTED_GRAPHS) {
      const r = await this.client.select(
        `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${g}> { ?s ?p ?o } }`,
      );
      tripleCount += parseInt(r.results.bindings[0]!['n']!.value, 10);
    }
    return {
      tier: tripleCount >= this.scaleGateTriples ? 'Active' : 'Seedling',
      tripleCount,
      threshold: this.scaleGateTriples,
    };
  }
}
```

- [ ] **Step 4: Export from the package index**

In `packages/predicate-agent/src/index.ts`, append:

```typescript
export * from './lifecycle-controller.js';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter predicate-agent test -- lifecycle-controller`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-agent/src/lifecycle-controller.ts packages/predicate-agent/src/index.ts packages/predicate-agent/tests/lifecycle-controller.test.ts
git commit -m "feat(agent): LifecycleController.scaleSignal — tier from total triple count"
```

## Task 3: `LifecycleController.move()` — the atomic primitive

**Files:**
- Modify: `packages/predicate-agent/src/lifecycle-controller.ts`
- Test: `packages/predicate-agent/tests/lifecycle-controller.test.ts`

`move()` performs an atomic graph-move, drops `kg:inferred`, and emits one `kg:meta` event. The selector is a discriminated union so it serves both the reaper (`where`) and demote (`ground`).

- [ ] **Step 1: Write the failing test (append to the existing describe-file)**

```typescript
import { LifecycleController } from '../src/lifecycle-controller.js';

describe('LifecycleController.move', () => {
  beforeEach(async () => {
    for (const g of ['kg:tbox', 'kg:tbox-demoted', 'kg:inferred', 'kg:meta']) {
      await reset(g);
    }
  });

  it('moves ground triples between graphs, drops inferred, emits an event', async () => {
    await client.update(`INSERT DATA { GRAPH <kg:tbox> { <urn:t:a> <urn:t:p> <urn:t:b> . } }`);
    await client.update(`INSERT DATA { GRAPH <kg:inferred> { <urn:i:x> <urn:i:p> <urn:i:y> . } }`);
    const ctrl = new LifecycleController(client);

    await ctrl.move({
      fromGraph: 'kg:tbox',
      toGraph: 'kg:tbox-demoted',
      selector: { kind: 'ground', tripleBlock: '<urn:t:a> <urn:t:p> <urn:t:b> .' },
      eventType: 'SchemaDemoted',
      goalIri: 'urn:test:proposal:1',
      payload: { proposalId: 'urn:test:proposal:1', reason: 'test' },
    });

    const tbox = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox> { ?s ?p ?o } }`);
    const demoted = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox-demoted> { ?s ?p ?o } }`);
    const inferred = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:inferred> { ?s ?p ?o } }`);
    const ev = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?e WHERE { GRAPH <kg:meta> { ?e a pred:SchemaDemoted } }`);

    expect(tbox.results.bindings[0]!['n']!.value).toBe('0');
    expect(demoted.results.bindings[0]!['n']!.value).toBe('1');
    expect(inferred.results.bindings[0]!['n']!.value).toBe('0'); // dropped
    expect(ev.results.bindings.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-agent test -- lifecycle-controller`
Expected: FAIL — `ctrl.move is not a function`

- [ ] **Step 3: Implement `move()`**

Add to `lifecycle-controller.ts` — imports at top:

```typescript
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
```

Add inside the class (and the supporting types above the class):

```typescript
export type MoveSelector =
  | { kind: 'ground'; tripleBlock: string }                 // concrete `s p o .` block
  | { kind: 'where'; whereClause: string };                 // pattern that binds ?s ?p ?o

export interface MoveOptions {
  fromGraph: string;
  toGraph: string;
  selector: MoveSelector;
  eventType: 'SchemaDemoted' | 'MaintenanceArchive';
  goalIri: string;
  payload: Record<string, unknown>;
}
```

```typescript
  private newEventId(kind: string): string {
    return `urn:predicate:event:${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async move(opts: MoveOptions): Promise<void> {
    const META = 'https://industriagents.com/predicate/meta#';
    if (opts.selector.kind === 'ground') {
      const block = opts.selector.tripleBlock;
      await this.client.update(
        `DELETE DATA { GRAPH <${opts.fromGraph}> { ${block} } }`,
      );
      await this.client.update(
        `INSERT DATA { GRAPH <${opts.toGraph}> { ${block} } }`,
      );
    } else {
      await this.client.update(`
        DELETE { GRAPH <${opts.fromGraph}> { ?s ?p ?o } }
        INSERT { GRAPH <${opts.toGraph}>   { ?s ?p ?o } }
        WHERE  { ${opts.selector.whereClause} }
      `);
    }
    await this.client.update(`DROP SILENT GRAPH <kg:inferred>`);
    const eventId = this.newEventId(opts.eventType.toLowerCase());
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:meta> {
        ${escapeIRI(eventId)} a pred:${opts.eventType} ;
          pred:at      "${new Date().toISOString()}"^^xsd:dateTime ;
          pred:actor   "LifecycleController" ;
          pred:goal    ${escapeIRI(opts.goalIri)} ;
          pred:payload ${escapeLiteral(JSON.stringify(opts.payload))} .
      } }
    `);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter predicate-agent test -- lifecycle-controller`
Expected: PASS (3 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-agent/src/lifecycle-controller.ts packages/predicate-agent/tests/lifecycle-controller.test.ts
git commit -m "feat(agent): LifecycleController.move — atomic graph-move + drop-inferred + event"
```

## Task 4: Numeric config key `scale-gate-triples`

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-config.ts`
- Test: `packages/predicate-mcp/tests/tools/kg-config-scale.test.ts`

The current `kg-config` supports only `boolean`/`string`. Add a `number` type and the `scale-gate-triples` key.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { kgConfigSet, kgConfigGet } from '../../src/tools/kg-config.js';

const client = getAdapter();

describe('kg-config scale-gate-triples', () => {
  beforeEach(async () => {
    await client.update(`DROP SILENT GRAPH <kg:meta>`);
    await client.update(`CREATE SILENT GRAPH <kg:meta>`);
  });

  it('round-trips a numeric value', async () => {
    const set = await kgConfigSet(client, { key: 'scale-gate-triples', value: 50000 });
    expect(set).toEqual({ ok: true, key: 'scale-gate-triples', value: 50000 });
    const got = await kgConfigGet(client, { key: 'scale-gate-triples' });
    expect(got).toEqual({ key: 'scale-gate-triples', value: 50000 });
  });

  it('rejects a non-numeric value', async () => {
    const set = await kgConfigSet(client, { key: 'scale-gate-triples', value: 'big' as unknown as number });
    expect(set.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-mcp test -- kg-config-scale`
Expected: FAIL — `unknown key 'scale-gate-triples'`

- [ ] **Step 3: Extend the key map and the type union**

In `kg-config.ts`:

Change the `KEY_TO_PROP` type and entries:

```typescript
const KEY_TO_PROP: Record<string, { prop: string; type: 'boolean' | 'string' | 'number' }> = {
  'schema-learning':    { prop: 'schemaLearningEnabled', type: 'boolean' },
  'init-mode':          { prop: 'initMode',              type: 'string'  },
  'init-ontology':      { prop: 'initOntology',          type: 'string'  },
  'scale-gate-triples': { prop: 'scaleGateTriples',      type: 'number'  },
};
```

Widen the input/result key unions (replace the three `'schema-learning' | ...` literals in `KgConfigSetInput`, `KgConfigGetInput`):

```typescript
type ConfigKey = 'schema-learning' | 'init-mode' | 'init-ontology' | 'scale-gate-triples';

export interface KgConfigSetInput { key: ConfigKey; value: string | boolean | number; }
export interface KgConfigGetInput { key?: ConfigKey; }
```

Update `KgConfigSetResult` and `KgConfigGetResult` value types to include `number`:

```typescript
export type KgConfigSetResult =
  | { ok: true; key: string; value: string | boolean | number }
  | { ok: false; error: string };

export interface KgConfigGetResult {
  config?: Record<string, string | boolean | number>;
  key?: string;
  value?: string | boolean | number | null;
}
```

Update `literalFor`:

```typescript
function literalFor(value: string | boolean | number, type: 'boolean' | 'string' | 'number'): string {
  if (type === 'boolean') {
    return `"${value}"^^<http://www.w3.org/2001/XMLSchema#boolean>`;
  }
  if (type === 'number') {
    return `"${value}"^^<http://www.w3.org/2001/XMLSchema#integer>`;
  }
  return escapeLiteral(String(value));
}
```

In `kgConfigSet`, after the boolean type-check, add a number type-check:

```typescript
  if (meta.type === 'number' && typeof input.value !== 'number') {
    return { ok: false, error: `${input.key} expects number, got ${typeof input.value}` };
  }
```

In `kgConfigGet` (single-key branch) replace the value coercion:

```typescript
    const value: string | boolean | number =
      meta.type === 'boolean' ? raw === 'true'
      : meta.type === 'number' ? parseInt(raw, 10)
      : raw;
```

In `kgConfigGet` (all-config branch) replace the per-binding coercion:

```typescript
    config[extKey] =
      kmeta.type === 'boolean' ? b['o']!.value === 'true'
      : kmeta.type === 'number' ? parseInt(b['o']!.value, 10)
      : b['o']!.value;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter predicate-mcp test -- kg-config-scale`
Expected: PASS (2 tests)

- [ ] **Step 5: Widen the registry zod schema for `kg_config`**

In `packages/predicate-mcp/src/tools/registry.ts`, find the `kg_config` set entry (`grep -n "scale-gate\|schema-learning\|kg_config" registry.ts`) and ensure the `key` enum includes `'scale-gate-triples'` and `value` accepts numbers, e.g.:

```typescript
inputSchema: z.object({
  key: z.enum(['schema-learning', 'init-mode', 'init-ontology', 'scale-gate-triples']),
  value: z.union([z.string(), z.boolean(), z.number()]),
}),
```

(If the existing schema uses a different shape, mirror it — only add the new key + number to the union.)

- [ ] **Step 6: Run mcp typecheck**

Run: `pnpm --filter predicate-mcp exec tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-config.ts packages/predicate-mcp/src/tools/registry.ts packages/predicate-mcp/tests/tools/kg-config-scale.test.ts
git commit -m "feat(mcp): numeric kg_config + scale-gate-triples key"
```

## Task 5: Scale-gate the reaper + generalizer in `kg_maintain`

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-maintain.ts`
- Test: `packages/predicate-mcp/tests/tools/kg-maintain-scale-gate.test.ts`

Below threshold, skip the reaper archive and the generalizer, and emit a `MaintenanceSkipped` event. Read the threshold from `kg_config` (fallback to `LifecycleController`'s default).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';
import { kgMaintain } from '../../src/tools/kg-maintain.js';
import { kgConfigSet } from '../../src/tools/kg-config.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

describe('kg_maintain scale-gate', () => {
  beforeEach(async () => {
    for (const g of ['kg:abox', 'kg:tbox', 'kg:inferred', 'kg:goals', 'kg:usage', 'kg:meta', 'kg:provenance', 'kg:tbox-staging']) {
      await reset(g);
    }
  });

  it('skips reaper+generalizer below threshold and emits MaintenanceSkipped', async () => {
    await kgConfigSet(client, { key: 'scale-gate-triples', value: 1000000 });
    const res = await kgMaintain(client, {});
    expect(res.tier).toBe('Seedling');
    expect(res.skipped).toBe(true);
    expect(res.archivedCount).toBe(0);
    const ev = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?e WHERE { GRAPH <kg:meta> { ?e a pred:MaintenanceSkipped } }`);
    expect(ev.results.bindings.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-mcp test -- kg-maintain-scale-gate`
Expected: FAIL — `res.tier` is undefined / `skipped` undefined

- [ ] **Step 3: Wire the scale-gate into `kgMaintain`**

In `kg-maintain.ts`:

Add imports:

```typescript
import { LifecycleController } from 'predicate-agent/src/index.js';
import { kgConfigGet } from './kg-config.js';
```

Extend `MaintainResult`:

```typescript
export interface MaintainResult {
  archivedCount: number;
  elapsedMs: number;
  eventId: string;
  tier: 'Seedling' | 'Active';
  skipped: boolean;
  sweeper?: SweeperResult;
  generalizer?: GeneralizerResult;
  fixpoint?: { iterations: number; inferredCount: number };
  autoProposalsSkipped?: boolean;
}
```

At the top of `kgMaintain`, after computing `t0`, resolve the threshold and tier:

```typescript
  const cfg = await kgConfigGet(client, { key: 'scale-gate-triples' });
  const scaleGateTriples = typeof cfg.value === 'number' ? cfg.value : undefined;
  const controller = new LifecycleController(client, { scaleGateTriples });
  const signal = await controller.scaleSignal();
```

Wrap the reaper block + generalizer call so they only run when `signal.tier === 'Active'`. When `Seedling`, emit a skip event and return early. Concretely, after the `controller.scaleSignal()` line and before `await client.update(\`CREATE SILENT GRAPH <kg:abox-archive>\`)`:

```typescript
  if (signal.tier === 'Seedling') {
    const skipId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:meta> {
        <${skipId}> a pred:MaintenanceSkipped ;
          pred:at      "${new Date().toISOString()}"^^xsd:dateTime ;
          pred:actor   "kg_maintain" ;
          pred:payload ${escapeLiteral(JSON.stringify({
            reason: 'below-scale-gate',
            tier: signal.tier,
            tripleCount: signal.tripleCount,
            threshold: signal.threshold,
          }))} .
      } }
    `);
    // Sweeper (usage+validation gate) stays live regardless of scale.
    const sweeper = await new PromotionSweeper(client, {
      useThreshold: input.useThreshold ?? 3,
    }).run();
    return {
      archivedCount: 0,
      elapsedMs: Date.now() - t0,
      eventId: skipId,
      tier: signal.tier,
      skipped: true,
      sweeper,
    };
  }
```

In the existing `Active`-path `return { ... }` at the end of the function, add `tier: signal.tier, skipped: false,`.

- [ ] **Step 4: Run the new test to verify it passes**

Run: `pnpm --filter predicate-mcp test -- kg-maintain-scale-gate`
Expected: PASS

- [ ] **Step 5: Run the existing maintain tests to confirm no regression**

Run: `pnpm --filter predicate-mcp test -- kg-maintain`
Expected: PASS (existing maintain tests still green; they have small graphs so they now hit Seedling — verify they assert on `sweeper`/events, not on `archivedCount > 0`. If any existing test depends on archiving, set `scale-gate-triples` to `0` in that test's setup so it stays Active.)

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-maintain.ts packages/predicate-mcp/tests/tools/kg-maintain-scale-gate.test.ts
git commit -m "feat(mcp): scale-gate reaper+generalizer in kg_maintain (sweeper stays live)"
```

## Task 6: Route the reaper archive through `move()`

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-maintain.ts`

Make the reaper the first `move({kind:'where'})` caller — this is the substrate consolidation, and keeps the "archive emits a typed event" behavior consistent with demote.

- [ ] **Step 1: Replace the inline reaper DELETE/INSERT with `controller.move()`**

In the `Active` path, replace the existing `await client.update(\` DELETE { GRAPH <kg:abox> ... } INSERT { GRAPH <kg:abox-archive> ... } WHERE { ... }\`)` block (`kg-maintain.ts:46-60`) with:

```typescript
  await controller.move({
    fromGraph: 'kg:abox',
    toGraph: 'kg:abox-archive',
    selector: {
      kind: 'where',
      whereClause: `
        GRAPH <kg:abox> { ?s ?p ?o }
        GRAPH <kg:provenance> {
          << ?s ?p ?o >> pred:confidence ?conf ;
                         pred:timestamp  ?ts .
          FILTER (?conf < ${archiveCutoff})
          FILTER (?ts < "${cutoffDate}"^^xsd:dateTime)
        }`,
    },
    eventType: 'MaintenanceArchive',
    goalIri: 'urn:predicate:maintenance',
    payload: { archiveCutoff, ageDays },
  });
```

Note: `move()` drops `kg:inferred` after the archive. The fixpoint re-materialization later in `kgMaintain` already rebuilds it, so this is consistent. Keep the `before`/`after` count logic to compute `archivedCount` (they wrap the `move()` call). The `move()` WHERE clause needs the `pred:` prefix bound — `move()` injects no prefixes for the `where` selector, so include `PREFIX pred: <...>` inline is NOT possible inside a WHERE; instead the controller's `move()` for `where` must prepend the standard prefixes. **Add** to `move()` (where-branch) a prefix header:

```typescript
      await this.client.update(`
        PREFIX pred: <${META}>
        PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
        DELETE { GRAPH <${opts.fromGraph}> { ?s ?p ?o } }
        INSERT { GRAPH <${opts.toGraph}>   { ?s ?p ?o } }
        WHERE  { ${opts.selector.whereClause} }
      `);
```

(Update Task 3's where-branch accordingly if implementing in order — both prefixes are harmless when unused.)

- [ ] **Step 2: Run the maintain tests**

Run: `pnpm --filter predicate-mcp test -- kg-maintain`
Expected: PASS (archivedCount still computed from before/after counts; a `MaintenanceArchive` event now also appears)

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-maintain.ts packages/predicate-agent/src/lifecycle-controller.ts
git commit -m "refactor(mcp): route reaper archive through LifecycleController.move()"
```

---

# PHASE 2 — Shadow harness

## Task 7: Pure `decideCounterfactual()`

**Files:**
- Create: `packages/predicate-agent/src/shadow-evaluator.ts`
- Test: `packages/predicate-agent/tests/shadow-evaluator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { decideCounterfactual } from '../src/shadow-evaluator.js';

describe('decideCounterfactual', () => {
  it('promotes when useCount >= N regardless of age', () => {
    expect(decideCounterfactual({ useCount: 5, ageInStagingDays: 1, n: 3, ttlDays: 7 })).toBe('promote');
  });
  it('expires when past TTL and under N', () => {
    expect(decideCounterfactual({ useCount: 1, ageInStagingDays: 8, n: 3, ttlDays: 7 })).toBe('expire');
  });
  it('waits when under N and within TTL', () => {
    expect(decideCounterfactual({ useCount: 1, ageInStagingDays: 2, n: 3, ttlDays: 7 })).toBe('wait');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-agent test -- shadow-evaluator`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the pure function**

Create `packages/predicate-agent/src/shadow-evaluator.ts`:

```typescript
import type { CounterfactualCell } from './types.js';

export interface CounterfactualInput {
  useCount: number;
  ageInStagingDays: number;
  n: number;
  ttlDays: number;
}

/** Mirror of PromotionSweeper.decide gate logic, as a pure function. */
export function decideCounterfactual(
  i: CounterfactualInput,
): 'promote' | 'wait' | 'expire' {
  if (i.useCount >= i.n) return 'promote';
  if (i.ageInStagingDays > i.ttlDays) return 'expire';
  return 'wait';
}

export const USAGE_GRID_N = [2, 3, 5];
export const USAGE_GRID_TTL = [3, 7, 14];

export function counterfactualGrid(
  useCount: number,
  ageInStagingDays: number,
): CounterfactualCell[] {
  const cells: CounterfactualCell[] = [];
  for (const n of USAGE_GRID_N) {
    for (const ttlDays of USAGE_GRID_TTL) {
      cells.push({ n, ttlDays, decision: decideCounterfactual({ useCount, ageInStagingDays, n, ttlDays }) });
    }
  }
  return cells;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter predicate-agent test -- shadow-evaluator`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-agent/src/shadow-evaluator.ts packages/predicate-agent/tests/shadow-evaluator.test.ts
git commit -m "feat(agent): pure decideCounterfactual + usage-gate grid"
```

## Task 8: `ShadowEvaluator` — emit `pred:GateShadow` events

**Files:**
- Modify: `packages/predicate-agent/src/shadow-evaluator.ts`
- Modify: `packages/predicate-agent/src/index.ts` (export)
- Test: `packages/predicate-agent/tests/shadow-evaluator.test.ts`

For each staging proposal: read its `expiresAt`/`proposedAt`, count uses (same query the sweeper uses), resolve `goalSource` from the motivating goal's `source`, compute the live decision + grid, and write one `GateShadow` event. Moves nothing.

- [ ] **Step 1: Write the failing integration test (append to shadow-evaluator.test.ts)**

```typescript
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { ShadowEvaluator } from '../src/shadow-evaluator.js';

const client = getAdapter();
const META = 'https://industriagents.com/predicate/meta#';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

describe('ShadowEvaluator', () => {
  beforeEach(async () => {
    for (const g of ['kg:tbox-staging', 'kg:meta', 'kg:usage', 'kg:goals']) await reset(g);
  });

  it('emits a GateShadow event per staging proposal, moving nothing', async () => {
    // a proposal motivated by an inferred goal
    await client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA {
        GRAPH <kg:goals> { <urn:goal:1> pred:source "inferred" . }
        GRAPH <kg:tbox-staging> {
          <urn:prop:1> a pred:Proposal ;
            pred:kind "add-class" ;
            pred:justification "j" ;
            pred:proposedAt "2026-05-20T00:00:00Z"^^xsd:dateTime ;
            pred:expiresAt  "2026-05-27T00:00:00Z"^^xsd:dateTime ;
            pred:motivatingGoal <urn:goal:1> .
        }
      }`);

    const evaluator = new ShadowEvaluator(client);
    const n = await evaluator.run({ tier: 'Seedling' });
    expect(n).toBe(1);

    const ev = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?payload WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow ; pred:payload ?payload } }`);
    expect(ev.results.bindings.length).toBe(1);
    const rec = JSON.parse(ev.results.bindings[0]!['payload']!.value);
    expect(rec.goalSource).toBe('inferred');
    expect(rec.counterfactual.length).toBe(9);
    // staging untouched
    const staging = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox-staging> { ?s ?p ?o } }`);
    expect(parseInt(staging.results.bindings[0]!['n']!.value, 10)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-agent test -- shadow-evaluator`
Expected: FAIL — `ShadowEvaluator` not exported

- [ ] **Step 3: Implement `ShadowEvaluator`**

Add to `shadow-evaluator.ts`:

```typescript
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeIRI, escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import type { GateShadowRecord, ScaleTier } from './types.js';

const META = 'https://industriagents.com/predicate/meta#';

export class ShadowEvaluator {
  constructor(private client: StorageAdapter) {}

  async run(opts: { tier: ScaleTier }): Promise<number> {
    const proposals = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?id ?proposedAt ?expiresAt ?goal WHERE {
        GRAPH <kg:tbox-staging> {
          ?id a pred:Proposal ;
              pred:proposedAt ?proposedAt ;
              pred:expiresAt  ?expiresAt .
          OPTIONAL { ?id pred:motivatingGoal ?goal }
        }
      }
    `);
    const now = Date.now();
    let count = 0;
    for (const b of proposals.results.bindings) {
      const id = b['id']!.value;
      const proposedAt = b['proposedAt']!.value;
      const ageInStagingDays = (now - new Date(proposedAt).getTime()) / 86400_000;
      const useCount = await this.countUses(id);
      const goalSource = await this.goalSource(b['goal']?.value);
      const grid = counterfactualGrid(useCount, ageInStagingDays);
      const live = decideCounterfactual({ useCount, ageInStagingDays, n: 3, ttlDays: 7 });
      const record: GateShadowRecord = {
        proposalId: id,
        passTimestamp: new Date().toISOString(),
        tier: opts.tier,
        goalSource,
        liveDecision: live,
        currentUseCount: useCount,
        ageInStagingDays: Math.round(ageInStagingDays * 100) / 100,
        counterfactual: grid,
      };
      await this.emit(id, record);
      count++;
    }
    return count;
  }

  private async goalSource(goalIri?: string): Promise<'explicit' | 'inferred'> {
    if (!goalIri) return 'explicit';
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT ?src WHERE { GRAPH <kg:goals> { ${escapeIRI(goalIri)} pred:source ?src } }
    `);
    return r.results.bindings[0]?.['src']?.value === 'inferred' ? 'inferred' : 'explicit';
  }

  private async countUses(proposalId: string): Promise<number> {
    const subjects = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT DISTINCT ?s WHERE {
        GRAPH <kg:tbox-staging> { << ?s ?p ?o >> pred:proposalId ${escapeIRI(proposalId)} . }
      }
    `);
    const iris = subjects.results.bindings.map((b) => b['s']!.value);
    if (iris.length === 0) return 0;
    const filters = iris.map((iri) => `CONTAINS(?sparql, "${iri}")`).join(' || ');
    const r = await this.client.select(`
      PREFIX pred: <${META}>
      SELECT (COUNT(*) AS ?n) WHERE {
        GRAPH <kg:usage> { ?q a pred:Query ; pred:sparql ?sparql . FILTER (${filters}) }
      }
    `);
    return parseInt(r.results.bindings[0]!['n']!.value, 10);
  }

  private async emit(proposalId: string, record: GateShadowRecord): Promise<void> {
    const eventId = `urn:predicate:event:gate-shadow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await this.client.update(`
      PREFIX pred: <${META}>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:meta> {
        ${escapeIRI(eventId)} a pred:GateShadow ;
          pred:at      "${record.passTimestamp}"^^xsd:dateTime ;
          pred:actor   "ShadowEvaluator" ;
          pred:goal    ${escapeIRI(proposalId)} ;
          pred:payload ${escapeLiteral(JSON.stringify(record))} .
      } }
    `);
  }
}
```

Add to `index.ts`:

```typescript
export * from './shadow-evaluator.js';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter predicate-agent test -- shadow-evaluator`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-agent/src/shadow-evaluator.ts packages/predicate-agent/src/index.ts packages/predicate-agent/tests/shadow-evaluator.test.ts
git commit -m "feat(agent): ShadowEvaluator emits goal-source-tagged GateShadow events"
```

## Task 9: Run the shadow harness from `kg_maintain` (always)

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-maintain.ts`
- Test: `packages/predicate-mcp/tests/tools/kg-maintain-scale-gate.test.ts` (extend)

The shadow harness runs in BOTH tiers (it's observation-only). Run it in the `Seedling` early-return path and the `Active` path.

- [ ] **Step 1: Extend the test**

Append to the `kg_maintain scale-gate` describe:

```typescript
  it('runs the shadow harness even in Seedling', async () => {
    await kgConfigSet(client, { key: 'scale-gate-triples', value: 1000000 });
    await client.update(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <kg:tbox-staging> {
        <urn:p:s> a pred:Proposal ;
          pred:kind "add-class" ; pred:justification "j" ;
          pred:proposedAt "2026-05-20T00:00:00Z"^^xsd:dateTime ;
          pred:expiresAt  "2026-05-27T00:00:00Z"^^xsd:dateTime .
      } }`);
    await kgMaintain(client, {});
    const ev = await client.select(`
      PREFIX pred: <https://industriagents.com/predicate/meta#>
      SELECT ?e WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow } }`);
    expect(ev.results.bindings.length).toBe(1);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-mcp test -- kg-maintain-scale-gate`
Expected: FAIL — no `GateShadow` event

- [ ] **Step 3: Invoke the evaluator in both paths**

In `kg-maintain.ts`, import:

```typescript
import { ShadowEvaluator } from 'predicate-agent/src/index.js';
```

In the `Seedling` early-return branch, before the `return`, add:

```typescript
    await new ShadowEvaluator(client).run({ tier: signal.tier });
```

In the `Active` path, after the sweeper runs and before the fixpoint, add:

```typescript
  await new ShadowEvaluator(client).run({ tier: signal.tier });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter predicate-mcp test -- kg-maintain-scale-gate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-maintain.ts packages/predicate-mcp/tests/tools/kg-maintain-scale-gate.test.ts
git commit -m "feat(mcp): run shadow harness from kg_maintain in both tiers"
```

## Task 10: Shadow rollup + `predicate shadow-report`

**Files:**
- Create: `packages/predicate-cli/src/commands/shadow-report.ts`
- Modify: `packages/predicate-cli/src/index.ts`

- [ ] **Step 1: Implement the rollup command**

Create `packages/predicate-cli/src/commands/shadow-report.ts`:

```typescript
import { getAdapter } from 'predicate-mcp/src/storage/index.js';

const META = 'https://industriagents.com/predicate/meta#';

interface Cell { n: number; ttlDays: number; decision: string }

export async function shadowReport(): Promise<number> {
  try {
    const client = getAdapter();
    const r = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?payload WHERE { GRAPH <kg:meta> { ?e a pred:GateShadow ; pred:payload ?payload } }
    `);
    // For each (n, ttl) cell, count promote/wait/expire across the latest record per proposal.
    const latest = new Map<string, { ts: string; cells: Cell[]; goalSource: string }>();
    for (const b of r.results.bindings) {
      const rec = JSON.parse(b['payload']!.value) as {
        proposalId: string; passTimestamp: string; goalSource: string; counterfactual: Cell[];
      };
      const prev = latest.get(rec.proposalId);
      if (!prev || rec.passTimestamp > prev.ts) {
        latest.set(rec.proposalId, { ts: rec.passTimestamp, cells: rec.counterfactual, goalSource: rec.goalSource });
      }
    }
    const grid: Record<string, { promote: number; wait: number; expire: number; inferredPromote: number }> = {};
    for (const { cells, goalSource } of latest.values()) {
      for (const c of cells) {
        const key = `N=${c.n},TTL=${c.ttlDays}d`;
        grid[key] ??= { promote: 0, wait: 0, expire: 0, inferredPromote: 0 };
        grid[key][c.decision as 'promote' | 'wait' | 'expire']++;
        if (c.decision === 'promote' && goalSource === 'inferred') grid[key].inferredPromote++;
      }
    }
    process.stdout.write(JSON.stringify({ proposals: latest.size, grid }, null, 2));
    return 0;
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: (e as Error).message }));
    return 1;
  }
}
```

- [ ] **Step 2: Route it in the CLI dispatcher**

In `packages/predicate-cli/src/index.ts`, add `shadow-report` to the help text and route it to `shadowReport()` (mirror how `maintain`/`schema` are dispatched — find with `grep -n "case 'maintain'\|maintain " src/index.ts`). Example:

```typescript
import { shadowReport } from './commands/shadow-report.js';
// ... in the command switch:
case 'shadow-report': process.exit(await shadowReport());
```

- [ ] **Step 3: Manual smoke test**

Run: `pnpm --filter predicate-cli build && node packages/predicate-cli/dist/index.js shadow-report`
Expected: prints `{ "proposals": <n>, "grid": { ... } }` JSON (empty grid is fine on a fresh store)

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-cli/src/commands/shadow-report.ts packages/predicate-cli/src/index.ts
git commit -m "feat(cli): predicate shadow-report — counterfactual usage-gate rollup"
```

---

# PHASE 3 — Programmatic demote

## Task 11: `kg_demote` tool + `LifecycleController.demoteById`

**Files:**
- Modify: `packages/predicate-agent/src/lifecycle-controller.ts`
- Create: `packages/predicate-mcp/src/tools/kg-demote.ts`
- Create: `packages/predicate-ontology/tbox/demoted/.gitkeep`
- Test: `packages/predicate-agent/tests/demote.test.ts`

Demote reads the promoted Turtle file (the reviewed source of truth for which triples were promoted), moves those ground triples `kg:tbox` → `kg:tbox-demoted` via `move()`, and relocates the file `promoted/<id>.ttl` → `demoted/<id>.ttl`.

- [ ] **Step 1: Write the failing integration test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';
import { LifecycleController } from '../src/lifecycle-controller.js';

const client = getAdapter();
let promotedDir: string;

beforeAll(() => {
  promotedDir = mkdtempSync(join(tmpdir(), 'predicate-demote-'));
  process.env['PREDICATE_PROMOTED_DIR'] = promotedDir;
});

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function recordUsage(sparql: string): Promise<void> {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:usage> {
      <urn:test:usage:${Math.random().toString(36).slice(2, 8)}> a pred:Query ;
        pred:sparql ${escapeLiteral(sparql)} ;
        pred:at "${new Date().toISOString()}"^^xsd:dateTime . } }`);
}

describe('demote round-trip', () => {
  beforeEach(async () => {
    for (const g of ['kg:tbox', 'kg:tbox-staging', 'kg:tbox-demoted', 'kg:meta', 'kg:usage', 'kg:inferred']) {
      await reset(g);
    }
  });

  it('promotes then demotes: triples leave kg:tbox, land in kg:tbox-demoted', async () => {
    const proposer = new SchemaProposer(client);
    const delta = { kind: 'add-class' as const, add: [
      { s: 'https://industriagents.com/predicate/codebase/Widget', p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: { type: 'uri' as const, value: 'http://www.w3.org/2002/07/owl#Class' } },
    ] };
    const { proposalId } = await proposer.propose(delta, 'because');
    // satisfy the usage gate (3 uses referencing the subject IRI)
    for (let i = 0; i < 3; i++) await recordUsage('SELECT * WHERE { <https://industriagents.com/predicate/codebase/Widget> ?p ?o }');
    const decision = await new PromotionSweeper(client).promoteById(proposalId, { actor: 'test' });
    expect(decision.outcome).toBe('promoted');

    const ctrl = new LifecycleController(client);
    const demote = await ctrl.demoteById(proposalId, { reason: 'test', actor: 'test' });
    expect(demote.outcome).toBe('demoted');

    const tbox = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox> { ?s ?p ?o } }`);
    const demoted = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox-demoted> { ?s ?p ?o } }`);
    expect(parseInt(tbox.results.bindings[0]!['n']!.value, 10)).toBe(0);
    expect(parseInt(demoted.results.bindings[0]!['n']!.value, 10)).toBeGreaterThan(0);
    expect(existsSync(join(promotedDir, '..', 'demoted')) || demote.demotedFile).toBeTruthy();
  });

  it('returns not-found for an unknown proposal', async () => {
    const ctrl = new LifecycleController(client);
    const d = await ctrl.demoteById('urn:predicate:proposal:missing', { reason: 'x', actor: 'test' });
    expect(d.outcome).toBe('not-found');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter predicate-agent test -- demote`
Expected: FAIL — `ctrl.demoteById is not a function`

- [ ] **Step 3: Implement `demoteById` on `LifecycleController`**

Add imports to `lifecycle-controller.ts`:

```typescript
import { readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DemoteDecision } from './types.js';
```

Add a private dir resolver mirroring the sweeper's (`promotion-sweeper.ts:53-57`) and the method:

```typescript
  private promotedDir(): string {
    return process.env['PREDICATE_PROMOTED_DIR']
      ?? (process.env['PREDICATE_STORE_PATH']
        ? resolve(process.env['PREDICATE_STORE_PATH'], 'promoted')
        : resolve(process.cwd(), '.predicate', 'promoted'));
  }

  async demoteById(
    proposalId: string,
    opts: { reason: string; actor: string },
  ): Promise<DemoteDecision> {
    const safe = proposalId.replace(/[^A-Za-z0-9-]/g, '_');
    const promotedFile = resolve(this.promotedDir(), `${safe}.ttl`);
    if (!existsSync(promotedFile)) {
      return { proposalId, outcome: 'not-found', reason: 'no promoted Turtle file for this proposal' };
    }
    const tripleBlock = readFileSync(promotedFile, 'utf8').trim();
    if (!tripleBlock) {
      return { proposalId, outcome: 'not-found', reason: 'promoted Turtle file is empty' };
    }
    const tboxVersion = `urn:predicate:tbox:v-${Date.now().toString(36)}`;
    await this.move({
      fromGraph: 'kg:tbox',
      toGraph: 'kg:tbox-demoted',
      selector: { kind: 'ground', tripleBlock },
      eventType: 'SchemaDemoted',
      goalIri: proposalId,
      payload: { proposalId, reason: opts.reason, actor: opts.actor, tboxVersion },
    });
    // relocate promoted/<id>.ttl -> demoted/<id>.ttl (git's record of what is no longer live)
    const demotedDir = resolve(this.promotedDir(), '..', 'demoted');
    mkdirSync(demotedDir, { recursive: true });
    const demotedFile = resolve(demotedDir, `${safe}.ttl`);
    renameSync(promotedFile, demotedFile);
    return { proposalId, outcome: 'demoted', demotedFile, tboxVersion };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter predicate-agent test -- demote`
Expected: PASS (2 tests)

- [ ] **Step 5: Create the demote tool + ontology dir placeholder**

Create `packages/predicate-ontology/tbox/demoted/.gitkeep` (empty file).

Create `packages/predicate-mcp/src/tools/kg-demote.ts`:

```typescript
import type { StorageAdapter } from '../storage/index.js';
import { LifecycleController, type DemoteDecision } from 'predicate-agent/src/index.js';

export interface KgDemoteInput {
  proposalId: string;
  reason?: string;
}

export async function kgDemote(
  client: StorageAdapter,
  input: KgDemoteInput,
): Promise<DemoteDecision> {
  const ctrl = new LifecycleController(client);
  return ctrl.demoteById(input.proposalId, {
    reason: input.reason ?? 'demoted via kg_demote',
    actor: 'kg_demote',
  });
}
```

- [ ] **Step 6: Register `kg_demote` in the registry**

In `registry.ts`, import `kgDemote` and add a tool entry alongside the others:

```typescript
import { kgDemote } from './kg-demote.js';
// ...
    {
      name: 'kg_demote',
      description: 'Reverse a schema promotion by proposal id: move its triples out of kg:tbox into kg:tbox-demoted, drop kg:inferred, and log a SchemaDemoted event. Reversible, queryable, by-id.',
      inputSchema: z.object({ proposalId: z.string().min(1), reason: z.string().optional() }),
      handler: async (raw): Promise<unknown> => {
        const args = parseInput(z.object({ proposalId: z.string().min(1), reason: z.string().optional() }), raw, 'kg_demote');
        return kgDemote(client, args);
      },
    },
```

- [ ] **Step 7: Typecheck both packages**

Run: `pnpm --filter predicate-agent exec tsc --noEmit && pnpm --filter predicate-mcp exec tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-agent/src/lifecycle-controller.ts packages/predicate-agent/tests/demote.test.ts packages/predicate-mcp/src/tools/kg-demote.ts packages/predicate-mcp/src/tools/registry.ts packages/predicate-ontology/tbox/demoted/.gitkeep
git commit -m "feat: kg_demote — programmatic reversible promotion via LifecycleController.demoteById"
```

## Task 12: `predicate schema demote <iri>` CLI verb

**Files:**
- Modify: `packages/predicate-cli/src/commands/schema.ts`

- [ ] **Step 1: Add the verb**

In `schema.ts`, add to the `help()` text:

```
  demote  <proposalIri>   Reverse a promotion: move its triples to kg:tbox-demoted.
```

Add a handler mirroring `rejectProposal` (reuse the `PROPOSAL_IRI` guard):

```typescript
import { LifecycleController } from 'predicate-agent/src/index.js';

async function demoteProposal(id: string): Promise<number> {
  if (!PROPOSAL_IRI.test(id)) {
    console.error(`predicate schema demote: invalid proposal IRI: ${id}`);
    return 2;
  }
  try {
    const client = getAdapter();
    const decision = await new LifecycleController(client).demoteById(id, {
      reason: 'demoted via CLI', actor: 'user-demote',
    });
    const ok = decision.outcome === 'demoted';
    process.stdout.write(JSON.stringify({ ok, ...decision }));
    return ok ? 0 : 1;
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: (e as Error).message }));
    return 1;
  }
}
```

Wire `demote` into the verb switch in `schema.ts` (find with `grep -n "approve\|reject\|case " schema.ts`):

```typescript
    case 'demote': return demoteProposal(args[0] ?? '');
```

- [ ] **Step 2: Build + smoke test**

Run: `pnpm --filter predicate-cli build && node packages/predicate-cli/dist/index.js schema demote urn:predicate:proposal:nope`
Expected: prints `{"ok":false,"proposalId":"urn:predicate:proposal:nope","outcome":"not-found",...}` and exit code 1

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-cli/src/commands/schema.ts
git commit -m "feat(cli): predicate schema demote <iri>"
```

## Task 13: `kg_stats` — tier, shadow rollup, demote survival

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-stats.ts`
- Modify: `packages/predicate-agent/src/types.ts` (extend `KgStats`)

- [ ] **Step 1: Extend the `KgStats` type**

In `types.ts`, add to the `KgStats` interface:

```typescript
  tier: 'Seedling' | 'Active';
  scaleGateTriples: number;
  demotePromoteRatio: number;   // SchemaDemoted count / SchemaPromoted count (0 if none promoted)
```

- [ ] **Step 2: Compute them in `kgStats`**

In `kg-stats.ts`, add helpers and include the new fields in the returned object:

```typescript
import { LifecycleController } from 'predicate-agent/src/index.js';
import { kgConfigGet } from './kg-config.js';

async function eventCount(client: StorageAdapter, type: string): Promise<number> {
  const r = await client.select(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    SELECT (COUNT(?e) AS ?n) WHERE { GRAPH <kg:meta> { ?e a pred:${type} } }`);
  return parseInt(r.results.bindings[0]!['n']!.value, 10);
}
```

In the main `kgStats` body, before building the return object:

```typescript
  const cfg = await kgConfigGet(client, { key: 'scale-gate-triples' });
  const scaleGateTriples = typeof cfg.value === 'number' ? cfg.value : 25000;
  const signal = await new LifecycleController(client, { scaleGateTriples }).scaleSignal();
  const promoted = await eventCount(client, 'SchemaPromoted');
  const demoted = await eventCount(client, 'SchemaDemoted');
```

Add to the returned object:

```typescript
    tier: signal.tier,
    scaleGateTriples,
    demotePromoteRatio: promoted === 0 ? 0 : demoted / promoted,
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter predicate-mcp exec tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Add a stats test (extend or create `kg-stats` test)**

```typescript
it('reports the current scale tier', async () => {
  const stats = await kgStats(getAdapter());
  expect(['Seedling', 'Active']).toContain(stats.tier);
  expect(typeof stats.demotePromoteRatio).toBe('number');
});
```

Run: `pnpm --filter predicate-mcp test -- kg-stats`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-stats.ts packages/predicate-agent/src/types.ts packages/predicate-mcp/tests/tools/kg-stats.test.ts
git commit -m "feat(mcp): kg_stats exposes tier + demote/promote survival ratio"
```

## Task 14: Route `promote()` graph-move through `move()` (substrate consolidation)

**Files:**
- Modify: `packages/predicate-agent/src/promotion-sweeper.ts`

This finishes the Approach-B consolidation: the sweeper's promote keeps its Turtle-file write + dual events, but delegates the kg:tbox INSERT + drop-inferred to a shared path. **Low-risk, isolated, fully covered by existing sweeper tests.**

- [ ] **Step 1: Confirm the existing sweeper tests pass first (baseline)**

Run: `pnpm --filter predicate-agent test -- promotion-sweeper`
Expected: PASS (record the count)

- [ ] **Step 2: Refactor `promote()` to insert via a shared INSERT path**

In `promotion-sweeper.ts` `promote()`, the block at lines 407-430 currently does `DROP kg:inferred` then a combined `INSERT DATA` of tbox triples + two events. Leave this behavior identical but extract the tbox-triple INSERT into the same ground-triple shape `move()` uses, to keep one code path for "write ground triples to a graph." Minimal change: keep as-is but add a comment linking to `LifecycleController.move`, since promote's dual-event + Turtle-file concerns exceed `move()`'s single-event contract. **If extraction risks behavior change, STOP and keep promote bespoke — document the divergence in a code comment.** The consolidation requirement is satisfied by reaper + demote both using `move()`; promote's bespoke path is acceptable given its extra concerns (YAGNI on a generic multi-event move).

```typescript
    // NOTE: promote() keeps its bespoke INSERT (Turtle-file + dual SchemaPromoted/TBoxVersionAdvanced
    // events exceed LifecycleController.move()'s single-event contract). Reaper + demote use move();
    // promote intentionally does not, to avoid generalising move() into a multi-event primitive (YAGNI).
```

- [ ] **Step 3: Run sweeper tests to confirm unchanged**

Run: `pnpm --filter predicate-agent test -- promotion-sweeper`
Expected: PASS (same count as Step 1)

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-agent/src/promotion-sweeper.ts
git commit -m "docs(agent): document promote() vs move() boundary in the lifecycle substrate"
```

## Task 15: Full suite + final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `pnpm -r test`
Expected: PASS (all packages green)

- [ ] **Step 2: Typecheck the whole workspace**

Run: `pnpm -r exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Manual end-to-end smoke**

```bash
pnpm --filter predicate-cli build
node packages/predicate-cli/dist/index.js maintain        # runs gate+shadow
node packages/predicate-cli/dist/index.js shadow-report   # prints grid
```
Expected: `maintain` returns JSON with a `tier` field; `shadow-report` prints `{ proposals, grid }`.

- [ ] **Step 4: Set the phase tag**

```bash
git tag v0.x-lifecycle-controller
```

(Confirm the tag name with the user / current versioning convention before pushing.)

---

## Self-review notes (addressed)

- **Spec coverage:** scale-gate (Tasks 2,4,5,6), shadow harness (Tasks 7,8,9,10), demote (Tasks 11,12), observability (`MaintenanceSkipped`/`GateShadow`/`SchemaDemoted` events + `kg_stats` Task 13), substrate `move()` (Tasks 3,6,11,14).
- **Type consistency:** `ScaleTier`, `GateShadowRecord`, `CounterfactualCell`, `DemoteDecision`, `MoveSelector`/`MoveOptions` defined once (Tasks 1,3) and reused.
- **Method-name consistency:** `scaleSignal()`, `move()`, `demoteById()`, `decideCounterfactual()`, `counterfactualGrid()`, `ShadowEvaluator.run()`, `kgDemote()` are used identically across tasks.
- **Deferred (matches spec §1 out-of-scope):** auto-demote controller; multi-tier model beyond Seedling/Active; live-threshold retune (this plan only *gathers* the data).
