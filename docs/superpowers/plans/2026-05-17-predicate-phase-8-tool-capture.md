# Predicate Phase 8 — kg_capture + Tool-Call Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `kg_capture` MCP tool plus Claude Code PreToolUse and PostToolUse hook scripts that record every tool call (with input + output, truncated, denylist-filtered) into `kg:usage`. Tag v1.4.0-tool-capture.

**Architecture:** Add a new MCP tool `kg_capture` that writes one triple-block per tool invocation to `kg:usage`. Front it with a `predicate capture` CLI subcommand whose `--from-stdin` mode parses the Claude Code hook payload shape directly. Two new bash scripts (`pre-tool-use.sh`, `post-tool-use.sh`) wired in `hooks.json` pipe stdin into the CLI. A denylist env var (`PREDICATE_CAPTURE_SKIP`) lets users suppress noisy tools (e.g. `Bash`).

**Tech Stack:** Node 20+, TypeScript 5 (strict + noUncheckedIndexedAccess), pnpm workspaces, Apache Jena Fuseki, bash, jq, esbuild bundler. Builds on the `predicate-mcp`, `predicate-cli`, `predicate-skill`, and `predicate-ontology` packages.

---

## File Structure

**New files:**
- `packages/predicate-mcp/src/tools/kg-capture.ts` — the `kgCapture` library function (one SPARQL update per call).
- `packages/predicate-mcp/tests/tools/kg-capture.test.ts` — unit tests against a live Fuseki: happy path, denylist, truncation, multi-call.
- `packages/predicate-cli/src/commands/capture.ts` — CLI subcommand wrapping `kgCapture`; supports `--from-stdin`, `--tool`, `--input`, `--output`, `--session`, `--phase`.
- `packages/predicate-cli/tests/capture.test.ts` — unit tests for the CLI (flag mode + stdin mode + denylist).
- `packages/predicate-skill/hooks/pre-tool-use.sh` — Claude Code PreToolUse hook: pipes stdin to `predicate capture --from-stdin --phase pre`.
- `packages/predicate-skill/hooks/post-tool-use.sh` — Claude Code PostToolUse hook: pipes stdin to `predicate capture --from-stdin --phase post`.

**Modified files:**
- `packages/predicate-ontology/meta/predicate-meta.ttl` — add `pred:ToolCall` class plus `pred:toolName`, `pred:toolInput`, `pred:toolOutput`, `pred:sessionId`, `pred:phase` properties.
- `packages/predicate-ontology/meta/version.json` — bump version.
- `packages/predicate-mcp/src/tools/registry.ts` — register `kg_capture` in `buildTools()`.
- `packages/predicate-cli/src/index.ts` — register `predicate capture` subcommand in the dispatcher + help text.
- `packages/predicate-skill/hooks/hooks.json` — register PreToolUse and PostToolUse events.
- `packages/predicate-skill/package.json` — bump version 1.3.0 → 1.4.0.
- `.claude-plugin/marketplace.json` — bump versions 1.3.0 → 1.4.0.
- `README.md` — add `kg_capture` row to the Tools table; add `predicate capture` row to the CLI block; update Status section; note the new `PREDICATE_CAPTURE_SKIP` env var.

---

## Background context (for the executing engineer)

### What kg_capture writes

For each tool call, one block of triples in `kg:usage`:

```turtle
GRAPH <kg:usage> {
  <urn:predicate:capture:lXXXXX-yyyyyy> a pred:ToolCall ;
    pred:toolName   "Read" ;
    pred:toolInput  "{\"file_path\":\"/foo.ts\"}" ;
    pred:toolOutput "1\tline 1\n2\tline 2\n…" ;
    pred:sessionId  "session-abc" ;
    pred:phase      "post" ;
    pred:at         "2026-05-17T08:00:00.000Z"^^xsd:dateTime .
}
```

`pred:phase` is `"pre"` (PreToolUse fired) or `"post"` (PostToolUse fired). The `urn:predicate:capture:…` URN uses base36(timestamp)-base36(random6) — same shape as the eventId in `kg-maintain.ts:71`.

### Claude Code hook payload shape

Claude Code feeds hooks via stdin JSON. Reference shape (verify against your live Claude Code version):

```json
{
  "session_id": "ses-abcdefg",
  "tool_name": "Read",
  "tool_input": { "file_path": "/Users/x/foo.ts" },
  "tool_response": { "content": "…file contents…" }
}
```

PreToolUse omits `tool_response`. PostToolUse includes it.

### Denylist semantics

Env var `PREDICATE_CAPTURE_SKIP` is a comma-separated list of tool names to skip. Default `""` (capture everything). Comparison is case-sensitive exact match against the `tool_name` field. Example:

```bash
PREDICATE_CAPTURE_SKIP="Bash,WebFetch"
```

If `tool_name` is in the skip list, `predicate capture` exits 0 with no SPARQL update and no stdout/stderr — silently suppress.

### Truncation

Env var `PREDICATE_CAPTURE_TRUNCATE` is an integer character cap. Default `500`. Applied independently to the serialized input JSON and the serialized output JSON. If a value is truncated, append a literal suffix ` … [truncated, N more chars]`.

### Why `predicate capture --from-stdin` instead of direct SPARQL in bash

