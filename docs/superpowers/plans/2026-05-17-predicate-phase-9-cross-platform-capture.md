# Predicate Phase 9 — Cross-Platform PreTool/PostTool Adapters Implementation Plan

> **⚠️ SUPERSEDED.** This plan extended Phase 8's per-tool-call capture model to 5 more platforms. It was abandoned before
> implementation in favor of a fundamentally different architecture: instead of writing one opaque triple per tool call,
> Phase 9 now extracts **typed, learned knowledge** at the **end of each turn** via a Stop hook. See
> [`2026-05-17-predicate-phase-9-stop-hook-extract.md`](2026-05-17-predicate-phase-9-stop-hook-extract.md). This file is
> kept for history.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Phase 8's tool-call capture to the other 5 platforms (Gemini CLI, Cursor, VS Code Copilot, OpenCode, Codex CLI). Add 10 new bash scripts (5 platforms × 2 events: pre-tool-use, post-tool-use) plus a `--platform` flag on `predicate capture --from-stdin` that selects the right per-platform JSON parser. Wire Gemini and OpenCode to native events where possible; ship the other three as manual / cron / shell-alias-only with documentation. Tag v1.5.0-cross-platform-capture.

**Architecture:** Each platform's PreToolUse / PostToolUse JSON payload has different field names (`tool_name` vs `toolName` vs `tool.name`). Rather than encoding that variation in 10 separate bash scripts, the CLI absorbs it: a new `--platform claude-code|gemini|opencode|cursor|vscode-copilot|codex-cli|auto` flag selects a per-platform parser. Default `claude-code` (preserves Phase 8 behavior). The bash scripts stay thin — same shape as the Claude Code ones, differing only in the `--platform` argument and the per-platform README that documents wiring.

**Tech Stack:** Node 20+, TypeScript 5 (strict + noUncheckedIndexedAccess), pnpm workspaces, Apache Jena Fuseki, bash, jq, esbuild bundler. Builds on `kg_capture` and `predicate capture --from-stdin` from Phase 8.

---

## File Structure

**New files (10 bash scripts):**
- `packages/predicate-skill/hooks/cursor/pre-tool-use.sh`
- `packages/predicate-skill/hooks/cursor/post-tool-use.sh`
- `packages/predicate-skill/hooks/gemini-cli/pre-tool-use.sh`
- `packages/predicate-skill/hooks/gemini-cli/post-tool-use.sh`
- `packages/predicate-skill/hooks/vscode-copilot/pre-tool-use.sh`
- `packages/predicate-skill/hooks/vscode-copilot/post-tool-use.sh`
- `packages/predicate-skill/hooks/opencode/pre-tool-use.sh`
- `packages/predicate-skill/hooks/opencode/post-tool-use.sh`
- `packages/predicate-skill/hooks/codex-cli/pre-tool-use.sh`
- `packages/predicate-skill/hooks/codex-cli/post-tool-use.sh`

**Modified files:**
- `packages/predicate-cli/src/commands/capture.ts` — add `--platform` flag + per-platform parsers.
- `packages/predicate-cli/tests/capture.test.ts` — add tests for each new platform parser.
- `packages/predicate-skill/hooks/gemini-cli/settings.json.template` — register the two new hook events.
- `packages/predicate-skill/hooks/opencode/opencode.json.template` — register the two new hook events.
- `packages/predicate-skill/hooks/{cursor,gemini-cli,vscode-copilot,opencode,codex-cli}/README.md` — document the new scripts (auto-wired vs manual-only).
- `README.md` (repo root) — bump status section; note the cross-platform capture in install matrix where applicable.
- `packages/predicate-skill/README.md` — update version line + hook events table.
- `packages/predicate-skill/package.json` — bump version 1.4.0 → 1.5.0.
- `.claude-plugin/marketplace.json` — bump versions 1.4.0 → 1.5.0.

---

## Background context (for the executing engineer)

### What Phase 8 shipped

The `predicate capture` CLI accepts either flag mode (`--tool X --input Y …`) or stdin mode (`--from-stdin`). Stdin mode currently assumes Claude Code's payload shape:

```json
{
  "session_id": "ses-abc",
  "tool_name": "Read",
  "tool_input": { "file_path": "/foo" },
  "tool_response": { "content": "…" }
}
```

The relevant code is in `packages/predicate-cli/src/commands/capture.ts`, in the `if (hasFlag(args, '--from-stdin'))` branch.

### What this phase adds to the CLI

A `--platform` flag that selects which parser to use against the stdin JSON. Five platform parsers, each tolerant of multiple field-name conventions because the exact hook payload schemas for Gemini / OpenCode are version-dependent and worth being defensive about:

| `--platform` value | Tried field names for toolName | Tried field names for input | Tried field names for output | Tried field names for sessionId |
|---|---|---|---|---|
| `claude-code` (default) | `tool_name` | `tool_input` | `tool_response` | `session_id` |
| `gemini` | `toolName`, `tool_name`, `tool.name` (dot-path) | `toolInput`, `tool_input`, `input`, `args` | `toolResponse`, `tool_response`, `output`, `result` | `sessionId`, `session_id`, `session.id` (dot-path) |
| `opencode` | `toolName`, `name`, `tool.name` | `input`, `args`, `tool.input` | `output`, `result`, `tool.output` | `sessionId`, `session.id` |
| `cursor`, `vscode-copilot`, `codex-cli` | falls through to flag mode (these have no stdin payload format) | — | — | — |

The `auto` value tries each parser in order and uses the first one that resolves a non-empty `toolName`.

### Why ship scripts for Cursor / VS Code Copilot / Codex CLI

