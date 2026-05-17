# Predicate Phase 9 — Stop-Hook Turn Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 8's per-tool-call opaque capture with **end-of-turn knowledge extraction**: when a turn ends (Stop hook), read the full tool-call sequence + final assistant message, run two extractors (deterministic + semantic-LLM) that emit **typed triples** through `kg_assert`, and write them to `kg:abox` where reasoning can use them. Flip the existing `kg_capture` raw-log path to opt-in. Tag v1.5.0-stop-extract.

**Architecture:** A new `predicate extract --from-stdin` CLI reads the Claude Code Stop-hook payload (which contains the session ID and a path to a JSONL transcript). It loads the transcript, runs:

1. **Deterministic extractor** (pure TypeScript, ~ms): walks the tool-call list and emits typed triples for `Edit`/`Write` (file modifications) and `Bash` (commands with exit codes). High confidence (0.95), method `tool-parse`.
2. **Semantic extractor** (Claude Haiku 4.5 over Anthropic API, ~1–3s): given a TBox slice + the final assistant message + a compressed tool-call summary, emits typed triples for what the agent reports having learned. Lower confidence (0.7), method `agent-self-report`. Predicates MUST exist in the provided TBox slice — invented predicates are dropped (or proposed via `kg_propose_schema` if the gap is obvious).

Both extractors funnel through `kgAssert` so SHACL validation and TBox predicate-discipline are enforced uniformly. The pre-existing `kg_capture` + `predicate capture` paths stay shipped but become opt-in (gated by a new `PREDICATE_RAW_CAPTURE=1` env var); default behavior is "no raw blob captures."

**Tech Stack:** Node 20+, TypeScript 5 (strict + `noUncheckedIndexedAccess`), pnpm workspaces, Apache Jena Fuseki, `@anthropic-ai/sdk` (new dep, used by `predicate-agent`), bash, jq, esbuild bundler.

---

## File Structure

**New files:**
- `packages/predicate-agent/src/turn-extractor.ts` — deterministic extractor (TypeScript only).
- `packages/predicate-agent/tests/turn-extractor.test.ts` — unit tests for the deterministic extractor.
- `packages/predicate-agent/src/semantic-extractor.ts` — Anthropic-API-driven semantic extractor.
- `packages/predicate-agent/tests/semantic-extractor.test.ts` — semantic extractor tests with mocked Anthropic SDK.
- `packages/predicate-cli/src/commands/extract.ts` — new `predicate extract` subcommand.
- `packages/predicate-cli/tests/extract.test.ts` — CLI tests (mocks both extractors).
- `packages/predicate-skill/hooks/stop.sh` — Claude Code Stop hook script.

**Modified files:**
- `packages/predicate-ontology/meta/predicate-meta.ttl` — add `pred:Session` class.
- `packages/predicate-ontology/tbox/codebase.ttl` — add `:Command` class + `:modifiedIn`/`:createdIn`/`:succeededIn`/`:failedIn`/`:commandText` properties.
- `packages/predicate-ontology/meta/version.json` — bump.
- `packages/predicate-cli/src/commands/capture.ts` — flip default behavior: skip all tools unless `PREDICATE_RAW_CAPTURE=1`. Update help text.
- `packages/predicate-cli/tests/capture.test.ts` — adjust tests for the new opt-in default.
- `packages/predicate-cli/src/index.ts` — register `extract` subcommand in dispatcher + help text.
- `packages/predicate-agent/package.json` — add `@anthropic-ai/sdk` dependency.
- `packages/predicate-skill/hooks/hooks.json` — register `Stop` event.
- `packages/predicate-skill/package.json` — bump 1.4.0 → 1.5.0.
- `.claude-plugin/marketplace.json` — bump 1.4.0 → 1.5.0.
- `README.md` (repo root) — Tools table gets no new row (no new MCP tool); CLI block gains `predicate extract`; Status section rewritten.
- `packages/predicate-skill/README.md` — version + CLI list + hook events table.

---

## Background context (for the executing engineer)

### Why this replaces Phase 8's capture model

Phase 8 wrote one `pred:ToolCall` triple per tool invocation into `kg:usage`. Every triple's value was an opaque JSON-stringified blob. This was **raw I/O logging dressed up as a knowledge graph**:

