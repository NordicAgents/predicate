# Predicate Phase 0 — Correctness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every P0/P1 (plus cheap P2s) found in the v2.3.0 end-to-end evaluation, so an agent can trust what's in the graph: durable writes, honest failures, a working `kg_explore_schema` gate, out-of-the-box session capture, a live latency metric, and a `doctor` round-trip self-test.

**Architecture:** Surgical fixes across `predicate-mcp` (server lifecycle, tools), `predicate-agent` (promotion sweeper), `predicate-cli` (extract, doctor), and `predicate-ontology` (meta vocabulary). No change to the reasoning engine, the 21 rules, or ontology semantics. Each fix lands TDD-first with a focused test, then the bundles are rebuilt and the three original E2E use cases are re-run as the integration gate.

**Tech Stack:** TypeScript (ESM, NodeNext), Vitest, Oxigraph (WASM, in-memory + per-graph `.nq` persistence), pnpm workspace, esbuild bundle.

**Spec:** `docs/superpowers/specs/2026-05-21-predicate-hardening-and-roadmap-design.md`

## Conventions used by every task

- Run a single test file with: `pnpm --filter <pkg> exec vitest run <path>` (e.g. `pnpm --filter predicate-mcp exec vitest run tests/shutdown.test.ts`).
- Run a whole package's tests with: `pnpm --filter <pkg> test`.
- Tests construct an isolated store with `new OxigraphAdapter({ storePath: ':memory:' })` (the established in-memory test pattern) unless persistence-to-disk is under test, in which case use a `mkdtempSync(join(tmpdir(), 'pred-'))` directory.
- Imports use `.js` extensions (NodeNext), matching existing files.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `packages/predicate-mcp/src/shutdown.ts` | Build an idempotent shutdown closure that flushes the adapter | Create |
| `packages/predicate-mcp/src/index.ts` | Server entry — install shutdown handlers | Modify |
| `packages/predicate-agent/src/promotion-sweeper.ts` | Promotion target dir resolution + mkdir before write | Modify |
| `packages/predicate-mcp/src/tools/kg-assert.ts` | Teaching error on malformed object | Modify |
| `packages/predicate-cli/src/commands/extract.ts` | Surface rejected triples; `--strict` exit | Modify |
| `packages/predicate-mcp/src/tools/kg-explore-schema.ts` | Local-name concept resolution + relative-IRI guard | Modify |
| `packages/predicate-ontology/meta/predicate-meta.ttl` | Session-history vocabulary in default bootstrap | Modify |
| `packages/predicate-mcp/src/tools/kg-maintain.ts` | Emit `MaterializationCompleted` event with fixpoint time | Modify |
| `packages/predicate-cli/src/commands/doctor.ts` | Round-trip self-test | Modify |

---

### Task 1: Durable shutdown — flush on SIGTERM/SIGINT (spec 0.1, P0)

**Root cause:** `OxigraphAdapter` flushes on a 300ms debounce, force-flushed only in `close()`. `predicate-mcp/src/index.ts` registers no signal handler, so when the MCP host SIGTERMs the server, writes inside the debounce window never reach disk.

**Files:**
- Create: `packages/predicate-mcp/src/shutdown.ts`
- Test: `packages/predicate-mcp/tests/shutdown.test.ts`
- Modify: `packages/predicate-mcp/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/shutdown.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeShutdown } from '../src/shutdown.js';
import type { StorageAdapter } from '../src/storage/index.js';

function fakeAdapter(): { adapter: StorageAdapter; closes: number } {
  const state = { closes: 0 };
  const adapter = {
    close: vi.fn(async () => { state.closes++; }),
  } as unknown as StorageAdapter;
  return { adapter, closes: 0, get closes() { return state.closes; } } as never;
}

describe('makeShutdown', () => {
  it('closes the adapter exactly once even if invoked twice', async () => {
    let closes = 0;
    const adapter = { close: vi.fn(async () => { closes++; }) } as unknown as StorageAdapter;
    const exits: number[] = [];
    const shutdown = makeShutdown(adapter, (code) => { exits.push(code); });

    await shutdown('SIGTERM');
    await shutdown('SIGINT');

    expect(closes).toBe(1);
    expect(exits).toEqual([0]);
  });

  it('still exits 0 if close throws', async () => {
    const adapter = { close: vi.fn(async () => { throw new Error('disk full'); }) } as unknown as StorageAdapter;
    const exits: number[] = [];
    const shutdown = makeShutdown(adapter, (code) => { exits.push(code); });

    await shutdown('SIGTERM');

    expect(exits).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-mcp exec vitest run tests/shutdown.test.ts`