These platforms have no native PreTool / PostTool lifecycle events as of writing. The scripts ship anyway because:
1. **Symmetry with Phase 7.** Phase 7 shipped per-platform SessionStart/PreCompact/Stop scripts for the same five platforms, with documented manual / cron wiring where native events were absent. Phase 9 mirrors that decision.
2. **Forward compatibility.** When these platforms add tool-call events, the scripts are ready — only the per-platform README needs to update to point at the new wiring path.
3. **Manual / programmatic capture.** A user can pipe tool-call JSON into these scripts from their own scaffolding (e.g. a wrapper shell function around `cursor`, an extension event handler in VS Code).

### Implementation pattern for each platform task

Each per-platform task is structurally identical. The differences are:
- The platform name (used in the bash `--platform` flag and in commit messages).
- Whether the platform README points at auto-wiring (Gemini, OpenCode) or manual wiring (Cursor, VS Code Copilot, Codex CLI).
- Whether the platform's `settings.json.template` / `opencode.json.template` is updated to register the new events (only Gemini and OpenCode).

### Out of scope (deferred to v1.6+)

- LLM-augmented entity extraction from captured tool calls (still on the v1.6+ deferred list).
- Reconciliation of orphan `phase=pre` events to their `phase=post` matches.
- A `predicate captures` query CLI for inspecting recent calls (raw SPARQL works for now).

---

### Task 1: Extend `predicate capture` with `--platform` flag and per-platform parsers

**Files:**
- Modify: `packages/predicate-cli/src/commands/capture.ts`
- Modify: `packages/predicate-cli/tests/capture.test.ts`

- [ ] **Step 1: Read the existing capture.ts to find the stdin branch**

Run: `grep -n "from-stdin" packages/predicate-cli/src/commands/capture.ts`

You should see references at the help text, the `hasFlag(args, '--from-stdin')` branch in `capture()`, and the test file. The new logic slots into the stdin branch.

- [ ] **Step 2: Write the failing tests**

Modify `packages/predicate-cli/tests/capture.test.ts`. Add these three tests AFTER the existing `'skips silently when tool_name is in PREDICATE_CAPTURE_SKIP'` test (but BEFORE the `'returns 2 with --help'` test):

```typescript
  it('parses Gemini-style stdin payload with --platform gemini', async () => {
    const payload = JSON.stringify({
      sessionId: 'ses-gemini',
      toolName: 'Read',
      toolInput: { file_path: '/g.ts' },
      toolResponse: { content: 'g-data' },
    });
    const stdin = Readable.from([payload]);
    const code = await capture(['--from-stdin', '--phase', 'post', '--platform', 'gemini'], stdin);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
    const r = await client.select(
      `PREFIX pred: <https://predicate.dev/meta#>
       SELECT ?tool ?session WHERE {
         GRAPH <kg:usage> { ?c pred:toolName ?tool ; pred:sessionId ?session }
       } LIMIT 1`,
    );
    expect(r.results.bindings[0]!.tool!.value).toBe('Read');
    expect(r.results.bindings[0]!.session!.value).toBe('ses-gemini');
  });

  it('parses OpenCode-style stdin payload with --platform opencode', async () => {
    const payload = JSON.stringify({
      session: { id: 'ses-opencode' },
      tool: { name: 'Edit', input: { file_path: '/o.ts' }, output: { ok: true } },
    });
    const stdin = Readable.from([payload]);
    const code = await capture(['--from-stdin', '--phase', 'post', '--platform', 'opencode'], stdin);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
    const r = await client.select(
      `PREFIX pred: <https://predicate.dev/meta#>
       SELECT ?tool ?session WHERE {
         GRAPH <kg:usage> { ?c pred:toolName ?tool ; pred:sessionId ?session }
       } LIMIT 1`,
    );
    expect(r.results.bindings[0]!.tool!.value).toBe('Edit');
    expect(r.results.bindings[0]!.session!.value).toBe('ses-opencode');
  });

  it('--platform auto resolves a Claude-Code payload without an explicit flag', async () => {
    const payload = JSON.stringify({
      session_id: 'ses-auto',
      tool_name: 'Write',
      tool_input: { file_path: '/a.ts' },
      tool_response: { ok: true },
    });
    const stdin = Readable.from([payload]);
    const code = await capture(['--from-stdin', '--phase', 'post', '--platform', 'auto'], stdin);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
  });

  it('rejects an unknown --platform value', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const code = await capture(['--from-stdin', '--phase', 'post', '--platform', 'wat'], Readable.from(['{}']));
      expect(code).toBe(2);
      expect(errSpy).toHaveBeenCalled();
      const msg = errSpy.mock.calls[0]![0] as string;
      expect(msg).toContain('unknown --platform');
    } finally { errSpy.mockRestore(); }
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
pnpm --filter predicate-cli test capture
```

Expected: the 4 new tests FAIL because the CLI doesn't yet understand `--platform`. The 4 existing tests still pass.

- [ ] **Step 4: Add the per-platform parsers and the --platform flag**

Modify `packages/predicate-cli/src/commands/capture.ts`. Find the imports and the existing `parseMaybeJson()` helper (near the top of the file). Add these helpers BEFORE the `capture()` function definition:

```typescript
type ParsedCapture = {
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  sessionId?: string;
};

const SUPPORTED_PLATFORMS = new Set([
  'claude-code',
  'gemini',
  'opencode',
  'cursor',
  'vscode-copilot',
  'codex-cli',
  'auto',
]);

function pickByPath(payload: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = payload;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function pick(payload: Record<string, unknown>, candidates: string[]): unknown {
  for (const path of candidates) {
    const v = pickByPath(payload, path);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function parseClaudeCode(p: Record<string, unknown>): ParsedCapture {
  return {
    toolName:  asString(p['tool_name']),
    toolInput:  p['tool_input'],
    toolOutput: p['tool_response'],
    sessionId:  asString(p['session_id']),
  };
}

function parseGemini(p: Record<string, unknown>): ParsedCapture {
  return {
    toolName:   asString(pick(p, ['toolName', 'tool_name', 'tool.name'])),
    toolInput:  pick(p, ['toolInput', 'tool_input', 'input', 'args']),
    toolOutput: pick(p, ['toolResponse', 'tool_response', 'output', 'result']),
    sessionId:  asString(pick(p, ['sessionId', 'session_id', 'session.id'])),
  };
}

function parseOpenCode(p: Record<string, unknown>): ParsedCapture {
  return {
    toolName:   asString(pick(p, ['toolName', 'name', 'tool.name'])),
    toolInput:  pick(p, ['input', 'args', 'tool.input']),
    toolOutput: pick(p, ['output', 'result', 'tool.output']),
    sessionId:  asString(pick(p, ['sessionId', 'session.id'])),
  };
}

function parseAuto(p: Record<string, unknown>): ParsedCapture {
  for (const fn of [parseClaudeCode, parseGemini, parseOpenCode]) {
    const parsed = fn(p);
    if (parsed.toolName !== undefined) return parsed;
  }
  return {};
}

function parsePayload(p: Record<string, unknown>, platform: string): ParsedCapture {
  switch (platform) {
    case 'claude-code':                                          return parseClaudeCode(p);
    case 'gemini':                                               return parseGemini(p);
    case 'opencode':                                             return parseOpenCode(p);
    case 'cursor': case 'vscode-copilot': case 'codex-cli':      return parseClaudeCode(p);
    case 'auto':                                                 return parseAuto(p);
    default:                                                     return {};
  }
}
```

- [ ] **Step 5: Wire `--platform` into the stdin branch of `capture()`**

Modify `packages/predicate-cli/src/commands/capture.ts`. Find the `if (hasFlag(args, '--from-stdin'))` block. Replace it with this version:

```typescript
  if (hasFlag(args, '--from-stdin')) {
    const platform = parseFlag(args, '--platform') ?? 'claude-code';
    if (!SUPPORTED_PLATFORMS.has(platform)) {
      console.error(`predicate capture: unknown --platform "${platform}". Supported: ${[...SUPPORTED_PLATFORMS].join(', ')}.`);
      return 2;
    }
    const raw = await readStdin(stdin);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      console.error(`predicate capture: invalid JSON on stdin: ${(err as Error).message}`);
      return 2;
    }
    const parsed = parsePayload(payload, platform);
    toolName   = parsed.toolName;
    toolInput  = parsed.toolInput;
    toolOutput = parsed.toolOutput;
    sessionId  = parsed.sessionId;
  } else {
    toolName = parseFlag(args, '--tool');
    toolInput = parseMaybeJson(parseFlag(args, '--input'));
    toolOutput = parseMaybeJson(parseFlag(args, '--output'));
    sessionId = parseFlag(args, '--session');
  }
```

- [ ] **Step 6: Update the `help()` text to document --platform**

Modify `packages/predicate-cli/src/commands/capture.ts`. Find the `help()` function. Replace its body to add a `--platform` line:

```typescript
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
  --from-stdin          Parse a hook-payload JSON object from stdin.
                        --phase is still required.
  --platform NAME       Schema to use when parsing stdin payload.
                        One of: claude-code (default), gemini, opencode,
                        cursor, vscode-copilot, codex-cli, auto.
  --help                Print this message.

Env:
  PREDICATE_CAPTURE_SKIP       Comma list of tool names to suppress (default "").
  PREDICATE_CAPTURE_TRUNCATE   Max chars per field (default 500).
  FUSEKI_URL, PREDICATE_DATASET   Server location.
`);
}
```

- [ ] **Step 7: Run all CLI tests to verify they pass**

```bash
pnpm --filter predicate-cli test
```

Expected: 15 tests pass (11 prior + 4 new).

- [ ] **Step 8: Smoke-test the new --platform flag against a live Fuseki**

```bash
# Reset kg:usage
curl -fsS -u admin:changeme -X POST --header "Content-Type: application/sparql-update" \
  --data "DROP SILENT GRAPH <kg:usage> ; CREATE SILENT GRAPH <kg:usage>" \
  "http://localhost:3030/predicate/update" >/dev/null

# Gemini-style payload
echo '{"sessionId":"ses-g","toolName":"Read","toolInput":{"file_path":"/x.ts"},"toolResponse":{"ok":true}}' \
  | PATH="$(pwd)/.bin:$PATH" predicate capture --from-stdin --phase post --platform gemini
echo "gemini exit=$?"

# OpenCode-style payload
echo '{"session":{"id":"ses-o"},"tool":{"name":"Edit","input":{"x":1},"output":{"ok":true}}}' \
  | PATH="$(pwd)/.bin:$PATH" predicate capture --from-stdin --phase post --platform opencode
echo "opencode exit=$?"

# Verify both landed
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT ?session ?tool WHERE { GRAPH <kg:usage> { ?c pred:toolName ?tool ; pred:sessionId ?session } } ORDER BY ?session" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[] | "\(.session.value) -> \(.tool.value)"'
```

Expected:
```
gemini exit=0
opencode exit=0
ses-g -> Read
ses-o -> Edit
```

- [ ] **Step 9: Commit**

```bash
git add packages/predicate-cli/src/commands/capture.ts packages/predicate-cli/tests/capture.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add --platform flag to `predicate capture --from-stdin`

Adds 5 per-platform JSON parsers (claude-code default, gemini,
opencode, cursor/vscode-copilot/codex-cli, auto) so the same stdin
hook payload can be ingested whatever the host platform's schema
convention. Each parser is tolerant of multiple field-name
candidates because the exact hook payload schemas for
Gemini / OpenCode vary by version.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Gemini CLI PreTool/PostTool adapter