- 25 tool calls per turn × 2 events each = 50 blob triples per turn. Mostly noise.
- The triples don't participate in OWL/SHACL reasoning (no class/property structure).
- `kg_explain` can't surface them — they're not in `kg:abox`.
- Schema discipline (kg_assert's "predicate must be declared in TBox") was bypassed.
- Latency was on the user-facing loop.

The redesign: **the knowledge graph stores what the agent learned, not what the agent did.** Extraction moves off the hot path to the Stop hook (after the user has their answer), happens once per turn, and produces typed triples that go through the same `kg_assert` validation gate as all other writes.

### Claude Code Stop hook payload

Claude Code fires the Stop event when a turn completes. The hook payload on stdin (verify exact shape during implementation):

```json
{
  "session_id": "ses-abc",
  "transcript_path": "/Users/.../session-transcript.jsonl",
  "stop_hook_active": true
}
```

The transcript file is JSONL — one JSON object per line, each line a turn event (`message`, `tool_use`, `tool_result`, etc.). The extractor reads the file and slices out the most recent turn.

### Deterministic extractor — mapping rules

For each tool call in the turn's transcript:

| Tool | Condition | Triple(s) emitted | Method, confidence |
|---|---|---|---|
| `Edit` | success | `<file://PATH> a codebase:File`, `<file://PATH> codebase:modifiedIn <urn:session:ID>` | `tool-parse`, 0.95 |
| `Write` | success, file pre-existed | `<file://PATH> a codebase:File`, `<file://PATH> codebase:modifiedIn <urn:session:ID>` | `tool-parse`, 0.95 |
| `Write` | success, file is new | `<file://PATH> a codebase:File`, `<file://PATH> codebase:createdIn <urn:session:ID>` | `tool-parse`, 0.95 |
| `Bash` | exit code 0 | `<urn:bash:HASH> a codebase:Command`, `<urn:bash:HASH> codebase:commandText "CMD"`, `<urn:bash:HASH> codebase:succeededIn <urn:session:ID>` | `tool-parse`, 0.95 |
| `Bash` | exit code ≠ 0 | `<urn:bash:HASH> a codebase:Command`, `<urn:bash:HASH> codebase:commandText "CMD"`, `<urn:bash:HASH> codebase:failedIn <urn:session:ID>` | `tool-parse`, 0.95 |
| `Read`, `Grep`, `Glob`, others | always | (none — read-only ops don't represent learned facts) | — |

`HASH` is the first 12 hex chars of SHA-1 of the command text. `<urn:session:ID>` is `urn:predicate:session:<session_id>`.

The deterministic extractor also asserts the session itself:
```turtle
<urn:predicate:session:SESSION_ID> a pred:Session ;
  pred:sessionId "SESSION_ID" ;
  pred:at        "2026-05-17T08:00:00Z"^^xsd:dateTime .
```

### Semantic extractor — prompt template

System prompt (with `cache_control: ephemeral` on the TBox slice block for cost):

```
You are the semantic extractor for Predicate, a knowledge graph that
tracks development-session OUTCOMES (what was learned, not what was done).

You will receive:
1. A TBox slice (the predicates currently declared in the schema).
2. The agent's final assistant message from a session.
3. A summary of tool calls made during the session.

Emit JSON: a list of typed triples that capture what the agent LEARNED.

HARD RULES:
- Use ONLY predicates that appear in the TBox slice. Do NOT invent
  predicates. If a fact would require a predicate not in TBox, skip
  it (note it in the "skipped" field).
- Confidence defaults to 0.7. Use 0.9 only when the agent's claim is
  directly supported by a tool-call output. Use 0.5 when the claim is
  speculative or unverified.
- method MUST be "agent-self-report".
- source MUST be the session URI provided.
- subject and predicate MUST be full IRIs.

Output strict JSON, no prose:
{
  "triples": [
    { "subject": "...", "predicate": "...",
      "object": { "type": "uri"|"literal", "value": "...", "datatype": "..." },
      "source": "<session URI>", "confidence": 0.7, "method": "agent-self-report" }
  ],
  "skipped": ["reasoning for skipped facts"]
}
```

User prompt assembled at extraction time:
- `<TBox-slice>` block (cached)
- `<final-message>` block
- `<tool-call-summary>` block

If `ANTHROPIC_API_KEY` is missing, the semantic extractor is skipped (with a log message) and only deterministic facts get asserted. This keeps Phase 9 usable in CI / sandboxed environments.

### Flipping the kg_capture default

The Phase 8 capture path still exists. After Phase 9 it's **off by default**: `PREDICATE_CAPTURE_SKIP="*"` is the default value, suppressing every tool. Users who want raw forensic capture set `PREDICATE_RAW_CAPTURE=1` to clear the skip list. The denylist semantics (specific tool names in `PREDICATE_CAPTURE_SKIP`) still work when `PREDICATE_RAW_CAPTURE=1` is set.

### Out of scope (deferred to v1.6+)

- Cross-validation between extractors (if semantic says "tests pass" but deterministic recorded `Bash exit 1`, downgrade or reject). MVP just asserts both with their own confidence — downstream `kg_explain` will surface contradictions when queried.
- Cross-platform Stop-hook extraction (Gemini / OpenCode have different transcript formats — wait for the Claude Code reference impl to bake).
- `predicate captures` query CLI.
- Per-turn cost / token budgeting for the semantic extractor.

---

### Task 1: TBox additions — `pred:Session`, `codebase:Command`, and the 4 action predicates

**Files:**
- Modify: `packages/predicate-ontology/meta/predicate-meta.ttl`
- Modify: `packages/predicate-ontology/tbox/codebase.ttl`
- Modify: `packages/predicate-ontology/meta/version.json`

- [ ] **Step 1: Add `pred:Session` to the meta vocab**

Modify `packages/predicate-ontology/meta/predicate-meta.ttl`. Append at end of file (after the existing `pred:ToolCall` block):

```turtle

# --- Session class (used by the Stop-hook extractor) -------------

pred:Session a owl:Class ; rdfs:label "Development session" .
pred:startedAt a owl:DatatypeProperty ;
               rdfs:domain pred:Session ; rdfs:range xsd:dateTime .
pred:endedAt   a owl:DatatypeProperty ;
               rdfs:domain pred:Session ; rdfs:range xsd:dateTime .
```

(`pred:sessionId` and `pred:at` already exist from earlier phases — reused.)

- [ ] **Step 2: Add `:Command` class and 5 properties to the codebase TBox**

Modify `packages/predicate-ontology/tbox/codebase.ttl`. Read the existing file first to find a sensible insertion point — look for the end of the Classes section (after `:Test`) and the end of the Properties section.

Append the new class after the existing class declarations:

```turtle
:Command      a owl:Class ; rdfs:label "Shell command invocation" .
```

Append the new properties at the end of the file:

```turtle

# --- Action predicates (used by the Stop-hook deterministic extractor) ---

:commandText  a owl:DatatypeProperty ;
              rdfs:domain :Command ; rdfs:range xsd:string ;
              rdfs:label "The literal command string." .

:modifiedIn   a owl:ObjectProperty ;
              rdfs:domain :File ; rdfs:range <https://predicate.dev/meta#Session> ;
              rdfs:label "File was modified during this session." .
:createdIn    a owl:ObjectProperty ;
              rdfs:domain :File ; rdfs:range <https://predicate.dev/meta#Session> ;
              rdfs:label "File was newly created in this session." .
:succeededIn  a owl:ObjectProperty ;
              rdfs:domain :Command ; rdfs:range <https://predicate.dev/meta#Session> ;
              rdfs:label "Command exited 0 in this session." .
:failedIn     a owl:ObjectProperty ;
              rdfs:domain :Command ; rdfs:range <https://predicate.dev/meta#Session> ;
              rdfs:label "Command exited non-zero in this session." .
```

- [ ] **Step 3: Bump the meta vocab version**

Modify `packages/predicate-ontology/meta/version.json`. Bump `"version": "0.3.0"` → `"version": "0.4.0"`.

- [ ] **Step 4: Reload the TBox into Fuseki**

```bash
( cd packages/predicate-server && bash scripts/bootstrap-graphs.sh ) 2>&1 | tail -3
```

Expected: `bootstrap complete`.

- [ ] **Step 5: Verify the new TBox is queryable**

```bash
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#> PREFIX cb: <https://predicate.dev/codebase#> ASK { GRAPH <kg:tbox> { pred:Session a <http://www.w3.org/2002/07/owl#Class> . cb:Command a <http://www.w3.org/2002/07/owl#Class> . cb:modifiedIn a <http://www.w3.org/2002/07/owl#ObjectProperty> } }" \
  --header "Accept: application/sparql-results+json" | jq -r .boolean
```

Expected: `true`.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-ontology/meta/predicate-meta.ttl packages/predicate-ontology/tbox/codebase.ttl packages/predicate-ontology/meta/version.json
git commit -m "$(cat <<'EOF'
feat(ontology): add Session class + 4 codebase action predicates

Adds pred:Session in the meta vocab and codebase:Command class plus
codebase:modifiedIn/createdIn/succeededIn/failedIn and
codebase:commandText properties. These back the Phase 9 deterministic
extractor's tool-parse → triple mapping: Edit/Write → modifiedIn,
Bash exit 0 → succeededIn, etc.

Bumps meta vocab to 0.4.0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Flip the kg_capture default to opt-in

**Files:**
- Modify: `packages/predicate-cli/src/commands/capture.ts`
- Modify: `packages/predicate-cli/tests/capture.test.ts`

- [ ] **Step 1: Write the new test for default-off behavior**

Modify `packages/predicate-cli/tests/capture.test.ts`. Add this test BEFORE the existing `'skips silently when tool_name is in PREDICATE_CAPTURE_SKIP'` test:

```typescript
  it('skips ALL captures by default (Phase 9 flip)', async () => {
    // No env vars set — default behavior must be no-op
    const orig = process.env['PREDICATE_RAW_CAPTURE'];
    const origSkip = process.env['PREDICATE_CAPTURE_SKIP'];
    delete process.env['PREDICATE_RAW_CAPTURE'];
    delete process.env['PREDICATE_CAPTURE_SKIP'];
    try {
      const code = await capture(['--tool', 'Read', '--phase', 'post', '--input', '{"x":1}']);
      expect(code).toBe(0);
      expect(await captureCount()).toBe(0);
    } finally {
      if (orig !== undefined) process.env['PREDICATE_RAW_CAPTURE'] = orig;
      if (origSkip !== undefined) process.env['PREDICATE_CAPTURE_SKIP'] = origSkip;
    }
  });

  it('captures when PREDICATE_RAW_CAPTURE=1 is set', async () => {
    const orig = process.env['PREDICATE_RAW_CAPTURE'];
    process.env['PREDICATE_RAW_CAPTURE'] = '1';
    try {
      const code = await capture(['--tool', 'Read', '--phase', 'post', '--input', '{"x":1}']);
      expect(code).toBe(0);
      expect(await captureCount()).toBe(1);
    } finally {
      if (orig !== undefined) process.env['PREDICATE_RAW_CAPTURE'] = orig;
      else delete process.env['PREDICATE_RAW_CAPTURE'];
    }
  });
```

Also, the EXISTING test `'writes a capture when given --tool and --phase via argv'` will break because the default flips. Modify that test to set `PREDICATE_RAW_CAPTURE=1` for the duration of the test. Find the test:

```typescript
  it('writes a capture when given --tool and --phase via argv', async () => {
    const code = await capture(['--tool', 'Read', '--phase', 'post', '--input', '{"x":1}']);
    expect(code).toBe(0);
    expect(await captureCount()).toBe(1);
  });
```

Replace its body with:

```typescript
  it('writes a capture when given --tool and --phase via argv (with raw capture enabled)', async () => {
    const orig = process.env['PREDICATE_RAW_CAPTURE'];
    process.env['PREDICATE_RAW_CAPTURE'] = '1';
    try {
      const code = await capture(['--tool', 'Read', '--phase', 'post', '--input', '{"x":1}']);
      expect(code).toBe(0);
      expect(await captureCount()).toBe(1);
    } finally {
      if (orig !== undefined) process.env['PREDICATE_RAW_CAPTURE'] = orig;
      else delete process.env['PREDICATE_RAW_CAPTURE'];
    }
  });
```

The `'parses Claude Code stdin payload with --from-stdin'` test also writes a triple — apply the same `PREDICATE_RAW_CAPTURE=1` wrap to its body.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter predicate-cli test capture
```

Expected: the 2 new tests FAIL (and the existing ones still pass under their newly-set PREDICATE_RAW_CAPTURE=1).

- [ ] **Step 3: Flip the default in `shouldSkip()`**

Modify `packages/predicate-cli/src/commands/capture.ts`. Find the existing `shouldSkip()` function:

```typescript
function shouldSkip(toolName: string): boolean {
  const raw = process.env['PREDICATE_CAPTURE_SKIP'] ?? '';
  if (raw.length === 0) return false;
  return raw.split(',').map((s) => s.trim()).includes(toolName);
}
```

Replace with:

```typescript
function shouldSkip(toolName: string): boolean {
  // Phase 9: default is to skip ALL tools (raw capture is opt-in via PREDICATE_RAW_CAPTURE=1).
  // The denylist (PREDICATE_CAPTURE_SKIP="A,B") still works when raw capture is enabled.
  const rawCapture = process.env['PREDICATE_RAW_CAPTURE'];
  if (rawCapture !== '1' && rawCapture !== 'true') return true;
  const skip = process.env['PREDICATE_CAPTURE_SKIP'] ?? '';
  if (skip.length === 0) return false;
  return skip.split(',').map((s) => s.trim()).includes(toolName);
}
```

- [ ] **Step 4: Update the help text**

Modify `packages/predicate-cli/src/commands/capture.ts`. Find the `Env:` block in `help()` and replace it with:

```typescript
Env:
  PREDICATE_RAW_CAPTURE        Set to "1" to enable raw kg_capture writes
                               (default: OFF — captures are skipped silently).
                               When enabled, every tool call lands in kg:usage.
                               Phase 9 prefers structured Stop-hook extraction
                               via \`predicate extract --from-stdin\` instead.
  PREDICATE_CAPTURE_SKIP       Comma list of tool names to suppress when raw
                               capture is enabled (default "").
  PREDICATE_CAPTURE_TRUNCATE   Max chars per field (default 500).
  FUSEKI_URL, PREDICATE_DATASET   Server location.
```

- [ ] **Step 5: Update the top-level help in `index.ts` to mention the env var**

Modify `packages/predicate-cli/src/index.ts`. Find the `Env:` block in `help()` and replace the `PREDICATE_CAPTURE_*` lines with:

```typescript
  PREDICATE_RAW_CAPTURE     "1" enables raw kg_capture writes (default off)
  PREDICATE_CAPTURE_SKIP    when raw capture is on, comma list of tools to skip
  PREDICATE_CAPTURE_TRUNCATE  max chars per captured input/output (default 500)
```

- [ ] **Step 6: Run tests to confirm everything passes**

```bash
pnpm --filter predicate-cli test
```

Expected: all CLI tests pass (15+ total counting the 2 new in this task).

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/capture.ts packages/predicate-cli/tests/capture.test.ts packages/predicate-cli/src/index.ts
git commit -m "$(cat <<'EOF'
feat(cli): flip predicate capture to opt-in via PREDICATE_RAW_CAPTURE

Phase 9 prefers structured Stop-hook extraction (kg_assert path) over
per-tool-call opaque blob captures. To match that, raw capture is now
OFF by default — only enabled when PREDICATE_RAW_CAPTURE=1 (or "true").
The denylist (PREDICATE_CAPTURE_SKIP="A,B") still works when raw
capture is enabled.

Existing tests adjusted to set the env var explicitly. Two new tests
verify the default-off and explicit-on behaviors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Deterministic turn extractor library

**Files:**
- Create: `packages/predicate-agent/src/turn-extractor.ts`
- Create: `packages/predicate-agent/tests/turn-extractor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-agent/tests/turn-extractor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractDeterministic, type Transcript } from '../src/turn-extractor.js';

describe('extractDeterministic', () => {
  const SESSION = 'ses-abc';

  function tx(events: Array<Record<string, unknown>>): Transcript {
    return { sessionId: SESSION, events };
  }

  it('emits a Session triple for every turn', () => {
    const r = extractDeterministic(tx([]));
    const sessionTriples = r.triples.filter((t) =>
      t.object.type === 'uri' &&
      t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      t.object.value === 'https://predicate.dev/meta#Session',
    );
    expect(sessionTriples).toHaveLength(1);
    expect(sessionTriples[0]!.subject).toBe(`urn:predicate:session:${SESSION}`);
  });

  it('Edit → file is typed as codebase:File and linked via codebase:modifiedIn', () => {
    const r = extractDeterministic(tx([
      { type: 'tool_use', name: 'Edit', input: { file_path: '/work/auth.ts' }, is_error: false },
    ]));
    const subjects = new Set(r.triples.map((t) => t.subject));
    expect(subjects).toContain('file:///work/auth.ts');
    const modifiedIn = r.triples.find((t) =>
      t.predicate === 'https://predicate.dev/codebase#modifiedIn',
    );
    expect(modifiedIn).toBeDefined();
    expect(modifiedIn!.subject).toBe('file:///work/auth.ts');
    expect(modifiedIn!.object.value).toBe(`urn:predicate:session:${SESSION}`);
    expect(modifiedIn!.confidence).toBe(0.95);
    expect(modifiedIn!.method).toBe('tool-parse');
  });

  it('Write of a new file emits codebase:createdIn (not modifiedIn)', () => {
    const r = extractDeterministic(tx([
      { type: 'tool_use', name: 'Write', input: { file_path: '/work/new.ts' }, is_error: false, was_new: true },
    ]));
    const createdIn = r.triples.find((t) =>
      t.predicate === 'https://predicate.dev/codebase#createdIn',
    );
    expect(createdIn).toBeDefined();
    expect(r.triples.find((t) =>
      t.predicate === 'https://predicate.dev/codebase#modifiedIn',
    )).toBeUndefined();
  });

  it('Bash exit 0 emits codebase:succeededIn; exit non-zero emits codebase:failedIn', () => {
    const ok = extractDeterministic(tx([
      { type: 'tool_use', name: 'Bash', input: { command: 'pnpm test' }, exit_code: 0 },
    ]));
    expect(ok.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#succeededIn')).toBeDefined();

    const fail = extractDeterministic(tx([
      { type: 'tool_use', name: 'Bash', input: { command: 'pnpm test' }, exit_code: 1 },
    ]));
    expect(fail.triples.find((t) => t.predicate === 'https://predicate.dev/codebase#failedIn')).toBeDefined();
  });

  it('Read/Grep/Glob produce no triples (read-only events don\'t represent learning)', () => {
    const r = extractDeterministic(tx([
      { type: 'tool_use', name: 'Read', input: { file_path: '/x.ts' } },
      { type: 'tool_use', name: 'Grep', input: { pattern: 'foo' } },
      { type: 'tool_use', name: 'Glob', input: { pattern: '*.ts' } },
    ]));
    // Only the Session triples remain
    const nonSession = r.triples.filter((t) => t.subject !== `urn:predicate:session:${SESSION}`);
    expect(nonSession).toHaveLength(0);
  });

  it('every emitted triple has confidence 0.95 and method "tool-parse"', () => {
    const r = extractDeterministic(tx([
      { type: 'tool_use', name: 'Edit', input: { file_path: '/x.ts' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'ls' }, exit_code: 0 },
    ]));
    for (const t of r.triples) {
      expect(t.confidence).toBe(0.95);
      expect(t.method).toBe('tool-parse');
      expect(t.source).toBe(`urn:predicate:session:${SESSION}`);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-agent test turn-extractor
```

Expected: FAIL (`Cannot find module '../src/turn-extractor.js'`).

- [ ] **Step 3: Implement the deterministic extractor**

Create `packages/predicate-agent/src/turn-extractor.ts`:

```typescript
import { createHash } from 'node:crypto';

const META = 'https://predicate.dev/meta#';
const CB   = 'https://predicate.dev/codebase#';
const RDF  = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD  = 'http://www.w3.org/2001/XMLSchema#';

export interface Transcript {
  sessionId: string;
  events: Array<Record<string, unknown>>;
}

export interface ExtractedTriple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string; datatype?: string };
  source: string;
  confidence: number;
  method: string;
}

export interface ExtractorResult {
  triples: ExtractedTriple[];
}

function uri(value: string): ExtractedTriple['object'] {
  return { type: 'uri', value };
}

function literal(value: string, datatype?: string): ExtractedTriple['object'] {
  return datatype ? { type: 'literal', value, datatype } : { type: 'literal', value };
}

function hash12(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 12);
}

export function extractDeterministic(transcript: Transcript): ExtractorResult {
  const sessionUri = `urn:predicate:session:${transcript.sessionId}`;
  const triples: ExtractedTriple[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  function push(t: ExtractedTriple): void {
    const key = `${t.subject}|${t.predicate}|${t.object.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    triples.push(t);
  }

  // Always emit the Session itself.
  const base = { source: sessionUri, confidence: 0.95, method: 'tool-parse' };
  push({ subject: sessionUri, predicate: `${RDF}type`, object: uri(`${META}Session`), ...base });
  push({ subject: sessionUri, predicate: `${META}sessionId`, object: literal(transcript.sessionId), ...base });
  push({ subject: sessionUri, predicate: `${META}at`, object: literal(now, `${XSD}dateTime`), ...base });

  for (const ev of transcript.events) {
    if (ev['type'] !== 'tool_use') continue;
    const name = ev['name'];
    const input = (ev['input'] ?? {}) as Record<string, unknown>;
    if (typeof name !== 'string') continue;

    if (name === 'Edit' || name === 'Write') {
      const filePath = typeof input['file_path'] === 'string' ? input['file_path'] : undefined;
      if (!filePath) continue;
      const fileUri = `file://${filePath}`;
      const wasNew = name === 'Write' && ev['was_new'] === true;
      const rel = wasNew ? `${CB}createdIn` : `${CB}modifiedIn`;
      push({ subject: fileUri, predicate: `${RDF}type`, object: uri(`${CB}File`), ...base });
      push({ subject: fileUri, predicate: rel, object: uri(sessionUri), ...base });
    } else if (name === 'Bash') {
      const cmd = typeof input['command'] === 'string' ? input['command'] : undefined;
      if (!cmd) continue;
      const cmdUri = `urn:bash:${hash12(cmd)}`;
      const exit = typeof ev['exit_code'] === 'number' ? ev['exit_code'] : 0;
      const rel = exit === 0 ? `${CB}succeededIn` : `${CB}failedIn`;
      push({ subject: cmdUri, predicate: `${RDF}type`, object: uri(`${CB}Command`), ...base });
      push({ subject: cmdUri, predicate: `${CB}commandText`, object: literal(cmd), ...base });
      push({ subject: cmdUri, predicate: rel, object: uri(sessionUri), ...base });
    }
    // Read/Grep/Glob/etc: no triples emitted.
  }

  return { triples };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test turn-extractor
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-agent/src/turn-extractor.ts packages/predicate-agent/tests/turn-extractor.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): add deterministic turn extractor

Walks a Claude Code transcript's tool-call list and emits typed
triples for Edit/Write (codebase:modifiedIn / createdIn) and Bash
(codebase:succeededIn / failedIn). Always emits a pred:Session
triple per turn. Read/Grep/Glob and other read-only ops produce
nothing — they don't represent learned facts. All triples carry
confidence 0.95 and method "tool-parse".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Semantic LLM extractor library

**Files:**
- Modify: `packages/predicate-agent/package.json`
- Create: `packages/predicate-agent/src/semantic-extractor.ts`
- Create: `packages/predicate-agent/tests/semantic-extractor.test.ts`

- [ ] **Step 1: Add the Anthropic SDK dependency**

Modify `packages/predicate-agent/package.json`. Find the `"dependencies"` block and add `"@anthropic-ai/sdk": "^0.40.0"`. If there's no `dependencies` block yet, create one. Example after edit:

```json
{
  "name": "predicate-agent",
  ...
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    ...other existing deps
  }
}
```

Run `pnpm install` to install:

```bash
pnpm install
```

Expected: installs `@anthropic-ai/sdk` and its peer deps.

- [ ] **Step 2: Write the failing test**

Create `packages/predicate-agent/tests/semantic-extractor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK BEFORE importing the module under test
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { extractSemantic } from '../src/semantic-extractor.js';

describe('extractSemantic', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns no triples when ANTHROPIC_API_KEY is missing', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      const r = await extractSemantic({
        sessionId: 'ses-x',
        finalMessage: 'I added JWT auth.',
        toolSummary: 'Edit auth.ts; Bash pnpm test (exit 0)',
        tboxSlice: 'codebase:hasAuthFlow ObjectProperty',
      });
      expect(r.triples).toHaveLength(0);
      expect(r.skipped).toContain('no ANTHROPIC_API_KEY');
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
    }
  });

  it('parses the LLM JSON response into ExtractedTriples when API key is set', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          triples: [
            {
              subject: 'file:///auth.ts',
              predicate: 'https://predicate.dev/codebase#hasAuthFlow',
              object: { type: 'literal', value: 'true' },
              source: 'urn:predicate:session:ses-x',
              confidence: 0.7,
              method: 'agent-self-report',
            },
          ],
          skipped: [],
        }),
      }],
    });
    try {
      const r = await extractSemantic({
        sessionId: 'ses-x',
        finalMessage: 'I added JWT auth to login.',
        toolSummary: 'Edit auth.ts; Bash pnpm test (exit 0)',
        tboxSlice: 'codebase:hasAuthFlow ObjectProperty',
      });
      expect(r.triples).toHaveLength(1);
      expect(r.triples[0]!.subject).toBe('file:///auth.ts');
      expect(r.triples[0]!.confidence).toBe(0.7);
      expect(r.triples[0]!.method).toBe('agent-self-report');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  it('returns empty triples and records a skip reason on malformed JSON', async () => {
    const orig = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    });
    try {
      const r = await extractSemantic({
        sessionId: 'ses-x',
        finalMessage: 'hi',
        toolSummary: '',
        tboxSlice: '',
      });
      expect(r.triples).toHaveLength(0);
      expect(r.skipped.join(' ')).toMatch(/parse/i);
    } finally {
      if (orig !== undefined) process.env['ANTHROPIC_API_KEY'] = orig;
      else delete process.env['ANTHROPIC_API_KEY'];
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter predicate-agent test semantic-extractor
```

Expected: FAIL (`Cannot find module '../src/semantic-extractor.js'`).

- [ ] **Step 4: Implement the semantic extractor**

Create `packages/predicate-agent/src/semantic-extractor.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are the semantic extractor for Predicate, a knowledge graph that
tracks development-session OUTCOMES (what was learned, not what was done).

You will receive:
1. A TBox slice (the predicates currently declared in the schema).
2. The agent's final assistant message from a session.
3. A summary of tool calls made during the session.

Emit JSON: a list of typed triples that capture what the agent LEARNED.

HARD RULES:
- Use ONLY predicates that appear in the TBox slice. Do NOT invent
  predicates. If a fact would require a predicate not in TBox, skip
  it (note it in the "skipped" field).
- Confidence defaults to 0.7. Use 0.9 only when the agent's claim is
  directly supported by a tool-call output. Use 0.5 when the claim is
  speculative or unverified.
- method MUST be "agent-self-report".
- source MUST be the session URI provided.
- subject and predicate MUST be full IRIs.

Output strict JSON, no prose:
{
  "triples": [
    { "subject": "...", "predicate": "...",
      "object": { "type": "uri"|"literal", "value": "...", "datatype": "..." },
      "source": "<session URI>", "confidence": 0.7, "method": "agent-self-report" }
  ],
  "skipped": ["reasoning for skipped facts"]
}`;

export interface SemanticInput {
  sessionId: string;
  finalMessage: string;
  toolSummary: string;
  tboxSlice: string;
}

export interface SemanticTriple {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string; datatype?: string };
  source: string;
  confidence: number;
  method: string;
}

