# Predicate Phase 7 — Multi-Platform Hook Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-platform hook adapters (SessionStart, PreCompact, Stop) for Gemini CLI, Cursor, VS Code Copilot, OpenCode, and Codex CLI — backed by two new `predicate` CLI subcommands that hook scripts call. Tag v1.3.0-platform-hooks.

**Architecture:** Add two new thin CLI subcommands (`predicate sessionstart`, `predicate maintain`) that wrap the existing SparqlClient + `kgStats` + `kgMaintain` library code. Then ship 15 small bash scripts (5 platforms × 3 events) that call those subcommands and format the output for the host platform. Each platform also gets a config template (settings.json / mcp.json / config.toml) and a README install block. PreToolUse/PostToolUse are deferred to Phase 8.

**Tech Stack:** Node 20+, TypeScript 5 (strict + noUncheckedIndexedAccess), pnpm workspaces, bash, jq, esbuild bundler, existing `predicate-mcp` and `predicate-agent` packages.

---

## File Structure

**New files:**
- `packages/predicate-cli/src/commands/sessionstart.ts` — emit a one-line KG status string
- `packages/predicate-cli/src/commands/maintain.ts` — run `kgMaintain` and print a one-line summary
- `packages/predicate-cli/test/sessionstart.test.ts` — unit test for sessionstart command
- `packages/predicate-cli/test/maintain.test.ts` — unit test for maintain command
- `packages/predicate-skill/hooks/cursor/session-start.sh`
- `packages/predicate-skill/hooks/cursor/pre-compact.sh`
- `packages/predicate-skill/hooks/cursor/stop.sh`
- `packages/predicate-skill/hooks/cursor/mcp.json.template`
- `packages/predicate-skill/hooks/cursor/README.md`
- `packages/predicate-skill/hooks/gemini-cli/session-start.sh`
- `packages/predicate-skill/hooks/gemini-cli/pre-compact.sh`
- `packages/predicate-skill/hooks/gemini-cli/stop.sh`
- `packages/predicate-skill/hooks/gemini-cli/settings.json.template`
- `packages/predicate-skill/hooks/gemini-cli/README.md`
- `packages/predicate-skill/hooks/vscode-copilot/session-start.sh`
- `packages/predicate-skill/hooks/vscode-copilot/pre-compact.sh`
- `packages/predicate-skill/hooks/vscode-copilot/stop.sh`
- `packages/predicate-skill/hooks/vscode-copilot/settings.json.template`
- `packages/predicate-skill/hooks/vscode-copilot/README.md`
- `packages/predicate-skill/hooks/opencode/session-start.sh`
- `packages/predicate-skill/hooks/opencode/pre-compact.sh`
- `packages/predicate-skill/hooks/opencode/stop.sh`
- `packages/predicate-skill/hooks/opencode/opencode.json.template`
- `packages/predicate-skill/hooks/opencode/README.md`
- `packages/predicate-skill/hooks/codex-cli/session-start.sh`
- `packages/predicate-skill/hooks/codex-cli/pre-compact.sh`
- `packages/predicate-skill/hooks/codex-cli/stop.sh`
- `packages/predicate-skill/hooks/codex-cli/config.toml.template`
- `packages/predicate-skill/hooks/codex-cli/README.md`

**Modified files:**
- `packages/predicate-cli/src/index.ts` — register two new subcommands in dispatch + help text
- `packages/predicate-skill/hooks/session-start.sh` — refactor to call `predicate sessionstart` so Claude Code shares the same source of truth
- `packages/predicate-skill/package.json` — bump version 1.2.0 → 1.3.0
- `packages/predicate-skill/.claude-plugin/marketplace.json` — bump plugin and marketplace versions to 1.3.0
- `README.md` — replace MCP-only blocks for Cursor/Gemini/OpenCode/Codex with full install-with-hooks blocks, add VS Code Copilot block, remove the "hook adapters are Claude-Code-only" sentence

---

## Background context (for the executing engineer)

### How the existing Claude Code SessionStart hook works

`packages/predicate-skill/hooks/hooks.json` registers a single hook:

```json
{
  "hooks": [
    {
      "event": "SessionStart",
      "matcher": "startup|clear|compact",
      "command": "bash ${PLUGIN_DIR}/hooks/session-start.sh"
    }
  ]
}
```

`packages/predicate-skill/hooks/session-start.sh` queries Fuseki directly with `curl` and emits a JSON object to stdout that Claude Code reads as additional context:

```bash
jq -n --arg m "$MSG" '{ additional_context: $m }'
```

In this phase we will:
1. Move the SPARQL-query logic into a CLI subcommand `predicate sessionstart` that emits the plain message text.
2. Rewrite the existing Claude Code script to be a one-liner that calls the CLI + wraps the text in Claude Code's expected JSON shape.
3. Add 14 more thin per-platform scripts (4 platforms × 3 events each) plus 3 more Claude Code scripts (PreCompact, Stop — Claude Code today only has SessionStart) calling the same CLI commands but with platform-appropriate output handling.

Wait — we are NOT shipping new Claude Code hook events in this phase. Claude Code already has SessionStart; we keep it and just refactor it to share the CLI. The new event hooks (PreCompact, Stop) are only added for the *other* platforms — primarily because their MCP/skill story is weaker than Claude Code's and they need the periodic maintenance kick more.

### How `kgMaintain` works today

`packages/predicate-mcp/src/tools/kg-maintain.ts` exports `kgMaintain(client, input)` which:
1. Archives low-confidence stale triples from `kg:abox` to `kg:abox-archive`
2. Runs the Generalizer to lift K-instance patterns into staged TBox proposals
3. Runs the PromotionSweeper to validate + promote staged TBox
4. Logs a `pred:MaintenanceRun` event to `kg:meta`

The result is `{ archivedCount, elapsedMs, eventId, sweeper, generalizer }`. We will print a one-line summary of this from the CLI.

### Per-platform hook semantics (best-effort, may need verification during implementation)

| Platform | SessionStart support | Compact-equivalent event | Stop-equivalent event | MCP config file |
|---|---|---|---|---|
| Claude Code | yes (existing) | SessionStart matcher=`compact` | Stop | `.claude-plugin/marketplace.json` + `hooks.json` |
| Gemini CLI | via hooks block in settings.json | PreCompress hook | Stop hook | `~/.gemini/settings.json` |
| Cursor | via `.cursor/rules/` (not a real event) | none — script is for manual/cron | none — script is for manual/cron | `.cursor/mcp.json` |
| VS Code Copilot | not exposed | not exposed | not exposed | `settings.json` `github.copilot.chat.mcp.servers` |
| OpenCode | via plugin events in opencode.json | session.compacted event | session.stopped event | `opencode.json` |
| Codex CLI | not exposed (MCP-only) | not exposed | not exposed | `~/.codex/config.toml` |