**Files:**
- Create: `packages/predicate-skill/hooks/gemini-cli/pre-tool-use.sh`
- Create: `packages/predicate-skill/hooks/gemini-cli/post-tool-use.sh`
- Modify: `packages/predicate-skill/hooks/gemini-cli/settings.json.template`
- Modify: `packages/predicate-skill/hooks/gemini-cli/README.md`

- [ ] **Step 1: Create `pre-tool-use.sh`**

Create `packages/predicate-skill/hooks/gemini-cli/pre-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Gemini CLI PreToolUse hook. Pipes stdin (the Gemini hook payload) into
# `predicate capture --from-stdin --phase pre --platform gemini`.
# Fail-open: any error returns exit 0 so capture never blocks a tool call.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre --platform gemini >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 2: Create `post-tool-use.sh`**

Create `packages/predicate-skill/hooks/gemini-cli/post-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Gemini CLI PostToolUse hook. Records the full input + output payload
# in kg:usage via `predicate capture --from-stdin --phase post --platform gemini`.
# Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase post --platform gemini >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 3: Mark both scripts executable**

```bash
chmod +x packages/predicate-skill/hooks/gemini-cli/pre-tool-use.sh packages/predicate-skill/hooks/gemini-cli/post-tool-use.sh
ls -l packages/predicate-skill/hooks/gemini-cli/*.sh
```

Expected: all `.sh` files in the directory have `-rwxr-xr-x` mode.

- [ ] **Step 4: Update `settings.json.template` to wire the two new events**

Modify `packages/predicate-skill/hooks/gemini-cli/settings.json.template`. Read its current content first; you should see a `hooks` array with three entries (sessionStart, preCompress, stop). Append two new entries for preToolUse and postToolUse so the array has 5 entries total:

```json
{
  "mcpServers": {
    "predicate": {
      "command": "node",
      "args": ["__PLUGIN_DIR__/server.bundle.mjs"],
      "env": {
        "FUSEKI_URL": "http://localhost:3030",
        "PREDICATE_DATASET": "predicate"
      }
    }
  },
  "hooks": [
    { "event": "sessionStart", "command": "bash __PLUGIN_DIR__/hooks/gemini-cli/session-start.sh" },
    { "event": "preCompress",  "command": "bash __PLUGIN_DIR__/hooks/gemini-cli/pre-compact.sh" },
    { "event": "stop",         "command": "bash __PLUGIN_DIR__/hooks/gemini-cli/stop.sh" },
    { "event": "preToolUse",   "command": "bash __PLUGIN_DIR__/hooks/gemini-cli/pre-tool-use.sh" },
    { "event": "postToolUse",  "command": "bash __PLUGIN_DIR__/hooks/gemini-cli/post-tool-use.sh" }
  ]
}
```

- [ ] **Step 5: Update the per-platform README**

Modify `packages/predicate-skill/hooks/gemini-cli/README.md`. Find the existing "Hooks reference" table (3 rows) and replace it with the 5-row version:

```markdown
## Hooks reference

| Event | Script | What it does |
|---|---|---|
| `sessionStart` | `session-start.sh` | Prints KG status line; Gemini reads stdout as context. |
| `preCompress` | `pre-compact.sh` | Runs `predicate maintain` before context compression. |
| `stop` | `stop.sh` | Runs `predicate maintain` on session close. |
| `preToolUse` | `pre-tool-use.sh` | Records the tool call (input + sessionId, `phase: pre`) into `kg:usage`. |
| `postToolUse` | `post-tool-use.sh` | Records the tool call with output (`phase: post`) into `kg:usage`. |
```

- [ ] **Step 6: Smoke-test the two new scripts**

```bash
# Reset kg:usage
curl -fsS -u admin:changeme -X POST --header "Content-Type: application/sparql-update" \
  --data "DROP SILENT GRAPH <kg:usage> ; CREATE SILENT GRAPH <kg:usage>" \
  "http://localhost:3030/predicate/update" >/dev/null

# Pre hook
echo '{"sessionId":"ses-gp","toolName":"Read","toolInput":{"file_path":"/x.ts"}}' \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/gemini-cli/pre-tool-use.sh
echo "pre exit=$?"

# Post hook
echo '{"sessionId":"ses-gp","toolName":"Read","toolInput":{"file_path":"/x.ts"},"toolResponse":{"content":"x"}}' \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/gemini-cli/post-tool-use.sh
echo "post exit=$?"

# Verify both landed with correct phases
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT ?phase WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall ; pred:phase ?phase } } ORDER BY ?phase" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[].phase.value'
```

Expected:
```
pre exit=0
post exit=0
post
pre
```

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-skill/hooks/gemini-cli
git commit -m "$(cat <<'EOF'
feat(skill): add gemini-cli pre-tool-use / post-tool-use adapters

Two new hook scripts wired to Gemini's preToolUse / postToolUse events
in settings.json.template (now 5 events total). Both pipe stdin into
`predicate capture --from-stdin --platform gemini`. README updated.
Fail-open: missing predicate binary or any error returns exit 0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: OpenCode PreTool/PostTool adapter

**Files:**
- Create: `packages/predicate-skill/hooks/opencode/pre-tool-use.sh`
- Create: `packages/predicate-skill/hooks/opencode/post-tool-use.sh`
- Modify: `packages/predicate-skill/hooks/opencode/opencode.json.template`
- Modify: `packages/predicate-skill/hooks/opencode/README.md`

- [ ] **Step 1: Create `pre-tool-use.sh`**

Create `packages/predicate-skill/hooks/opencode/pre-tool-use.sh`:

```bash
#!/usr/bin/env bash
# OpenCode tool.before adapter. Pipes stdin (the OpenCode plugin event)
# into `predicate capture --from-stdin --phase pre --platform opencode`.
# Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre --platform opencode >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 2: Create `post-tool-use.sh`**

Create `packages/predicate-skill/hooks/opencode/post-tool-use.sh`:

```bash
#!/usr/bin/env bash
# OpenCode tool.after adapter. Records input + output via
# `predicate capture --from-stdin --phase post --platform opencode`.
# Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase post --platform opencode >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 3: Mark both scripts executable**

