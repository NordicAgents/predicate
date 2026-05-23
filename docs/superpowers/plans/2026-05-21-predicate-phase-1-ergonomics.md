# Predicate Phase 1 — Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tools effortless for a host model — auto-materialize on read (no forgotten `kg_maintain`), accept `kg_ask` without a `question`, give field-naming teaching errors everywhere, and survive a malformed transcript line.

**Architecture:** A presence-based dirty marker in `kg:meta` (`<urn:predicate:materialization-state> pred:aboxDirty true`) is set by `kgAssert` and consumed by a new `materializeIfDirty` helper that `kg_ask`/`kg_explain` call before reading `kg:inferred`. The reasoner (`runFixpoint`) runs lazily on the first read after a change. The other three items are localized edits.

**Tech Stack:** TypeScript (NodeNext ESM), Vitest, Oxigraph (in-memory + `.nq` persistence), pnpm workspace, esbuild bundle.

**Spec:** `docs/superpowers/specs/2026-05-21-predicate-phase-1-ergonomics-design.md`

## Conventions (every task)
- Single test file: `pnpm --filter <pkg> exec vitest run <path>`. Whole package: `pnpm --filter <pkg> test`.
- Isolated in-memory store in tests: `new OxigraphAdapter({ storePath: ':memory:' })`.
- NodeNext `.js` import extensions.
- The dirty marker is **presence-based**: writing `aboxDirty true` is idempotent (RDF set semantics — re-asserting the same triple is a no-op, so `kgAssert` in a loop costs one no-op update each); "clean" = the triple is absent. This realizes the spec's "absent marker = not dirty" exactly.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `packages/predicate-mcp/src/materialize.ts` | Dirty-marker read/write + lazy `materializeIfDirty` | Create |
| `packages/predicate-mcp/src/tools/kg-assert.ts` | Mark ABox dirty after a successful assert | Modify |
| `packages/predicate-mcp/src/tools/kg-ask.ts` | `materializeIfDirty` before query; `question` optional | Modify |
| `packages/predicate-mcp/src/tools/kg-explain.ts` | `materializeIfDirty` before explain | Modify |
| `packages/predicate-mcp/src/tools/kg-maintain.ts` | Clear dirty marker at end | Modify |
| `packages/predicate-mcp/src/tools/parse-input.ts` | Shared teaching-error parse helper | Create |
| `packages/predicate-mcp/src/tools/registry.ts` | `kg_ask` schema (question optional); route 4 handlers through `parseInput` | Modify |
| `packages/predicate-cli/src/commands/extract.ts` | Per-line transcript parse; `skippedLines` | Modify |

---

### Task 1: Dirty-marker helpers + lazy materialize (spec §1 core)

**Files:**
- Create: `packages/predicate-mcp/src/materialize.ts`
- Test: `packages/predicate-mcp/tests/materialize.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/predicate-mcp/tests/materialize.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { markAboxDirty, isAboxDirty, clearAboxDirty, materializeIfDirty } from '../src/materialize.js';

const TBOX = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix cb: <https://industriagents.com/predicate/codebase#> .
cb:calls a owl:ObjectProperty , owl:TransitiveProperty .
`;

describe('dirty marker', () => {
  let client: OxigraphAdapter;
  beforeEach(() => { client = new OxigraphAdapter({ storePath: ':memory:' }); });

  it('is clean on a fresh store (absent marker)', async () => {
    expect(await isAboxDirty(client)).toBe(false);
  });

  it('mark then clear toggles the flag, idempotently', async () => {
    await markAboxDirty(client);
    await markAboxDirty(client); // idempotent — still one marker
    expect(await isAboxDirty(client)).toBe(true);
    await clearAboxDirty(client);
    expect(await isAboxDirty(client)).toBe(false);
  });
});