export interface SemanticResult {
  triples: SemanticTriple[];
  skipped: string[];
}

export async function extractSemantic(input: SemanticInput): Promise<SemanticResult> {
  if (!process.env['ANTHROPIC_API_KEY']) {
    return { triples: [], skipped: ['no ANTHROPIC_API_KEY — semantic extraction skipped'] };
  }

  const client = new Anthropic();
  const sessionUri = `urn:predicate:session:${input.sessionId}`;

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'text', text: `<tbox-slice>\n${input.tboxSlice}\n</tbox-slice>`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{
        role: 'user',
        content: `<session-uri>${sessionUri}</session-uri>

<final-message>
${input.finalMessage}
</final-message>

<tool-call-summary>
${input.toolSummary}
</tool-call-summary>`,
      }],
    });
  } catch (err) {
    return { triples: [], skipped: [`API call failed: ${(err as Error).message}`] };
  }

  const text = response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  let parsed: unknown;
  try {
    // Sometimes the model wraps JSON in ```json fences — strip them.
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(stripped);
  } catch (err) {
    return { triples: [], skipped: [`failed to parse LLM JSON: ${(err as Error).message}`] };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { triples: [], skipped: ['LLM returned non-object JSON'] };
  }
  const obj = parsed as Record<string, unknown>;
  const tripArr = Array.isArray(obj['triples']) ? (obj['triples'] as unknown[]) : [];
  const skippedArr = Array.isArray(obj['skipped']) ? (obj['skipped'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];

  const triples: SemanticTriple[] = [];
  for (const t of tripArr) {
    if (typeof t !== 'object' || t === null) continue;
    const r = t as Record<string, unknown>;
    if (typeof r['subject'] !== 'string' || typeof r['predicate'] !== 'string') continue;
    const o = r['object'];
    if (typeof o !== 'object' || o === null) continue;
    const ro = o as Record<string, unknown>;
    if ((ro['type'] !== 'uri' && ro['type'] !== 'literal') || typeof ro['value'] !== 'string') continue;
    triples.push({
      subject: r['subject'],
      predicate: r['predicate'],
      object: {
        type: ro['type'] as 'uri' | 'literal',
        value: ro['value'],
        ...(typeof ro['datatype'] === 'string' ? { datatype: ro['datatype'] } : {}),
      },
      source: typeof r['source'] === 'string' ? r['source'] : sessionUri,
      confidence: typeof r['confidence'] === 'number' ? r['confidence'] : 0.7,
      method: typeof r['method'] === 'string' ? r['method'] : 'agent-self-report',
    });
  }

  return { triples, skipped: skippedArr };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter predicate-agent test semantic-extractor
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-agent/package.json packages/predicate-agent/src/semantic-extractor.ts packages/predicate-agent/tests/semantic-extractor.test.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(agent): add semantic LLM-driven turn extractor

Calls Claude Haiku 4.5 over the Anthropic API with a session's final
assistant message + tool-call summary + TBox slice (cached). Returns
typed triples for assertion with confidence 0.7 / method
"agent-self-report".

Hard-enforces predicate discipline: the LLM is told to emit triples
only with predicates that appear in the TBox slice; invented
predicates are skipped.

If ANTHROPIC_API_KEY is missing, returns empty triples + skip
reason — keeps the Stop-hook pipeline usable in CI / sandboxes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `predicate extract` CLI subcommand

**Files:**
- Create: `packages/predicate-cli/src/commands/extract.ts`
- Create: `packages/predicate-cli/tests/extract.test.ts`
- Modify: `packages/predicate-cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/extract.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
  })),
}));

import { extract } from '../src/commands/extract.js';

const client = new SparqlClient(loadConfig());

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:abox>`);
  await client.update(`CREATE SILENT GRAPH <kg:abox>`);
  await client.update(`DROP SILENT GRAPH <kg:provenance>`);
  await client.update(`CREATE SILENT GRAPH <kg:provenance>`);
}