**The deal:** For platforms with no native hook events (Cursor, VS Code Copilot, Codex CLI), the scripts are still shipped — they're runnable manually or via cron, and the README documents both options. The scripts themselves are uniform across platforms (3 per platform); only the **wiring config** differs by what each platform exposes.

When the executing engineer hits a documentation gap (e.g. exact Gemini hook event names changed since this plan was written), they should:
1. Ship the bash script as-is — the script logic is independent of the wiring
2. Note the wiring uncertainty in the platform README rather than guessing
3. Mark the platform's PR comment with a `verify-wiring` note

---

### Task 1: Add `predicate sessionstart` CLI subcommand

**Files:**
- Create: `packages/predicate-cli/src/commands/sessionstart.ts`
- Create: `packages/predicate-cli/test/sessionstart.test.ts`
- Modify: `packages/predicate-cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/test/sessionstart.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { sessionstart } from '../src/commands/sessionstart.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

describe('predicate sessionstart', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // Bootstrap a minimal kg:tbox so the count is non-zero
    const client = new SparqlClient(loadConfig());
    await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
    await client.update(`CREATE SILENT GRAPH <kg:goals>`);
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errSpy?.mockRestore();
  });

  it('prints a single-line summary with goals + classes counts when fuseki is reachable', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await sessionstart();
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]![0] as string;
    expect(line).toMatch(/^Predicate ready: \d+ active goals, \d+ TBox classes\./);
    expect(line).toContain('kg_explore_schema');
  });

  it('returns 0 and prints a fallback message when fuseki is unreachable', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orig = process.env['FUSEKI_URL'];
    process.env['FUSEKI_URL'] = 'http://127.0.0.1:1';  // unreachable
    try {
      const code = await sessionstart();
      expect(code).toBe(0);
      const line = logSpy.mock.calls[0]![0] as string;
      expect(line).toContain('not reachable');
    } finally {
      if (orig !== undefined) process.env['FUSEKI_URL'] = orig;
      else delete process.env['FUSEKI_URL'];
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
pnpm --filter predicate-cli test sessionstart
```

Expected: FAIL with `Cannot find module '../src/commands/sessionstart.js'` (or similar resolution error).

- [ ] **Step 3: Write minimal implementation**

Create `packages/predicate-cli/src/commands/sessionstart.ts`:

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

const META = 'https://predicate.dev/meta#';
const OWL = 'http://www.w3.org/2002/07/owl#';