```bash
chmod +x packages/predicate-skill/hooks/opencode/pre-tool-use.sh packages/predicate-skill/hooks/opencode/post-tool-use.sh
ls -l packages/predicate-skill/hooks/opencode/*.sh
```

Expected: all `.sh` files have `-rwxr-xr-x` mode.

- [ ] **Step 4: Update `opencode.json.template` to wire the two new events**

Modify `packages/predicate-skill/hooks/opencode/opencode.json.template`. Read its current content first; the `events` array has 3 entries (session.started, session.compacted, session.stopped). Add two more entries for tool.before and tool.after so the array has 5 entries total:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "predicate": {
      "type": "local",
      "command": ["node", "__PLUGIN_DIR__/server.bundle.mjs"],
      "environment": {
        "FUSEKI_URL": "http://localhost:3030",
        "PREDICATE_DATASET": "predicate"
      }
    }
  },
  "events": [
    { "on": "session.started",   "run": "bash __PLUGIN_DIR__/hooks/opencode/session-start.sh" },
    { "on": "session.compacted", "run": "bash __PLUGIN_DIR__/hooks/opencode/pre-compact.sh" },
    { "on": "session.stopped",   "run": "bash __PLUGIN_DIR__/hooks/opencode/stop.sh" },
    { "on": "tool.before",       "run": "bash __PLUGIN_DIR__/hooks/opencode/pre-tool-use.sh" },
    { "on": "tool.after",        "run": "bash __PLUGIN_DIR__/hooks/opencode/post-tool-use.sh" }
  ]
}
```

- [ ] **Step 5: Update the per-platform README**

Modify `packages/predicate-skill/hooks/opencode/README.md`. Find the existing "Hooks reference" table (3 rows) and replace it with the 5-row version:

```markdown
## Hooks reference

| Event | Script | What it does |
|---|---|---|
| `session.started` | `session-start.sh` | Prints KG status line; OpenCode reads stdout as context. |
| `session.compacted` | `pre-compact.sh` | Runs `predicate maintain` before context compression. |
| `session.stopped` | `stop.sh` | Runs `predicate maintain` on session close. |
| `tool.before` | `pre-tool-use.sh` | Records the tool call (input + sessionId, `phase: pre`) into `kg:usage`. |
| `tool.after` | `post-tool-use.sh` | Records the tool call with output (`phase: post`) into `kg:usage`. |
```

- [ ] **Step 6: Smoke-test the two new scripts**

```bash
# Reset kg:usage
curl -fsS -u admin:changeme -X POST --header "Content-Type: application/sparql-update" \
  --data "DROP SILENT GRAPH <kg:usage> ; CREATE SILENT GRAPH <kg:usage>" \
  "http://localhost:3030/predicate/update" >/dev/null

# Pre hook (OpenCode-style payload, nested)
echo '{"session":{"id":"ses-op"},"tool":{"name":"Read","input":{"file_path":"/x.ts"}}}' \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/opencode/pre-tool-use.sh
echo "pre exit=$?"

# Post hook
echo '{"session":{"id":"ses-op"},"tool":{"name":"Read","input":{"file_path":"/x.ts"},"output":{"content":"x"}}}' \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/opencode/post-tool-use.sh
echo "post exit=$?"

# Verify both landed
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT ?phase ?tool WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall ; pred:phase ?phase ; pred:toolName ?tool } } ORDER BY ?phase" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[] | "\(.phase.value) -> \(.tool.value)"'
```

Expected:
```
pre exit=0
post exit=0
post -> Read
pre -> Read
```

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-skill/hooks/opencode
git commit -m "$(cat <<'EOF'
feat(skill): add opencode pre-tool-use / post-tool-use adapters

Two new hook scripts wired to OpenCode's tool.before / tool.after
plugin events in opencode.json.template (now 5 events total). Both
pipe stdin into `predicate capture --from-stdin --platform opencode`.
README updated. Fail-open.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Cursor PreTool/PostTool adapter (manual / cron)

**Files:**
- Create: `packages/predicate-skill/hooks/cursor/pre-tool-use.sh`
- Create: `packages/predicate-skill/hooks/cursor/post-tool-use.sh`
- Modify: `packages/predicate-skill/hooks/cursor/README.md`

Cursor has no native PreTool/PostTool events. The scripts ship for manual / cron / user-scaffolding use; the README documents this explicitly.

- [ ] **Step 1: Create `pre-tool-use.sh`**

Create `packages/predicate-skill/hooks/cursor/pre-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Cursor PreTool adapter. Cursor has no native PreTool event today —
# this script is intended to be invoked from a user-defined wrapper
# (shell function around `cursor`, etc.) that pipes tool-call JSON
# into it. Uses --platform cursor which falls through to Claude-Code-
# shaped fields, so users can pipe Claude-Code-style JSON in. Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre --platform cursor >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 2: Create `post-tool-use.sh`**