Expected: FAIL — `Cannot find module '../src/shutdown.js'`.

- [ ] **Step 3: Create the implementation**

Create `packages/predicate-mcp/src/shutdown.ts`:

```ts
import type { StorageAdapter } from './storage/index.js';

/**
 * Build an idempotent shutdown closure that flushes the adapter to disk and
 * then exits. Guards against double-invocation (a process can receive both
 * SIGTERM and SIGINT). `close()` failures are logged but never block exit.
 *
 * Extracted from index.ts so the flush-once / exit-0 contract is unit-testable
 * without firing real OS signals.
 */
export function makeShutdown(
  adapter: StorageAdapter,
  exit: (code: number) => void = (c) => process.exit(c),
): (signal: string) => Promise<void> {
  let closed = false;
  return async (signal: string): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await adapter.close();
    } catch (err) {
      console.error(`predicate-mcp: flush on ${signal} failed:`, err);
    }
    exit(0);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-mcp exec vitest run tests/shutdown.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the handlers into the server entry**

In `packages/predicate-mcp/src/index.ts`, add the import after the existing imports:

```ts
import { makeShutdown } from './shutdown.js';
```

Then inside `main()`, immediately after `const client = getAdapter();`, add:

```ts
  const shutdown = makeShutdown(client);
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter predicate-mcp typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-mcp/src/shutdown.ts packages/predicate-mcp/tests/shutdown.test.ts packages/predicate-mcp/src/index.ts
git commit -m "fix(mcp): flush Oxigraph store on SIGTERM/SIGINT (durable shutdown)"
```

---

### Task 2: Promotion writes to a writable, co-located dir (spec 0.2, P0)

**Root cause:** `PromotionSweeper.promotedDir` defaults to a source-tree path (`…/predicate-ontology/tbox/promoted/`) absent from the packaged skill, and `promote()` calls `writeFileSync` without `mkdir`. When the N≥3 gate is met, `kg_maintain` throws ENOENT and aborts.

**Files:**
- Modify: `packages/predicate-agent/src/promotion-sweeper.ts`
- Test: `packages/predicate-agent/tests/promotion-sweeper-dir.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-agent/tests/promotion-sweeper-dir.test.ts`:

```ts
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';