Keeps the JSON parsing, escaping, and SPARQL formatting in TypeScript where it's tested. Bash scripts stay 3 lines (`set -euo pipefail; cat - | predicate capture --from-stdin --phase X`). Avoids shell-escaping bugs around quotes in tool input/output.

### Pre-Phase scope reminders

- **In scope:** kg_capture MCP tool, predicate capture CLI, Claude Code PreToolUse + PostToolUse hooks, denylist, truncation.
- **Out of scope (deferred to v1.5+):** Cursor/Gemini/VSCode/OpenCode/Codex PreTool/PostTool adapters (their event schemas are unstable or absent — Phase 9 will add platforms once we have a reference impl). LLM-augmented entity extraction. Reconciliation between Pre and Post events. A `predicate captures` query CLI to inspect recent calls (use `predicate stats` or raw SPARQL for now).

---

### Task 1: Add `pred:ToolCall` to meta vocabulary

**Files:**
- Modify: `packages/predicate-ontology/meta/predicate-meta.ttl`
- Modify: `packages/predicate-ontology/meta/version.json`

- [ ] **Step 1: Read the existing meta vocab to find the insertion point**

Run: `cat packages/predicate-ontology/meta/predicate-meta.ttl | tail -10`

You'll see the `pred:Query` class block at the end. Append the new ToolCall block after it.

- [ ] **Step 2: Append `pred:ToolCall` to the meta vocab**

Modify `packages/predicate-ontology/meta/predicate-meta.ttl`. Append at end of file (after the existing `pred:elapsedMs` declaration):

```turtle

# --- Tool-call capture event class (used by kg_capture) ----------

pred:ToolCall a owl:Class ; rdfs:label "Captured tool invocation" .

pred:toolName   a owl:DatatypeProperty ;
                rdfs:domain pred:ToolCall ; rdfs:range xsd:string .
pred:toolInput  a owl:DatatypeProperty ;
                rdfs:domain pred:ToolCall ; rdfs:range xsd:string .
pred:toolOutput a owl:DatatypeProperty ;
                rdfs:domain pred:ToolCall ; rdfs:range xsd:string .
pred:sessionId  a owl:DatatypeProperty ;
                rdfs:domain pred:ToolCall ; rdfs:range xsd:string .
pred:phase      a owl:DatatypeProperty ;
                rdfs:domain pred:ToolCall ; rdfs:range xsd:string .
```

- [ ] **Step 3: Bump version.json**

Modify `packages/predicate-ontology/meta/version.json`. Read the current content first; bump the patch or minor version. Example transition: `1.0.0` → `1.1.0`. The file is small, just replace its full contents:

```json
{
  "version": "1.1.0",
  "publishedAt": "2026-05-17"
}
```

(Use today's date in `publishedAt`; if the existing file has a different schema, preserve all other keys and only adjust `version` and the date.)

- [ ] **Step 4: Reload the meta vocab into Fuseki**

```bash
docker exec predicate-fuseki bash -c "echo ok" >/dev/null 2>&1 && \
  ( cd packages/predicate-server && bash scripts/bootstrap-graphs.sh ) 2>&1 | tail -10
```

Expected: `bootstrap complete` on last line. (The script appends to kg:tbox; duplicate triples are no-ops.)

- [ ] **Step 5: Verify the new class is queryable**

```bash
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> ASK { GRAPH <kg:tbox> { pred:ToolCall a <http://www.w3.org/2002/07/owl#Class> } }" \
  --header "Accept: application/sparql-results+json" | jq -r .boolean
```

Expected: `true`

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-ontology/meta/predicate-meta.ttl packages/predicate-ontology/meta/version.json
git commit -m "$(cat <<'EOF'
feat(ontology): add pred:ToolCall class for kg_capture

Adds the class + 5 properties (toolName, toolInput, toolOutput,
sessionId, phase) backing the new kg_capture MCP tool and the
Claude Code PreToolUse/PostToolUse hook scripts shipping in
Phase 8. Bumps meta vocabulary to 1.1.0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Implement `kgCapture()` library function

**Files:**
- Create: `packages/predicate-mcp/src/tools/kg-capture.ts`
- Create: `packages/predicate-mcp/tests/tools/kg-capture.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-mcp/tests/tools/kg-capture.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { kgCapture } from '../../src/tools/kg-capture.js';

const client = new SparqlClient(loadConfig());

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:usage>`);
  await client.update(`CREATE SILENT GRAPH <kg:usage>`);
}