Create `packages/predicate-skill/hooks/cursor/post-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Cursor PostTool adapter. Same caveat as pre-tool-use.sh — no native
# event in Cursor; intended for user-defined wrappers. Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase post --platform cursor >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 3: Mark both scripts executable**

```bash
chmod +x packages/predicate-skill/hooks/cursor/pre-tool-use.sh packages/predicate-skill/hooks/cursor/post-tool-use.sh
ls -l packages/predicate-skill/hooks/cursor/*.sh
```

Expected: all `.sh` files have `-rwxr-xr-x` mode.

- [ ] **Step 4: Update the per-platform README**

Modify `packages/predicate-skill/hooks/cursor/README.md`. Append a new section at the end of the file (after the existing "Notes" section):

```markdown
## 5. Optional: PreTool / PostTool capture

Cursor has no native PreTool / PostTool event. The `pre-tool-use.sh`
and `post-tool-use.sh` scripts in this directory read Claude-Code-shaped
JSON from stdin and write to `kg:usage`. Use them from your own wrapper:

```bash
# Example: shell function that captures a tool call manually.
predicate-capture-cursor() {
  echo "{\"session_id\":\"manual\",\"tool_name\":\"$1\",\"tool_input\":$2}" \
    | bash /abs/path/hooks/cursor/post-tool-use.sh
}
```

If Cursor adds tool-call events in the future, this adapter is ready —
only the wiring location changes.
```

- [ ] **Step 5: Smoke-test the scripts**

```bash
# Reset kg:usage
curl -fsS -u admin:changeme -X POST --header "Content-Type: application/sparql-update" \
  --data "DROP SILENT GRAPH <kg:usage> ; CREATE SILENT GRAPH <kg:usage>" \
  "http://localhost:3030/predicate/update" >/dev/null

echo '{"session_id":"ses-cur","tool_name":"Read","tool_input":{"x":1},"tool_response":{"ok":true}}' \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/cursor/post-tool-use.sh
echo "exit=$?"

curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall ; pred:sessionId \"ses-cur\" } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[0].n.value'
```

Expected: `exit=0`, count `1`.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-skill/hooks/cursor
git commit -m "$(cat <<'EOF'
feat(skill): add cursor pre-tool-use / post-tool-use scripts

Cursor has no native PreTool/PostTool event today — these scripts
ship for user-defined wrappers and forward compatibility. Both pipe
stdin into `predicate capture --from-stdin --platform cursor`
(falls through to Claude-Code-shaped parsing). README documents
manual invocation. Fail-open.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: VS Code Copilot PreTool/PostTool adapter (manual / VS Code task)

**Files:**
- Create: `packages/predicate-skill/hooks/vscode-copilot/pre-tool-use.sh`
- Create: `packages/predicate-skill/hooks/vscode-copilot/post-tool-use.sh`
- Modify: `packages/predicate-skill/hooks/vscode-copilot/README.md`

VS Code Copilot has no native PreTool/PostTool event. Same pattern as Cursor.

- [ ] **Step 1: Create `pre-tool-use.sh`**

Create `packages/predicate-skill/hooks/vscode-copilot/pre-tool-use.sh`:

```bash
#!/usr/bin/env bash
# VS Code Copilot PreTool adapter. No native event in Copilot Chat today —
# this ships for VS Code extension authors / user-defined task wrappers
# that pipe tool-call JSON into it. Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre --platform vscode-copilot >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 2: Create `post-tool-use.sh`**

Create `packages/predicate-skill/hooks/vscode-copilot/post-tool-use.sh`:

```bash
#!/usr/bin/env bash
# VS Code Copilot PostTool adapter. Same caveat as pre. Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase post --platform vscode-copilot >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 3: Mark both scripts executable**

```bash
chmod +x packages/predicate-skill/hooks/vscode-copilot/pre-tool-use.sh packages/predicate-skill/hooks/vscode-copilot/post-tool-use.sh
ls -l packages/predicate-skill/hooks/vscode-copilot/*.sh
```

Expected: all `.sh` files have `-rwxr-xr-x` mode.

- [ ] **Step 4: Update the per-platform README**

Modify `packages/predicate-skill/hooks/vscode-copilot/README.md`. Append at end of file:

```markdown
## PreTool / PostTool capture

VS Code Copilot Chat does not expose PreTool / PostTool events as of
writing. The `pre-tool-use.sh` and `post-tool-use.sh` scripts in this
directory ship for forward-compat and for extension authors who want
to call them from a custom extension hook. Both read Claude-Code-shaped
JSON from stdin and write to `kg:usage`.

If you build a VS Code extension that captures tool calls, pipe the
JSON to:

```bash
echo "$PAYLOAD_JSON" | bash /abs/path/hooks/vscode-copilot/post-tool-use.sh
```
```

- [ ] **Step 5: Smoke-test the scripts**

```bash
# Reset kg:usage
curl -fsS -u admin:changeme -X POST --header "Content-Type: application/sparql-update" \
  --data "DROP SILENT GRAPH <kg:usage> ; CREATE SILENT GRAPH <kg:usage>" \
  "http://localhost:3030/predicate/update" >/dev/null

echo '{"session_id":"ses-vsc","tool_name":"Read","tool_input":{"x":1},"tool_response":{"ok":true}}' \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/vscode-copilot/post-tool-use.sh
echo "exit=$?"

curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall ; pred:sessionId \"ses-vsc\" } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[0].n.value'
```

Expected: `exit=0`, count `1`.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-skill/hooks/vscode-copilot
git commit -m "$(cat <<'EOF'
feat(skill): add vscode-copilot pre-tool-use / post-tool-use scripts

VS Code Copilot Chat has no PreTool/PostTool events today — these
scripts ship for VS Code extension authors and user-defined task
wrappers. Both pipe stdin into
`predicate capture --from-stdin --platform vscode-copilot`. README
documents manual invocation. Fail-open.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Codex CLI PreTool/PostTool adapter (manual / shell alias)

**Files:**
- Create: `packages/predicate-skill/hooks/codex-cli/pre-tool-use.sh`
- Create: `packages/predicate-skill/hooks/codex-cli/post-tool-use.sh`
- Modify: `packages/predicate-skill/hooks/codex-cli/README.md`

Codex CLI has no native PreTool/PostTool event. Same pattern as Cursor + VS Code.

- [ ] **Step 1: Create `pre-tool-use.sh`**

Create `packages/predicate-skill/hooks/codex-cli/pre-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Codex CLI PreTool adapter. No native event in Codex today — ships
# for user-defined wrappers (shell aliases / functions) that pipe
# tool-call JSON in. Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre --platform codex-cli >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 2: Create `post-tool-use.sh`**

Create `packages/predicate-skill/hooks/codex-cli/post-tool-use.sh`:

```bash
#!/usr/bin/env bash
# Codex CLI PostTool adapter. Same caveat as pre. Fail-open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase post --platform codex-cli >/dev/null 2>&1 || true
fi
exit 0
```

- [ ] **Step 3: Mark both scripts executable**

```bash
chmod +x packages/predicate-skill/hooks/codex-cli/pre-tool-use.sh packages/predicate-skill/hooks/codex-cli/post-tool-use.sh
ls -l packages/predicate-skill/hooks/codex-cli/*.sh
```

Expected: all `.sh` files have `-rwxr-xr-x` mode.

- [ ] **Step 4: Update the per-platform README**

Modify `packages/predicate-skill/hooks/codex-cli/README.md`. Append at end of file:

```markdown
## PreTool / PostTool capture

Codex CLI has no native PreTool / PostTool events as of writing.
The `pre-tool-use.sh` and `post-tool-use.sh` scripts in this directory
ship for forward-compat and for user-defined shell wrappers. Both read
Claude-Code-shaped JSON from stdin and write to `kg:usage`.

Example wrapper:

```sh
# in ~/.zshrc or ~/.bashrc — captures every "codex run" tool invocation
# you manually fed JSON to (you'd need to instrument your own pipeline).
codex-capture-post() {
  echo "$1" | bash /abs/path/hooks/codex-cli/post-tool-use.sh
}
```

If Codex CLI adds tool-call events in the future, this adapter is
ready — only the wiring location changes.
```

- [ ] **Step 5: Smoke-test the scripts**

```bash
# Reset kg:usage
curl -fsS -u admin:changeme -X POST --header "Content-Type: application/sparql-update" \
  --data "DROP SILENT GRAPH <kg:usage> ; CREATE SILENT GRAPH <kg:usage>" \
  "http://localhost:3030/predicate/update" >/dev/null

echo '{"session_id":"ses-cdx","tool_name":"Read","tool_input":{"x":1},"tool_response":{"ok":true}}' \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/codex-cli/post-tool-use.sh
echo "exit=$?"

curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:usage> { ?c a pred:ToolCall ; pred:sessionId \"ses-cdx\" } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[0].n.value'
```

Expected: `exit=0`, count `1`.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-skill/hooks/codex-cli
git commit -m "$(cat <<'EOF'
feat(skill): add codex-cli pre-tool-use / post-tool-use scripts

Codex CLI has no PreTool/PostTool events today — these scripts ship
for user-defined shell wrappers and forward compatibility. Both pipe
stdin into `predicate capture --from-stdin --platform codex-cli`.
README documents manual invocation. Fail-open.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: README + version bump + bundle rebuild + tag v1.5.0-cross-platform-capture

**Files:**
- Modify: `README.md`
- Modify: `packages/predicate-skill/README.md`
- Modify: `packages/predicate-skill/package.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `packages/predicate-skill/server.bundle.mjs` (regenerated)
- Modify: `packages/predicate-skill/cli.bundle.mjs` (regenerated)

- [ ] **Step 1: Update the top-level Status section**

Modify `README.md`. Find the `## Status` heading and replace its body with:

```markdown
## Status

**v1.5 — cross-platform tool capture.** PreToolUse / PostToolUse hook
adapters shipped for all five non-Claude-Code platforms (Gemini CLI,
Cursor, VS Code Copilot, OpenCode, Codex CLI) via the new
`--platform` flag on `predicate capture --from-stdin`. Gemini and
OpenCode wire to their native events; Cursor / VS Code Copilot /
Codex CLI ship the scripts for manual / wrapper-based use until those
platforms expose events. 9 MCP tools, 30 bash hook scripts total.

Earlier milestones (in order): `v0.1.0-foundation` → `v0.2.0-discipline` →
`v0.3a.0-goals-and-gaps` → `v0.3b.0-research-execution` →
`v0.3c.0-schema-evolution` → `v1.0.0` → `v1.1.0-distribution` →
`v1.2.0-multiplatform` → `v1.3.0-platform-hooks` → `v1.4.0-tool-capture` →
`v1.5.0-cross-platform-capture`.

Deferred to v1.6 (see spec §17): LLM-augmented entity extraction from
captured tool calls; reconciliation of orphan Pre events to their
Post events; a `predicate captures` query CLI; materialization
caching; tag-while-deriving for `kg_explain`; intent-aware
`ResearchSource` filtering; journal-based cross-system promotion
atomicity.
```

- [ ] **Step 2: Update `packages/predicate-skill/README.md`**

Modify `packages/predicate-skill/README.md`. Find the "Current version" line near the top and replace it with `Current version: **1.5.0** (\`v1.5.0-cross-platform-capture\`).`

Then find the "Hook events wired" table and update the rows for Gemini CLI and OpenCode to include `preToolUse + postToolUse` / `tool.before + tool.after`. Update the three rows for Cursor / VS Code Copilot / Codex CLI to add "+ PreTool / PostTool (manual)" to their entries. The full table:

```markdown
| Platform | Subdirectory | Hook events wired |
|---|---|---|
| Claude Code | `hooks/` (root) | SessionStart, PreToolUse, PostToolUse |
| Gemini CLI | `hooks/gemini-cli/` | sessionStart, preCompress, stop, preToolUse, postToolUse |
| Cursor | `hooks/cursor/` | manual / cron only (PreTool/PostTool via user wrapper) |
| VS Code Copilot | `hooks/vscode-copilot/` | manual / VS Code tasks (PreTool/PostTool via extension wrapper) |
| OpenCode | `hooks/opencode/` | session.started, session.compacted, session.stopped, tool.before, tool.after |
| Codex CLI | `hooks/codex-cli/` | manual / shell alias / cron (PreTool/PostTool via wrapper) |
```

- [ ] **Step 3: Bump version in `packages/predicate-skill/package.json`**

Modify `packages/predicate-skill/package.json`. Find `"version": "1.4.0"` and replace with `"version": "1.5.0"`.

- [ ] **Step 4: Bump versions in `.claude-plugin/marketplace.json`**

Modify `.claude-plugin/marketplace.json`. Find both `"version": "1.4.0"` lines and replace both with `"version": "1.5.0"`.

- [ ] **Step 5: Run the full test suite**

```bash
pnpm test 2>&1 | grep -E "Tests +[0-9]"
```

Expected: 164 total (160 prior + 4 new in capture CLI). If anything fails, fix before continuing.

- [ ] **Step 6: Rebuild the bundles**

```bash
pnpm --filter predicate-skill run bundle 2>&1 | tail -3
ls -l packages/predicate-skill/cli.bundle.mjs
node packages/predicate-skill/cli.bundle.mjs capture --help | head -20
```

Expected: bundle rebuilt; `--platform NAME` line appears in the help output.

- [ ] **Step 7: Commit**

```bash
git add README.md packages/predicate-skill/README.md packages/predicate-skill/package.json .claude-plugin/marketplace.json packages/predicate-skill/server.bundle.mjs packages/predicate-skill/cli.bundle.mjs
git commit -m "$(cat <<'EOF'
chore(release): v1.5.0 — cross-platform PreTool/PostTool adapters

- Top-level README Status: v1.5 cross-platform capture summary.
- Package README: bump version, expand Hook events wired table.
- Bump package.json + marketplace.json to 1.5.0.
- Rebuild bundles (server.bundle.mjs + cli.bundle.mjs) with the new
  --platform flag for predicate capture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Tag v1.5.0-cross-platform-capture**

```bash
git tag -a v1.5.0-cross-platform-capture -m "Predicate v1.5.0 — PreTool/PostTool adapters for Gemini CLI, Cursor, VS Code Copilot, OpenCode, Codex CLI"
git tag --list 'v*' | sort
```

Expected: the new tag appears alongside the prior `v1.*` tags. Do NOT push the tag — the user controls when to push.

---

## Self-Review

### Spec coverage

This plan covers Phase 9 as scoped in conversation:

- ✅ `--platform` flag added to `predicate capture --from-stdin` — Task 1 (with parsers for claude-code, gemini, opencode, cursor, vscode-copilot, codex-cli, auto)
- ✅ Gemini CLI PreTool + PostTool scripts + settings.json.template wiring — Task 2
- ✅ OpenCode PreTool + PostTool scripts + opencode.json.template wiring — Task 3
- ✅ Cursor PreTool + PostTool scripts + README note that wiring is manual — Task 4
- ✅ VS Code Copilot PreTool + PostTool scripts + README note — Task 5
- ✅ Codex CLI PreTool + PostTool scripts + README note — Task 6
- ✅ Top-level + package READMEs updated — Task 7
- ✅ Tag v1.5.0-cross-platform-capture — Task 7 Step 8
- ✅ Out-of-scope items (LLM extraction, reconciliation, `predicate captures` query CLI) documented as deferred in the Status section — Task 7 Step 1

### Placeholder scan

Searched the plan for `TBD`, `TODO`, `implement later`, `add appropriate`, `add validation`, `handle edge cases`, `similar to task`. None found in execution steps. Acceptable literal placeholder: `__PLUGIN_DIR__` in template files — that's an intentional install-time substitution marker (same convention as Phase 7).

### Type / name consistency

- `--platform` accepted values across CLI help, switch dispatcher, and SUPPORTED_PLATFORMS set: `claude-code | gemini | opencode | cursor | vscode-copilot | codex-cli | auto`. ✅
- Per-platform bash scripts always pass the same platform name they live under (e.g. `hooks/gemini-cli/pre-tool-use.sh` passes `--platform gemini`). The dash-vs-no-dash convention is deliberate: directory names use dash-case (`vscode-copilot`, `codex-cli`) and the CLI accepts them verbatim. ✅
- Event names per platform:
  - Gemini: `preToolUse`, `postToolUse` (camelCase, matches the existing `sessionStart`, `preCompress`, `stop` style in Task 2's settings.json.template). ✅
  - OpenCode: `tool.before`, `tool.after` (dot-case, matches the existing `session.started`, `session.compacted`, `session.stopped` style in Task 3's opencode.json.template). ✅
- The `parseClaudeCode()` function is reused by the `cursor`, `vscode-copilot`, and `codex-cli` platforms (Task 1 step 4's `parsePayload` switch). This is correct — those platforms have no native payload shape, so when a user does manually pipe JSON in, the most likely shape they'll have available is Claude-Code-style. ✅
- `parseAuto()` tries parsers in order claude-code → gemini → opencode (Task 1 step 4). It returns the first parser whose `.toolName` resolves. ✅

### Things the executing engineer should double-check during implementation

- **Gemini hook event names.** The plan uses `preToolUse` / `postToolUse`. If your local Gemini CLI version uses different names (e.g. `pre_tool_use`), update the settings.json.template entries — the bash scripts themselves don't care about the event name.
- **OpenCode event names.** Same caveat: plan uses `tool.before` / `tool.after`. Verify against `opencode --help events` if available.
- **OpenCode payload shape.** The smoke test in Task 3 step 6 uses a nested `{session:{id:…}, tool:{name:…, input:…, output:…}}` shape. If OpenCode actually emits a flatter shape, update `parseOpenCode` field candidates in Task 1 to match. The plan's parser already tries flatter fallbacks (`toolName`, `name`, `input`, etc.) so flat payloads should still work without code changes.
