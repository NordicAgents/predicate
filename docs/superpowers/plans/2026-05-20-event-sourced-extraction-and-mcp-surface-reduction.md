# Event-sourced extraction + MCP surface reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop `kg_capture`/`kg_config_get`/`kg_config_set` from the MCP registry (11→8 tools) with a CLI replacement, and add `predicate extract --replay <path>` that rebuilds the extraction-derived slice of `kg:abox` from transcripts idempotently.

**Architecture:** Config and capture stay as functions/CLI; only their MCP exposure is removed. Replay reuses the live extraction core, wrapping it in a per-session scoped delete (keyed on `urn:predicate:session:<id>` provenance) + re-assert, then re-materializes `kg:inferred` once.

**Tech Stack:** TypeScript (ESM, Node 20), pnpm workspaces, vitest, Oxigraph/Fuseki storage adapter, esbuild bundles.

**Spec:** `docs/superpowers/specs/2026-05-20-event-sourced-extraction-and-mcp-surface-reduction-design.md`

**Prerequisite for every test step:** the test suite talks to a live store on `:3030`. Start it once before running tests: `pnpm fuseki:up` (and `pnpm fuseki:down` when done).

---

### Task 1: New `predicate config` CLI command

Adds the operator path for runtime config so removing the MCP config tools (Task 2) never strands the `schema-learning` toggle. Reuses `kgConfigGet`/`kgConfigSet` verbatim.

**Files:**
- Create: `packages/predicate-cli/src/commands/config.ts`
- Create: `packages/predicate-cli/tests/config.test.ts`
- Modify: `packages/predicate-cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/config.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { config } from '../src/commands/config.js';

const client = getAdapter();

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

describe('predicate config', () => {
  beforeEach(async () => { await reset('kg:meta'); });

  it('set then get round-trips a boolean key', async () => {
    expect(await config(['set', 'schema-learning', 'false'])).toBe(0);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await config(['get', 'schema-learning'])).toBe(0);
    expect(log.mock.calls.flat().join(' ')).toContain('false');
    log.mockRestore();
  });

  it('rejects an unknown key with exit 2', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await config(['set', 'nope', 'x'])).toBe(2);
    err.mockRestore();
  });

  it('rejects a non-boolean schema-learning value with exit 2', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await config(['set', 'schema-learning', 'maybe'])).toBe(2);
    err.mockRestore();
  });

  it('prints help with exit 0', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await config(['--help'])).toBe(0);
    expect(log.mock.calls.flat().join(' ')).toContain('predicate config');
    log.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-cli exec vitest run tests/config.test.ts`
Expected: FAIL — cannot find module `../src/commands/config.js`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/predicate-cli/src/commands/config.ts`:

```ts
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgConfigGet, kgConfigSet } from 'predicate-mcp/src/tools/kg-config.js';

const KEYS = ['schema-learning', 'init-mode', 'init-ontology'] as const;
type Key = (typeof KEYS)[number];

function isKey(s: string | undefined): s is Key {
  return s !== undefined && (KEYS as readonly string[]).includes(s);
}

function help(): void {
  console.log(`predicate config <get|set>

  config get [<key>]            Print one value, or the full config if key omitted.
  config set <key> <value>      Write a runtime config value into kg:meta.

Keys:
  schema-learning   boolean (true|false) — toggles the auto-proposer.
  init-mode         string  — usually written by \`predicate init\`.
  init-ontology     string  — usually written by \`predicate init\`.
`);
}