describe('materializeIfDirty', () => {
  it('reasons once when dirty and reports it ran; no-op when clean', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(TBOX, 'kg:tbox');
    const F = 'https://industriagents.com/predicate/codebase/x#';
    const C = 'https://industriagents.com/predicate/codebase#calls';
    await client.update(`INSERT DATA { GRAPH <kg:abox> {
      <${F}a> <${C}> <${F}b> . <${F}b> <${C}> <${F}c> . } }`);
    await markAboxDirty(client);

    const ranFirst = await materializeIfDirty(client);
    expect(ranFirst).toBe(true);
    const inferred = await client.ask(`ASK { GRAPH <kg:inferred> { <${F}a> <${C}> <${F}c> } }`);
    expect(inferred).toBe(true); // transitive closure materialized
    expect(await isAboxDirty(client)).toBe(false);

    const ranSecond = await materializeIfDirty(client);
    expect(ranSecond).toBe(false); // clean — did not re-run
  });
});
```

- [ ] **Step 2: Run to verify it FAILS**

Run: `pnpm --filter predicate-mcp exec vitest run tests/materialize.test.ts`
Expected: FAIL — `Cannot find module '../src/materialize.js'`.

- [ ] **Step 3: Create `packages/predicate-mcp/src/materialize.ts`**

```ts
import type { StorageAdapter } from './storage/index.js';
import { runFixpoint } from 'predicate-reasoner/src/fixpoint.js';
import { RULES } from 'predicate-reasoner/src/rules/index.js';

const STATE = 'urn:predicate:materialization-state';
const META = 'https://industriagents.com/predicate/meta#';

// Presence-based marker: the triple's presence means "ABox changed since the
// inferred graph was last materialized". Absent means clean. Re-inserting the
// same triple is a no-op (RDF set semantics), so marking dirty in a tight
// assert loop costs one harmless update each.
export async function markAboxDirty(client: StorageAdapter): Promise<void> {
  await client.update(
    `PREFIX pred: <${META}> INSERT DATA { GRAPH <kg:meta> { <${STATE}> pred:aboxDirty true } }`,
  );
}

export async function isAboxDirty(client: StorageAdapter): Promise<boolean> {
  return client.ask(
    `PREFIX pred: <${META}> ASK { GRAPH <kg:meta> { <${STATE}> pred:aboxDirty true } }`,
  );
}

export async function clearAboxDirty(client: StorageAdapter): Promise<void> {
  await client.update(
    `PREFIX pred: <${META}> DELETE WHERE { GRAPH <kg:meta> { <${STATE}> pred:aboxDirty ?v } }`,
  );
}

// Lazy reasoning: if the ABox changed, run the reasoner fixpoint (NOT the
// reaper/sweeper/generalizer that kg_maintain runs) and clear the marker.
// Returns true if it materialized, false if the store was already clean.
// On a runFixpoint failure the marker is left dirty so the next read retries.
export async function materializeIfDirty(client: StorageAdapter): Promise<boolean> {
  if (!(await isAboxDirty(client))) return false;
  await runFixpoint(client, RULES, {
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    inferredGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });
  await clearAboxDirty(client);
  return true;
}
```

- [ ] **Step 4: Run to verify it PASSES**

Run: `pnpm --filter predicate-mcp exec vitest run tests/materialize.test.ts`
Expected: PASS (3 tests). If `runFixpoint`'s option keys differ, copy them verbatim from `packages/predicate-mcp/src/tools/kg-maintain.ts` (the `runFixpoint(client, RULES, {...})` call there is the source of truth).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter predicate-mcp typecheck`
```bash
git add packages/predicate-mcp/src/materialize.ts packages/predicate-mcp/tests/materialize.test.ts
git commit -m "feat(mcp): dirty marker + lazy materializeIfDirty helper"
```

---

### Task 2: Wire auto-materialization into the tools (spec §1 wiring)

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-assert.ts`, `kg-ask.ts`, `kg-explain.ts`, `kg-maintain.ts`
- Test: `packages/predicate-mcp/tests/auto-materialize.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/predicate-mcp/tests/auto-materialize.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgAssert } from '../src/tools/kg-assert.js';
import { kgAsk } from '../src/tools/kg-ask.js';
import { isAboxDirty } from '../src/materialize.js';

const TBOX = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix cb: <https://industriagents.com/predicate/codebase#> .
cb:calls a owl:ObjectProperty , owl:TransitiveProperty .
`;
const C = 'https://industriagents.com/predicate/codebase#calls';
const F = 'https://industriagents.com/predicate/codebase/x#';
const assert = (client: OxigraphAdapter, s: string, o: string) =>
  kgAssert(client, { subject: s, predicate: C, object: { type: 'uri', value: o },
    source: 't', confidence: 0.95, method: 'm' });

describe('auto-materialization on read', () => {
  it('kg_ask returns inferred rows WITHOUT an explicit kg_maintain', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(TBOX, 'kg:tbox');
    await assert(client, `${F}a`, `${F}b`);
    await assert(client, `${F}b`, `${F}c`);
    expect(await isAboxDirty(client)).toBe(true); // asserts marked dirty

    const r = await kgAsk(client, {
      question: 'transitive closure',
      sparql: `SELECT ?o WHERE { GRAPH <kg:inferred> { <${F}a> <${C}> ?o } }`,
    });
    const objs = r.bindings.map((b) => b['o']!.value);
    expect(objs).toContain(`${F}c`); // a calls c (transitive) — materialized lazily
    expect(await isAboxDirty(client)).toBe(false); // cleared after read
  });
});
```

