# Predicate Phase 12 — `predicate captures` + `predicate recall` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Two new query CLI commands. `predicate captures` lists raw `kg:usage` ToolCall captures (companion to `predicate sessions`; only meaningful if `PREDICATE_RAW_CAPTURE=1` was set). `predicate recall <text>` searches session-history for matching files, commands, or sessions and prints a structured summary. Tag v1.9.0-captures-recall.

**Architecture:** Both commands are thin SPARQL wrappers, same shape as `predicate sessions`. `recall` does a substring match against `cb:commandText` and against file paths (the file IRI's last segment). It returns matched files (with their last-modified session) and matched commands (with their success/failure tally). No fuzzy/embedding search — pure SPARQL FILTER CONTAINS. Anything beyond that lives in a future "semantic-recall" phase.

**Tech Stack:** TypeScript + SPARQL. Tests against live Fuseki.

---

## File Structure

**New files:**
- `packages/predicate-cli/src/commands/captures.ts`
- `packages/predicate-cli/src/commands/recall.ts`
- `packages/predicate-cli/tests/captures.test.ts`
- `packages/predicate-cli/tests/recall.test.ts`

**Modified files:**
- `packages/predicate-cli/src/index.ts` — register both commands + help text.
- `packages/predicate-skill/skills/predicate/SKILL.md` — append a "memory primitive" worked example showing when to suggest `predicate recall`.
- Version bumps to 1.9.0
- README updates

---

### Task 1: `predicate captures`

Mirror `packages/predicate-cli/src/commands/sessions.ts` but query `kg:usage`. Columns: captureId (short), at, toolName, phase, sessionId.

```typescript
// packages/predicate-cli/src/commands/captures.ts
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

interface CaptureRow {
  captureId: string;
  at: string;
  toolName: string;
  phase: string;
  sessionId: string;
}

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function help(): void {
  console.log(`predicate captures [--limit N] [--tool NAME] [--json]

List raw tool-call captures from kg:usage (only present when
PREDICATE_RAW_CAPTURE=1 was set during the session — see
\`predicate capture --help\` for details). The structured Stop-hook
extraction path uses kg:abox + \`predicate sessions\` instead.

Options:
  --limit N    Show the N most recent captures (default 20).
  --tool NAME  Filter to a specific tool (e.g. --tool Bash).
  --json       Output as JSON.
  --help       Print this message.
`);
}

async function fetchCaptures(client: SparqlClient, opts: { limit: number; tool?: string }): Promise<CaptureRow[]> {
  const META = 'https://predicate.dev/meta#';
  const toolFilter = opts.tool
    ? `FILTER (?tool = "${opts.tool.replace(/"/g, '\\"')}")`
    : '';
  const r = await client.select(
    `PREFIX pred: <${META}>
     SELECT ?c ?at ?tool ?phase ?session WHERE {
       GRAPH <kg:usage> {
         ?c a pred:ToolCall ;
            pred:at        ?at ;
            pred:toolName  ?tool ;
            pred:phase     ?phase .
         OPTIONAL { ?c pred:sessionId ?session }
         ${toolFilter}
       }
     }
     ORDER BY DESC(?at)
     LIMIT ${opts.limit}`,
  );
  return r.results.bindings.map((b) => ({
    captureId: b['c']!.value,
    at:        b['at']!.value,
    toolName:  b['tool']!.value,
    phase:     b['phase']!.value,
    sessionId: b['session']?.value ?? '',
  }));
}

function renderTable(rows: CaptureRow[]): string {
  if (rows.length === 0) {
    return '(no captures in kg:usage — set PREDICATE_RAW_CAPTURE=1 to enable raw capture, then re-run)';
  }
  const header = ['captureId', 'at', 'tool', 'phase', 'sessionId'];
  const cells: string[][] = [header, ...rows.map((r) => [
    r.captureId.replace(/^urn:predicate:capture:/, ''),
    r.at,
    r.toolName,
    r.phase,
    r.sessionId,
  ])];
  const widths = header.map((_, i) => Math.max(...cells.map((row) => row[i]!.length)));
  return cells.map((row) => row.map((c, i) => c.padEnd(widths[i]!)).join('  ')).join('\n');
}