function writeTranscript(events: Array<Record<string, unknown>>): string {
  const dir = mkdtempSync(join(tmpdir(), 'predicate-test-'));
  const path = join(dir, 'transcript.jsonl');
  writeFileSync(path, events.map((e) => JSON.stringify(e)).join('\n'));
  return path;
}

describe('predicate extract', () => {
  beforeEach(async () => { await reset(); });

  it('reads the Stop-hook payload, runs deterministic extractor, and asserts triples', async () => {
    const transcript = writeTranscript([
      { type: 'tool_use', name: 'Edit', input: { file_path: '/work/auth.ts' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'pnpm test' }, exit_code: 0 },
    ]);
    const payload = JSON.stringify({
      session_id: 'ses-extract',
      transcript_path: transcript,
      stop_hook_active: true,
    });
    const code = await extract(['--from-stdin'], Readable.from([payload]));
    expect(code).toBe(0);
    try {
      const r = await client.select(
        `PREFIX cb: <https://predicate.dev/codebase#>
         SELECT (COUNT(*) AS ?n) WHERE {
           GRAPH <kg:abox> {
             <file:///work/auth.ts> cb:modifiedIn <urn:predicate:session:ses-extract>
           }
         }`,
      );
      expect(parseInt(r.results.bindings[0]!.n!.value, 10)).toBe(1);
    } finally {
      rmSync(transcript, { force: true });
    }
  });

  it('returns 2 with --help', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const code = await extract(['--help'], Readable.from(['']));
      expect(code).toBe(0);
      const printed = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(printed).toContain('predicate extract');
      expect(printed).toContain('--from-stdin');
    } finally { logSpy.mockRestore(); }
  });

  it('errors with exit 2 on missing transcript_path', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const code = await extract(['--from-stdin'], Readable.from(['{"session_id":"x"}']));
      expect(code).toBe(2);
    } finally { errSpy.mockRestore(); }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter predicate-cli test extract