export async function config(args: string[]): Promise<number> {
  const sub = args[0];
  if (sub === '--help') { help(); return 0; }
  if (sub === undefined) { help(); return 2; }

  const client = getAdapter();

  if (sub === 'get') {
    const key = args[1];
    if (key !== undefined && !isKey(key)) {
      console.error(`predicate config get: unknown key '${key}'. Valid: ${KEYS.join(', ')}`);
      return 2;
    }
    const r = await kgConfigGet(client, isKey(key) ? { key } : {});
    console.log(JSON.stringify(isKey(key) ? { [r.key!]: r.value } : (r.config ?? {}), null, 2));
    return 0;
  }

  if (sub === 'set') {
    const key = args[1];
    const valueRaw = args[2];
    if (!isKey(key)) {
      console.error(`predicate config set: key must be one of ${KEYS.join(', ')}`);
      return 2;
    }
    if (valueRaw === undefined) {
      console.error('predicate config set: a value is required');
      return 2;
    }
    let value: string | boolean = valueRaw;
    if (key === 'schema-learning') {
      if (valueRaw !== 'true' && valueRaw !== 'false') {
        console.error(`predicate config set: schema-learning expects true|false, got '${valueRaw}'`);
        return 2;
      }
      value = valueRaw === 'true';
    }
    const res = await kgConfigSet(client, { key, value });
    if (!res.ok) { console.error(`predicate config set: ${res.error}`); return 2; }
    console.log(`predicate config set: ${res.key}=${res.value}`);
    return 0;
  }

  console.error(`predicate config: unknown subcommand '${sub}'`);
  help();
  return 2;
}
```

- [ ] **Step 4: Wire into the CLI dispatcher**

In `packages/predicate-cli/src/index.ts`, add the import next to the other command imports:

```ts
import { config } from './commands/config.js';
```

Add the help line in the `Commands:` block (after the `schema` line):

```
  config            Get/set runtime config (schema-learning toggle, init keys).
```

Add the switch case (next to `case 'schema':`):

```ts
    case 'config':          return config(process.argv.slice(3));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter predicate-cli exec vitest run tests/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter predicate-cli typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/config.ts packages/predicate-cli/tests/config.test.ts packages/predicate-cli/src/index.ts
git commit -m "feat(cli): add 'predicate config get/set' command"
```

---

### Task 2: Remove the three tools from the MCP registry

`kg_capture`, `kg_config_get`, `kg_config_set` leave the model surface. Their implementation modules (`kg-capture.ts`, `kg-config.ts`) stay — they are imported by the CLI.

**Files:**
- Modify: `packages/predicate-mcp/src/tools/registry.ts`
- Modify: `packages/predicate-mcp/tests/index.test.ts`

- [ ] **Step 1: Update the failing test first (TDD: assertion drives the change)**

Replace the body of `packages/predicate-mcp/tests/index.test.ts` with the 8-tool expectation:

```ts
import { describe, it, expect } from 'vitest';
import { getAdapter } from '../src/storage/index.js';

import { buildTools } from '../src/tools/registry.js';