export async function captures(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const limitStr = parseFlag(args, '--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 20;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('predicate captures: --limit must be a positive integer');
    return 2;
  }
  const tool = parseFlag(args, '--tool');
  try {
    const client = new SparqlClient(loadConfig());
    const rows = await fetchCaptures(client, { limit, ...(tool ? { tool } : {}) });
    if (hasFlag(args, '--json')) console.log(JSON.stringify(rows, null, 2));
    else console.log(renderTable(rows));
    return 0;
  } catch (err) {
    console.error(`predicate captures failed: ${(err as Error).message}`);
    return 1;
  }
}
```

Tests follow the `sessions.test.ts` pattern: seed kg:usage with synthetic ToolCall triples, verify table render + --json + --tool filter + empty state + --help.

### Task 2: `predicate recall <text>`

Search session-history for files and commands containing the query substring.

```typescript
// packages/predicate-cli/src/commands/recall.ts
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

interface RecallResult {
  query: string;
  files: Array<{ file: string; modifiedInSessions: number; lastModifiedAt: string }>;
  commands: Array<{ commandText: string; succeeded: number; failed: number }>;
}

function help(): void {
  console.log(`predicate recall <query> [--json] [--limit N]

Search session-history (kg:abox) for files and commands matching the
query substring. Output:
  - Files: list of file paths matching <query>, with how many sessions
    they were modified in and when last touched.
  - Commands: list of bash command texts matching <query>, with success
    and failure counts.

This is a substring-match memory primitive, not a semantic search.
Use it to answer questions like "what did I do with X recently?".

Options:
  --limit N    Cap rows per category (default 10).
  --json       Output as JSON.
  --help       Print this message.

Example:
  predicate recall auth
  predicate recall "pnpm test"
`);
}

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function escapeSparqlLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function searchFiles(client: SparqlClient, query: string, limit: number): Promise<RecallResult['files']> {
  const CB = 'https://predicate.dev/codebase#';
  const META = 'https://predicate.dev/meta#';
  const r = await client.select(
    `PREFIX cb:   <${CB}>
     PREFIX pred: <${META}>
     SELECT ?file (COUNT(DISTINCT ?session) AS ?modCount) (MAX(?at) AS ?lastAt)
     WHERE {
       GRAPH <kg:abox> {
         ?file cb:modifiedIn ?session .
         ?session pred:at ?at .
         FILTER (CONTAINS(LCASE(STR(?file)), LCASE("${escapeSparqlLiteral(query)}")))
       }
     }
     GROUP BY ?file
     ORDER BY DESC(?lastAt)
     LIMIT ${limit}`,
  );
  return r.results.bindings.map((b) => ({
    file:               b['file']!.value,
    modifiedInSessions: parseInt(b['modCount']!.value, 10),
    lastModifiedAt:     b['lastAt']!.value,
  }));
}

async function searchCommands(client: SparqlClient, query: string, limit: number): Promise<RecallResult['commands']> {
  const CB = 'https://predicate.dev/codebase#';
  const r = await client.select(
    `PREFIX cb: <${CB}>
     SELECT ?text
            (COUNT(DISTINCT ?okSession) AS ?okN)
            (COUNT(DISTINCT ?badSession) AS ?badN)
     WHERE {
       GRAPH <kg:abox> {
         ?cmd a cb:Command ; cb:commandText ?text .
         OPTIONAL { ?cmd cb:succeededIn ?okSession }
         OPTIONAL { ?cmd cb:failedIn    ?badSession }
         FILTER (CONTAINS(LCASE(?text), LCASE("${escapeSparqlLiteral(query)}")))
       }
     }
     GROUP BY ?text
     ORDER BY DESC(?badN) DESC(?okN)
     LIMIT ${limit}`,
  );
  return r.results.bindings.map((b) => ({
    commandText: b['text']!.value,
    succeeded:   parseInt(b['okN']!.value, 10),
    failed:      parseInt(b['badN']!.value, 10),
  }));
}