```

Expected: FAIL (`Cannot find module '../src/commands/extract.js'`).

- [ ] **Step 3: Implement the extract subcommand**

Create `packages/predicate-cli/src/commands/extract.ts`:

```typescript
import type { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';
import {
  extractDeterministic,
  type ExtractedTriple,
  type Transcript,
} from 'predicate-agent/src/turn-extractor.js';
import { extractSemantic, type SemanticTriple } from 'predicate-agent/src/semantic-extractor.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function readStdin(stream: Readable): Promise<string> {
  let buf = '';
  for await (const chunk of stream) buf += String(chunk);
  return buf;
}

function help(): void {
  console.log(`predicate extract --from-stdin

Read a Claude Code Stop-hook payload from stdin and extract typed
triples for what the turn LEARNED. Triples go through kg_assert so
SHACL validation and TBox predicate-discipline apply.

Expected stdin payload (Claude Code Stop hook):
  { "session_id": "...", "transcript_path": "/abs/path.jsonl",
    "stop_hook_active": true }

The CLI:
  1. Reads the transcript JSONL.
  2. Runs the deterministic extractor (TS, no LLM, fast).
  3. Runs the semantic extractor (Claude Haiku, only if
     ANTHROPIC_API_KEY is set).
  4. Asserts all triples via kg_assert.

Options:
  --from-stdin   Required.
  --help         Print this message.

Env:
  ANTHROPIC_API_KEY    Enables the semantic extractor (default: off).
  FUSEKI_URL, PREDICATE_DATASET    Graph server.
`);
}