- [ ] **Step 2: Run to verify it FAILS**

Run: `pnpm --filter predicate-mcp exec vitest run tests/auto-materialize.test.ts`
Expected: FAIL — `kg:inferred` is empty (no auto-materialize yet), so `objs` does not contain `${F}c`.

- [ ] **Step 3: Mark dirty in `kgAssert`**

In `packages/predicate-mcp/src/tools/kg-assert.ts`, add the import:
```ts
import { markAboxDirty } from '../materialize.js';
```
At the END of `kgAssert`, after the `await client.update(...)` that writes the abox/provenance, add:
```ts
  await markAboxDirty(client);
```

- [ ] **Step 4: Materialize-on-read in `kgAsk`**

In `packages/predicate-mcp/src/tools/kg-ask.ts`, add the import:
```ts
import { materializeIfDirty } from '../materialize.js';
```
At the START of `kgAsk` (before the `FORBIDDEN.test` check is fine, but do it after so a forbidden query still errors first — place it immediately after the `FORBIDDEN` guard), add:
```ts
  await materializeIfDirty(client);
```

- [ ] **Step 5: Materialize-on-read in `kgExplain`**

In `packages/predicate-mcp/src/tools/kg-explain.ts`, add the import:
```ts
import { materializeIfDirty } from '../materialize.js';
```
At the START of `kgExplain`, before constructing the adapter, add:
```ts
  await materializeIfDirty(client);
```

- [ ] **Step 6: Clear the marker in `kgMaintain`**

In `packages/predicate-mcp/src/tools/kg-maintain.ts`, add the import:
```ts
import { clearAboxDirty } from '../materialize.js';
```
After the fixpoint runs and the events are written (just before `return { ... }`), add:
```ts
  await clearAboxDirty(client);
```

- [ ] **Step 7: Run to verify it PASSES + no regressions**

Run: `pnpm --filter predicate-mcp exec vitest run tests/auto-materialize.test.ts`
Expected: PASS.
Run: `pnpm --filter predicate-mcp test`
Expected: PASS. (Watch `kg-assert` / `kg-maintain` / `kg-ask` tests — the added calls should not break them; a now-auto-materialized read could change a test that previously asserted `kg:inferred` was empty after assert. If such a test exists, update it to reflect that reads now materialize, and report it.)

- [ ] **Step 8: Typecheck + commit**

Run: `pnpm --filter predicate-mcp typecheck`
```bash
git add packages/predicate-mcp/src/tools/kg-assert.ts packages/predicate-mcp/src/tools/kg-ask.ts packages/predicate-mcp/src/tools/kg-explain.ts packages/predicate-mcp/src/tools/kg-maintain.ts packages/predicate-mcp/tests/auto-materialize.test.ts
git commit -m "feat(mcp): auto-materialize on kg_ask/kg_explain via dirty marker"
```

---

### Task 3: `kg_ask` question-or-sparql (spec §2)

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-ask.ts`, `packages/predicate-mcp/src/tools/registry.ts`
- Test: `packages/predicate-mcp/tests/kg-ask-optional-question.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/predicate-mcp/tests/kg-ask-optional-question.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgAsk } from '../src/tools/kg-ask.js';