async function captureCount(): Promise<number> {
  const r = await client.select(
    `PREFIX pred: <https://predicate.dev/meta#>
     SELECT (COUNT(*) AS ?n) WHERE {
       GRAPH <kg:usage> { ?c a pred:ToolCall }
     }`,
  );
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

describe('kg_capture', () => {
  beforeEach(async () => { await reset(); });

  it('writes one ToolCall block per invocation', async () => {
    const result = await kgCapture(client, {
      toolName: 'Read',
      input: { file_path: '/foo.ts' },
      output: { content: 'line 1\nline 2' },
      sessionId: 'ses-test',
      phase: 'post',
    });
    expect(result.captureId).toMatch(/^urn:predicate:capture:/);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(await captureCount()).toBe(1);
  });

  it('truncates input and output to PREDICATE_CAPTURE_TRUNCATE chars', async () => {
    const orig = process.env['PREDICATE_CAPTURE_TRUNCATE'];
    process.env['PREDICATE_CAPTURE_TRUNCATE'] = '50';
    try {
      const longString = 'x'.repeat(200);
      const result = await kgCapture(client, {
        toolName: 'Read',
        input: { data: longString },
        output: { data: longString },
        phase: 'post',
      });
      const stored = await client.select(
        `PREFIX pred: <https://predicate.dev/meta#>
         SELECT ?input ?output WHERE {
           GRAPH <kg:usage> {
             <${result.captureId}> pred:toolInput ?input ;
                                   pred:toolOutput ?output .
           }
         }`,
      );
      const inputStr = stored.results.bindings[0]!.input!.value;
      const outputStr = stored.results.bindings[0]!.output!.value;
      expect(inputStr.length).toBeLessThan(longString.length);
      expect(inputStr).toContain('truncated');
      expect(outputStr.length).toBeLessThan(longString.length);
      expect(outputStr).toContain('truncated');
    } finally {
      if (orig !== undefined) process.env['PREDICATE_CAPTURE_TRUNCATE'] = orig;
      else delete process.env['PREDICATE_CAPTURE_TRUNCATE'];
    }
  });

  it('omits toolOutput when output is undefined (pre-phase)', async () => {
    const result = await kgCapture(client, {
      toolName: 'Edit',
      input: { file_path: '/x.ts' },
      phase: 'pre',
    });
    const r = await client.select(
      `PREFIX pred: <https://predicate.dev/meta#>
       SELECT (BOUND(?o) AS ?hasOutput) WHERE {
         GRAPH <kg:usage> {
           <${result.captureId}> pred:phase "pre" .
           OPTIONAL { <${result.captureId}> pred:toolOutput ?o }
         }
       }`,
    );
    expect(r.results.bindings[0]!.hasOutput!.value).toBe('false');
  });

  it('returns distinct captureIds for back-to-back calls', async () => {
    const r1 = await kgCapture(client, { toolName: 'Read', phase: 'post' });
    const r2 = await kgCapture(client, { toolName: 'Read', phase: 'post' });
    expect(r1.captureId).not.toBe(r2.captureId);
    expect(await captureCount()).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
pnpm --filter predicate-mcp test kg-capture
```

Expected: FAIL with `Cannot find module '../../src/tools/kg-capture.js'` (or similar resolution error).

- [ ] **Step 3: Write the minimal implementation**

Create `packages/predicate-mcp/src/tools/kg-capture.ts`:

```typescript
import { SparqlClient } from '../sparql/client.js';
import { GRAPH } from '../graphs.js';
import { escapeIRI, escapeLiteral } from '../sparql/escape.js';

const META = 'https://predicate.dev/meta#';

export interface CaptureInput {
  toolName: string;
  input?: unknown;
  output?: unknown;
  sessionId?: string;
  phase: 'pre' | 'post';
}

export interface CaptureResult {
  captureId: string;
  elapsedMs: number;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const extra = s.length - max;
  return `${s.slice(0, max)} … [truncated, ${extra} more chars]`;
}

function serialize(value: unknown, max: number): string {
  let s: string;
  if (value === undefined || value === null) s = '';
  else if (typeof value === 'string') s = value;
  else {
    try { s = JSON.stringify(value); } catch { s = String(value); }
  }
  return truncate(s, max);
}

export async function kgCapture(
  client: SparqlClient,
  input: CaptureInput,
): Promise<CaptureResult> {
  const t0 = Date.now();
  const maxChars = parseInt(process.env['PREDICATE_CAPTURE_TRUNCATE'] ?? '500', 10);
  const captureId =
    `urn:predicate:capture:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const inputStr = serialize(input.input, maxChars);
  const hasOutput = input.output !== undefined && input.output !== null;
  const outputStr = hasOutput ? serialize(input.output, maxChars) : '';

  const lines: string[] = [
    `${escapeIRI(captureId)} a <${META}ToolCall> ;`,
    `  <${META}toolName>  ${escapeLiteral(input.toolName)} ;`,
    `  <${META}phase>     ${escapeLiteral(input.phase)} ;`,
    `  <${META}at>        "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>`,
  ];
  if (inputStr.length > 0) lines.push(`  ; <${META}toolInput>  ${escapeLiteral(inputStr)}`);
  if (hasOutput) lines.push(`  ; <${META}toolOutput> ${escapeLiteral(outputStr)}`);
  if (input.sessionId) lines.push(`  ; <${META}sessionId>  ${escapeLiteral(input.sessionId)}`);
  lines.push('  .');

  await client.update(`
    INSERT DATA { GRAPH ${escapeIRI(GRAPH.usage)} {
      ${lines.join('\n      ')}
    } }
  `);

  return { captureId, elapsedMs: Date.now() - t0 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter predicate-mcp test kg-capture
```

Expected: PASS (4 tests). If any fail, read the error and fix — the most likely issue is escaping or graph-name mismatches.

- [ ] **Step 5: Run the full predicate-mcp test suite to confirm no regressions**

```bash
pnpm --filter predicate-mcp test
```

Expected: all prior tests still pass + the 4 new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-mcp/src/tools/kg-capture.ts packages/predicate-mcp/tests/tools/kg-capture.test.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add kgCapture library function

Writes one pred:ToolCall block per tool invocation into kg:usage,
with truncation governed by PREDICATE_CAPTURE_TRUNCATE (default 500
chars) and an explicit phase field ("pre" or "post"). The capture
URN scheme matches the eventId shape used by kg_maintain.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Register `kg_capture` in MCP registry

**Files:**
- Modify: `packages/predicate-mcp/src/tools/registry.ts`

- [ ] **Step 1: Add the import**

Modify `packages/predicate-mcp/src/tools/registry.ts`. After the existing imports at lines 1-10, add:

```typescript
import { kgCapture } from './kg-capture.js';
```

- [ ] **Step 2: Add the tool definition**

Modify `packages/predicate-mcp/src/tools/registry.ts`. Find the `kg_stats` entry around lines 178-182 and add a new entry immediately AFTER it (still inside the `return [` array, before `...stubs()`):

```typescript
    {
      name: 'kg_capture',
      description: 'Record a tool invocation (toolName, input, output, sessionId, phase) into kg:usage. Used by per-platform PreToolUse/PostToolUse hooks; safe to call directly. Returns {captureId, elapsedMs}.',
      inputSchema: z.object({
        toolName: z.string().min(1),
        input: z.unknown().optional(),
        output: z.unknown().optional(),
        sessionId: z.string().optional(),
        phase: z.enum(['pre', 'post']),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          toolName: z.string().min(1),
          input: z.unknown().optional(),
          output: z.unknown().optional(),
          sessionId: z.string().optional(),
          phase: z.enum(['pre', 'post']),
        }).parse(raw);
        return kgCapture(client, args);
      },
    },
```

- [ ] **Step 3: Verify the registry compiles**

```bash
pnpm --filter predicate-mcp build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 4: Smoke-test the tool is registered**

```bash
pnpm --filter predicate-mcp exec node -e "
import('predicate-mcp/src/tools/registry.js').then(m => {
  import('predicate-mcp/src/sparql/client.js').then(c => {
    import('predicate-mcp/src/config.js').then(cfg => {
      const client = new c.SparqlClient(cfg.loadConfig());
      const tools = m.buildTools(client);
      const names = tools.map(t => t.name).sort();
      console.log('registered tools:', names);
      console.log('has kg_capture:', names.includes('kg_capture'));
    });
  });
});
"
```

Expected: list of tools includes `kg_capture`; final line `has kg_capture: true`.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-mcp/src/tools/registry.ts
git commit -m "$(cat <<'EOF'
feat(mcp): register kg_capture in the MCP tool registry

Exposes kgCapture as the 9th MCP tool. Schema validates toolName +
phase as required fields; input/output/sessionId optional. Handler
delegates to the library function added in the previous commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add `predicate capture` CLI subcommand

**Files:**
- Create: `packages/predicate-cli/src/commands/capture.ts`
- Create: `packages/predicate-cli/tests/capture.test.ts`
- Modify: `packages/predicate-cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/capture.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import { capture } from '../src/commands/capture.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

const client = new SparqlClient(loadConfig());

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:usage>`);
  await client.update(`CREATE SILENT GRAPH <kg:usage>`);
}

async function captureCount(): Promise<number> {
  const r = await client.select(
    `PREFIX pred: <https://predicate.dev/meta#>
     SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall } }`,
  );
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

describe('predicate capture', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await reset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); });

  it('writes a capture when given --tool and --phase via argv', async () => {
    const code = await capture(['--tool', 'Read', '--phase', 'post', '--input', '{"x":1}']);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
  });

  it('parses Claude Code stdin payload with --from-stdin', async () => {
    const payload = JSON.stringify({
      session_id: 'ses-abc',
      tool_name: 'Edit',
      tool_input: { file_path: '/x.ts' },
      tool_response: { ok: true },
    });
    const stdin = Readable.from([payload]);
    const code = await capture(['--from-stdin', '--phase', 'post'], stdin);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
  });

  it('skips silently when tool_name is in PREDICATE_CAPTURE_SKIP', async () => {
    const orig = process.env['PREDICATE_CAPTURE_SKIP'];
    process.env['PREDICATE_CAPTURE_SKIP'] = 'Bash,WebFetch';
    try {
      const code = await capture(['--tool', 'Bash', '--phase', 'post']);
      expect(code).toBe(0);
      expect(await captureCount()).toBe(0);
    } finally {
      if (orig !== undefined) process.env['PREDICATE_CAPTURE_SKIP'] = orig;
      else delete process.env['PREDICATE_CAPTURE_SKIP'];
    }
  });

  it('returns 2 with --help and prints usage', async () => {
    const code = await capture(['--help']);
    expect(code).toBe(0);
    const printed = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(printed).toContain('predicate capture');
    expect(printed).toContain('--from-stdin');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-cli test capture
```

Expected: FAIL with `Cannot find module '../src/commands/capture.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/predicate-cli/src/commands/capture.ts`:

```typescript
import type { Readable } from 'node:stream';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgCapture } from 'predicate-mcp/src/tools/kg-capture.js';

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function help(): void {
  console.log(`predicate capture [options]

Record a tool invocation into kg:usage. Suitable for use from
platform-specific PreToolUse / PostToolUse hook scripts.

Options:
  --tool NAME           Tool name (required unless --from-stdin)
  --phase pre|post      Hook phase (required)
  --input  JSON_OR_STR  Serialized tool input (optional)
  --output JSON_OR_STR  Serialized tool output (optional)
  --session ID          Session identifier (optional)
  --from-stdin          Parse a Claude-Code-shaped JSON object from stdin
                        (keys: session_id, tool_name, tool_input, tool_response).
                        --phase is still required.
  --help                Print this message.

Env:
  PREDICATE_CAPTURE_SKIP       Comma list of tool names to suppress (default "").
  PREDICATE_CAPTURE_TRUNCATE   Max chars per field (default 500).
  FUSEKI_URL, PREDICATE_DATASET   Server location.
`);
}

async function readStdin(stream: Readable): Promise<string> {
  let buf = '';
  for await (const chunk of stream) buf += String(chunk);
  return buf;
}

function shouldSkip(toolName: string): boolean {
  const raw = process.env['PREDICATE_CAPTURE_SKIP'] ?? '';
  if (raw.length === 0) return false;
  return raw.split(',').map((s) => s.trim()).includes(toolName);
}

function parseMaybeJson(s: string | undefined): unknown {
  if (s === undefined) return undefined;
  try { return JSON.parse(s); } catch { return s; }
}

export async function capture(args: string[], stdin: Readable = process.stdin): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const phase = parseFlag(args, '--phase');
  if (phase !== 'pre' && phase !== 'post') {
    console.error('predicate capture: --phase must be "pre" or "post"');
    return 2;
  }

  let toolName: string | undefined;
  let toolInput: unknown;
  let toolOutput: unknown;
  let sessionId: string | undefined;

  if (hasFlag(args, '--from-stdin')) {
    const raw = await readStdin(stdin);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      console.error(`predicate capture: invalid JSON on stdin: ${(err as Error).message}`);
      return 2;
    }
    toolName = typeof payload['tool_name'] === 'string' ? payload['tool_name'] : undefined;
    toolInput = payload['tool_input'];
    toolOutput = payload['tool_response'];
    sessionId = typeof payload['session_id'] === 'string' ? payload['session_id'] : undefined;
  } else {
    toolName = parseFlag(args, '--tool');
    toolInput = parseMaybeJson(parseFlag(args, '--input'));
    toolOutput = parseMaybeJson(parseFlag(args, '--output'));
    sessionId = parseFlag(args, '--session');
  }

  if (!toolName) {
    console.error('predicate capture: --tool is required (or --from-stdin with payload.tool_name)');
    return 2;
  }
  if (shouldSkip(toolName)) return 0;

  try {
    const client = new SparqlClient(loadConfig());
    await kgCapture(client, { toolName, input: toolInput, output: toolOutput, sessionId, phase });
    return 0;
  } catch (err) {
    console.error(`predicate capture failed: ${(err as Error).message}`);
    return 1;
  }
}
```

- [ ] **Step 4: Wire the subcommand into the CLI dispatcher**

Modify `packages/predicate-cli/src/index.ts`. Add the capture import after the existing maintain import:

```typescript
#!/usr/bin/env node
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { doctor } from './commands/doctor.js';
import { stats } from './commands/stats.js';
import { sessionstart } from './commands/sessionstart.js';
import { maintain } from './commands/maintain.js';
import { capture } from './commands/capture.js';
```

Update the `help()` function to add a `capture` line:

```typescript
function help(): void {
  console.log(`predicate <command>

Commands:
  up             Bring Fuseki up (docker compose up -d) and load the seed TBox.
  down           Stop Fuseki, preserve the data volume.
  doctor         Health checks: docker, fuseki, tbox.
  stats          Print kg_stats output for the live graph.
  sessionstart   Print a one-line KG status banner (used by hook scripts).
  maintain       Run kg_maintain (reaper + generalizer + sweeper).
  capture        Record a tool invocation in kg:usage (used by PreTool/PostTool hooks).
  --version      Print the predicate version.
  --help         This message.

Env:
  FUSEKI_URL                http://localhost:3030 (default)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
  PREDICATE_CAPTURE_SKIP    comma list of tool names to skip in kg_capture
  PREDICATE_CAPTURE_TRUNCATE  max chars per captured input/output (default 500)
`);
}
```

Update the switch — note the capture case forwards `process.argv.slice(3)`:

```typescript
  switch (cmd) {
    case 'up':           return up();
    case 'down':         return down();
    case 'doctor':       return doctor();
    case 'stats':        return stats();
    case 'sessionstart': return sessionstart();
    case 'maintain':     return maintain();
    case 'capture':      return capture(process.argv.slice(3));
    case '--version':
    case 'version':      console.log(VERSION); return 0;
    case undefined:
    case '--help':
    case 'help':         help(); return 0;
    default:
      console.error(`unknown command: ${cmd}`);
      help();
      return 2;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter predicate-cli test
```

Expected: all prior CLI tests pass + the 4 new capture tests.

- [ ] **Step 6: Manually smoke-test the CLI from a fresh shell**

```bash
pnpm --filter predicate-skill run bundle
node packages/predicate-skill/cli.bundle.mjs capture --tool Read --phase post --input '{"file_path":"/foo.ts"}'
# Expected: no output, exit 0
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall } }" \
  --header "Accept: application/sparql-results+json" | jq -r '.results.bindings[0].n.value'
```

Expected: a non-zero count (the count from the test seeds + your manual capture). Actual minimum after this run is 1; if the test cleaned up beforeEach it would be exactly 1.

Also try stdin mode:

```bash
echo '{"session_id":"ses-x","tool_name":"Edit","tool_input":{"file_path":"/a.ts"},"tool_response":{"ok":true}}' \
  | node packages/predicate-skill/cli.bundle.mjs capture --from-stdin --phase post
```

Expected: no output, exit 0.

And denylist:

```bash
PREDICATE_CAPTURE_SKIP="Bash" node packages/predicate-skill/cli.bundle.mjs capture --tool Bash --phase post
# Expected: no output, exit 0, no new triple written
```

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/capture.ts packages/predicate-cli/tests/capture.test.ts packages/predicate-cli/src/index.ts
git commit -m "$(cat <<'EOF'
feat(cli): add `predicate capture` subcommand

Wraps kgCapture for use from per-platform PreToolUse / PostToolUse
hook scripts. Supports flag mode (--tool, --phase, --input, --output,
--session) and --from-stdin mode that parses Claude Code's hook
payload directly. PREDICATE_CAPTURE_SKIP env var (comma list) skips
suppressed tools silently; PREDICATE_CAPTURE_TRUNCATE caps field
length (default 500 chars).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add Claude Code `pre-tool-use.sh` hook script

**Files:**
- Create: `packages/predicate-skill/hooks/pre-tool-use.sh`

- [ ] **Step 1: Create the script**

Create `packages/predicate-skill/hooks/pre-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Claude Code PreToolUse hook: records {toolName, input, sessionId, phase:"pre"}
# in kg:usage. Reads Claude Code's hook payload JSON from stdin and delegates
# to `predicate capture --from-stdin`. Fails open: any error returns exit 0
# so the user's tool invocation is never blocked by capture logic.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 2: Mark it executable**

```bash
chmod +x packages/predicate-skill/hooks/pre-tool-use.sh
ls -l packages/predicate-skill/hooks/pre-tool-use.sh
```

Expected: file mode starts with `-rwxr-xr-x`.

- [ ] **Step 3: Smoke-test the script**

```bash
# Make sure `predicate` is on PATH (e.g. via the .bin shim or `npm link`).
echo '{"session_id":"ses-test","tool_name":"Read","tool_input":{"file_path":"/x.ts"}}' \
  | bash packages/predicate-skill/hooks/pre-tool-use.sh
echo "exit=$?"
```

Expected: `exit=0`. Verify the capture landed:

```bash
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT ?phase WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall ; pred:phase ?phase ; pred:sessionId \"ses-test\" } } ORDER BY DESC(?phase) LIMIT 1" \
  --header "Accept: application/sparql-results+json" | jq -r '.results.bindings[0].phase.value'
```

Expected: `pre`.

- [ ] **Step 4: Verify fail-open behavior**

Temporarily make `predicate` unavailable, then run:

```bash
env -i PATH=/usr/bin:/bin bash packages/predicate-skill/hooks/pre-tool-use.sh </dev/null
echo "exit=$?"
```

Expected: `exit=0` even though `predicate` was not on PATH. The hook MUST never block the user's tool call.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-skill/hooks/pre-tool-use.sh
git commit -m "$(cat <<'EOF'
feat(skill): add claude-code pre-tool-use.sh hook

Pipes Claude Code's PreToolUse stdin payload into
`predicate capture --from-stdin --phase pre`. Fail-open: any error
or missing `predicate` binary returns exit 0 so capture never
blocks the user's tool invocation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add Claude Code `post-tool-use.sh` hook script

**Files:**
- Create: `packages/predicate-skill/hooks/post-tool-use.sh`

- [ ] **Step 1: Create the script**

Create `packages/predicate-skill/hooks/post-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Claude Code PostToolUse hook: records {toolName, input, output, sessionId,
# phase:"post"} in kg:usage. Reads Claude Code's hook payload JSON from stdin
# and delegates to `predicate capture --from-stdin`. Fails open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase post >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 2: Mark it executable**

```bash
chmod +x packages/predicate-skill/hooks/post-tool-use.sh
ls -l packages/predicate-skill/hooks/post-tool-use.sh
```

Expected: file mode starts with `-rwxr-xr-x`.

- [ ] **Step 3: Smoke-test the script**

```bash
echo '{"session_id":"ses-post","tool_name":"Read","tool_input":{"file_path":"/y.ts"},"tool_response":{"content":"hello"}}' \
  | bash packages/predicate-skill/hooks/post-tool-use.sh
echo "exit=$?"
```

Expected: `exit=0`. Verify:

```bash
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT ?phase ?output WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall ; pred:phase ?phase ; pred:sessionId \"ses-post\" ; pred:toolOutput ?output } } LIMIT 1" \
  --header "Accept: application/sparql-results+json" | jq -r '.results.bindings[0] | .phase.value + " | " + .output.value'
```

Expected: `post | {"content":"hello"}` (or similar — the exact output string is the JSON-stringified tool_response).

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-skill/hooks/post-tool-use.sh
git commit -m "$(cat <<'EOF'
feat(skill): add claude-code post-tool-use.sh hook

Records the full PostToolUse payload (input + output + sessionId)
in kg:usage via `predicate capture --from-stdin --phase post`.
Fail-open, never blocks the user's flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Register PreToolUse and PostToolUse in hooks.json

**Files:**
- Modify: `packages/predicate-skill/hooks/hooks.json`

- [ ] **Step 1: Read the current hooks.json**

Run: `cat packages/predicate-skill/hooks/hooks.json`

You should see an array with one entry (SessionStart). The new file will have three entries total.

- [ ] **Step 2: Replace hooks.json with the expanded array**

Modify `packages/predicate-skill/hooks/hooks.json` (overwrite full contents):

```json
{
  "hooks": [
    {
      "event": "SessionStart",
      "matcher": "startup|clear|compact",
      "command": "bash ${PLUGIN_DIR}/hooks/session-start.sh"
    },
    {
      "event": "PreToolUse",
      "matcher": "*",
      "command": "bash ${PLUGIN_DIR}/hooks/pre-tool-use.sh"
    },
    {
      "event": "PostToolUse",
      "matcher": "*",
      "command": "bash ${PLUGIN_DIR}/hooks/post-tool-use.sh"
    }
  ]
}
```

- [ ] **Step 3: Validate the JSON parses**

```bash
jq . packages/predicate-skill/hooks/hooks.json
```

Expected: pretty-printed JSON without errors. If `jq` reports a syntax error, fix the file and re-run.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-skill/hooks/hooks.json
git commit -m "$(cat <<'EOF'
feat(skill): wire PreToolUse + PostToolUse in claude-code hooks.json

Registers the two new hook scripts with matcher "*" so they fire
for every tool call. Combined with the existing SessionStart entry,
Claude Code now exercises three lifecycle events for Predicate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: README + version bump + bundle rebuild + tag v1.4.0-tool-capture

**Files:**
- Modify: `README.md`
- Modify: `packages/predicate-skill/package.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `packages/predicate-skill/server.bundle.mjs` (regenerated)
- Modify: `packages/predicate-skill/cli.bundle.mjs` (regenerated)

- [ ] **Step 1: Add `kg_capture` to the Tools table in README**

Modify `README.md`. Find the Tools table (begins with `| Tool | What it does |`). Add this row directly after the `kg_maintain` row (which currently is last):

```markdown
| `kg_capture` | Record a tool invocation (toolName, input, output, sessionId, phase) into `kg:usage`. Used by PreToolUse/PostToolUse hook scripts. |
```

- [ ] **Step 2: Add `predicate capture` to the CLI block in README**

Modify `README.md`. Find the CLI code block (begins with `predicate up`). Add the new line directly after the `predicate maintain` line:

```
predicate capture        # record a tool call in kg:usage (used by hooks)
```

The full CLI block should now read:

```
predicate up             # docker compose up + bootstrap graphs + load TBox
predicate down           # stop fuseki, keep the volume
predicate doctor         # health checks (docker, fuseki, tbox, tools)
predicate stats          # current kg_stats output
predicate sessionstart   # one-line KG status banner (used by hook scripts)
predicate maintain       # reaper + generalizer + promotion sweeper
predicate capture        # record a tool call in kg:usage (used by hooks)
predicate --version
predicate --help
```

- [ ] **Step 3: Update the Status section**

Modify `README.md`. Find the `## Status` heading and replace its body with:

```markdown
## Status

**v1.4 — tool-call capture.** Claude Code PreToolUse and PostToolUse
hooks now record every tool invocation in `kg:usage` (with input/output
truncation and per-tool denylist via `PREDICATE_CAPTURE_SKIP`). 9 MCP
tools total (`kg_capture` added). Per-platform hook adapters from v1.3
remain shipped; cross-platform PreTool/PostTool extractors are deferred
to v1.5 once the v1.4 reference impl on Claude Code is proven.

Earlier milestones (in order): `v0.1.0-foundation` → `v0.2.0-discipline` →
`v0.3a.0-goals-and-gaps` → `v0.3b.0-research-execution` →
`v0.3c.0-schema-evolution` → `v1.0.0` → `v1.1.0-distribution` →
`v1.2.0-multiplatform` → `v1.3.0-platform-hooks` → `v1.4.0-tool-capture`.

Deferred to v1.5 (see spec §17): cross-platform PreTool/PostTool
adapters (Cursor, Gemini CLI, VS Code Copilot, OpenCode, Codex CLI);
LLM-augmented entity extraction from captured tool calls; reconciliation
of orphan Pre events to their Post events; a `predicate captures` query
CLI; materialization caching; tag-while-deriving for `kg_explain`;
intent-aware `ResearchSource` filtering; journal-based cross-system
promotion atomicity.
```

- [ ] **Step 4: Bump version in `packages/predicate-skill/package.json`**

Modify `packages/predicate-skill/package.json`. Find `"version": "1.3.0"` (line 3) and replace with `"version": "1.4.0"`.

- [ ] **Step 5: Bump versions in `.claude-plugin/marketplace.json`**

Modify `.claude-plugin/marketplace.json`. Find both `"version": "1.3.0"` lines and replace both with `"version": "1.4.0"`. The file should still parse as valid JSON afterward.

- [ ] **Step 6: Run the full test suite**

```bash
pnpm test 2>&1 | grep -E "Test Files|Tests +[0-9]"
```

Expected: every prior test still passes; total test count should be 152 (Phase 7) + 8 new (4 in kg-capture, 4 in capture CLI) = 160.

- [ ] **Step 7: Rebuild the bundles**

```bash
pnpm --filter predicate-skill run bundle 2>&1 | tail -5
ls -l packages/predicate-skill/server.bundle.mjs packages/predicate-skill/cli.bundle.mjs
```

Expected: both files updated; mode bits on `cli.bundle.mjs` are `-rwxr-xr-x`.

- [ ] **Step 8: Smoke-test the bundled CLI**

```bash
node packages/predicate-skill/cli.bundle.mjs --help | head -15
node packages/predicate-skill/cli.bundle.mjs capture --tool Read --phase post --input '{"file_path":"/tmp/foo"}'
echo "exit=$?"
```

Expected first command: help output includes `capture` row. Expected second command: `exit=0`, no other output.

- [ ] **Step 9: Commit**

```bash
git add README.md packages/predicate-skill/package.json .claude-plugin/marketplace.json packages/predicate-skill/server.bundle.mjs packages/predicate-skill/cli.bundle.mjs
git commit -m "$(cat <<'EOF'
chore(release): v1.4.0 — tool-call capture (kg_capture + Claude Code hooks)

- README Tools table gains kg_capture row.
- README CLI block gains `predicate capture` row.
- README Status updated; cross-platform PreTool/PostTool moved to v1.5.
- Bump predicate-skill package.json + marketplace.json to 1.4.0.
- Rebuild bundles (server.bundle.mjs + cli.bundle.mjs) including the
  new kg_capture tool and predicate capture subcommand.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Tag v1.4.0-tool-capture**

```bash
git tag -a v1.4.0-tool-capture -m "Predicate v1.4.0 — kg_capture MCP tool + Claude Code PreToolUse + PostToolUse hooks"
git tag --list 'v*' | sort
```

Expected: the new tag appears in the sorted list alongside `v1.3.0-platform-hooks` and earlier. Do NOT push the tag — the user controls when to push.

---

## Self-Review

### Spec coverage

This plan covers Phase 8 as confirmed in conversation:

- ✅ New MCP tool `kg_capture` — Tasks 2 + 3
- ✅ New CLI subcommand `predicate capture` with `--from-stdin` mode — Task 4
- ✅ Claude Code PreToolUse hook (`pre-tool-use.sh`) — Task 5
- ✅ Claude Code PostToolUse hook (`post-tool-use.sh`) — Task 6
- ✅ `hooks.json` updated to register both new events — Task 7
- ✅ Denylist env var `PREDICATE_CAPTURE_SKIP` — Task 4 (implementation) + Task 2 fields (not yet — wait, denylist lives in the CLI not the library; see consistency check below)
- ✅ Truncation env var `PREDICATE_CAPTURE_TRUNCATE` — Task 2 (library handles it)
- ✅ Tag v1.4.0-tool-capture — Task 8 Step 10
- ✅ Other platforms (Cursor/Gemini/VSCode/OpenCode/Codex) deferred — explicitly noted in README Status section in Task 8 Step 3

One implicit requirement worth verifying: the `pred:ToolCall` class declaration must exist in the meta vocab for `kg_explore_schema` to surface it — Task 1 handles this.

### Placeholder scan

Searched the plan for: `TBD`, `TODO`, `implement later`, `add appropriate`, `add validation`, `handle edge cases`, `similar to task`. None found in execution steps. Acceptable literal placeholders: none — the plan contains complete code blocks for every step.

### Type / name consistency

- `kgCapture(client, input)` signature: defined in Task 2 step 3; called the same way in Task 3 step 2 (handler) and Task 4 step 3 (CLI). ✅
- `CaptureInput.phase` is `'pre' | 'post'` (Task 2). The CLI parses `--phase` and validates against the same two strings (Task 4 step 3). The hook scripts pass `--phase pre` / `--phase post` (Tasks 5/6). ✅
- Capture URN format `urn:predicate:capture:base36-base36`: defined in Task 2 step 3, tested in Task 2 step 1 with regex `/^urn:predicate:capture:/`. ✅
- Env var name `PREDICATE_CAPTURE_SKIP`: consistent across Task 4 (CLI parses it), Task 4 test 3 (test sets and unsets it), README Status update (Task 8 step 3), and CLI help text (Task 4 step 4 — also adds it to the index.ts env block). ✅
- Env var `PREDICATE_CAPTURE_TRUNCATE`: consistent across Task 2 step 3 (library reads it), Task 2 step 1 test 2 (test sets it), and README/help additions in Task 4. ✅
- Hook script filenames `pre-tool-use.sh` / `post-tool-use.sh`: consistent across Tasks 5, 6, and the hooks.json wiring in Task 7. ✅

**Note on the denylist's home:** The plan places the denylist check in the CLI (Task 4 step 3, `shouldSkip()`) rather than in the library (`kgCapture` in Task 2). That's deliberate — the library should remain a pure write path that any caller can use without surprise side-effects. The CLI is the public boundary where opinionated behavior lives. The MCP tool registration (Task 3 step 2) calls `kgCapture` directly, so calls coming in over MCP are NOT filtered by `PREDICATE_CAPTURE_SKIP` — only calls through `predicate capture` (i.e. the hooks) are. If a future requirement makes the denylist apply to MCP callers too, lifting it into `kgCapture` is a one-line change.