async function buildTBoxSlice(client: SparqlClient): Promise<string> {
  // Naive slice: list every declared predicate. Good enough for v1.5;
  // future versions can scope by concept.
  const r = await client.select(
    `PREFIX owl: <http://www.w3.org/2002/07/owl#>
     SELECT DISTINCT ?p ?kind WHERE {
       GRAPH <kg:tbox> {
         ?p a ?kind .
         FILTER (?kind IN (owl:ObjectProperty, owl:DatatypeProperty))
       }
     } ORDER BY ?p`,
  );
  return r.results.bindings.map((b) => `${b['p']!.value} a ${b['kind']!.value} .`).join('\n');
}

function summarizeTools(events: Array<Record<string, unknown>>): string {
  const lines: string[] = [];
  for (const ev of events) {
    if (ev['type'] !== 'tool_use') continue;
    const name = ev['name'];
    const input = (ev['input'] ?? {}) as Record<string, unknown>;
    const exit = ev['exit_code'];
    if (name === 'Edit' || name === 'Write') {
      lines.push(`${name} ${String(input['file_path'] ?? '?')}`);
    } else if (name === 'Bash') {
      const cmd = String(input['command'] ?? '?');
      const short = cmd.length > 80 ? `${cmd.slice(0, 80)}…` : cmd;
      lines.push(`Bash "${short}" (exit ${exit ?? 0})`);
    } else if (typeof name === 'string') {
      lines.push(name);
    }
  }
  return lines.join('\n');
}

function lastAssistantMessage(events: Array<Record<string, unknown>>): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]!;
    if (ev['role'] === 'assistant') {
      const c = ev['content'];
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        return c
          .filter((b): b is { type: 'text'; text: string } => typeof b === 'object' && b !== null && (b as Record<string, unknown>)['type'] === 'text')
          .map((b) => b.text)
          .join('\n');
      }
    }
  }
  return '';
}

export async function extract(args: string[], stdin: Readable = process.stdin): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  if (!hasFlag(args, '--from-stdin')) {
    console.error('predicate extract: --from-stdin is required.');
    return 2;
  }

  const raw = await readStdin(stdin);
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.error(`predicate extract: invalid JSON on stdin: ${(err as Error).message}`);
    return 2;
  }

  const sessionId = typeof payload['session_id'] === 'string' ? payload['session_id'] : undefined;
  const transcriptPath = typeof payload['transcript_path'] === 'string' ? payload['transcript_path'] : undefined;
  if (!sessionId || !transcriptPath) {
    console.error('predicate extract: payload must include session_id and transcript_path.');
    return 2;
  }

  let events: Array<Record<string, unknown>>;
  try {
    const lines = readFileSync(transcriptPath, 'utf8').split('\n').filter((l) => l.trim().length > 0);
    events = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch (err) {
    console.error(`predicate extract: failed to read transcript: ${(err as Error).message}`);
    return 1;
  }

  const transcript: Transcript = { sessionId, events };
  const deterministic = extractDeterministic(transcript);

  let semantic: { triples: SemanticTriple[]; skipped: string[] } = { triples: [], skipped: [] };
  const client = new SparqlClient(loadConfig());
  if (process.env['ANTHROPIC_API_KEY']) {
    const tboxSlice = await buildTBoxSlice(client);
    semantic = await extractSemantic({
      sessionId,
      finalMessage: lastAssistantMessage(events),
      toolSummary: summarizeTools(events),
      tboxSlice,
    });
  }

  let asserted = 0;
  let rejected = 0;
  for (const t of [...deterministic.triples, ...semantic.triples] as Array<ExtractedTriple | SemanticTriple>) {
    try {
      await kgAssert(client, t);
      asserted++;
    } catch {
      rejected++;
    }
  }

  console.log(
    `predicate extract: session=${sessionId} deterministic=${deterministic.triples.length} semantic=${semantic.triples.length} asserted=${asserted} rejected=${rejected}`,
  );
  return 0;
}
```

- [ ] **Step 4: Wire the subcommand into `index.ts`**

Modify `packages/predicate-cli/src/index.ts`. Add the import after the existing `capture` import:

```typescript
import { extract } from './commands/extract.js';
```

Update the `Commands:` block in `help()`:

```typescript
  capture        Record a tool invocation in kg:usage (opt-in via PREDICATE_RAW_CAPTURE).
  extract        Read a Stop-hook payload from stdin and extract typed triples into kg:abox.