describe('kg_ask without a question', () => {
  it('runs sparql-only and still logs usage', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.update(`INSERT DATA { GRAPH <kg:abox> { <urn:s> <urn:p> <urn:o> } }`);
    const r = await kgAsk(client, {
      sparql: `SELECT ?s WHERE { GRAPH <kg:abox> { ?s <urn:p> <urn:o> } }`,
    });
    expect(r.bindings.map((b) => b['s']!.value)).toContain('urn:s');
    const log = await client.ask(`PREFIX pred: <https://industriagents.com/predicate/meta#> ASK { GRAPH <kg:usage> { ?q a pred:Query } }`);
    expect(log).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it FAILS**

Run: `pnpm --filter predicate-mcp exec vitest run tests/kg-ask-optional-question.test.ts`
Expected: FAIL — TypeScript/runtime requires `question`; the call without it errors.

- [ ] **Step 3: Make `question` optional in `kg-ask.ts`**

In `packages/predicate-mcp/src/tools/kg-ask.ts`, change the interface:
```ts
export interface AskInput {
  question?: string;
  sparql: string;
  maxRows?: number;
}
```
In the `logUsage` call inside `kgAsk`, pass a fallback for the question:
```ts
  await logUsage(client, input.question ?? '', input.sparql, r.results.bindings.length, elapsedMs);
```
(The `logUsage` signature stays `question: string`; the empty string is logged as `pred:question`.)

- [ ] **Step 4: Make `question` optional in the registry schema**

In `packages/predicate-mcp/src/tools/registry.ts`, the `kg_ask` tool — update BOTH the declared `inputSchema` and the in-handler `z.object({...}).parse(raw)` so `question` is optional:
```ts
      inputSchema: z.object({
        question: z.string().optional(),
        sparql: z.string(),
        maxRows: z.number().int().positive().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          question: z.string().optional(),
          sparql: z.string(),
          maxRows: z.number().int().positive().optional(),
        }).parse(raw);
        return kgAsk(client, args);
      },
```
Also update the tool `description` to note the question is optional: change it to `'Execute a caller-drafted SPARQL SELECT/ASK against the live graph; logs usage. Read-only. "question" is an optional human-readable label.'`

- [ ] **Step 5: Run to verify it PASSES + no regressions**

Run: `pnpm --filter predicate-mcp exec vitest run tests/kg-ask-optional-question.test.ts`
Expected: PASS.
Run: `pnpm --filter predicate-mcp test` → PASS. `pnpm --filter predicate-mcp typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-ask.ts packages/predicate-mcp/src/tools/registry.ts packages/predicate-mcp/tests/kg-ask-optional-question.test.ts
git commit -m "feat(mcp): kg_ask accepts sparql-only (question optional)"
```

---

### Task 4: Generalized teaching errors (spec §3)

**Files:**
- Create: `packages/predicate-mcp/src/tools/parse-input.ts`
- Modify: `packages/predicate-mcp/src/tools/registry.ts` (route `kg_explore_schema`, `kg_research_goal`, `kg_propose_schema`, `kg_extract_judgments`)
- Test: `packages/predicate-mcp/tests/parse-input.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/predicate-mcp/tests/parse-input.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseInput } from '../src/tools/parse-input.js';

describe('parseInput teaching errors', () => {
  const schema = z.object({ concept: z.string().min(1) });

  it('names the offending field and tool on bad input', () => {
    expect(() => parseInput(schema, { concept: '' }, 'kg_explore_schema'))
      .toThrow(/kg_explore_schema: concept/);
  });

  it('returns the parsed value on good input', () => {
    expect(parseInput(schema, { concept: 'Function' }, 'kg_explore_schema'))
      .toEqual({ concept: 'Function' });
  });
});
```

- [ ] **Step 2: Run to verify it FAILS**

Run: `pnpm --filter predicate-mcp exec vitest run tests/parse-input.test.ts`
Expected: FAIL — `Cannot find module '../src/tools/parse-input.js'`.

- [ ] **Step 3: Create `packages/predicate-mcp/src/tools/parse-input.ts`**

```ts
import type { z } from 'zod';

// Parse tool input with a teaching error: instead of a raw ZodError dump, throw
// "<tool>: <field path> <message>" naming the first offending field.
export function parseInput<T>(schema: z.ZodType<T>, raw: unknown, toolName: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue && issue.path.length > 0 ? issue.path.join('.') : '(root)';
    const message = issue?.message ?? 'invalid input';
    throw new Error(`${toolName}: ${path} ${message}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Run to verify it PASSES**

Run: `pnpm --filter predicate-mcp exec vitest run tests/parse-input.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Route the four handlers through `parseInput`**

In `packages/predicate-mcp/src/tools/registry.ts`, add the import at the top:
```ts
import { parseInput } from './parse-input.js';
```
Replace the in-handler `z.object({...}).parse(raw)` calls for these four tools with `parseInput(<sameSchema>, raw, '<toolName>')`:

- `kg_explore_schema` handler:
```ts
      handler: async (raw): Promise<unknown> => {
        const { concept } = parseInput(z.object({ concept: z.string().min(1) }), raw, 'kg_explore_schema');
        return kgExploreSchema(client, concept);
      },
```
- `kg_research_goal` handler — replace its `z.object({...}).parse(raw)` with `parseInput(z.object({...}), raw, 'kg_research_goal')` (keep the identical schema body already present).
- `kg_propose_schema` handler — replace its `z.object({...}).parse(raw)` with `parseInput(z.object({...}), raw, 'kg_propose_schema')` (keep the identical schema body).
- `kg_extract_judgments` handler — replace its `z.object({...}).parse(raw)` with `parseInput(z.object({...}), raw, 'kg_extract_judgments')` (keep the identical schema body).

- [ ] **Step 6: Write an integration test for a routed tool** — append to `packages/predicate-mcp/tests/parse-input.test.ts`

```ts
import { buildTools } from '../src/tools/registry.js';
import { OxigraphAdapter } from '../src/storage/index.js';

describe('registry routes teaching errors', () => {
  it('kg_explore_schema rejects an empty concept with a teaching error', async () => {
    const tools = buildTools(new OxigraphAdapter({ storePath: ':memory:' }));
    const tool = tools.find((t) => t.name === 'kg_explore_schema')!;
    await expect(tool.handler({ concept: '' })).rejects.toThrow(/kg_explore_schema: concept/);
  });

  it('kg_propose_schema rejects a missing justification with a teaching error', async () => {
    const tools = buildTools(new OxigraphAdapter({ storePath: ':memory:' }));
    const tool = tools.find((t) => t.name === 'kg_propose_schema')!;
    await expect(tool.handler({ delta: { kind: 'add-property', iri: 'x', parent: 'y' } }))
      .rejects.toThrow(/kg_propose_schema:/);
  });
});
```

- [ ] **Step 7: Run to verify it PASSES + no regressions**

Run: `pnpm --filter predicate-mcp exec vitest run tests/parse-input.test.ts`
Expected: PASS (4 tests). If the `kg_propose_schema` delta shape in the second test doesn't match `schemaDeltaSchema`, adjust the bad input so it still triggers a validation failure (the assertion only requires the `kg_propose_schema:` prefix). Then `pnpm --filter predicate-mcp test` → PASS; `pnpm --filter predicate-mcp typecheck` → clean.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-mcp/src/tools/parse-input.ts packages/predicate-mcp/src/tools/registry.ts packages/predicate-mcp/tests/parse-input.test.ts
git commit -m "feat(mcp): field-naming teaching errors for tool input validation"
```

---

### Task 5: Per-line transcript resilience (spec §4)

**Files:**
- Modify: `packages/predicate-cli/src/commands/extract.ts`
- Test: `packages/predicate-cli/tests/extract-resilience.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/predicate-cli/tests/extract-resilience.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { extractTranscript } from '../src/commands/extract.js';

const META_TTL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'predicate-ontology', 'meta', 'predicate-meta.ttl');

describe('extract per-line resilience', () => {
  it('skips a malformed JSONL line and captures the valid ones', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(readFileSync(META_TTL, 'utf8'), 'kg:tbox'); // session vocab present

    const dir = mkdtempSync(join(tmpdir(), 'pred-resil-'));
    const t = join(dir, 't.jsonl');
    writeFileSync(t, [
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/r/a.ts', old_string: 'x', new_string: 'y' } },
      ] } }),
      '{ this is not valid json',           // <-- malformed line
      JSON.stringify({ type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'e1', is_error: false, content: 'ok' },
      ] } }),
    ].join('\n') + '\n', 'utf8');

    try {
      const r = await extractTranscript(client, { sessionId: 's1', transcriptPath: t, platform: 'claude-code' });
      expect(r.skippedLines).toBe(1);
      expect(r.rejected).toBe(0);          // valid lines extracted + asserted
      expect(r.asserted).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run to verify it FAILS**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-resilience.test.ts`
Expected: FAIL — the malformed line currently makes `JSON.parse` throw, so `extractTranscript` rejects (and there's no `skippedLines` field).

- [ ] **Step 3: Per-line parse + `skippedLines` in `extract.ts`**

In `packages/predicate-cli/src/commands/extract.ts`:

(a) Extend `ExtractTranscriptResult` (the interface added in Phase 0) to include `skippedLines`:
```ts
export interface ExtractTranscriptResult {
  deterministic: number;
  semantic: number;
  asserted: number;
  rejected: number;
  rejections: ExtractRejection[];
  skippedLines: number;
}
```

(b) In `extractTranscript`, replace:
```ts
  const events = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
```
with:
```ts
  const events: Array<Record<string, unknown>> = [];
  let skippedLines = 0;
  for (const l of lines) {
    try {
      events.push(JSON.parse(l) as Record<string, unknown>);
    } catch {
      skippedLines++;
    }
  }
```

(c) Add `skippedLines` to the returned object (the `return { deterministic, semantic, asserted, rejected: rejections.length, rejections };` becomes):
```ts
  return {
    deterministic: deterministic.triples.length,
    semantic: semantic.triples.length,
    asserted,
    rejected: rejections.length,
    rejections,
    skippedLines,
  };
```

- [ ] **Step 4: Surface skips in the CLI warning**

In the `extract(...)` CLI entry, in the block that prints the summary/rejection warning (added in Phase 0), add after the rejection warning:
```ts
  if (result.skippedLines > 0) {
    console.error(
      `predicate extract: WARNING — skipped ${result.skippedLines} unparseable transcript line(s).`,
    );
  }
```

- [ ] **Step 5: Run to verify it PASSES + no regressions**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-resilience.test.ts`
Expected: PASS.
Run: `pnpm --filter predicate-cli test` → PASS (the Phase 0 `extract-rejections`/`extract-default-bootstrap` tests construct `ExtractTranscriptResult` via the function, so the new field flows through; if any test asserts the exact result object via `toEqual`, add `skippedLines: 0`). `pnpm --filter predicate-cli typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-cli/src/commands/extract.ts packages/predicate-cli/tests/extract-resilience.test.ts
git commit -m "fix(cli): extract skips malformed transcript lines instead of aborting"
```

---

### Task 6: Rebuild bundles, full suite, E2E re-run, version bump (integration gate)

**Files:** version files + regenerated bundles.

- [ ] **Step 1: Full build + bundle**

Run: `pnpm build`
Expected: all packages compile; `server.bundle.mjs` / `cli.bundle.mjs` regenerate.

- [ ] **Step 2: Confirm the new behavior is bundled**

Run: `grep -c 'aboxDirty' packages/predicate-skill/server.bundle.mjs`
Expected: `>= 1` (auto-materialization is in the server bundle).

- [ ] **Step 3: Full workspace test suite**

Run: `pnpm -r --workspace-concurrency=1 --filter './packages/*' test`
Expected: PASS across all packages (the "flush on SIGTERM failed: disk full" stderr is an intentional mock, not a failure).

- [ ] **Step 4: E2E re-run — auto-materialization (the headline behavior)**

Against the rebuilt bundle in an isolated temp store: seed `up` + `init --ontology codebase --force`, open the MCP server, `kg_assert` a transitive `calls` chain, then call `kg_ask` for the transitive closure in `kg:inferred` **without** calling `kg_maintain` first. Confirm the derived edge appears. Then `kg_ask` a sparql-only query (no `question`) and confirm it runs.
Expected: inferred rows present with no explicit maintain; sparql-only query works.

- [ ] **Step 5: Version bump to 2.5.0**

Bump `2.4.0` → `2.5.0` in `.claude-plugin/marketplace.json` (both `metadata.version` and the plugin entry), `packages/predicate-skill/package.json`, and `packages/predicate-skill/.claude-plugin/plugin.json`. Do NOT touch `packages/predicate-skill/meta/version.json` (separate ontology version).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(skill): bump to 2.5.0 (Phase 1 ergonomics)"
```

---

## Self-review notes

- **Spec coverage:** §1 anchor → Tasks 1+2; §2 → Task 3; §3 → Task 4; §4 → Task 5; testing/regression/bundle → Task 6. All spec items mapped.
- **Type consistency:** `markAboxDirty`/`isAboxDirty`/`clearAboxDirty`/`materializeIfDirty` defined in Task 1 and consumed in Task 2. `AskInput.question?` (Task 3) matches the registry schema change. `ExtractTranscriptResult.skippedLines` (Task 5) extends the Phase 0 shape. `parseInput<T>(schema, raw, toolName)` defined in Task 4 and used in the same task's registry edits.
- **Error handling:** `materializeIfDirty` leaves the marker dirty on `runFixpoint` failure (Task 1 code comment + behavior) so the read surfaces the error and the next read retries — per spec.
- **Deferred (non-goals):** NL→SPARQL, incremental reasoning, `kg_explain` depth-bound re-derivation (Phase 3), new tools — none included.