describe('PromotionSweeper promoted-dir resolution', () => {
  const prev = process.env['PREDICATE_PROMOTED_DIR'];
  let store: string;

  beforeEach(() => { store = mkdtempSync(join(tmpdir(), 'pred-promo-')); });
  afterEach(() => {
    if (prev === undefined) delete process.env['PREDICATE_PROMOTED_DIR'];
    else process.env['PREDICATE_PROMOTED_DIR'] = prev;
    rmSync(store, { recursive: true, force: true });
  });

  it('defaults the promoted dir under PREDICATE_STORE_PATH, not the source tree', () => {
    delete process.env['PREDICATE_PROMOTED_DIR'];
    process.env['PREDICATE_STORE_PATH'] = store;
    const sweeper = new PromotionSweeper(new OxigraphAdapter({ storePath: ':memory:' }));
    // promotedDir is private; assert via the resolver's documented behavior:
    expect((sweeper as unknown as { promotedDir: string }).promotedDir).toBe(join(store, 'promoted'));
  });

  it('creates the promoted dir on demand (no pre-existing dir)', () => {
    const target = join(store, 'nested', 'promoted');
    expect(existsSync(target)).toBe(false);
    const sweeper = new PromotionSweeper(new OxigraphAdapter({ storePath: ':memory:' }), { promotedDir: target });
    (sweeper as unknown as { ensurePromotedDir(): void }).ensurePromotedDir();
    expect(existsSync(target)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-agent exec vitest run tests/promotion-sweeper-dir.test.ts`
Expected: FAIL — default resolves to the source-tree path, and `ensurePromotedDir` does not exist.

- [ ] **Step 3: Update the dir resolution + add mkdir helper**

In `packages/predicate-agent/src/promotion-sweeper.ts`, add `mkdirSync` to the `node:fs` import at line 1:

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
```

Replace the constructor's `promotedDir` resolution (lines 53–58) with a store-relative default:

```ts
    this.promotedDir = opts.promotedDir
      ?? process.env['PREDICATE_PROMOTED_DIR']
      ?? (process.env['PREDICATE_STORE_PATH']
            ? resolve(process.env['PREDICATE_STORE_PATH'], 'promoted')
            : resolve(process.cwd(), '.predicate', 'promoted'));
```

Add a private helper method to the class (place it directly above `promote(`):

```ts
  private ensurePromotedDir(): void {
    mkdirSync(this.promotedDir, { recursive: true });
  }
```

In `promote()`, immediately before the `writeFileSync(turtleFile, ...)` call (line ~380), insert:

```ts
    this.ensurePromotedDir();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-agent exec vitest run tests/promotion-sweeper-dir.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the package's existing tests (no regressions)**

Run: `pnpm --filter predicate-agent test`
Expected: PASS (all existing sweeper tests still green).

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-agent/src/promotion-sweeper.ts packages/predicate-agent/tests/promotion-sweeper-dir.test.ts
git commit -m "fix(agent): promote into store-relative dir + mkdir on demand (no ENOENT)"
```

---

### Task 3a: kg_assert teaching error on malformed object (spec 0.3, P2)

**Root cause:** `renderObject` reads `obj.value` without validating shape; a bare-string object yields `Cannot read properties of undefined (reading 'replace')`.

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-assert.ts`
- Test: `packages/predicate-mcp/tests/kg-assert-guard.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/kg-assert-guard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgAssert } from '../src/tools/kg-assert.js';

describe('kgAssert object-shape guard', () => {
  it('throws a teaching error when object is a bare string', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    const bad = {
      subject: 'urn:s', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: 'urn:o' as unknown as { type: 'uri'; value: string },
      source: 'test', confidence: 0.9, method: 'manual',
    };
    await expect(kgAssert(client, bad)).rejects.toThrow(/object must be \{type:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-mcp exec vitest run tests/kg-assert-guard.test.ts`
Expected: FAIL — throws the opaque `reading 'replace'` error, not the teaching message.

- [ ] **Step 3: Add the guard**

In `packages/predicate-mcp/src/tools/kg-assert.ts`, inside `kgAssert`, immediately after the confidence check (after line 42's closing `}`), insert:

```ts
  const o0 = t.object as unknown;
  if (
    o0 === null || typeof o0 !== 'object' ||
    typeof (o0 as { value?: unknown }).value !== 'string' ||
    ((o0 as { type?: unknown }).type !== 'uri' && (o0 as { type?: unknown }).type !== 'literal')
  ) {
    throw new Error(
      `kg_assert: object must be {type:"uri"|"literal", value:string, datatype?:string}, got ${JSON.stringify(t.object)}`,
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-mcp exec vitest run tests/kg-assert-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-assert.ts packages/predicate-mcp/tests/kg-assert-guard.test.ts
git commit -m "fix(mcp): kg_assert teaches the object shape instead of crashing on a string"
```

---

### Task 3b: extract surfaces rejected triples + `--strict` (spec 0.3, P1)

**Root cause:** the assert loop in `extractTranscript` does `catch { rejected++; }`, discarding the reason; `extract` prints only counts and always exits 0, so a store missing the required vocabulary looks like success.

**Files:**
- Modify: `packages/predicate-cli/src/commands/extract.ts`
- Test: `packages/predicate-cli/tests/extract-rejections.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/extract-rejections.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { extractTranscript } from '../src/commands/extract.js';

describe('extractTranscript rejection reporting', () => {
  it('returns the rejected triples with reasons on an un-seeded store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pred-extract-'));
    const transcript = join(dir, 't.jsonl');
    writeFileSync(transcript, [
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
      ] } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'e1', is_error: false, content: 'ok' },
      ] } }),
    ].join('\n') + '\n', 'utf8');

    // Bare in-memory store: no codebase vocabulary declared → modifiedIn is rejected.
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    const r = await extractTranscript(client, { sessionId: 's1', transcriptPath: transcript, platform: 'claude-code' });

    expect(r.rejected).toBeGreaterThan(0);
    expect(r.rejections.length).toBe(r.rejected);
    expect(r.rejections[0]!.reason).toMatch(/not declared/);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-rejections.test.ts`
Expected: FAIL — `ExtractTranscriptResult` has no `rejections` field.

- [ ] **Step 3: Collect rejection reasons**

In `packages/predicate-cli/src/commands/extract.ts`, extend the result interface (lines 88–93):

```ts
export interface ExtractRejection {
  subject: string;
  predicate: string;
  reason: string;
}

export interface ExtractTranscriptResult {
  deterministic: number;
  semantic: number;
  asserted: number;
  rejected: number;
  rejections: ExtractRejection[];
}
```

Replace the assert loop and return (lines 119–129) with:

```ts
  let asserted = 0;
  const rejections: ExtractRejection[] = [];
  for (const t of [...deterministic.triples, ...semantic.triples] as Array<ExtractedTriple | SemanticTriple>) {
    try {
      await kgAssert(client, t);
      asserted++;
    } catch (err) {
      rejections.push({ subject: t.subject, predicate: t.predicate, reason: (err as Error).message });
    }
  }
  return {
    deterministic: deterministic.triples.length,
    semantic: semantic.triples.length,
    asserted,
    rejected: rejections.length,
    rejections,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-rejections.test.ts`
Expected: PASS.

- [ ] **Step 5: Print warnings + add `--strict` in the CLI entry**

In `packages/predicate-cli/src/commands/extract.ts`, replace the final `console.log(...)` + `return 0;` block (lines 239–242) with:

```ts
  console.log(
    `predicate extract: session=${sessionId} deterministic=${result.deterministic} semantic=${result.semantic} asserted=${result.asserted} rejected=${result.rejected}`,
  );
  if (result.rejected > 0) {
    console.error(
      `predicate extract: WARNING — ${result.rejected} triple(s) were rejected and NOT stored. ` +
      `The store is likely missing required vocabulary (run 'predicate doctor'). First reasons:`,
    );
    for (const r of result.rejections.slice(0, 5)) {
      console.error(`  - ${r.predicate} (subject ${r.subject}): ${r.reason}`);
    }
  }
  return hasFlag(args, '--strict') && result.rejected > 0 ? 1 : 0;
```

Add `--strict` to the help text (in `help()`, after the `--platform` line):

```ts
  --strict             Exit non-zero if any triple is rejected (default: exit 0
                       for Stop-hook safety).
```

- [ ] **Step 6: Run the package's existing extract tests (no regressions)**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract.test.ts`
Expected: PASS. (If an existing test asserts the exact `ExtractTranscriptResult` shape, update it to include `rejections: []`.)

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/extract.ts packages/predicate-cli/tests/extract-rejections.test.ts
git commit -m "fix(cli): extract surfaces rejected triples + --strict (no silent partial success)"
```

---

### Task 4: kg_explore_schema resolves by local name (spec 0.4, P1)

**Root cause:** when a concept isn't found by `rdfs:label`, `resolveConcept` falls back to the bare word and `escapeIRI` injects an invalid relative IRI (`<reads>`), which Oxigraph rejects with `expected ENCODE_FOR_URI`. Class labels happen to equal their local name (`Function`), but property/class labels are human phrases (`reads` → "reads env var", `Command` → "Shell command invocation").

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-explore-schema.ts`
- Test: `packages/predicate-mcp/tests/kg-explore-schema.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/kg-explore-schema.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgExploreSchema } from '../src/tools/kg-explore-schema.js';

const TBOX = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix cb: <https://predicate.dev/codebase#> .
cb:Function a owl:Class ; rdfs:label "Function" .
cb:EnvVar   a owl:Class ; rdfs:label "EnvVar" .
cb:reads a owl:ObjectProperty ; rdfs:domain cb:Function ; rdfs:range cb:EnvVar ; rdfs:label "reads env var" .
`;

describe('kgExploreSchema concept resolution', () => {
  let client: OxigraphAdapter;
  beforeEach(async () => {
    client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(TBOX, 'kg:tbox');
  });

  it('resolves a property by its local name even when the label differs', async () => {
    const slice = await kgExploreSchema(client, 'reads');
    expect(slice.concept).toBe('https://predicate.dev/codebase#EnvVar');
    // 'reads' resolves to the property IRI; the slice lists it among properties.
    expect(slice.properties.map((p) => p.iri)).toContain('https://predicate.dev/codebase#reads');
  });

  it('returns an empty slice (no throw) for an unknown concept', async () => {
    const slice = await kgExploreSchema(client, 'doesNotExist');
    expect(slice.classes).toEqual([]);
    expect(slice.properties).toEqual([]);
  });

  it('still resolves a class by label', async () => {
    const slice = await kgExploreSchema(client, 'Function');
    expect(slice.concept).toBe('https://predicate.dev/codebase#Function');
  });
});
```

> Note on the first assertion: `reads` resolves to the property IRI `cb:reads`. Because the existing property query filters on `?dom = cIri || ?rng = cIri`, a *property* IRI as the concept yields no domain/range match. To make exploring a property useful, Step 3 also adds the resolved IRI itself to the property query filter (`?p = cIri`). The `concept` returned is the resolved IRI; the test's first assertion is updated in Step 3's note if resolution lands on the property rather than its range — keep the assertion that `properties` contains `cb:reads`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-mcp exec vitest run tests/kg-explore-schema.test.ts`
Expected: FAIL — `reads` throws the `ENCODE_FOR_URI` parse error; unknown concept also throws.

- [ ] **Step 3: Add local-name resolution + drop the bare-word fallback**

In `packages/predicate-mcp/src/tools/kg-explore-schema.ts`, replace `resolveConcept` (lines 27–38) with:

```ts
async function resolveConcept(client: StorageAdapter, raw: string): Promise<string | null> {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  // 1. Exact rdfs:label match.
  const byLabel = await client.select(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?iri WHERE {
      GRAPH ${escapeIRI(GRAPH.tbox)} {
        ?iri rdfs:label ${escapeLiteral(raw)} .
      }
    } LIMIT 1
  `);
  const labelHit = byLabel.results.bindings[0]?.iri?.value;
  if (labelHit) return labelHit;

  // 2. Local-name match (the token after the last '#' or '/'). This is how an
  //    agent naturally refers to a predicate/class ("reads", "dependsOn",
  //    "Command"), whose human label is often a phrase.
  const byLocal = await client.select(`
    SELECT ?iri WHERE {
      GRAPH ${escapeIRI(GRAPH.tbox)} { ?iri ?p ?o }
      FILTER(REPLACE(STR(?iri), "^.*[#/]", "") = ${escapeLiteral(raw)})
    } LIMIT 1
  `);
  return byLocal.results.bindings[0]?.iri?.value ?? null;
}
```

Then change the head of `kgExploreSchema` (lines 44–46) so an unresolved concept returns an empty slice instead of injecting a relative IRI:

```ts
  const resolved = await resolveConcept(client, conceptInput);
  if (resolved === null) {
    return { concept: conceptInput, classes: [], properties: [] };
  }
  const concept = resolved;
  const cIri = escapeIRI(concept);
  const tbox = escapeIRI(GRAPH.tbox);
```

In the property query, broaden the final filter (line 89) so exploring a property IRI returns that property:

```ts
        FILTER(?dom = ${cIri} || ?rng = ${cIri} || ?p = ${cIri})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-mcp exec vitest run tests/kg-explore-schema.test.ts`
Expected: PASS (3 tests). If the first assertion's `concept` differs, keep the `properties` containment assertion (it is the load-bearing one) and align `concept` to the resolved IRI actually returned.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-explore-schema.ts packages/predicate-mcp/tests/kg-explore-schema.test.ts
git commit -m "fix(mcp): kg_explore_schema resolves by local name; no relative-IRI crash"
```

---

### Task 5: Session-history vocabulary in default bootstrap (spec 0.5 / D1, P1)

**Root cause:** the Stop-hook extractor emits `codebase#File`, `codebase#Command`, `codebase#modifiedIn`, `codebase#succeededIn`, `codebase#failedIn`, `codebase#commandText`. These live only in `codebase.ttl`. `applyPlan` always loads `predicate-meta.ttl` (every mode) but not `codebase.ttl` (only `--ontology codebase`). So in empty/foaf/etc. modes, session capture silently rejects every relationship triple. Declaring these terms in the always-loaded meta vocabulary fixes capture in all modes while keeping the extractor's IRIs unchanged.

**Files:**
- Modify: `packages/predicate-ontology/meta/predicate-meta.ttl`
- Test: `packages/predicate-cli/tests/extract-default-bootstrap.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/extract-default-bootstrap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { extractTranscript } from '../src/commands/extract.js';

const META_TTL = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'predicate-ontology', 'meta', 'predicate-meta.ttl',
);

describe('session capture works after loading only the meta vocabulary', () => {
  it('accepts modifiedIn/commandText/succeededIn without the codebase ontology', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(readFileSync(META_TTL, 'utf8'), 'kg:tbox');

    const dir = mkdtempSync(join(tmpdir(), 'pred-boot-'));
    const transcript = join(dir, 't.jsonl');
    writeFileSync(transcript, [
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
        { type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'pnpm test' } },
      ] } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'e1', is_error: false, content: 'ok' },
        { type: 'tool_result', tool_use_id: 'b1', is_error: false, content: 'ok' },
      ] } }),
    ].join('\n') + '\n', 'utf8');

    const r = await extractTranscript(client, { sessionId: 's1', transcriptPath: transcript, platform: 'claude-code' });
    expect(r.rejected).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-default-bootstrap.test.ts`
Expected: FAIL — `r.rejected` > 0 (codebase predicates not declared).

- [ ] **Step 3: Add the session-history block to the meta vocabulary**

In `packages/predicate-ontology/meta/predicate-meta.ttl`, add a `cb:` prefix line near the top prefix block:

```ttl
@prefix cb:   <https://predicate.dev/codebase#> .
```

Then append this block at the end of the file (after the bootstrap/init config section):

```ttl
# --- Session-history vocabulary (Stop-hook extractor; loaded in every mode) ---
# These codebase: terms are emitted by the deterministic turn-extractor. They
# live here, in the always-loaded meta vocab, so "what did I modify last
# session" works regardless of which community ontology (if any) is installed.
# codebase.ttl re-declares the same terms; loading both is idempotent.

cb:File    a owl:Class ; rdfs:label "Source file" .
cb:Command a owl:Class ; rdfs:label "Shell command invocation" .

cb:modifiedIn  a owl:ObjectProperty ;
               rdfs:domain cb:File ; rdfs:range pred:Session ;
               rdfs:label "modified in session" .
cb:succeededIn a owl:ObjectProperty ;
               rdfs:domain cb:Command ; rdfs:range pred:Session ;
               rdfs:label "succeeded in session" .
cb:failedIn    a owl:ObjectProperty ;
               rdfs:domain cb:Command ; rdfs:range pred:Session ;
               rdfs:label "failed in session" .
cb:commandText a owl:DatatypeProperty ;
               rdfs:domain cb:Command ; rdfs:range xsd:string ;
               rdfs:label "command text" .
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-default-bootstrap.test.ts`
Expected: PASS (`r.rejected` is 0).

- [ ] **Step 5: Confirm community-mode init still works (no duplicate-load error)**

Run: `pnpm --filter predicate-cli exec vitest run tests/init.test.ts tests/init-judgment.test.ts`
Expected: PASS — loading meta then codebase.ttl (which re-declares the same terms) is idempotent.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-ontology/meta/predicate-meta.ttl packages/predicate-cli/tests/extract-default-bootstrap.test.ts
git commit -m "fix(ontology): session-history vocab in default bootstrap (capture works in empty mode)"
```

---

### Task 6: Live materialization latency metric (spec 0.6, P2)

**Root cause:** `kg_stats.materializationLatencyMsP95` reads `pred:MaterializationCompleted` events with an `elapsedMs` payload, but nothing ever writes that event — only `pred:MaintenanceRun`. So the metric is always 0.

**Files:**
- Modify: `packages/predicate-mcp/src/tools/kg-maintain.ts`
- Test: `packages/predicate-mcp/tests/maintain-latency.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/maintain-latency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { kgMaintain } from '../src/tools/kg-maintain.js';
import { kgStats } from '../src/tools/kg-stats.js';

describe('materialization latency metric', () => {
  it('records a MaterializationCompleted event so kg_stats P95 is populated', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.update('CREATE SILENT GRAPH <kg:meta>');
    await kgMaintain(client, {});
    const r = await client.select(`
      PREFIX pred: <https://predicate.dev/meta#>
      SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:meta> { ?e a pred:MaterializationCompleted } }
    `);
    expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);

    const stats = await kgStats(client);
    expect(stats.materializationLatencyMsP95).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(stats.materializationLatencyMsP95)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-mcp exec vitest run tests/maintain-latency.test.ts`
Expected: FAIL — zero `MaterializationCompleted` events found.

- [ ] **Step 3: Time the fixpoint and emit the event**

In `packages/predicate-mcp/src/tools/kg-maintain.ts`, replace the `runFixpoint` call (lines 75–80) with a timed version:

```ts
  const tFix = Date.now();
  const fixpoint = await runFixpoint(client, RULES, {
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    inferredGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });
  const fixpointMs = Date.now() - tFix;
```

Immediately after the existing `INSERT DATA` that writes the `pred:MaintenanceRun` event (after line 99's closing backtick + `);`), add a second event write:

```ts
  const matEventId = `urn:predicate:event:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${matEventId}> a pred:MaterializationCompleted ;
        pred:at      "${new Date().toISOString()}"^^xsd:dateTime ;
        pred:actor   "kg_maintain" ;
        pred:payload ${escapeLiteral(JSON.stringify({
          elapsedMs: fixpointMs,
          iterations: fixpoint.iterations,
          inferredCount: fixpoint.inferredCount,
        }))} .
    } }
  `);
```

> `pred:MaterializationCompleted` is a new event subclass. Add it to the meta vocabulary too (it groups with the other `pred:Event` subclasses). In `packages/predicate-ontology/meta/predicate-meta.ttl`, in the event-class block (next to `pred:MaintenanceRun`), add:
>
> ```ttl
> pred:MaterializationCompleted a owl:Class ; rdfs:subClassOf pred:Event .
> ```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-mcp exec vitest run tests/maintain-latency.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the package's maintain/stats tests (no regressions)**

Run: `pnpm --filter predicate-mcp test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-maintain.ts packages/predicate-ontology/meta/predicate-meta.ttl packages/predicate-mcp/tests/maintain-latency.test.ts
git commit -m "fix(mcp): emit MaterializationCompleted so kg_stats latency P95 is real"
```

---

### Task 7: doctor round-trip self-test (spec 0.7)

**Goal:** make `predicate doctor` exercise the full durability + reasoning path — assert → maintain → ask → explain → reopen — so durability regressions (Task 1) are caught and trust is observable. This runs only for the Oxigraph backend (uses a throwaway temp store, never the user's data).

**Files:**
- Modify: `packages/predicate-cli/src/commands/doctor.ts`
- Test: `packages/predicate-cli/tests/doctor-roundtrip.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/doctor-roundtrip.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
import { roundTripSelfTest } from '../src/commands/doctor.js';

describe('doctor round-trip self-test', () => {
  it('asserts, persists, and re-reads a triple across adapter instances', async () => {
    const store = mkdtempSync(join(tmpdir(), 'pred-rt-'));
    const ok = await roundTripSelfTest(store);
    expect(ok.persisted).toBe(true);
    // a .nq file was written
    expect(existsSync(store)).toBe(true);
    rmSync(store, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-cli exec vitest run tests/doctor-roundtrip.test.ts`
Expected: FAIL — `roundTripSelfTest` is not exported.

- [ ] **Step 3: Implement the self-test**

In `packages/predicate-cli/src/commands/doctor.ts`, add imports at the top:

```ts
import { OxigraphAdapter } from 'predicate-mcp/src/storage/index.js';
```

Add the exported helper (above `export async function doctor`):

```ts
export interface RoundTripResult {
  persisted: boolean;
  detail: string;
}

/**
 * Assert one triple in an isolated store, close (flush), reopen with a fresh
 * adapter, and confirm the triple survived. Proves durability + query end to
 * end. Uses its own throwaway store dir — never the user's data.
 */
export async function roundTripSelfTest(storePath: string): Promise<RoundTripResult> {
  const S = 'urn:predicate:selftest:s';
  const P = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const O = 'urn:predicate:selftest:Probe';

  const w = new OxigraphAdapter({ storePath });
  await w.ready();
  await w.update(`INSERT DATA { GRAPH <kg:abox> { <${S}> <${P}> <${O}> } }`);
  await w.close(); // force flush to disk

  const r = new OxigraphAdapter({ storePath });
  await r.ready();
  const survived = await r.ask(`ASK { GRAPH <kg:abox> { <${S}> <${P}> <${O}> } }`);
  await r.close();

  return survived
    ? { persisted: true, detail: 'assert → flush → reopen → read OK' }
    : { persisted: false, detail: 'triple lost across reopen — flush-on-close is broken' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-cli exec vitest run tests/doctor-roundtrip.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the self-test into the doctor checks (Oxigraph branch)**

In `packages/predicate-cli/src/commands/doctor.ts`, inside the `else` (Oxigraph) branch, after the "oxigraph store writable" check is pushed, add:

```ts
    if (writable) {
      const rt = await roundTripSelfTest(join(dirname(cfg.oxigraphStorePath), 'doctor-selftest'))
        .catch((err) => ({ persisted: false, detail: (err as Error).message }));
      checks.push({
        name: 'round-trip (assert→flush→reopen→read)',
        ok: rt.persisted,
        detail: rt.detail,
      });
    }
```

Add `join` to the `node:path` import at the top:

```ts
import { dirname, join } from 'node:path';
```

- [ ] **Step 6: Typecheck + run the doctor tests**

Run: `pnpm --filter predicate-cli exec vitest run tests/doctor.test.ts tests/doctor-roundtrip.test.ts`
Expected: PASS. (Update `tests/doctor.test.ts` if it asserts the exact number/order of checks.)

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/doctor.ts packages/predicate-cli/tests/doctor-roundtrip.test.ts
git commit -m "feat(cli): doctor round-trip self-test (durability + reasoning regression guard)"
```

---

### Task 8: Rebuild bundles and re-run the three E2E use cases (integration gate)

**Goal:** prove the patch end-to-end on the same surface the original evaluation used (bundled MCP stdio server + CLI), confirming each P0/P1 finding is resolved.

**Files:** none (verification only).

- [ ] **Step 1: Full build + bundle**

Run: `pnpm build`
Expected: all packages compile; `packages/predicate-skill/server.bundle.mjs`, `cli.bundle.mjs`, and the copied `meta/predicate-meta.ttl` regenerate without error.

- [ ] **Step 2: Full workspace test suite**

Run: `pnpm -r --workspace-concurrency=1 --filter './packages/*' test`
Expected: PASS across all packages.

- [ ] **Step 3: Re-run the durability + explore_schema E2E (Use case 1)**

Run a probe against the rebuilt bundle in a temp store: seed via `cli.bundle.mjs up`/`init --ontology codebase --force`, open the MCP server, `kg_assert` a `login→validateToken→…→JWT_SECRET` chain, `kg_maintain`, `kg_ask` the transitive blast radius, `kg_explain` a claim, then **kill the server, reopen, and confirm the abox/inferred survived**. Also call `kg_explore_schema('reads')`, `('dependsOn')`, `('Session')`.
Expected: blast radius is transitive; provenance returned; **data persists across the kill**; `kg_explore_schema` returns slices for all three (no `ENCODE_FOR_URI`).

- [ ] **Step 4: Re-run the session-history E2E (Use case 2) in EMPTY mode**

Seed with `cli.bundle.mjs up` only (no `--ontology codebase`), feed a Stop-hook payload + transcript with one Edit, one passing Bash, one failing Bash, then `sessions` and `recall`.
Expected: `extract` reports `rejected=0`; `sessions` shows `modifiedFiles=1 succeeded=1 failed=1`; `recall` finds the file and commands. (Confirms Task 5.)

- [ ] **Step 5: Re-run the judgment + schema-evolution E2E (Use case 3)**

In a temp store: capture two conflicting decisions, `kg_maintain`, confirm r20/r21 conflict surfacing; `kg_propose_schema`, drive 3 qualifying uses, `kg_maintain`, and confirm promotion **without setting `PREDICATE_PROMOTED_DIR`** (Task 2).
Expected: conflict surfaced + explained; promotion succeeds out-of-the-box (promoted `.ttl` written under the store dir).

- [ ] **Step 6: Record results and commit the version bump**

Bump `version` to `2.4.0` in `.claude-plugin/marketplace.json`, `packages/predicate-skill/package.json`, `packages/predicate-skill/.claude-plugin/plugin.json`, and `packages/predicate-skill/meta/version.json` (match the existing version-bump pattern in commit `eff39ca`). Then:

```bash
git add -A
git commit -m "chore(skill): bump to 2.4.0 (Phase 0 correctness hardening)"
```

---

## Self-review notes

- **Spec coverage:** 0.1→T1, 0.2→T2, 0.3→T3a+T3b, 0.4→T4, 0.5/D1→T5, 0.6→T6, 0.7→T7, verification→T8. D2 is realized as T1's signal-handler-plus-debounce approach. All spec items map to a task.
- **Type consistency:** `ExtractTranscriptResult` gains `rejections: ExtractRejection[]` (T3b) and is consumed in the same file; `roundTripSelfTest`/`RoundTripResult` defined and used in T7; `makeShutdown` defined in T1 and imported in `index.ts`.
- **Deferred (not in this plan, per spec):** idempotent re-extraction (rides the 2026-05-20 event-sourced spec), per-line transcript resilience, `kg_ask` question-or-sparql flexibility, auto/lazy materialization — all Phase 1+.