```

Update the switch:

```typescript
    case 'capture':      return capture(process.argv.slice(3));
    case 'extract':      return extract(process.argv.slice(3));
```

- [ ] **Step 5: Run all CLI tests to verify they pass**

```bash
pnpm --filter predicate-cli test
```

Expected: all CLI tests pass (existing + 3 new in extract.test.ts).

- [ ] **Step 6: Smoke-test against a synthetic transcript**

```bash
TX=$(mktemp -d)/transcript.jsonl
cat > "$TX" <<'EOF'
{"type":"tool_use","name":"Edit","input":{"file_path":"/work/auth.ts"}}
{"type":"tool_use","name":"Bash","input":{"command":"pnpm test"},"exit_code":0}
{"role":"assistant","content":"I added JWT validation."}
EOF
pnpm --filter predicate-skill run bundle >/dev/null
echo "{\"session_id\":\"ses-smoke\",\"transcript_path\":\"$TX\",\"stop_hook_active\":true}" \
  | PATH="$(pwd)/.bin:$PATH" predicate extract --from-stdin

curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX cb: <https://predicate.dev/codebase#> SELECT ?s ?p ?o WHERE { GRAPH <kg:abox> { ?s ?p ?o . FILTER (?p IN (cb:modifiedIn, cb:succeededIn)) } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[] | "\(.s.value) -> \(.p.value) -> \(.o.value)"'
```

Expected first command output:

```
predicate extract: session=ses-smoke deterministic=7 semantic=0 asserted=7 rejected=0
```

Expected curl output (order may vary):

```
file:///work/auth.ts -> https://predicate.dev/codebase#modifiedIn -> urn:predicate:session:ses-smoke
urn:bash:<hash> -> https://predicate.dev/codebase#succeededIn -> urn:predicate:session:ses-smoke
```

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/extract.ts packages/predicate-cli/tests/extract.test.ts packages/predicate-cli/src/index.ts
git commit -m "$(cat <<'EOF'
feat(cli): add `predicate extract --from-stdin` subcommand

Reads a Stop-hook payload from stdin, loads the transcript file,
runs the deterministic + (optional) semantic extractors from the
predicate-agent package, and asserts the union of their triples
through kg_assert (SHACL + predicate-discipline gated).

Prints a one-line summary of (session, deterministic count, semantic
count, asserted count, rejected count) so the host hook can log
extraction outcomes. Semantic extractor is only invoked when
ANTHROPIC_API_KEY is present; without it, only deterministic triples
flow into kg:abox.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Claude Code Stop hook script + hooks.json wiring

**Files:**
- Create: `packages/predicate-skill/hooks/stop.sh`
- Modify: `packages/predicate-skill/hooks/hooks.json`

- [ ] **Step 1: Create `stop.sh`**

Create `packages/predicate-skill/hooks/stop.sh`:

```bash
#!/usr/bin/env bash
# Claude Code Stop hook: reads the Stop-hook JSON payload from stdin,
# runs structured turn extraction (predicate extract), then a
# maintenance sweep. Fail-open: any error returns exit 0 so capture
# never blocks the user's next prompt.
set -uo pipefail

if ! command -v predicate >/dev/null 2>&1; then
  exit 0
fi

# Buffer stdin so we can tee it into extract.
payload="$(cat || true)"

if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate extract --from-stdin >/dev/null 2>&1 || true
fi

predicate maintain >/dev/null 2>&1 || true
exit 0
```

- [ ] **Step 2: Mark it executable**

```bash
chmod +x packages/predicate-skill/hooks/stop.sh
ls -l packages/predicate-skill/hooks/stop.sh
```

Expected: file mode starts with `-rwxr-xr-x`.

- [ ] **Step 3: Update `hooks.json` to register the Stop event**

Modify `packages/predicate-skill/hooks/hooks.json`. Read the current file (should have 3 entries from Phase 8: SessionStart, PreToolUse, PostToolUse). Append a fourth entry for Stop:

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
    },
    {
      "event": "Stop",
      "matcher": "*",
      "command": "bash ${PLUGIN_DIR}/hooks/stop.sh"
    }
  ]
}
```

- [ ] **Step 4: Validate JSON**

```bash
jq . packages/predicate-skill/hooks/hooks.json
```

Expected: pretty-printed valid JSON, no errors.

- [ ] **Step 5: Smoke-test stop.sh**

```bash
TX=$(mktemp -d)/transcript.jsonl
cat > "$TX" <<'EOF'
{"type":"tool_use","name":"Edit","input":{"file_path":"/work/x.ts"}}
{"role":"assistant","content":"done"}
EOF
echo "{\"session_id\":\"ses-stop\",\"transcript_path\":\"$TX\"}" \
  | PATH="$(pwd)/.bin:$PATH" bash packages/predicate-skill/hooks/stop.sh
echo "exit=$?"

# Verify the extraction landed
curl -fsS http://localhost:3030/predicate/query \
  --data-urlencode "query=PREFIX cb: <https://predicate.dev/codebase#> ASK { GRAPH <kg:abox> { <file:///work/x.ts> cb:modifiedIn <urn:predicate:session:ses-stop> } }" \
  --header "Accept: application/sparql-results+json" | jq -r .boolean
```

Expected: `exit=0` and `true`.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-skill/hooks/stop.sh packages/predicate-skill/hooks/hooks.json
git commit -m "$(cat <<'EOF'
feat(skill): add Claude Code Stop hook for turn extraction

Wires \`hooks/stop.sh\` to the Claude Code Stop event. The script
pipes the Stop-hook payload into \`predicate extract --from-stdin\`
(typed triples to kg:abox via kg_assert), then runs
\`predicate maintain\` to keep the graph tidy. Fail-open so capture
never blocks the user's next prompt.

Claude Code now exercises four lifecycle events for Predicate:
SessionStart, PreToolUse, PostToolUse, Stop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: README + version bump + bundle rebuild + tag v1.5.0-stop-extract

**Files:**
- Modify: `README.md`
- Modify: `packages/predicate-skill/README.md`
- Modify: `packages/predicate-skill/package.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `packages/predicate-skill/server.bundle.mjs` (regenerated)
- Modify: `packages/predicate-skill/cli.bundle.mjs` (regenerated)

- [ ] **Step 1: Update top-level README CLI block**

Modify `README.md`. Find the CLI code block (begins with `predicate up`). Add the new `extract` line right after `capture`:

```
predicate capture        # record a tool call in kg:usage (opt-in: PREDICATE_RAW_CAPTURE=1)
predicate extract        # read a Stop-hook payload and assert typed triples to kg:abox
```

- [ ] **Step 2: Update top-level README Status section**

Modify `README.md`. Find `## Status` and replace its body with:

```markdown
## Status

**v1.5 — Stop-hook turn extraction.** Claude Code's Stop event now
triggers structured knowledge extraction: a deterministic TypeScript
pass plus an optional Claude Haiku 4.5 semantic pass emit typed
triples through `kg_assert` (SHACL + predicate-discipline gated) at
end of every turn. Phase 8's per-tool-call `kg_capture` raw-log path
is preserved but flipped OFF by default — enable with
`PREDICATE_RAW_CAPTURE=1` if you need forensic capture.

Earlier milestones (in order): `v0.1.0-foundation` → `v0.2.0-discipline` →
`v0.3a.0-goals-and-gaps` → `v0.3b.0-research-execution` →
`v0.3c.0-schema-evolution` → `v1.0.0` → `v1.1.0-distribution` →
`v1.2.0-multiplatform` → `v1.3.0-platform-hooks` → `v1.4.0-tool-capture` →
`v1.5.0-stop-extract`.

Deferred to v1.6 (see spec §17): cross-validation between deterministic
and semantic extractors; cross-platform Stop-hook extraction
(Gemini / OpenCode have different transcript shapes); `predicate
captures` query CLI; materialization caching; tag-while-deriving for
`kg_explain`; intent-aware `ResearchSource` filtering; journal-based
cross-system promotion atomicity.
```