export async function sessionstart(): Promise<number> {
  const cfg = loadConfig();
  const client = new SparqlClient(cfg);

  try {
    const goalsRes = await client.select(
      `PREFIX pred: <${META}>
       SELECT (COUNT(*) AS ?n) WHERE {
         GRAPH <kg:goals> { ?g pred:status "active" }
       }`,
    );
    const classesRes = await client.select(
      `PREFIX owl: <${OWL}>
       SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
         GRAPH <kg:tbox> { ?c a owl:Class }
       }`,
    );
    const goals = goalsRes.results.bindings[0]?.n?.value ?? '0';
    const classes = classesRes.results.bindings[0]?.n?.value ?? '0';
    console.log(
      `Predicate ready: ${goals} active goals, ${classes} TBox classes. Use kg_explore_schema before drafting SPARQL.`,
    );
    return 0;
  } catch {
    console.log(
      `Predicate: Fuseki not reachable; KG tools may fail. Start it with \`predicate up\`.`,
    );
    return 0;
  }
}
```

- [ ] **Step 4: Wire the subcommand into the CLI dispatcher**

Modify `packages/predicate-cli/src/index.ts`. Find the existing imports block at lines 1-5 and add the sessionstart import:

```typescript
#!/usr/bin/env node
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { doctor } from './commands/doctor.js';
import { stats } from './commands/stats.js';
import { sessionstart } from './commands/sessionstart.js';
```

Find the existing `help()` function around lines 9-27 and replace the Commands block to add the new entry:

```typescript
function help(): void {
  console.log(`predicate <command>

Commands:
  up             Bring Fuseki up (docker compose up -d) and load the seed TBox.
  down           Stop Fuseki, preserve the data volume.
  doctor         Health checks: docker, fuseki, tbox.
  stats          Print kg_stats output for the live graph.
  sessionstart   Print a one-line KG status banner (used by hook scripts).
  --version      Print the predicate version.
  --help         This message.

Env:
  FUSEKI_URL                http://localhost:3030 (default)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
`);
}
```

Find the existing `switch (cmd)` block around lines 31-45 and add the new case before `--version`:

```typescript
  switch (cmd) {
    case 'up':           return up();
    case 'down':         return down();
    case 'doctor':       return doctor();
    case 'stats':        return stats();
    case 'sessionstart': return sessionstart();
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

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
pnpm --filter predicate-cli test sessionstart
```

Expected: PASS (2 tests). If fuseki is down, you must first `predicate up`. If still failing, check the SparqlClient import path matches the existing `stats.ts` pattern.

- [ ] **Step 6: Manually smoke-test against live fuseki**

```bash
predicate up
predicate sessionstart
```

Expected output (single line):

```
Predicate ready: 0 active goals, N TBox classes. Use kg_explore_schema before drafting SPARQL.
```

(Where N is the count from the seeded TBox — should be > 0.)

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/index.ts packages/predicate-cli/src/commands/sessionstart.ts packages/predicate-cli/test/sessionstart.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add `predicate sessionstart` subcommand

Emits a single-line KG status banner used by per-platform hook scripts.
Mirrors the SPARQL queries that hooks/session-start.sh runs today, so the
existing Claude Code hook can be refactored to share this source of truth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `predicate maintain` CLI subcommand

**Files:**
- Create: `packages/predicate-cli/src/commands/maintain.ts`
- Create: `packages/predicate-cli/test/maintain.test.ts`
- Modify: `packages/predicate-cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/test/maintain.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { maintain } from '../src/commands/maintain.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';

describe('predicate maintain', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    const client = new SparqlClient(loadConfig());
    await client.update(`CREATE SILENT GRAPH <kg:abox>`);
    await client.update(`CREATE SILENT GRAPH <kg:provenance>`);
    await client.update(`CREATE SILENT GRAPH <kg:meta>`);
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errSpy?.mockRestore();
  });

  it('runs the maintenance pass and prints a one-line summary', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await maintain();
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]![0] as string;
    expect(line).toMatch(/^predicate maintain: archived=\d+ proposals=\d+ promotions=\d+ elapsed=\d+ms event=urn:predicate:event:/);
  });

  it('returns 1 and prints to stderr when fuseki is unreachable', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orig = process.env['FUSEKI_URL'];
    process.env['FUSEKI_URL'] = 'http://127.0.0.1:1';
    try {
      const code = await maintain();
      expect(code).toBe(1);
      expect(errSpy).toHaveBeenCalled();
      const errLine = errSpy.mock.calls[0]![0] as string;
      expect(errLine).toContain('predicate maintain failed');
    } finally {
      if (orig !== undefined) process.env['FUSEKI_URL'] = orig;
      else delete process.env['FUSEKI_URL'];
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter predicate-cli test maintain
```

Expected: FAIL with `Cannot find module '../src/commands/maintain.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/predicate-cli/src/commands/maintain.ts`:

```typescript
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgMaintain } from 'predicate-mcp/src/tools/kg-maintain.js';

export async function maintain(): Promise<number> {
  try {
    const client = new SparqlClient(loadConfig());
    const result = await kgMaintain(client, {});
    const proposals = result.generalizer?.proposals.length ?? 0;
    const promotions = result.sweeper?.decisions.filter((d) => d.action === 'promote').length ?? 0;
    console.log(
      `predicate maintain: archived=${result.archivedCount} proposals=${proposals} promotions=${promotions} elapsed=${result.elapsedMs}ms event=${result.eventId}`,
    );
    return 0;
  } catch (err) {
    console.error(`predicate maintain failed: ${(err as Error).message}`);
    return 1;
  }
}
```

- [ ] **Step 4: Wire the subcommand into the CLI dispatcher**

Modify `packages/predicate-cli/src/index.ts`. Add the maintain import after the existing sessionstart import:

```typescript
#!/usr/bin/env node
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { doctor } from './commands/doctor.js';
import { stats } from './commands/stats.js';
import { sessionstart } from './commands/sessionstart.js';
import { maintain } from './commands/maintain.js';
```

Update the `help()` function — add `maintain` line under `sessionstart`:

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
  --version      Print the predicate version.
  --help         This message.

Env:
  FUSEKI_URL                http://localhost:3030 (default)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
`);
}
```

Update the switch:

```typescript
  switch (cmd) {
    case 'up':           return up();
    case 'down':         return down();
    case 'doctor':       return doctor();
    case 'stats':        return stats();
    case 'sessionstart': return sessionstart();
    case 'maintain':     return maintain();
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

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter predicate-cli test
```

Expected: PASS for both `sessionstart` and `maintain` test suites (4 tests total).

- [ ] **Step 6: Manually smoke-test against live fuseki**

```bash
predicate up
predicate maintain
```

Expected output (single line):

```
predicate maintain: archived=0 proposals=0 promotions=0 elapsed=42ms event=urn:predicate:event:l...
```

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/index.ts packages/predicate-cli/src/commands/maintain.ts packages/predicate-cli/test/maintain.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add `predicate maintain` subcommand

Wraps kgMaintain (reaper + generalizer + promotion sweeper) for invocation
from hook scripts on PreCompact/Stop events across platforms. Prints a
single-line summary; returns exit 1 if fuseki is unreachable so hook
scripts can decide whether to surface the error.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Refactor Claude Code SessionStart hook to use CLI

**Files:**
- Modify: `packages/predicate-skill/hooks/session-start.sh`

The existing script (lines 1-26) duplicates the SPARQL queries that now live in `predicate sessionstart`. Replace its body so Claude Code shares the new source of truth.

- [ ] **Step 1: Replace the script body**

Modify `packages/predicate-skill/hooks/session-start.sh`. Read the existing file first, then replace its entire contents with:

```bash
#!/usr/bin/env bash
# SessionStart hook for Claude Code: emits a short context block telling
# the agent what's in the KG. Delegates to `predicate sessionstart` so the
# message format stays in one place.
set -euo pipefail

if MSG="$(predicate sessionstart 2>/dev/null)"; then
  :
else
  MSG="Predicate: Fuseki not reachable; KG tools may fail. Start it with \`predicate up\`."
fi

jq -n --arg m "$MSG" '{ additional_context: $m }'
```

- [ ] **Step 2: Verify the script is still executable**

```bash
ls -l /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/session-start.sh
```

Expected: file mode begins with `-rwxr-xr-x` (executable bit set). If not, run:

```bash
chmod +x /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/session-start.sh
```

- [ ] **Step 3: Smoke-test the script against live fuseki**

```bash
predicate up
bash /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/session-start.sh
```

Expected output (JSON, one line):

```json
{"additional_context":"Predicate ready: 0 active goals, N TBox classes. Use kg_explore_schema before drafting SPARQL."}
```

- [ ] **Step 4: Smoke-test the fallback path**

```bash
predicate down
FUSEKI_URL=http://127.0.0.1:1 bash /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/session-start.sh
```

Expected output:

```json
{"additional_context":"Predicate: Fuseki not reachable; KG tools may fail. Start it with `predicate up`."}
```

Then bring fuseki back up:

```bash
predicate up
```

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-skill/hooks/session-start.sh
git commit -m "$(cat <<'EOF'
refactor(skill): claude-code session-start uses `predicate sessionstart`

Eliminates duplicated SPARQL between the bash hook and the new CLI
subcommand. Behavior unchanged for Claude Code users; the script is
now ~10 lines instead of 26.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Cursor hook adapter

**Files:**
- Create: `packages/predicate-skill/hooks/cursor/session-start.sh`
- Create: `packages/predicate-skill/hooks/cursor/pre-compact.sh`
- Create: `packages/predicate-skill/hooks/cursor/stop.sh`
- Create: `packages/predicate-skill/hooks/cursor/mcp.json.template`
- Create: `packages/predicate-skill/hooks/cursor/README.md`

Cursor has no lifecycle hook events as of writing. The session-start script is intended to be run manually (or its output pasted into `.cursor/rules/predicate.md`). The pre-compact and stop scripts are intended to be wired to user cron jobs.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/cursor
```

- [ ] **Step 2: Create `session-start.sh`**

Create `packages/predicate-skill/hooks/cursor/session-start.sh`:

```bash
#!/usr/bin/env bash
# Cursor session-start adapter: emits a plain text status line.
# Cursor reads stdout when invoked from a custom rule script;
# can also be run manually and pasted into .cursor/rules/predicate.md.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
```

- [ ] **Step 3: Create `pre-compact.sh`**

Create `packages/predicate-skill/hooks/cursor/pre-compact.sh`:

```bash
#!/usr/bin/env bash
# Cursor pre-compact adapter: trims low-confidence stale facts and
# promotes any matured staged TBox proposals before context compaction.
# Cursor has no native PreCompact event — run manually or via cron, e.g.:
#   */30 * * * * /path/to/hooks/cursor/pre-compact.sh
set -euo pipefail
predicate maintain
```

- [ ] **Step 4: Create `stop.sh`**

Create `packages/predicate-skill/hooks/cursor/stop.sh`:

```bash
#!/usr/bin/env bash
# Cursor session-end adapter: runs maintenance on session close.
# Cursor has no native Stop event — run manually after each session.
set -euo pipefail
predicate maintain
```

- [ ] **Step 5: Mark all three scripts executable**

```bash
chmod +x /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/cursor/*.sh
```

- [ ] **Step 6: Create the MCP config template**

Create `packages/predicate-skill/hooks/cursor/mcp.json.template`:

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
  }
}
```

- [ ] **Step 7: Create the per-platform README**

Create `packages/predicate-skill/hooks/cursor/README.md`:

```markdown
# Cursor adapter

Predicate exposes its 8 `kg_*` tools to Cursor over MCP, plus three optional
maintenance scripts you can wire into cron.

## 1. MCP server

Copy `mcp.json.template` to `.cursor/mcp.json` (project-local) or
`~/.cursor/mcp.json` (global), replacing `__PLUGIN_DIR__` with the absolute
path to your local clone, e.g. `/Users/you/code/predicate/packages/predicate-skill`.

Then in Cursor restart MCP (Cmd-Shift-P → "Reload MCP servers") and the 8
`kg_*` tools will be available.

## 2. Optional: SessionStart context

Cursor has no native SessionStart event. Two options:

**a. Manual:** Run `bash session-start.sh` in your terminal; paste the
output into `.cursor/rules/predicate.md`.

**b. Cron:** Refresh the rule file periodically:

```cron
*/10 * * * * bash /absolute/path/hooks/cursor/session-start.sh > /project/.cursor/rules/predicate.md
```

## 3. Optional: PreCompact maintenance

Cursor has no native PreCompact event. Wire `pre-compact.sh` to cron so the
KG stays tidy between sessions:

```cron
*/30 * * * * /absolute/path/hooks/cursor/pre-compact.sh >/dev/null 2>&1
```

## 4. Optional: Stop maintenance

Run `bash stop.sh` manually after a long session, or wire it into a shell
shutdown alias.

## Notes

All scripts require `predicate` on `$PATH`. Install with
`npm install -g predicate-skill`, or use the absolute path:
`/abs/path/to/predicate/packages/predicate-skill/cli.bundle.mjs`.
```

- [ ] **Step 8: Smoke-test each script**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
predicate up
bash packages/predicate-skill/hooks/cursor/session-start.sh
bash packages/predicate-skill/hooks/cursor/pre-compact.sh
bash packages/predicate-skill/hooks/cursor/stop.sh
```

Expected for `session-start.sh` (single line):

```
Predicate ready: 0 active goals, N TBox classes. Use kg_explore_schema before drafting SPARQL.
```

Expected for `pre-compact.sh` and `stop.sh`:

```
predicate maintain: archived=0 proposals=0 promotions=0 elapsed=...ms event=urn:predicate:event:...
```

- [ ] **Step 9: shellcheck (if available)**

```bash
which shellcheck && shellcheck /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/cursor/*.sh
```

Expected: no findings, or `shellcheck not found` (acceptable — not a hard dependency).

- [ ] **Step 10: Commit**

```bash
git add packages/predicate-skill/hooks/cursor
git commit -m "$(cat <<'EOF'
feat(skill): add cursor hook adapter

Three thin scripts (session-start, pre-compact, stop) plus an mcp.json
template and a per-platform README. Cursor has no native lifecycle
events, so the README documents both manual and cron wiring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Gemini CLI hook adapter

**Files:**
- Create: `packages/predicate-skill/hooks/gemini-cli/session-start.sh`
- Create: `packages/predicate-skill/hooks/gemini-cli/pre-compact.sh`
- Create: `packages/predicate-skill/hooks/gemini-cli/stop.sh`
- Create: `packages/predicate-skill/hooks/gemini-cli/settings.json.template`
- Create: `packages/predicate-skill/hooks/gemini-cli/README.md`

Gemini CLI supports MCP servers in `~/.gemini/settings.json` and (in recent versions) a `hooks` block that mirrors Claude Code's lifecycle event model. If the hooks block isn't supported in the user's Gemini version, the scripts still work standalone or via cron.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/gemini-cli
```

- [ ] **Step 2: Create `session-start.sh`**

Create `packages/predicate-skill/hooks/gemini-cli/session-start.sh`:

```bash
#!/usr/bin/env bash
# Gemini CLI session-start adapter. Gemini reads stdout as additional context
# when wired via the `hooks` block in ~/.gemini/settings.json (event: "sessionStart").
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
```

- [ ] **Step 3: Create `pre-compact.sh`**

Create `packages/predicate-skill/hooks/gemini-cli/pre-compact.sh`:

```bash
#!/usr/bin/env bash
# Gemini CLI pre-compress adapter: runs maintenance before Gemini compacts
# the chat context. Wire to the `preCompress` event in settings.json.
set -euo pipefail
predicate maintain
```

- [ ] **Step 4: Create `stop.sh`**

Create `packages/predicate-skill/hooks/gemini-cli/stop.sh`:

```bash
#!/usr/bin/env bash
# Gemini CLI stop adapter: runs maintenance on session close.
# Wire to the `stop` event in settings.json.
set -euo pipefail
predicate maintain
```

- [ ] **Step 5: Mark all three scripts executable**

```bash
chmod +x /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/gemini-cli/*.sh
```

- [ ] **Step 6: Create the settings template**

Create `packages/predicate-skill/hooks/gemini-cli/settings.json.template`:

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
    { "event": "stop",         "command": "bash __PLUGIN_DIR__/hooks/gemini-cli/stop.sh" }
  ]
}
```

- [ ] **Step 7: Create the per-platform README**

Create `packages/predicate-skill/hooks/gemini-cli/README.md`:

```markdown
# Gemini CLI adapter

## Install

Merge `settings.json.template` into `~/.gemini/settings.json`, replacing
`__PLUGIN_DIR__` with the absolute path to this package
(e.g. `/Users/you/code/predicate/packages/predicate-skill`).

Restart Gemini CLI. The 8 `kg_*` tools will be available; the three hook
scripts will fire on `sessionStart`, `preCompress`, and `stop`.

## Hooks reference

| Event | Script | What it does |
|---|---|---|
| `sessionStart` | `session-start.sh` | Prints KG status line; Gemini reads stdout as context. |
| `preCompress` | `pre-compact.sh` | Runs `predicate maintain` before context compression. |
| `stop` | `stop.sh` | Runs `predicate maintain` on session close. |

## If your Gemini version doesn't expose hooks

The `hooks` block is harmless if unsupported. You can still run each script
manually or via cron — see `../cursor/README.md` for cron examples; the
syntax is identical.

## Verify wiring

Run `gemini --debug` and start a fresh session; you should see Predicate's
KG status line printed in the debug output before your first prompt.
```

- [ ] **Step 8: Smoke-test each script**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
predicate up
bash packages/predicate-skill/hooks/gemini-cli/session-start.sh
bash packages/predicate-skill/hooks/gemini-cli/pre-compact.sh
bash packages/predicate-skill/hooks/gemini-cli/stop.sh
```

Expected for `session-start.sh`:

```
Predicate ready: 0 active goals, N TBox classes. Use kg_explore_schema before drafting SPARQL.
```

Expected for `pre-compact.sh` and `stop.sh`:

```
predicate maintain: archived=0 proposals=0 promotions=0 elapsed=...ms event=urn:predicate:event:...
```

- [ ] **Step 9: Commit**

```bash
git add packages/predicate-skill/hooks/gemini-cli
git commit -m "$(cat <<'EOF'
feat(skill): add gemini-cli hook adapter

Three scripts + a settings template wiring sessionStart, preCompress,
and stop events to predicate's sessionstart/maintain CLI commands.
Falls back gracefully if the hooks block isn't supported in older
Gemini versions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: VS Code Copilot hook adapter

**Files:**
- Create: `packages/predicate-skill/hooks/vscode-copilot/session-start.sh`
- Create: `packages/predicate-skill/hooks/vscode-copilot/pre-compact.sh`
- Create: `packages/predicate-skill/hooks/vscode-copilot/stop.sh`
- Create: `packages/predicate-skill/hooks/vscode-copilot/settings.json.template`
- Create: `packages/predicate-skill/hooks/vscode-copilot/README.md`

VS Code Copilot Chat exposes MCP servers via the `github.copilot.chat.mcp.servers` settings key. It does not expose lifecycle events for SessionStart/PreCompact/Stop; the scripts ship anyway for manual/cron use and for forward-compat if VS Code adds events later.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/vscode-copilot
```

- [ ] **Step 2: Create `session-start.sh`**

Create `packages/predicate-skill/hooks/vscode-copilot/session-start.sh`:

```bash
#!/usr/bin/env bash
# VS Code Copilot session-start adapter. VS Code has no native SessionStart
# hook today — run this manually before invoking Copilot Chat, or wire it
# to a VS Code task in tasks.json.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
```

- [ ] **Step 3: Create `pre-compact.sh`**

Create `packages/predicate-skill/hooks/vscode-copilot/pre-compact.sh`:

```bash
#!/usr/bin/env bash
# VS Code Copilot pre-compact adapter. Run via cron or a VS Code task.
set -euo pipefail
predicate maintain
```

- [ ] **Step 4: Create `stop.sh`**

Create `packages/predicate-skill/hooks/vscode-copilot/stop.sh`:

```bash
#!/usr/bin/env bash
# VS Code Copilot stop adapter. Run manually after a long chat session
# or wire to a VS Code task that runs on workspace close.
set -euo pipefail
predicate maintain
```

- [ ] **Step 5: Mark all three scripts executable**

```bash
chmod +x /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/vscode-copilot/*.sh
```

- [ ] **Step 6: Create the settings template**

Create `packages/predicate-skill/hooks/vscode-copilot/settings.json.template`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "predicate": {
      "command": "node",
      "args": ["__PLUGIN_DIR__/server.bundle.mjs"],
      "env": {
        "FUSEKI_URL": "http://localhost:3030",
        "PREDICATE_DATASET": "predicate"
      }
    }
  }
}
```

- [ ] **Step 7: Create the per-platform README**

Create `packages/predicate-skill/hooks/vscode-copilot/README.md`:

```markdown
# VS Code Copilot adapter

## Install MCP server

Merge `settings.json.template` into your VS Code `settings.json`
(User or Workspace), replacing `__PLUGIN_DIR__` with the absolute path
to this package. Restart VS Code. The 8 `kg_*` tools will be available
to Copilot Chat.

## Hooks

VS Code Copilot does not expose SessionStart, PreCompact, or Stop
lifecycle events as of writing. The three scripts in this directory
are provided so you can:

1. Run `session-start.sh` manually before opening Copilot Chat and
   paste the output into a prompt as initial context.

2. Wire `pre-compact.sh` and `stop.sh` to cron for periodic KG
   maintenance — see `../cursor/README.md` for cron examples.

3. Use them in VS Code tasks (`.vscode/tasks.json`):

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "predicate: session start",
      "type": "shell",
      "command": "bash ${workspaceFolder}/packages/predicate-skill/hooks/vscode-copilot/session-start.sh"
    },
    {
      "label": "predicate: maintain",
      "type": "shell",
      "command": "bash ${workspaceFolder}/packages/predicate-skill/hooks/vscode-copilot/pre-compact.sh"
    }
  ]
}
```

If VS Code adds lifecycle hooks for Copilot Chat in the future, this
adapter is ready to wire them — script logic is unchanged.
```

- [ ] **Step 8: Smoke-test each script**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
predicate up
bash packages/predicate-skill/hooks/vscode-copilot/session-start.sh
bash packages/predicate-skill/hooks/vscode-copilot/pre-compact.sh
bash packages/predicate-skill/hooks/vscode-copilot/stop.sh
```

Expected: same outputs as Task 5 Step 8.

- [ ] **Step 9: Commit**

```bash
git add packages/predicate-skill/hooks/vscode-copilot
git commit -m "$(cat <<'EOF'
feat(skill): add vscode-copilot hook adapter

Three scripts + a settings.json template for github.copilot.chat.mcp.servers.
VS Code has no SessionStart/PreCompact/Stop events for Copilot Chat as of
writing; README documents manual + VS Code task wiring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: OpenCode hook adapter

**Files:**
- Create: `packages/predicate-skill/hooks/opencode/session-start.sh`
- Create: `packages/predicate-skill/hooks/opencode/pre-compact.sh`
- Create: `packages/predicate-skill/hooks/opencode/stop.sh`
- Create: `packages/predicate-skill/hooks/opencode/opencode.json.template`
- Create: `packages/predicate-skill/hooks/opencode/README.md`

OpenCode supports MCP servers and a session-events plugin model in `opencode.json`. Event names below (`session.started`, `session.compacted`, `session.stopped`) reflect the plugin API; verify against the OpenCode version targeted at implementation time.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/opencode
```

- [ ] **Step 2: Create `session-start.sh`**

Create `packages/predicate-skill/hooks/opencode/session-start.sh`:

```bash
#!/usr/bin/env bash
# OpenCode session-start adapter. OpenCode reads stdout as additional context
# when wired to the session.started event.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
```

- [ ] **Step 3: Create `pre-compact.sh`**

Create `packages/predicate-skill/hooks/opencode/pre-compact.sh`:

```bash
#!/usr/bin/env bash
# OpenCode pre-compact adapter. Wire to the session.compacted event
# (fires immediately before OpenCode compresses chat history).
set -euo pipefail
predicate maintain
```

- [ ] **Step 4: Create `stop.sh`**

Create `packages/predicate-skill/hooks/opencode/stop.sh`:

```bash
#!/usr/bin/env bash
# OpenCode stop adapter. Wire to the session.stopped event.
set -euo pipefail
predicate maintain
```

- [ ] **Step 5: Mark all three scripts executable**

```bash
chmod +x /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/opencode/*.sh
```

- [ ] **Step 6: Create the OpenCode config template**

Create `packages/predicate-skill/hooks/opencode/opencode.json.template`:

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
    { "on": "session.stopped",   "run": "bash __PLUGIN_DIR__/hooks/opencode/stop.sh" }
  ]
}
```

- [ ] **Step 7: Create the per-platform README**

Create `packages/predicate-skill/hooks/opencode/README.md`:

```markdown
# OpenCode adapter

## Install

Merge `opencode.json.template` into `~/.config/opencode/opencode.json`
(or your project-local `opencode.json`), replacing `__PLUGIN_DIR__` with
the absolute path to this package.

Restart OpenCode. The 8 `kg_*` tools will be available, and the three
hook scripts will fire on `session.started`, `session.compacted`, and
`session.stopped`.

## Hooks reference

| Event | Script | What it does |
|---|---|---|
| `session.started` | `session-start.sh` | Prints KG status line; OpenCode reads stdout as context. |
| `session.compacted` | `pre-compact.sh` | Runs `predicate maintain` before context compression. |
| `session.stopped` | `stop.sh` | Runs `predicate maintain` on session close. |

## Verify wiring

Start an OpenCode session and check the debug log; you should see
Predicate's KG status line in the initial context, and `predicate maintain`
output when the session compacts or stops.

## If event names changed in your OpenCode version

Consult `opencode --help events` (or the OpenCode docs) for the current
event names. The scripts are event-agnostic — only the template's `on:`
keys need to match.
```

- [ ] **Step 8: Smoke-test each script**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
predicate up
bash packages/predicate-skill/hooks/opencode/session-start.sh
bash packages/predicate-skill/hooks/opencode/pre-compact.sh
bash packages/predicate-skill/hooks/opencode/stop.sh
```

Expected: same outputs as Task 5 Step 8.

- [ ] **Step 9: Commit**

```bash
git add packages/predicate-skill/hooks/opencode
git commit -m "$(cat <<'EOF'
feat(skill): add opencode hook adapter

Three scripts + an opencode.json template wiring session.started,
session.compacted, and session.stopped events to predicate's
sessionstart/maintain CLI commands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Codex CLI hook adapter

**Files:**
- Create: `packages/predicate-skill/hooks/codex-cli/session-start.sh`
- Create: `packages/predicate-skill/hooks/codex-cli/pre-compact.sh`
- Create: `packages/predicate-skill/hooks/codex-cli/stop.sh`
- Create: `packages/predicate-skill/hooks/codex-cli/config.toml.template`
- Create: `packages/predicate-skill/hooks/codex-cli/README.md`

Codex CLI configures MCP servers in `~/.codex/config.toml`. As of writing, Codex CLI does not expose SessionStart/PreCompact/Stop lifecycle hooks — the scripts ship for manual / cron / shell-alias use.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/codex-cli
```

- [ ] **Step 2: Create `session-start.sh`**

Create `packages/predicate-skill/hooks/codex-cli/session-start.sh`:

```bash
#!/usr/bin/env bash
# Codex CLI session-start adapter. Codex has no native SessionStart event;
# run this manually before a session and paste the output as initial context,
# or alias it to `codex` in your shell rc.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
```

- [ ] **Step 3: Create `pre-compact.sh`**

Create `packages/predicate-skill/hooks/codex-cli/pre-compact.sh`:

```bash
#!/usr/bin/env bash
# Codex CLI pre-compact adapter: run via cron to keep the KG tidy.
set -euo pipefail
predicate maintain
```

- [ ] **Step 4: Create `stop.sh`**

Create `packages/predicate-skill/hooks/codex-cli/stop.sh`:

```bash
#!/usr/bin/env bash
# Codex CLI stop adapter: run manually after long sessions.
set -euo pipefail
predicate maintain
```

- [ ] **Step 5: Mark all three scripts executable**

```bash
chmod +x /Users/mx/Documents/Work/MX/Research/predicate/packages/predicate-skill/hooks/codex-cli/*.sh
```

- [ ] **Step 6: Create the Codex CLI config template**

Create `packages/predicate-skill/hooks/codex-cli/config.toml.template`:

```toml
# Merge into ~/.codex/config.toml — replace __PLUGIN_DIR__ with the
# absolute path to packages/predicate-skill.

[mcp_servers.predicate]
command = "node"
args = ["__PLUGIN_DIR__/server.bundle.mjs"]

[mcp_servers.predicate.env]
FUSEKI_URL = "http://localhost:3030"
PREDICATE_DATASET = "predicate"
```

- [ ] **Step 7: Create the per-platform README**

Create `packages/predicate-skill/hooks/codex-cli/README.md`:

```markdown
# Codex CLI adapter

## Install MCP server

Merge `config.toml.template` into `~/.codex/config.toml`, replacing
`__PLUGIN_DIR__` with the absolute path to this package. The 8 `kg_*`
tools will be available the next time you launch `codex`.

## Hooks

Codex CLI does not expose SessionStart, PreCompact, or Stop lifecycle
events as of writing. The three scripts in this directory are provided
so you can:

1. Run `session-start.sh` manually and paste output into your initial
   Codex prompt. Or alias:

```sh
# in ~/.zshrc or ~/.bashrc
codex() { command codex --context "$(predicate sessionstart 2>/dev/null)" "$@"; }
```

2. Wire `pre-compact.sh` and `stop.sh` to cron for periodic maintenance:

```cron
*/30 * * * * /absolute/path/hooks/codex-cli/pre-compact.sh >/dev/null 2>&1
```

If Codex CLI adds lifecycle hooks in the future, this adapter is ready
to wire them — script logic is unchanged.
```

- [ ] **Step 8: Smoke-test each script**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
predicate up
bash packages/predicate-skill/hooks/codex-cli/session-start.sh
bash packages/predicate-skill/hooks/codex-cli/pre-compact.sh
bash packages/predicate-skill/hooks/codex-cli/stop.sh
```

Expected: same outputs as Task 5 Step 8.

- [ ] **Step 9: Commit**

```bash
git add packages/predicate-skill/hooks/codex-cli
git commit -m "$(cat <<'EOF'
feat(skill): add codex-cli hook adapter

Three scripts + a config.toml template for ~/.codex/config.toml.
Codex CLI has no lifecycle events as of writing; README documents
manual + shell-alias + cron wiring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: README updates + version bump + tag v1.3.0-platform-hooks

**Files:**
- Modify: `README.md`
- Modify: `packages/predicate-skill/package.json`
- Modify: `packages/predicate-skill/.claude-plugin/marketplace.json`

- [ ] **Step 1: Replace the Cursor block in `README.md`**

Find the Cursor `<details>` block (around lines 34-59 of `README.md`) and replace its body so it points users to the new adapter:

```markdown
<details>
<summary><strong>Cursor</strong> — MCP + 3 maintenance scripts</summary>

```bash
# 1. Clone + bundle
git clone https://github.com/NordicAgents/predicate
cd predicate && pnpm install && pnpm build

# 2. Copy the MCP config
cp packages/predicate-skill/hooks/cursor/mcp.json.template ~/.cursor/mcp.json
# Edit ~/.cursor/mcp.json: replace __PLUGIN_DIR__ with the absolute path to
# this checkout's packages/predicate-skill directory.

# 3. Start fuseki
predicate up
```

Restart Cursor's MCP servers (Cmd-Shift-P → "Reload MCP servers"). The 8
`kg_*` tools are now available. See
`packages/predicate-skill/hooks/cursor/README.md` for optional cron wiring
of the SessionStart, PreCompact, and Stop scripts.

</details>
```

- [ ] **Step 2: Replace the Gemini-flavored block in `README.md`**

Currently `README.md` lines 94-127 describe a generic Any-MCP block that includes Gemini settings. Replace it with two separate blocks: a Gemini-specific block, then a generic any-MCP fallback.

Find the line beginning with `<summary><strong>Any-MCP / Gemini CLI / Codex CLI / generic</strong></summary>` and replace that entire `<details>` block (through its closing `</details>`) with these three blocks (Gemini, Codex, generic):

```markdown
<details>
<summary><strong>Gemini CLI</strong> — MCP + SessionStart + PreCompress + Stop hooks</summary>

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate && pnpm install && pnpm build
predicate up

# Merge packages/predicate-skill/hooks/gemini-cli/settings.json.template
# into ~/.gemini/settings.json. Replace __PLUGIN_DIR__ with the absolute
# path to this checkout's packages/predicate-skill directory.
```

See `packages/predicate-skill/hooks/gemini-cli/README.md` for details
on the three hook events.

</details>

<details>
<summary><strong>VS Code Copilot</strong> — MCP via settings.json</summary>

Merge `packages/predicate-skill/hooks/vscode-copilot/settings.json.template`
into your VS Code `settings.json`, replacing `__PLUGIN_DIR__`. Restart
VS Code. The 8 `kg_*` tools are available to Copilot Chat. VS Code does
not currently expose SessionStart/PreCompact/Stop events; see the
adapter README for manual + VS Code task wiring of the maintenance
scripts.

</details>

<details>
<summary><strong>OpenCode</strong> — MCP + session.started + session.compacted + session.stopped hooks</summary>

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate && pnpm install && pnpm build
predicate up

# Merge packages/predicate-skill/hooks/opencode/opencode.json.template
# into ~/.config/opencode/opencode.json. Replace __PLUGIN_DIR__ with the
# absolute path to this checkout's packages/predicate-skill directory.
```

See `packages/predicate-skill/hooks/opencode/README.md` for details
on the three plugin events.

</details>

<details>
<summary><strong>Codex CLI</strong> — MCP via ~/.codex/config.toml</summary>

Merge `packages/predicate-skill/hooks/codex-cli/config.toml.template`
into `~/.codex/config.toml`, replacing `__PLUGIN_DIR__`. The 8 `kg_*`
tools are available the next time you launch `codex`. Codex CLI has no
lifecycle events yet; see the adapter README for manual + shell-alias
wiring of the maintenance scripts.

</details>

<details>
<summary><strong>Any-MCP / generic</strong></summary>

Any client that speaks MCP over stdio can use the bundled server directly:

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate && pnpm install && pnpm build
predicate up

# Then point your MCP-capable tool at:
#   node /absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
# with env FUSEKI_URL=http://localhost:3030 PREDICATE_DATASET=predicate
```

</details>
```

- [ ] **Step 3: Remove the stale "hook adapters are Claude-Code-only" sentence**

The old generic block contained the sentence:

> Hook adapters (`BeforeTool`/`AfterTool` integration like context-mode has)
> are Claude-Code-only in v1.2. Other platforms get the 8 `kg_*` tools, which
> work without hooks.

Step 2 removed it as part of replacing the block. Verify it's gone:

```bash
grep -n "Claude-Code-only" /Users/mx/Documents/Work/MX/Research/predicate/README.md
```

Expected: no output (sentence is gone).

- [ ] **Step 4: Update the "Status" section in `README.md`**

Find the `## Status` heading (around line 200) and replace its body with:

```markdown
## Status

**v1.3 — multi-platform hooks.** Distributable via Claude Code marketplace,
Cursor, Continue.dev, OpenCode, Gemini CLI, VS Code Copilot, Codex CLI,
and any generic MCP client. Per-platform SessionStart + PreCompact + Stop
hook adapters shipped. npm publish flow verified.

Earlier milestones (in order): `v0.1.0-foundation` → `v0.2.0-discipline` →
`v0.3a.0-goals-and-gaps` → `v0.3b.0-research-execution` →
`v0.3c.0-schema-evolution` → `v1.0.0` → `v1.1.0-distribution` →
`v1.2.0-multiplatform` → `v1.3.0-platform-hooks`.

Deferred to v1.4 (see spec §17): PreToolUse / PostToolUse hooks (Phase 8,
adds `kg_capture` tool); materialization caching; tag-while-deriving for
`kg_explain`; intent-aware `ResearchSource` filtering; journal-based
cross-system promotion atomicity; LLM-augmented decomposer + extractor.
```

- [ ] **Step 5: Bump version in `packages/predicate-skill/package.json`**

Find the `"version": "1.2.0"` line in `packages/predicate-skill/package.json` and replace with `"version": "1.3.0"`:

```json
{
  "name": "predicate-skill",
  "version": "1.3.0",
  ...
}
```

- [ ] **Step 6: Bump versions in `marketplace.json`**

Find both occurrences of `"version": "1.0.0"` in `packages/predicate-skill/.claude-plugin/marketplace.json` (or the current values — confirm by reading the file first) and bump both to `"version": "1.3.0"`:

```json
{
  "name": "predicate",
  "owner": {
    "name": "Nordic Agents Research",
    "email": "midhunxavier@outlook.com"
  },
  "metadata": {
    "description": "Predicate — local reasoning knowledge graph for AI agents",
    "version": "1.3.0"
  },
  "plugins": [
    {
      "name": "predicate",
      "source": "./packages/predicate-skill",
      "description": "Local RDF/OWL knowledge graph with 16-rule reasoner, agent loop, schema-evolution gates, and the 8 kg_* MCP tools.",
      "version": "1.3.0",
      "author": { "name": "Nordic Agents Research" },
      "category": "knowledge-graph",
      "keywords": ["mcp", "rdf", "owl", "sparql", "reasoning", "agent"]
    }
  ]
}
```

Wait — this plan's worktree may already be at marketplace.json version 1.0.0 (we never bumped it during v1.1/v1.2). If so, jumping straight to 1.3.0 is the right move and matches the package.json. Verify by reading the file first.

- [ ] **Step 7: Run the full test suite**

```bash
cd /Users/mx/Documents/Work/MX/Research/predicate
pnpm test
```

Expected: ALL existing tests pass + the 4 new CLI tests pass. If any pre-existing test fails, fix it before continuing — do not let unrelated failures slip in under this phase.

- [ ] **Step 8: Rebuild the bundle**

```bash
pnpm --filter predicate-skill run bundle
ls -l packages/predicate-skill/server.bundle.mjs packages/predicate-skill/cli.bundle.mjs
```

Expected:
- `server.bundle.mjs` ~1.5MB, mode `-rw-r--r--` (not executable; loaded as a module).
- `cli.bundle.mjs` ~9.8KB plus the new ~3KB for sessionstart + maintain commands, mode `-rwxr-xr-x` (executable bit set — required because it's the `bin` entry).

- [ ] **Step 9: Smoke-test the bundled CLI directly**

```bash
node packages/predicate-skill/cli.bundle.mjs sessionstart
node packages/predicate-skill/cli.bundle.mjs maintain
```

Expected: same outputs as the dev `predicate sessionstart` / `predicate maintain` runs.

- [ ] **Step 10: Commit**

```bash
git add README.md packages/predicate-skill/package.json packages/predicate-skill/.claude-plugin/marketplace.json packages/predicate-skill/server.bundle.mjs packages/predicate-skill/cli.bundle.mjs
git commit -m "$(cat <<'EOF'
chore(release): v1.3.0 — multi-platform hook adapters

- README install matrix updated: Cursor / Gemini CLI / VS Code Copilot
  / OpenCode / Codex CLI each get their own block with hook scripts.
- Remove stale "hook adapters are Claude-Code-only" disclaimer.
- Bump predicate-skill package.json + marketplace.json to 1.3.0.
- Rebuild bundles (server.bundle.mjs + cli.bundle.mjs) including the
  new sessionstart + maintain CLI subcommands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 11: Tag v1.3.0-platform-hooks**

```bash
git tag -a v1.3.0-platform-hooks -m "Predicate v1.3.0 — per-platform hook adapters (Gemini CLI, Cursor, VS Code Copilot, OpenCode, Codex CLI)"
git tag --list 'v*'
```

Expected: the new tag appears in the list alongside `v1.2.0-multiplatform` and earlier.

Do NOT push the tag yet; the user controls when to push to GitHub.

---

## Self-Review

### Spec coverage

This plan covers the Phase 7 scope confirmed by the user:
- ✅ 5 platforms (Gemini CLI, Cursor, VS Code Copilot, OpenCode, Codex CLI) — Tasks 4, 5, 6, 7, 8
- ✅ 3 events per platform (SessionStart, PreCompact, Stop) — each task creates exactly those 3 scripts
- ✅ Architecture: per-platform hook scripts (15 thin shell scripts total) — verified file structure
- ✅ Per-platform settings/config templates in `hooks/<platform>/` — each task includes a template
- ✅ README updates with hook config per platform — Task 9
- ✅ Tag v1.3.0-platform-hooks at completion — Task 9 Step 11
- ✅ PreToolUse / PostToolUse deferred to Phase 8 — explicitly noted in Goal + README Status section

Two additional pieces of scaffolding the user didn't explicitly request but are necessary to make the scripts work:
- The new CLI subcommands `predicate sessionstart` and `predicate maintain` (Tasks 1, 2). Without these the scripts have nothing to call into.
- The Claude Code refactor in Task 3, which is one-line behavior-preserving and eliminates the DRY violation between bash and CLI.

### Placeholder scan

Searched plan for: `TBD`, `TODO`, `implement later`, `add appropriate`, `add validation`, `handle edge cases`, `similar to task`. None found in execution steps. The README block in Task 9 includes an explicit `__PLUGIN_DIR__` placeholder, which is intentional — that's a literal template marker users substitute at install time.

### Type / name consistency

- `sessionstart()` returns `Promise<number>` (Task 1) — matches the `up/down/doctor/stats` pattern in `packages/predicate-cli/src/commands/`.
- `maintain()` returns `Promise<number>` (Task 2) — same pattern.
- `kgMaintain(client, input)` import path `predicate-mcp/src/tools/kg-maintain.js` — verified against actual file existing at `packages/predicate-mcp/src/tools/kg-maintain.ts` (line 25 exports it).
- Result shape `{ archivedCount, elapsedMs, eventId, sweeper, generalizer }` (Task 2 Step 3) — verified against `kgMaintain` return type at line 17-23.
- `sweeper.decisions` filtering by `d.action === 'promote'` (Task 2 Step 3) — implementing engineer should verify this matches the actual SweeperResult.decisions[].action field. If the field name differs, adjust accordingly; the test in Task 2 Step 1 covers it by matching `/promotions=\d+/` rather than specific count.
- Script file names consistent across all 5 platforms: `session-start.sh`, `pre-compact.sh`, `stop.sh`.
- Template file extension consistent: `.template` suffix for all 5 platform config templates.