describe('tool registry', () => {
  const tools = buildTools(getAdapter());
  const names = tools.map((t) => t.name);

  it('exposes exactly the 8 agent-facing tools', () => {
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

  it('no longer exposes capture/config tools (moved to CLI)', () => {
    expect(names).not.toContain('kg_capture');
    expect(names).not.toContain('kg_config_get');
    expect(names).not.toContain('kg_config_set');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-mcp exec vitest run tests/index.test.ts`
Expected: FAIL — registry still returns 11 names including `kg_capture`/`kg_config_*`.

- [ ] **Step 3: Remove the three tool definitions**

In `packages/predicate-mcp/src/tools/registry.ts`, delete the three object literals: the `kg_capture` block (currently `name: 'kg_capture'` … through its closing `},`), the `kg_config_get` block, and the `kg_config_set` block — i.e. the contiguous region from `{ name: 'kg_capture', …` up to and including the `},` immediately before `...stubs(),`.

Then remove the now-unused imports at the top of the file:

```ts
import { kgCapture } from './kg-capture.js';
import { kgConfigGet, kgConfigSet } from './kg-config.js';
```

Leave `...stubs()` and every other tool untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-mcp exec vitest run tests/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck (catches any stray reference)**

Run: `pnpm --filter predicate-mcp typecheck`
Expected: no errors (no remaining use of `kgCapture`/`kgConfigGet`/`kgConfigSet` in registry).

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/registry.ts packages/predicate-mcp/tests/index.test.ts
git commit -m "feat(mcp): drop kg_capture/kg_config_* from registry (11→8 tools)"
```

---

### Task 3: Refactor `extract` to expose a reusable per-transcript core

Pure refactor — no behavior change. Pulls the read→adapt→extract→assert body into `extractTranscript()` so both `--from-stdin` and `--replay` can call it. The existing `extract.test.ts` must stay green.

**Files:**
- Modify: `packages/predicate-cli/src/commands/extract.ts`

- [ ] **Step 1: Add the `extractTranscript` helper**

In `packages/predicate-cli/src/commands/extract.ts`, add this exported function (above the existing `extract` function). It is the body currently inline in `extract`, parameterized:

```ts
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';

export interface ExtractTranscriptResult {
  deterministic: number;
  semantic: number;
  asserted: number;
  rejected: number;
}

export async function extractTranscript(
  client: StorageAdapter,
  opts: { sessionId: string; transcriptPath: string; platform: Platform },
): Promise<ExtractTranscriptResult> {
  const lines = readFileSync(opts.transcriptPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  const events = lines.map((l) => JSON.parse(l) as Record<string, unknown>);

  const adapted = adapterFor(opts.platform)(events);
  const transcript: Transcript = { sessionId: opts.sessionId, events: adapted };
  const deterministic = extractDeterministic(transcript);

  let semantic: { triples: SemanticTriple[]; skipped: string[] } = { triples: [], skipped: [] };
  if (process.env['ANTHROPIC_API_KEY']) {
    const tboxSlice = await buildTBoxSlice(client);
    semantic = await extractSemantic({
      sessionId: opts.sessionId,
      finalMessage: lastAssistantText(adapted),
      toolSummary: summarizeToolCalls(adapted),
      tboxSlice,
    });
  }

  let asserted = 0;
  let rejected = 0;
  for (const t of [...deterministic.triples, ...semantic.triples] as Array<ExtractedTriple | SemanticTriple>) {
    try { await kgAssert(client, t); asserted++; } catch { rejected++; }
  }
  return {
    deterministic: deterministic.triples.length,
    semantic: semantic.triples.length,
    asserted,
    rejected,
  };
}
```

- [ ] **Step 2: Rewrite the `--from-stdin` branch to call the helper**

In the existing `extract` function, replace the block from `let events: Array<Record<string, unknown>>;` down through the final `console.log(...)`/`return 0;` (the read/extract/assert/log body) with:

```ts
  let result: ExtractTranscriptResult;
  try {
    result = await extractTranscript(getAdapter(), { sessionId, transcriptPath, platform });
  } catch (err) {
    console.error(`predicate extract: failed to process transcript: ${(err as Error).message}`);
    return 1;
  }

  console.log(
    `predicate extract: session=${sessionId} deterministic=${result.deterministic} semantic=${result.semantic} asserted=${result.asserted} rejected=${result.rejected}`,
  );
  return 0;
```

(The `getAdapter` import already exists; the now-unneeded inline `const client = getAdapter();` in that branch is removed by this replacement.)

- [ ] **Step 3: Run the existing extract tests**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract.test.ts`
Expected: PASS — unchanged behavior for `--from-stdin`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter predicate-cli typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-cli/src/commands/extract.ts
git commit -m "refactor(cli): extract reusable extractTranscript() core"
```

---

### Task 4: Scoped-delete helper for a session's extracted slice

The idempotency primitive: delete only triples whose provenance `source` is the session URI **and** that have no other source (preserves model-authored facts on shared triples).

**Files:**
- Create: `packages/predicate-cli/src/commands/replay-rebuild.ts`
- Create: `packages/predicate-cli/tests/replay-rebuild.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/replay-rebuild.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';
import { deleteExtractedSlice } from '../src/commands/replay-rebuild.js';

const client = getAdapter();
const C = 'https://predicate.dev/codebase#';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function aboxCount(): Promise<number> {
  const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }');
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

beforeEach(async () => {
  await reset('kg:tbox'); await reset('kg:abox'); await reset('kg:provenance');
  // declare the predicate so kgAssert accepts it
  await client.loadTurtle(
    `@prefix c: <${C}> . @prefix owl: <http://www.w3.org/2002/07/owl#> . c:imports a owl:ObjectProperty .`,
    'kg:tbox',
  );
});

describe('deleteExtractedSlice', () => {
  it('removes only triples whose sole provenance source is the session URI', async () => {
    await kgAssert(client, {
      subject: `${C}a.ts`, predicate: `${C}imports`,
      object: { type: 'uri', value: `${C}b.ts` },
      source: 'urn:predicate:session:S1', confidence: 0.95, method: 'tool-parse',
    });
    expect(await aboxCount()).toBe(1);
    await deleteExtractedSlice(client, 'S1');
    expect(await aboxCount()).toBe(0);
  });

  it('preserves a triple that also has a non-session source (shared triple)', async () => {
    const triple = {
      subject: `${C}a.ts`, predicate: `${C}imports`,
      object: { type: 'uri' as const, value: `${C}b.ts` },
    };
    await kgAssert(client, { ...triple, source: 'urn:predicate:session:S1', confidence: 0.95, method: 'tool-parse' });
    await kgAssert(client, { ...triple, source: 'manual', confidence: 1, method: 'human' });
    await deleteExtractedSlice(client, 'S1');
    expect(await aboxCount()).toBe(1); // shared triple survives
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-cli exec vitest run tests/replay-rebuild.test.ts`
Expected: FAIL — cannot find module `../src/commands/replay-rebuild.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/predicate-cli/src/commands/replay-rebuild.ts`:

```ts
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://predicate.dev/meta#';

/**
 * Delete the extraction-derived slice for one session from kg:abox + kg:provenance.
 * A triple is removed only when the session URI is its SOLE provenance source, so
 * facts the model also asserted directly (a different source) are preserved.
 */
export async function deleteExtractedSlice(
  client: StorageAdapter,
  sessionId: string,
): Promise<void> {
  const source = escapeLiteral(`urn:predicate:session:${sessionId}`);
  await client.update(`
    PREFIX pred: <${META}>
    DELETE {
      GRAPH <kg:abox> { ?s ?p ?o }
      GRAPH <kg:provenance> { << ?s ?p ?o >> ?pp ?po }
    }
    WHERE {
      GRAPH <kg:provenance> {
        << ?s ?p ?o >> pred:source ${source} .
        << ?s ?p ?o >> ?pp ?po .
      }
      FILTER NOT EXISTS {
        GRAPH <kg:provenance> {
          << ?s ?p ?o >> pred:source ?other .
          FILTER (?other != ${source})
        }
      }
    }
  `);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-cli exec vitest run tests/replay-rebuild.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-cli/src/commands/replay-rebuild.ts packages/predicate-cli/tests/replay-rebuild.test.ts
git commit -m "feat(cli): scoped-delete helper for a session's extracted slice"
```

---

### Task 5: Wire `--replay <path>` into the extract command

Enumerate transcripts, per-session delete+re-extract, then re-materialize `kg:inferred` once.

**Files:**
- Modify: `packages/predicate-cli/src/commands/extract.ts`
- Create: `packages/predicate-cli/tests/extract-replay.test.ts`
- Test fixture: created inline by the test (a temp dir of `.jsonl` files)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/extract-replay.test.ts`. The transcript
shape and TBox precondition are copied verbatim from the known-good
`tests/extract.test.ts` (Edit + Bash tool calls → `cb:modifiedIn` /
`cb:succeededIn` triples; the `withCodebaseTBox` fixture supplies the TBox so
`kgAssert` accepts those predicates). `--replay` derives the session id from
the filename, so naming the file `<sessionId>.jsonl` yields
`urn:predicate:session:<sessionId>`:

```ts
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withCodebaseTBox } from 'predicate-mcp/tests/fixtures/with-codebase.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';
import { extract } from '../src/commands/extract.js';

const client = getAdapter();
const C = 'https://predicate.dev/codebase#';

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function aboxCount(): Promise<number> {
  const r = await client.select('SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:abox> { ?s ?p ?o } }');
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

// Same event shape proven to extract a triple in tests/extract.test.ts.
function writeTranscript(dir: string, sessionId: string): void {
  const events = [
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/work/auth.ts' } },
    ]}},
    { type: 'user', message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
    ]}},
    { type: 'assistant', message: { role: 'assistant', content: [
      { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'pnpm test' } },
    ]}},
    { type: 'user', message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't2', content: 'PASS' },
    ]}},
  ];
  writeFileSync(join(dir, `${sessionId}.jsonl`), events.map((e) => JSON.stringify(e)).join('\n'));
}

describe('predicate extract --replay', () => {
  let dir: string;
  beforeAll(async () => { await withCodebaseTBox(client); });
  beforeEach(async () => {
    await reset('kg:abox'); await reset('kg:provenance'); await reset('kg:inferred');
    dir = mkdtempSync(join(tmpdir(), 'replay-'));
  });

  it('rebuilds the abox slice and is idempotent across two replays', async () => {
    writeTranscript(dir, 'sess1');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(await extract(['--replay', dir])).toBe(0);
    const after1 = await aboxCount();
    expect(after1).toBeGreaterThan(0);

    expect(await extract(['--replay', dir])).toBe(0);
    const after2 = await aboxCount();
    expect(after2).toBe(after1); // no duplication

    log.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('preserves a model-authored fact (non-session source) across replay', async () => {
    // cb:modifiedIn is declared by withCodebaseTBox; assert one with a manual source.
    await kgAssert(client, {
      subject: 'file:///work/manual.ts', predicate: `${C}modifiedIn`,
      object: { type: 'uri', value: 'urn:predicate:session:HUMAN' },
      source: 'manual', confidence: 1, method: 'human',
    });
    writeTranscript(dir, 'sess2');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(await extract(['--replay', dir])).toBe(0);
    const r = await client.select(
      `SELECT ?o WHERE { GRAPH <kg:abox> { <file:///work/manual.ts> <${C}modifiedIn> ?o } }`,
    );
    expect(r.results.bindings).toHaveLength(1); // manual fact survived

    log.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('errors with exit 2 when the path has no .jsonl files', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await extract(['--replay', dir])).toBe(2);
    err.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-replay.test.ts`
Expected: FAIL — `extract` rejects unknown mode / `--from-stdin is required`.

- [ ] **Step 3a: Add the `predicate-reasoner` workspace dependency**

`predicate-cli` does not yet depend on `predicate-reasoner` (it has
`predicate-agent`, `predicate-mcp`, `predicate-server`). The re-materialize
step imports `FusekiConstructAdapter` directly, so add the dep. In
`packages/predicate-cli/package.json`, add to `dependencies`:

```json
    "predicate-reasoner": "workspace:*",
```

Then run `pnpm install` to relink the workspace:

Run: `pnpm install`
Expected: lockfile updated, `predicate-reasoner` linked into predicate-cli.

- [ ] **Step 3b: Add imports + the replay branch**

In `packages/predicate-cli/src/commands/extract.ts`, add imports:

```ts
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import { deleteExtractedSlice } from './replay-rebuild.js';
```

Add a `replay` function:

```ts
async function replay(pathArg: string, platform: Platform): Promise<number> {
  let files: string[];
  try {
    const st = statSync(pathArg);
    files = st.isDirectory()
      ? readdirSync(pathArg).filter((f) => f.endsWith('.jsonl')).map((f) => join(pathArg, f))
      : [pathArg];
  } catch (err) {
    console.error(`predicate extract --replay: cannot read ${pathArg}: ${(err as Error).message}`);
    return 2;
  }
  if (files.length === 0) {
    console.error(`predicate extract --replay: no .jsonl transcripts in ${pathArg}`);
    return 2;
  }

  const client = getAdapter();
  let sessions = 0, asserted = 0, rejected = 0, errors = 0;
  for (const file of files) {
    const sessionId = basename(file, '.jsonl');
    try {
      await deleteExtractedSlice(client, sessionId);
      const r = await extractTranscript(client, { sessionId, transcriptPath: file, platform });
      asserted += r.asserted; rejected += r.rejected; sessions++;
    } catch (err) {
      console.error(`predicate extract --replay: session ${sessionId} failed: ${(err as Error).message}`);
      errors++;
    }
  }

  // Re-materialize inferred once over the rebuilt abox.
  await client.update('DROP SILENT GRAPH <kg:inferred>');
  await new FusekiConstructAdapter(client).materialize({
    tboxGraph: 'kg:tbox',
    aboxGraphs: ['kg:abox'],
    targetGraph: 'kg:inferred',
    closureCutoff: 0.5,
  });

  console.log(
    `predicate extract --replay: replayed ${sessions} sessions, asserted ${asserted}, rejected ${rejected}, errors ${errors}`,
  );
  return sessions === 0 && errors > 0 ? 1 : 0;
}
```

- [ ] **Step 4: Dispatch `--replay` at the top of `extract`**

In `extract`, replace the early guard:

```ts
  if (!hasFlag(args, '--from-stdin')) {
    console.error('predicate extract: --from-stdin is required.');
    return 2;
  }
```

with platform parsing first, then a replay/stdin branch:

```ts
  const platformRaw = parseFlag(args, '--platform') ?? 'claude-code';
  if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platformRaw)) {
    console.error(
      `predicate extract: unsupported --platform "${platformRaw}". Supported: ${SUPPORTED_PLATFORMS.join(', ')}.`,
    );
    return 2;
  }
  const platform = platformRaw as Platform;

  const replayPath = parseFlag(args, '--replay');
  if (replayPath !== undefined) {
    return replay(replayPath, platform);
  }

  if (!hasFlag(args, '--from-stdin')) {
    console.error('predicate extract: --from-stdin or --replay <path> is required.');
    return 2;
  }
```

Then delete the now-duplicated `platformRaw`/`platform` parsing block that previously sat after the `--from-stdin` guard (Task 3 left it just above the stdin read). The single copy above now serves both branches.

- [ ] **Step 5: Update the help text**

In the `help()` of `extract.ts`, add a line documenting replay (next to the `--from-stdin` usage):

```
  --replay <path>   Rebuild the extracted abox slice from a transcript file or
                    a directory of <session-id>.jsonl files (re-materializes inferred).
```

- [ ] **Step 6: Run the new + existing extract tests**

Run: `pnpm --filter predicate-cli exec vitest run tests/extract-replay.test.ts tests/extract.test.ts`
Expected: PASS — replay tests green, `--from-stdin` behavior unchanged.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter predicate-cli typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/predicate-cli/src/commands/extract.ts packages/predicate-cli/tests/extract-replay.test.ts \
        packages/predicate-cli/package.json pnpm-lock.yaml
git commit -m "feat(cli): add 'predicate extract --replay' transcript rebuild"
```

---

### Task 6: Docs, manifests, tool counts, and bundle rebuild

Bring shipped docs in line with 8 tools + the two new CLI commands, then regenerate the committed bundles.

**Files:**
- Modify: `README.md`
- Modify: `packages/predicate-skill/README.md`
- Modify: `packages/predicate-skill/skills/predicate/SKILL.md`
- Modify: `packages/predicate-skill/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `packages/predicate-skill/skills/predicate-doctor/SKILL.md`
- Regenerated: `packages/predicate-skill/cli.bundle.mjs`, `server.bundle.mjs`, `meta/`

- [ ] **Step 1: Update tool counts and tables**

Apply these edits:
- `plugin.json`: `"11 kg_* MCP tools"` → `"8 kg_* MCP tools"`.
- `marketplace.json`: `"the 11 kg_* MCP tools"` → `"the 8 kg_* MCP tools"`.
- `predicate-doctor/SKILL.md`: `"all 11 kg_* tools responsive"` → `"all 8 kg_* tools responsive"`.
- `README.md` MCP-tools table: remove no rows for capture/config (they were already absent), but in the **CLI** section add:
  ```
  predicate config get|set    # runtime config (schema-learning toggle, init keys)
  predicate extract --replay <path>   # rebuild extracted abox slice from transcripts
  ```
- `packages/predicate-skill/README.md`: it states `"The bundled server exposes 11 tools over stdio:"` → change to `8`, and ensure no `kg_capture`/`kg_config_*` rows remain in its tool table (remove them if present). Add the same two CLI lines as above to its CLI block.
- `SKILL.md`: if it documents `kg_config_*`/`kg_capture` as MCP tools anywhere, replace with a one-line note that config is now `predicate config` (CLI).

- [ ] **Step 2: Grep to confirm no stale references**

Run:
```bash
git grep -nE "kg_capture|kg_config_(get|set)|11 (kg_\*|tools|MCP)" -- '*.md' '*.json' ':!docs/*'
```
Expected: no output (all converted to the CLI / "8").

- [ ] **Step 3: Rebuild the bundles**

Run: `pnpm build:bundle`
Expected: `built server.bundle.mjs` + `built cli.bundle.mjs`, `staged meta/`.

- [ ] **Step 4: Verify the CLI bundle has the new commands and not the dropped tools**

Run:
```bash
grep -c "predicate config" packages/predicate-skill/cli.bundle.mjs
grep -c "kg_config_get\|kg_config_set\|name: 'kg_capture'" packages/predicate-skill/server.bundle.mjs
```
Expected: first `> 0`; second `0`.

- [ ] **Step 5: Commit**

```bash
git add README.md packages/predicate-skill .claude-plugin
git commit -m "docs: 8-tool surface, document config + extract --replay; rebuild bundles"
```

---

### Task 7: Full suite + version bump (release gate)

**Files:**
- Modify (version): `packages/predicate-skill/package.json`, `packages/predicate-skill/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (×2)

- [ ] **Step 1: Run the full workspace test suite (Fuseki up)**

Run: `pnpm fuseki:up && pnpm test`
Expected: all packages green (predicate-mcp now 8-tool assertion; predicate-cli includes config + replay-rebuild + extract-replay).

- [ ] **Step 2: Typecheck the whole workspace**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Decide and apply the version bump**

Removing model-facing MCP tools is a breaking contract change. Default to **minor `2.2.0`** unless the maintainer chooses major. Bump all four version strings (the same four touched in the last release: skill `package.json`, `plugin.json`, and `marketplace.json` metadata + plugin entries), then rebuild bundles so `predicate --version` reports it:

```bash
# edit the four version strings 2.1.0 -> 2.2.0, then:
pnpm build:bundle
grep -c '"2.2.0"' packages/predicate-skill/cli.bundle.mjs   # expect > 0
```

- [ ] **Step 4: Commit + tear down**

```bash
git add -A
git commit -m "chore(skill): bump to 2.2.0 (8-tool MCP surface + extract --replay)"
pnpm fuseki:down
```

---

## Notes for the executor

- Tasks 1–2 are independent of 3–5; 3 must precede 4–5 only because 5 imports the Task-3 helper and Task-4 module.
- Every test step needs Fuseki on `:3030` (`pnpm fuseki:up`). The container image pulls on first run.
- Do not hand-edit `*.bundle.mjs` or `packages/predicate-skill/meta/` — they are generated by `pnpm build:bundle` (Task 6/7).
- The `predicate capture` CLI and `kgCapture`/`kgConfig*` functions are intentionally **kept**; only their MCP registration is removed.