function render(result: RecallResult): string {
  const lines: string[] = [];
  lines.push(`recall "${result.query}":`);
  lines.push('');
  if (result.files.length > 0) {
    lines.push(`  Files (${result.files.length}):`);
    for (const f of result.files) {
      lines.push(`    ${f.file} — ${f.modifiedInSessions} sessions, last ${f.lastModifiedAt}`);
    }
    lines.push('');
  }
  if (result.commands.length > 0) {
    lines.push(`  Commands (${result.commands.length}):`);
    for (const c of result.commands) {
      const cmd = c.commandText.length > 80 ? c.commandText.slice(0, 80) + '…' : c.commandText;
      lines.push(`    ${cmd}  (ok=${c.succeeded} fail=${c.failed})`);
    }
    lines.push('');
  }
  if (result.files.length === 0 && result.commands.length === 0) {
    lines.push(`  (no files or commands matched "${result.query}" in kg:abox)`);
  }
  return lines.join('\n');
}

export async function recall(args: string[]): Promise<number> {
  if (hasFlag(args, '--help') || args.length === 0) { help(); return args.length === 0 ? 2 : 0; }
  const flagIdxs = new Set<number>();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' || args[i] === '--json') {
      flagIdxs.add(i);
      if (args[i] === '--limit') flagIdxs.add(i + 1);
    }
  }
  const queryParts = args.filter((_, i) => !flagIdxs.has(i));
  const query = queryParts.join(' ').trim();
  if (!query) {
    console.error('predicate recall: query argument is required');
    return 2;
  }
  const limitStr = parseFlag(args, '--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 10;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('predicate recall: --limit must be a positive integer');
    return 2;
  }
  try {
    const client = new SparqlClient(loadConfig());
    const [files, commands] = await Promise.all([
      searchFiles(client, query, limit),
      searchCommands(client, query, limit),
    ]);
    const result: RecallResult = { query, files, commands };
    if (hasFlag(args, '--json')) console.log(JSON.stringify(result, null, 2));
    else console.log(render(result));
    return 0;
  } catch (err) {
    console.error(`predicate recall failed: ${(err as Error).message}`);
    return 1;
  }
}
```

Tests: seed kg:abox with files like `/work/auth.ts` and `/work/other.ts` plus commands like `pnpm test` (failed in 2 sessions) and `ls` (succeeded in 1). Verify `recall auth` returns only the matching file; `recall test` returns the matching command with correct counts.

### Task 3: Register both commands

Modify `packages/predicate-cli/src/index.ts`:

```typescript
import { captures } from './commands/captures.js';
import { recall } from './commands/recall.js';
```

Add to help text:
```
  captures       List raw kg:usage ToolCall captures (opt-in raw-capture path).
  recall         Substring search over session history (files + commands).
```

Add to switch:
```typescript
case 'captures':     return captures(process.argv.slice(3));
case 'recall':       return recall(process.argv.slice(3));
```

### Task 4: SKILL.md memory-primitive example

Append worked example 5 (or wherever it fits in the current SKILL.md numbering):

```markdown
## Memory recall — "what did I do with X recently?"

For substring-match recall over session history, call `predicate recall`
(or `kg_ask` with the equivalent SPARQL). Useful when the user asks
"what did I work on related to X?" or "did I ever run command Y?"

\`\`\`sparql
PREFIX cb:   <https://predicate.dev/codebase#>
PREFIX pred: <https://predicate.dev/meta#>
SELECT ?file (COUNT(DISTINCT ?session) AS ?n) (MAX(?at) AS ?lastAt)
WHERE {
  GRAPH <kg:abox> {
    ?file cb:modifiedIn ?session .
    ?session pred:at ?at .
    FILTER (CONTAINS(LCASE(STR(?file)), LCASE("auth")))
  }
} GROUP BY ?file ORDER BY DESC(?lastAt)
\`\`\`

Combine with the `cb:Hotspot` / `cb:FlakyCommand` / `cb:ActiveFile` derived
classes from `kg:inferred` for richer answers ("is auth.ts a hotspot?").
```

### Task 5: Bump + release

- Version bumps 1.8.0 → 1.9.0 across all three manifest files
- README Status update mentioning the two new commands
- Bundle rebuild
- One commit with descriptive message
- Tag `v1.9.0-captures-recall`
- Merge to main + push
- Expected test count: ~213 (205 prior + 5 captures tests + 3 recall tests)