- [ ] **Step 3: Update `packages/predicate-skill/README.md`**

Modify `packages/predicate-skill/README.md`:
- Change the "Current version" line to `Current version: **1.5.0** (\`v1.5.0-stop-extract\`).`
- Update the Hook events table — the Claude Code row now shows four events:

```markdown
| Claude Code | `hooks/` (root) | SessionStart, PreToolUse, PostToolUse, Stop |
```

- Update the CLI block to include `predicate extract` after `predicate capture`.

- [ ] **Step 4: Bump versions**

Modify `packages/predicate-skill/package.json`: `"version": "1.4.0"` → `"version": "1.5.0"`.

Modify `.claude-plugin/marketplace.json`: both `"version": "1.4.0"` → `"version": "1.5.0"`.

- [ ] **Step 5: Run the full test suite**

```bash
pnpm test 2>&1 | grep -E "Tests +[0-9]"
```

Expected: every prior test still passes. Total count = 160 (Phase 8) + 6 turn-extractor + 3 semantic-extractor + 3 extract CLI + 2 capture (defaults) = 174 tests.

- [ ] **Step 6: Rebuild the bundles**

```bash
pnpm --filter predicate-skill run bundle 2>&1 | tail -3
ls -l packages/predicate-skill/cli.bundle.mjs
node packages/predicate-skill/cli.bundle.mjs --help | head -15
```

Expected: both bundle files updated; help output lists `extract` between `capture` and `--version`.

- [ ] **Step 7: Commit the release**

```bash
git add README.md packages/predicate-skill/README.md packages/predicate-skill/package.json .claude-plugin/marketplace.json packages/predicate-skill/server.bundle.mjs packages/predicate-skill/cli.bundle.mjs
git commit -m "$(cat <<'EOF'
chore(release): v1.5.0 — Stop-hook turn extraction

- Top-level README CLI block gains \`predicate extract\` line.
- Top-level README Status rewritten: v1.5 stop-extract summary; raw
  capture flipped to opt-in via PREDICATE_RAW_CAPTURE=1.
- Package README: bump version + add Stop event to Hook events table
  + add extract line to CLI block.
- Bump package.json + marketplace.json to 1.5.0.
- Rebuild bundles (server.bundle.mjs + cli.bundle.mjs) including the
  new extract CLI subcommand plus the deterministic + semantic
  extractor libraries from predicate-agent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Tag v1.5.0-stop-extract**

```bash
git tag -a v1.5.0-stop-extract -m "Predicate v1.5.0 — Stop-hook turn extraction (deterministic + semantic) → kg_assert"
git tag --list 'v*' | sort
```

Expected: the new tag appears alongside the prior `v1.*` tags. Do NOT push.

---

## Self-Review

### Spec coverage

This plan covers the redesign as proposed:

- ✅ Stop event added to `hooks.json` + `hooks/stop.sh` for Claude Code — Task 6
- ✅ New CLI `predicate extract --from-stdin` — Task 5
- ✅ Deterministic extractor in `predicate-agent` parsing Claude Code transcript JSON, emitting triples for Edit/Write/Bash — Task 3
- ✅ Semantic extractor with prompt template + Anthropic API call (Claude Haiku 4.5) + schema slice fed via cache_control — Task 4
- ✅ Both extractors funnel through `kgAssert` — Task 5 (Step 3, the loop at end of `extract()` calls `kgAssert` for every triple)
- ✅ `PREDICATE_CAPTURE_SKIP` / `PREDICATE_RAW_CAPTURE` default flip — Task 2
- ✅ TBox additions for the four action predicates — Task 1
- ✅ Tag v1.5.0-stop-extract — Task 7 Step 8

The cross-validation between extractors (semantic claims contradicting deterministic facts) is documented as deferred to v1.6 in the Status section. MVP relies on confidence scores (0.95 vs 0.7) to let downstream `kg_explain` surface contradictions naturally.

### Placeholder scan

Searched for `TBD`, `TODO`, `implement later`, `add appropriate`, `add validation`, `handle edge cases`, `similar to task`. None found in execution steps. Acceptable literal placeholders: none.

### Type / name consistency

- `ExtractedTriple` shape from `turn-extractor.ts` (Task 3) matches the shape kg_assert expects (subject, predicate, object{type,value,datatype?}, source, confidence, method). ✅
- `SemanticTriple` shape (Task 4) is structurally identical to `ExtractedTriple` — both feed `kgAssert` in `extract()` via a spread union type (Task 5 step 3). ✅
- TBox predicate IRIs used in the extractor exactly match what Task 1 adds:
  - `codebase:modifiedIn` → `https://predicate.dev/codebase#modifiedIn` ✅
  - `codebase:createdIn` → `https://predicate.dev/codebase#createdIn` ✅
  - `codebase:succeededIn` → `https://predicate.dev/codebase#succeededIn` ✅
  - `codebase:failedIn` → `https://predicate.dev/codebase#failedIn` ✅
  - `codebase:commandText` → `https://predicate.dev/codebase#commandText` ✅
  - `codebase:File` and `codebase:Command` exist after Task 1 ✅
  - `pred:Session` → `https://predicate.dev/meta#Session` ✅
- Session URN scheme `urn:predicate:session:<id>` consistent across deterministic extractor (Task 3), the SPARQL queries in Task 5/6 smoke tests, and the README.
- `PREDICATE_RAW_CAPTURE` env var name consistent across Task 2 (CLI), README updates in Task 7, and the `Env:` block in both `capture.ts` help and `index.ts` help. ✅
- Model ID `claude-haiku-4-5-20251001` in Task 4 step 4 matches Claude's current naming.

### Things the engineer should verify during implementation

1. **Claude Code Stop hook payload shape.** The plan assumes `{session_id, transcript_path, stop_hook_active}`. If your Claude Code version uses different field names, update the `extract()` parsing in Task 5 step 3 accordingly. The hook script in Task 6 is payload-agnostic — it just pipes stdin through.
2. **Claude Code transcript JSONL shape.** The deterministic extractor assumes events look like `{type:"tool_use", name, input, exit_code?, is_error?, was_new?}` and assistant messages look like `{role:"assistant", content}` (string or array of `{type:"text", text}` blocks). Verify against a real transcript before relying on the parser. The unit tests (Task 3) feed in synthetic shapes that match this assumption.
3. **`@anthropic-ai/sdk` version.** The plan pins `^0.40.0`. If the SDK has had breaking changes since, adjust the import / call shape in Task 4 step 4 (the `messages.create()` API has been stable for a while but verify the `cache_control` field location).
4. **Test count in Task 7 step 5.** The 174-tests estimate counts Phase 8's 160 + 14 new in this phase. Adjust if any pre-existing test breaks under the `PREDICATE_RAW_CAPTURE` default flip — Task 2's test changes should cover the relevant edits in `capture.test.ts`.
