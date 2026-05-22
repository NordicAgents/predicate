# Multi-Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Predicate install and run cleanly on Codex CLI, Gemini CLI, VS Code Copilot, and Cursor — building on the working Claude Code path, with per-platform adapters generated from a single source so they cannot silently rot.

**Architecture:** One portable core (the `server.bundle.mjs` MCP server + `predicate` CLI). Per-platform shells (manifests, hook wiring, instruction files) are *generated* from canonical sources by `scripts/gen-adapters.mjs`, which the `bundle` step runs and verifies. Tier 1 (Claude/Codex/Gemini) shares skills + hooks + MCP; Tier 2 (VS Code/Cursor) gets MCP registration + an instruction file via a new `predicate install <platform>` subcommand. OpenCode is removed entirely.

**Tech Stack:** Node 20 ESM, esbuild (bundling), Vitest (tests, run via `pnpm --filter <pkg> test`), TypeScript. Shell (bash) hook scripts. JSON/TOML manifests.

**Spec:** `docs/superpowers/specs/2026-05-22-multi-agent-integration-design.md`

**All paths below are relative to the repo root** `/Users/mx/Documents/Work/MX/Research/predicate` unless noted. The skill package root is `packages/predicate-skill/`.

---

## Phase 1 — Cross-cutting correctness fixes

These unblock every platform. Do them first.

### Task 1: Remove the OpenCode `extract --platform` adapter

**Files:**
- Modify: `packages/predicate-cli/src/commands/extract.ts` (lines 16-23, 36-45, ~78)
- Modify: `packages/predicate-agent/src/transcript-adapters.ts:82` (remove `adaptOpenCodeTranscript`)
- Test: `packages/predicate-cli/tests/extract-platform.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/extract-platform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SUPPORTED_PLATFORMS } from '../src/commands/extract.js';

describe('extract platforms', () => {
  it('supports claude-code and gemini only — opencode removed', () => {
    expect([...SUPPORTED_PLATFORMS]).toEqual(['claude-code', 'gemini']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-cli test extract-platform`
Expected: FAIL — `SUPPORTED_PLATFORMS` is not exported and still contains `'opencode'`.

- [ ] **Step 3: Edit `extract.ts`**

Change the import block (lines 16-20) to drop the OpenCode adapter:

```typescript
import {
  adaptClaudeCodeTranscript,
  adaptGeminiTranscript,
} from 'predicate-agent/src/transcript-adapters.js';
```

Export and shrink the platform list (line 23):

```typescript
export const SUPPORTED_PLATFORMS = ['claude-code', 'gemini'] as const;
```

Remove the `case 'opencode':` branch from `adapterFor` (lines 40-41) so the switch is:

```typescript
function adapterFor(platform: Platform): (events: Array<Record<string, unknown>>) => Array<Record<string, unknown>> {
  switch (platform) {
    case 'gemini':
      return adaptGeminiTranscript;
    case 'claude-code':
    default:
      return adaptClaudeCodeTranscript;
  }
}
```

In the `help()` text, change the `--platform` line to:

```
  --platform <name>    One of: claude-code (default), gemini.
                       Selects the transcript adapter for the platform.
```

- [ ] **Step 4: Remove `adaptOpenCodeTranscript` from `transcript-adapters.ts`**

Delete the entire `export function adaptOpenCodeTranscript(...)` block starting at line 82 (through its closing brace). Then check for any OpenCode-specific tests:

Run: `grep -rn "adaptOpenCodeTranscript\|opencode\|OpenCode" packages/predicate-agent/tests packages/predicate-cli/tests`
For each hit in a test file, delete the corresponding `it(...)`/`describe(...)` block referencing OpenCode.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter predicate-cli test extract-platform && pnpm --filter predicate-agent test transcript-adapters`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-cli/src/commands/extract.ts \
        packages/predicate-cli/tests/extract-platform.test.ts \
        packages/predicate-agent/src/transcript-adapters.ts \
        packages/predicate-agent/tests
git commit -m "refactor(extract): remove OpenCode platform adapter"
```

---

### Task 2: Define the canonical MCP env contract as a shared constant

The oxigraph env contract (`PREDICATE_BACKEND=oxigraph`, `PREDICATE_DATASET=predicate`) is currently duplicated and drifts (non-Claude templates still say `FUSEKI_URL`). Make one source of truth that the generator (Task 5) consumes.

**Files:**
- Create: `packages/predicate-skill/scripts/adapter-spec.mjs`
- Test: `packages/predicate-skill/scripts/adapter-spec.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-skill/scripts/adapter-spec.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { MCP_ENV, PLATFORMS } from './adapter-spec.mjs';

describe('adapter-spec', () => {
  it('uses the oxigraph backend, never FUSEKI_URL', () => {
    expect(MCP_ENV.PREDICATE_BACKEND).toBe('oxigraph');
    expect(MCP_ENV.PREDICATE_DATASET).toBe('predicate');
    expect(MCP_ENV).not.toHaveProperty('FUSEKI_URL');
  });
  it('declares the in-scope platforms only', () => {
    expect(Object.keys(PLATFORMS).sort()).toEqual(
      ['codex', 'cursor', 'gemini', 'vscode'].sort(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-skill exec vitest run scripts/adapter-spec.test.mjs`
Expected: FAIL — module does not exist.
(If `predicate-skill` has no `vitest` devDep yet, add it: `pnpm --filter predicate-skill add -D vitest@^2.0.0`, then add `"test": "vitest run"` to its `package.json` scripts.)

- [ ] **Step 3: Write `adapter-spec.mjs`**

```javascript
// Single source of truth for per-platform adapter generation.
// gen-adapters.mjs reads this; never hand-edit generated manifests.

export const MCP_ENV = {
  PREDICATE_BACKEND: 'oxigraph',
  PREDICATE_DATASET: 'predicate',
};

// Tier 1 = full plugin bundle (skills + hooks + MCP). Tier 2 = MCP + instructions.
export const PLATFORMS = {
  codex:  { tier: 1, instructionFile: 'AGENTS.md' },
  gemini: { tier: 1, instructionFile: 'GEMINI.md' },
  vscode: { tier: 2, instructionFile: 'AGENTS.md' },
  cursor: { tier: 2, instructionFile: 'AGENTS.md' },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-skill exec vitest run scripts/adapter-spec.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/predicate-skill/scripts/adapter-spec.mjs \
        packages/predicate-skill/scripts/adapter-spec.test.mjs \
        packages/predicate-skill/package.json
git commit -m "feat(skill): canonical MCP env + platform spec for adapter generation"
```

---

### Task 3: Shared CLI-resolution snippet for hook scripts

Today only the Claude scripts resolve the bundled CLI; gemini/codex scripts only `command -v predicate` and silently no-op without a global install. Extract one snippet all scripts source.

**Files:**
- Create: `packages/predicate-skill/hooks/lib/resolve-cli.sh`

- [ ] **Step 1: Write the resolver**

Create `packages/predicate-skill/hooks/lib/resolve-cli.sh`:

```bash
#!/usr/bin/env bash
# Shared CLI resolver, sourced by every platform hook script.
# Defines predicate_cli() that prefers the CLI bundled with the plugin
# (resolved from whichever plugin-root env var the host platform sets),
# then falls back to a global `predicate` on PATH, else a no-op that
# returns non-zero so callers can fail-open.
#
# Platform plugin-root env vars, in priority order:
#   CLAUDE_PLUGIN_ROOT  - Claude Code, and Codex (Codex sets it for compat)
#   PLUGIN_ROOT         - Codex native
#   PREDICATE_PLUGIN_ROOT - Gemini/manual: set in the hook command to ${extensionPath}

_predicate_bundled_cli() {
  local root
  for root in "${PREDICATE_PLUGIN_ROOT:-}" "${CLAUDE_PLUGIN_ROOT:-}" "${PLUGIN_ROOT:-}"; do
    if [[ -n "$root" && -f "$root/cli.bundle.mjs" ]]; then
      printf '%s' "$root/cli.bundle.mjs"
      return 0
    fi
  done
  return 1
}

if _CLI_BUNDLE="$(_predicate_bundled_cli)"; then
  predicate_cli() { node "$_CLI_BUNDLE" "$@"; }
elif command -v predicate >/dev/null 2>&1; then
  predicate_cli() { predicate "$@"; }
else
  predicate_cli() { return 127; }
fi
```

- [ ] **Step 2: Verify it sources cleanly**

Run:
```bash
cd packages/predicate-skill
PREDICATE_PLUGIN_ROOT="$PWD" bash -c 'source hooks/lib/resolve-cli.sh; type predicate_cli'
```
Expected: prints `predicate_cli is a function` and the function body referencing `cli.bundle.mjs` (the file exists in the package, so the bundled branch is taken).

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-skill/hooks/lib/resolve-cli.sh
git commit -m "feat(hooks): shared bundled-CLI resolver for all platforms"
```

---

### Task 4: Rewrite the Claude hook scripts to use the shared resolver

Prove the resolver works on the already-functioning Claude path before reusing it elsewhere. Behavior must not regress.

**Files:**
- Modify: `packages/predicate-skill/hooks/session-start.sh`
- Modify: `packages/predicate-skill/hooks/stop.sh`

- [ ] **Step 1: Rewrite `hooks/session-start.sh`**

```bash
#!/usr/bin/env bash
# SessionStart hook: ensure the local Oxigraph store + seed TBox exist
# (idempotent), then emit a short KG context block on stdout.
set -euo pipefail
source "$(dirname "$0")/lib/resolve-cli.sh"

predicate_cli up --if-needed >/dev/null 2>&1 || true

if MSG="$(predicate_cli sessionstart 2>/dev/null)"; then
  :
else
  MSG="Predicate: knowledge graph not ready. Run \`predicate up\` to initialise the local Oxigraph store."
fi

jq -n --arg m "$MSG" '{ additional_context: $m }'
```

- [ ] **Step 2: Rewrite `hooks/stop.sh`**

```bash
#!/usr/bin/env bash
# Stop hook: extract typed triples from the turn, then maintenance sweep.
# Fail-open: any error exits 0 so capture never blocks the next prompt.
set -uo pipefail
source "$(dirname "$0")/lib/resolve-cli.sh"

payload="$(cat || true)"
if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate_cli extract --from-stdin >/dev/null 2>&1 || true
fi
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
```

- [ ] **Step 3: Verify both scripts run with the bundled CLI resolved**

Run:
```bash
cd packages/predicate-skill
CLAUDE_PLUGIN_ROOT="$PWD" bash hooks/session-start.sh | jq -e '.additional_context' >/dev/null && echo "session-start OK"
echo '{}' | CLAUDE_PLUGIN_ROOT="$PWD" bash hooks/stop.sh && echo "stop OK (exit 0)"
```
Expected: `session-start OK` then `stop OK (exit 0)`. (Requires `node`, `jq`, and a built `cli.bundle.mjs` present — it is, in the package.)

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-skill/hooks/session-start.sh packages/predicate-skill/hooks/stop.sh
git commit -m "refactor(hooks): Claude scripts use shared CLI resolver"
```

---

## Phase 2 — The adapter generator

### Task 5: `gen-adapters.mjs` — generate AGENTS.md / GEMINI.md from SKILL.md

**Files:**
- Create: `packages/predicate-skill/scripts/gen-adapters.mjs`
- Test: `packages/predicate-skill/scripts/gen-adapters.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-skill/scripts/gen-adapters.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { buildInstructionDoc } from './gen-adapters.mjs';

const SKILL = `---
name: predicate-reasoning
description: Local reasoning knowledge graph.
---

# When to use this skill
Use Predicate when the user asks why something happened.
`;

describe('buildInstructionDoc', () => {
  it('strips frontmatter and prepends a generated-file banner', () => {
    const out = buildInstructionDoc(SKILL, 'AGENTS.md');
    expect(out).toContain('<!-- GENERATED from skills/predicate-reasoning/SKILL.md — do not edit -->');
    expect(out).not.toContain('---\nname: predicate-reasoning');
    expect(out).toContain('# When to use this skill');
    expect(out).toContain('Predicate when the user asks why');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter predicate-skill exec vitest run scripts/gen-adapters.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `gen-adapters.mjs` (instruction-doc portion)**

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_ENV, PLATFORMS } from './adapter-spec.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..'); // packages/predicate-skill
const SKILL_PATH = resolve(root, 'skills/predicate-reasoning/SKILL.md');

const BANNER = (src) =>
  `<!-- GENERATED from ${src} — do not edit -->`;

/** Strip YAML frontmatter, prepend the do-not-edit banner. */
export function buildInstructionDoc(skillSource, _targetName) {
  const body = skillSource.replace(/^---\n[\s\S]*?\n---\n/, '');
  return `${BANNER('skills/predicate-reasoning/SKILL.md')}\n\n# Predicate — reasoning knowledge graph\n\n${body.trimStart()}`;
}

export function generateAll() {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const written = [];
  // One AGENTS.md and one GEMINI.md (deduped by filename across platforms).
  const files = new Set(Object.values(PLATFORMS).map((p) => p.instructionFile));
  for (const name of files) {
    const out = buildInstructionDoc(skill, name);
    writeFileSync(resolve(root, name), out);
    written.push(name);
  }
  return written;
}

// MCP server config block shared by manifests/templates.
export function mcpServerBlock({ argsPrefix }) {
  return {
    command: 'node',
    args: [`${argsPrefix}/server.bundle.mjs`],
    env: { ...MCP_ENV },
  };
}

const isMain = resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const written = generateAll();
  console.log(`generated: ${written.join(', ')}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter predicate-skill exec vitest run scripts/gen-adapters.test.mjs`
Expected: PASS.

- [ ] **Step 5: Generate the files and eyeball them**

Run: `node packages/predicate-skill/scripts/gen-adapters.mjs && head -15 packages/predicate-skill/AGENTS.md packages/predicate-skill/GEMINI.md`
Expected: both files start with the generated banner, then the skill body (no frontmatter).

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-skill/scripts/gen-adapters.mjs \
        packages/predicate-skill/scripts/gen-adapters.test.mjs \
        packages/predicate-skill/AGENTS.md packages/predicate-skill/GEMINI.md
git commit -m "feat(skill): generate AGENTS.md/GEMINI.md from SKILL.md"
```

---

### Task 6: Extend `gen-adapters.mjs` to emit Codex + Gemini manifests, and wire into `bundle`

**Files:**
- Modify: `packages/predicate-skill/scripts/gen-adapters.mjs`
- Modify: `packages/predicate-skill/scripts/bundle.mjs` (call generator + drift assertion)
- Test: `packages/predicate-skill/scripts/gen-adapters.test.mjs`

- [ ] **Step 1: Add manifest tests**

Append to `gen-adapters.test.mjs`:

```javascript
import { codexPluginManifest, codexMcpJson, geminiExtensionManifest } from './gen-adapters.mjs';

describe('manifests', () => {
  it('codex .mcp.json points at the bundled server with oxigraph env', () => {
    const m = codexMcpJson();
    expect(m.predicate.command).toBe('node');
    expect(m.predicate.args[0]).toMatch(/server\.bundle\.mjs$/);
    expect(m.predicate.env.PREDICATE_BACKEND).toBe('oxigraph');
    expect(JSON.stringify(m)).not.toContain('FUSEKI_URL');
  });
  it('codex plugin manifest declares skills + hooks + mcp', () => {
    const p = codexPluginManifest('9.9.9');
    expect(p.name).toBe('predicate');
    expect(p.version).toBe('9.9.9');
    expect(p.skills).toBe('./skills/');
  });
  it('gemini extension uses extensionPath + GEMINI.md context file', () => {
    const g = geminiExtensionManifest('9.9.9');
    expect(g.contextFileName).toBe('GEMINI.md');
    expect(g.mcpServers.predicate.args[0]).toBe('${extensionPath}/server.bundle.mjs');
    expect(g.version).toBe('9.9.9');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter predicate-skill exec vitest run scripts/gen-adapters.test.mjs`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Add manifest builders to `gen-adapters.mjs`**

Add these exports (Codex honors `${CLAUDE_PLUGIN_ROOT}` / `${PLUGIN_ROOT}` at runtime; the bundled `.mcp.json` uses a relative-to-plugin path via `node` cwd, so we point at `server.bundle.mjs` resolved from the plugin root the host injects — Codex resolves plugin-relative paths from the plugin dir):

```javascript
const PKG = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
);

export function codexMcpJson() {
  return {
    predicate: {
      command: 'node',
      args: ['${PLUGIN_ROOT}/server.bundle.mjs'],
      env: { ...MCP_ENV },
    },
  };
}

export function codexPluginManifest(version = PKG.version) {
  return {
    name: 'predicate',
    version,
    description: PKG.description,
    author: PKG.author,
    homepage: PKG.homepage,
    license: 'Elastic-2.0',
    keywords: ['mcp', 'knowledge-graph', 'rdf', 'owl', 'sparql', 'reasoning'],
    skills: './skills/',
  };
}

export function geminiExtensionManifest(version = PKG.version) {
  return {
    name: 'predicate',
    version,
    description: PKG.description,
    contextFileName: 'GEMINI.md',
    mcpServers: {
      predicate: {
        command: 'node',
        args: ['${extensionPath}/server.bundle.mjs'],
        env: { ...MCP_ENV },
      },
    },
  };
}
```

Extend `generateAll()` to also write the manifest files and the Codex/Gemini hooks:

```javascript
export function generateAll() {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const written = [];

  const files = new Set(Object.values(PLATFORMS).map((p) => p.instructionFile));
  for (const name of files) {
    writeFileSync(resolve(root, name), buildInstructionDoc(skill, name));
    written.push(name);
  }

  // Codex plugin bundle
  mkdirSync(resolve(root, '.codex-plugin'), { recursive: true });
  writeFileSync(resolve(root, '.codex-plugin/plugin.json'),
    JSON.stringify(codexPluginManifest(), null, 2) + '\n');
  writeFileSync(resolve(root, '.mcp.json'),
    JSON.stringify(codexMcpJson(), null, 2) + '\n');
  written.push('.codex-plugin/plugin.json', '.mcp.json');

  // Gemini extension manifest
  writeFileSync(resolve(root, 'gemini-extension.json'),
    JSON.stringify(geminiExtensionManifest(), null, 2) + '\n');
  written.push('gemini-extension.json');

  // Gemini hooks/hooks.json — REAL Gemini event names
  mkdirSync(resolve(root, 'hooks/gemini-cli'), { recursive: true });
  writeFileSync(resolve(root, 'hooks/gemini-cli/hooks.json'),
    JSON.stringify(geminiHooksJson(), null, 2) + '\n');
  written.push('hooks/gemini-cli/hooks.json');

  return written;
}

export function geminiHooksJson() {
  const cmd = (script) =>
    `bash "\${extensionPath}/hooks/gemini-cli/${script}"`;
  return {
    hooks: {
      SessionStart: [{ matcher: 'startup|resume', hooks: [{ type: 'command', command: cmd('session-start.sh') }] }],
      AfterAgent:   [{ matcher: '', hooks: [{ type: 'command', command: cmd('stop.sh') }] }],
      PreCompress:  [{ matcher: '', hooks: [{ type: 'command', command: cmd('pre-compact.sh') }] }],
    },
  };
}
```

Add `mkdirSync` to the imports at the top: `import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';`

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter predicate-skill exec vitest run scripts/gen-adapters.test.mjs`
Expected: PASS.

- [ ] **Step 5: Wire generator + drift assertion into `bundle.mjs`**

In `packages/predicate-skill/scripts/bundle.mjs`, after the oxigraph vendoring block and before the esbuild `build(...)` calls, add:

```javascript
// Regenerate per-platform adapters from canonical sources and fail if the
// committed copies are stale (prevents the adapters from silently rotting).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

execFileSync('node', [resolve(here, 'gen-adapters.mjs')], { stdio: 'inherit' });
const dirty = execFileSync('git', ['status', '--porcelain', '--',
  'AGENTS.md', 'GEMINI.md', '.codex-plugin', '.mcp.json',
  'gemini-extension.json', 'hooks/gemini-cli/hooks.json'],
  { cwd: root, encoding: 'utf8' });
if (dirty.trim()) {
  console.error('Generated adapters are stale. Run gen-adapters.mjs and commit:\n' + dirty);
  process.exit(1);
}
console.log('adapters regenerated + verified in sync');
```

(Note: place the two `import` lines at the top of the file with the other imports, not inline — shown inline here only for locality. `existsSync` may already be needed elsewhere.)

- [ ] **Step 6: Run the full bundle to verify it generates + passes the drift check**

Run: `pnpm --filter predicate-skill bundle`
Expected: prints `generated: ...` then `adapters regenerated + verified in sync`, then the esbuild build lines. Exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-skill/scripts/gen-adapters.mjs \
        packages/predicate-skill/scripts/gen-adapters.test.mjs \
        packages/predicate-skill/scripts/bundle.mjs \
        packages/predicate-skill/.codex-plugin packages/predicate-skill/.mcp.json \
        packages/predicate-skill/gemini-extension.json \
        packages/predicate-skill/hooks/gemini-cli/hooks.json
git commit -m "feat(skill): generate Codex/Gemini manifests + hooks; bundle drift-check"
```

---

## Phase 3 — Codex CLI (priority 1)

### Task 7: Codex hook scripts + marketplace entry

Codex reuses the canonical `hooks/hooks.json` (`SessionStart`/`Stop`) and honors `CLAUDE_PLUGIN_ROOT`, so the Claude scripts already work. Replace the stale `hooks/codex-cli/*` (which claim "Codex has no hooks") with thin scripts that source the shared resolver, plus a marketplace manifest.

**Files:**
- Modify: `packages/predicate-skill/hooks/codex-cli/session-start.sh`
- Modify: `packages/predicate-skill/hooks/codex-cli/stop.sh`
- Delete: `packages/predicate-skill/hooks/codex-cli/pre-compact.sh`, `config.toml.template`
- Create: `packages/predicate-skill/.agents/plugins/marketplace.json`
- Rewrite: `packages/predicate-skill/hooks/codex-cli/README.md`

- [ ] **Step 1: Rewrite `hooks/codex-cli/session-start.sh`**

```bash
#!/usr/bin/env bash
# Codex CLI SessionStart hook. Codex injects PLUGIN_ROOT/CLAUDE_PLUGIN_ROOT.
set -euo pipefail
source "$(dirname "$0")/../lib/resolve-cli.sh"
predicate_cli up --if-needed >/dev/null 2>&1 || true
MSG="$(predicate_cli sessionstart 2>/dev/null || echo 'Predicate: run `predicate up` to initialise the store.')"
jq -n --arg m "$MSG" '{ additional_context: $m }'
```

- [ ] **Step 2: Rewrite `hooks/codex-cli/stop.sh`**

```bash
#!/usr/bin/env bash
# Codex CLI Stop hook: extract typed triples, then maintenance. Fail-open.
set -uo pipefail
source "$(dirname "$0")/../lib/resolve-cli.sh"
payload="$(cat || true)"
if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate_cli extract --from-stdin >/dev/null 2>&1 || true
fi
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
```

- [ ] **Step 3: Delete stale codex files**

```bash
git rm packages/predicate-skill/hooks/codex-cli/pre-compact.sh \
       packages/predicate-skill/hooks/codex-cli/config.toml.template
```
(Codex has no PreCompact event; MCP comes from the generated `.mcp.json`, not a hand-edited config.toml.)

- [ ] **Step 4: Create the Codex marketplace manifest**

Create `packages/predicate-skill/.agents/plugins/marketplace.json`:

```json
{
  "name": "predicate",
  "interface": { "displayName": "Predicate" },
  "plugins": [
    {
      "source": { "path": "../../" },
      "policy": { "installation": "manual", "authentication": "none" },
      "category": "knowledge"
    }
  ]
}
```

- [ ] **Step 5: Rewrite `hooks/codex-cli/README.md`**

````markdown
# Codex CLI adapter

Codex CLI (v0.117+) uses the Claude Code plugin model and honors
`CLAUDE_PLUGIN_ROOT`, so Predicate installs as a native Codex plugin:
the bundled `skills/`, `hooks/hooks.json` (`SessionStart`/`Stop`), and the
generated `.mcp.json` are consumed directly.

## Install

```sh
codex plugin marketplace add NordicAgents/predicate
# then enable "predicate" in the interactive plugin browser
```

## Two one-time gotchas

1. Plugin hooks are gated behind a feature flag. In `~/.codex/config.toml`:
   ```toml
   [features]
   plugin_hooks = true
   ```
2. Codex requires you to approve non-managed hooks once via the `/hooks`
   command before they run.

## Verify

Start `codex`; you should see Predicate's KG status line in the initial
context. After a turn, `predicate sessions` should list the new session.
````

- [ ] **Step 6: Regenerate + verify**

Run: `pnpm --filter predicate-skill bundle && bash -n packages/predicate-skill/hooks/codex-cli/*.sh && jq -e . packages/predicate-skill/.agents/plugins/marketplace.json >/dev/null && echo OK`
Expected: bundle succeeds (drift check passes), `bash -n` reports no syntax errors, `OK`.

- [ ] **Step 7: Commit**

```bash
git add -A packages/predicate-skill/hooks/codex-cli \
        packages/predicate-skill/.agents
git commit -m "feat(codex): native plugin hooks + marketplace manifest"
```

---

## Phase 4 — Gemini CLI (priority 2)

### Task 8: Gemini hook scripts with correct event payloads + extension wiring

The `gemini-extension.json` and `hooks/gemini-cli/hooks.json` are generated (Task 6). This task fixes the three Gemini hook *scripts* to use the shared resolver and the `${extensionPath}` plugin root, and replaces the stale `settings.json.template`.

**Files:**
- Modify: `packages/predicate-skill/hooks/gemini-cli/session-start.sh`
- Modify: `packages/predicate-skill/hooks/gemini-cli/stop.sh`
- Modify: `packages/predicate-skill/hooks/gemini-cli/pre-compact.sh`
- Delete: `packages/predicate-skill/hooks/gemini-cli/settings.json.template`
- Rewrite: `packages/predicate-skill/hooks/gemini-cli/README.md`
- Test: `packages/predicate-agent/tests/transcript-adapters.test.ts` (add AfterAgent fixture)

- [ ] **Step 1: Add a Gemini `AfterAgent` transcript fixture test**

In `packages/predicate-agent/tests/transcript-adapters.test.ts`, add (adapt the `expect` to the canonical shape `adaptGeminiTranscript` already returns — check the existing gemini test in the same file for the exact assertion style):

```typescript
import { adaptGeminiTranscript } from '../src/transcript-adapters.js';

describe('adaptGeminiTranscript — AfterAgent turn', () => {
  it('maps a tool_call/tool_result pair to canonical events', () => {
    const events = [
      { type: 'tool_call', toolUse: { name: 'Bash', input: { command: 'pnpm test' } } },
      { type: 'tool_result', toolResult: { output: 'ok' } },
    ];
    const out = adaptGeminiTranscript(events);
    expect(out.length).toBeGreaterThan(0);
    // canonical shape: assistant tool_use then user tool_result
    expect(JSON.stringify(out)).toContain('Bash');
  });
});
```

- [ ] **Step 2: Run to verify it passes (adapter already exists) or fails (needs fix)**

Run: `pnpm --filter predicate-agent test transcript-adapters`
Expected: PASS if the existing `adaptGeminiTranscript` already handles this shape; if FAIL, fix `adaptGeminiTranscript` so the fixture maps correctly, then re-run to PASS.

- [ ] **Step 3: Rewrite `hooks/gemini-cli/session-start.sh`**

```bash
#!/usr/bin/env bash
# Gemini CLI SessionStart hook.
set -euo pipefail
export PREDICATE_PLUGIN_ROOT="${PREDICATE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
source "$(dirname "$0")/../lib/resolve-cli.sh"
predicate_cli up --if-needed >/dev/null 2>&1 || true
MSG="$(predicate_cli sessionstart 2>/dev/null || echo 'Predicate: run `predicate up` to initialise the store.')"
jq -n --arg m "$MSG" '{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: $m } }'
```

(Gemini reads `hookSpecificOutput.additionalContext` from SessionStart, not `additional_context`.)

- [ ] **Step 4: Rewrite `hooks/gemini-cli/stop.sh` (fires on `AfterAgent`)**

```bash
#!/usr/bin/env bash
# Gemini CLI AfterAgent hook: extract typed triples for the turn, then maintain.
set -uo pipefail
export PREDICATE_PLUGIN_ROOT="${PREDICATE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
source "$(dirname "$0")/../lib/resolve-cli.sh"
payload="$(cat || true)"
if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate_cli extract --from-stdin --platform gemini >/dev/null 2>&1 || true
fi
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
```

- [ ] **Step 5: Rewrite `hooks/gemini-cli/pre-compact.sh` (fires on `PreCompress`)**

```bash
#!/usr/bin/env bash
# Gemini CLI PreCompress hook: maintenance sweep before context compression.
set -uo pipefail
export PREDICATE_PLUGIN_ROOT="${PREDICATE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
source "$(dirname "$0")/../lib/resolve-cli.sh"
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
```

- [ ] **Step 6: Delete stale template + rewrite README**

```bash
git rm packages/predicate-skill/hooks/gemini-cli/settings.json.template
```

Rewrite `hooks/gemini-cli/README.md`:

````markdown
# Gemini CLI adapter

Predicate installs as a native Gemini CLI **extension**. The
`gemini-extension.json` manifest (repo root of the package) registers the
MCP server via `${extensionPath}`, loads `GEMINI.md` as context, and wires
`hooks/gemini-cli/hooks.json` to the real Gemini events: `SessionStart`,
`AfterAgent` (end of turn), and `PreCompress`.

## Install

```sh
gemini extensions install https://github.com/NordicAgents/predicate
# restart Gemini CLI
```

(For the lighter MCP-only path without hooks: `gemini mcp add predicate -s user -- node /abs/path/server.bundle.mjs`.)

## Verify

`gemini --debug`, start a fresh session: Predicate's KG status line appears
in the debug output before your first prompt. After a turn, `predicate
sessions` lists the new session.
````

- [ ] **Step 7: Regenerate + verify**

Run: `pnpm --filter predicate-skill bundle && bash -n packages/predicate-skill/hooks/gemini-cli/*.sh && jq -e '.hooks.AfterAgent' packages/predicate-skill/hooks/gemini-cli/hooks.json >/dev/null && echo OK`
Expected: bundle OK (drift check passes), no bash syntax errors, `OK`.

- [ ] **Step 8: Commit**

```bash
git add -A packages/predicate-skill/hooks/gemini-cli \
        packages/predicate-agent/tests/transcript-adapters.test.ts
git commit -m "feat(gemini): correct event names + extensionPath CLI resolution"
```

---

## Phase 5 — `predicate install` for MCP-only platforms (VS Code, Cursor)

### Task 9: `predicate install <platform>` subcommand

VS Code Copilot and Cursor have no marketplace and no usable hooks. A small CLI subcommand writes the MCP block into the right config file and drops the instruction file. Runs via `npx predicate-skill install <platform>`.

**Files:**
- Create: `packages/predicate-cli/src/commands/install.ts`
- Modify: `packages/predicate-cli/src/index.ts` (register command + help)
- Test: `packages/predicate-cli/tests/install.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/install.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeMcpConfig } from '../src/commands/install.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'predicate-install-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('writeMcpConfig', () => {
  it('vscode: writes .vscode/mcp.json with oxigraph env, merging existing servers', () => {
    const out = writeMcpConfig('vscode', dir, '/abs/server.bundle.mjs');
    const cfg = JSON.parse(readFileSync(out, 'utf8'));
    expect(cfg.servers.predicate.command).toBe('node');
    expect(cfg.servers.predicate.args[0]).toBe('/abs/server.bundle.mjs');
    expect(cfg.servers.predicate.env.PREDICATE_BACKEND).toBe('oxigraph');
    expect(JSON.stringify(cfg)).not.toContain('FUSEKI_URL');
  });

  it('cursor: writes .cursor/mcp.json with the predicate server', () => {
    const out = writeMcpConfig('cursor', dir, '/abs/server.bundle.mjs');
    expect(out).toContain('.cursor');
    const cfg = JSON.parse(readFileSync(out, 'utf8'));
    expect(cfg.mcpServers.predicate.args[0]).toBe('/abs/server.bundle.mjs');
  });

  it('preserves a pre-existing unrelated server entry', () => {
    writeMcpConfig('vscode', dir, '/abs/server.bundle.mjs');
    const out = writeMcpConfig('vscode', dir, '/abs/server.bundle.mjs');
    const cfg = JSON.parse(readFileSync(out, 'utf8'));
    expect(existsSync(out)).toBe(true);
    expect(cfg.servers.predicate).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter predicate-cli test install`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `install.ts`**

```typescript
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_ENV = { PREDICATE_BACKEND: 'oxigraph', PREDICATE_DATASET: 'predicate' };

type Platform = 'vscode' | 'cursor';

/** VS Code uses { servers: {...} }; Cursor uses { mcpServers: {...} }. */
function configSpec(platform: Platform): { rel: string; key: 'servers' | 'mcpServers' } {
  switch (platform) {
    case 'vscode': return { rel: '.vscode/mcp.json', key: 'servers' };
    case 'cursor': return { rel: '.cursor/mcp.json', key: 'mcpServers' };
  }
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}

export function writeMcpConfig(platform: Platform, projectDir: string, serverPath: string): string {
  const { rel, key } = configSpec(platform);
  const out = join(projectDir, rel);
  mkdirSync(dirname(out), { recursive: true });
  const cfg = readJson(out);
  const servers = (cfg[key] as Record<string, unknown>) ?? {};
  servers.predicate = { command: 'node', args: [serverPath], env: { ...MCP_ENV } };
  cfg[key] = servers;
  writeFileSync(out, JSON.stringify(cfg, null, 2) + '\n');
  return out;
}

/** Resolve the bundled server.bundle.mjs shipped beside this CLI. */
function bundledServerPath(): string {
  // When bundled, this file is .../predicate-skill/cli.bundle.mjs; the server
  // sits next to it. When run from source, fall back to the package root.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(here, 'server.bundle.mjs');
  return existsSync(candidate) ? candidate : resolve(here, '../../../predicate-skill/server.bundle.mjs');
}

/** Copy the generated AGENTS.md beside the project config, if available. */
function dropInstructions(projectDir: string): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = resolve(here, 'AGENTS.md');
  if (!existsSync(src)) return null;
  const dst = join(projectDir, 'AGENTS.md');
  if (!existsSync(dst)) copyFileSync(src, dst);
  return existsSync(dst) ? dst : null;
}

export async function install(args: string[]): Promise<number> {
  const platform = args[0] as Platform | undefined;
  if (platform !== 'vscode' && platform !== 'cursor') {
    console.error('usage: predicate install <vscode|cursor>');
    console.error('  (Claude/Codex/Gemini install via their own marketplace/extension commands)');
    return 2;
  }
  const projectDir = process.cwd();
  const serverPath = bundledServerPath();
  const written = writeMcpConfig(platform, projectDir, serverPath);
  const instr = dropInstructions(projectDir);
  console.log(`Wrote ${written}`);
  if (instr) console.log(`Wrote ${instr}`);
  console.log(`Restart ${platform === 'vscode' ? 'VS Code' : 'Cursor'} to load the predicate MCP server.`);
  return 0;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter predicate-cli test install`
Expected: PASS (all three cases).

- [ ] **Step 5: Register the command in `index.ts`**

Add the import alongside the others:

```typescript
import { install } from './commands/install.js';
```

Add the case in the `switch (cmd)` block (after `migrate`):

```typescript
    case 'install':         return install(process.argv.slice(3));
```

Add to the `help()` Commands list (after `migrate`):

```
  install           Write MCP config + AGENTS.md for an MCP-only host: install <vscode|cursor>.
```

- [ ] **Step 6: Verify the command is wired**

Run: `pnpm --filter predicate-cli build && node packages/predicate-cli/dist/src/index.js install`
Expected: prints the usage line and exits non-zero (no platform arg).

- [ ] **Step 7: Commit**

```bash
git add packages/predicate-cli/src/commands/install.ts \
        packages/predicate-cli/src/index.ts \
        packages/predicate-cli/tests/install.test.ts
git commit -m "feat(cli): predicate install <vscode|cursor> writes MCP config + AGENTS.md"
```

---

### Task 10: Refresh the VS Code Copilot and Cursor adapter READMEs

**Files:**
- Rewrite: `packages/predicate-skill/hooks/vscode-copilot/README.md`
- Rewrite: `packages/predicate-skill/hooks/cursor/README.md`
- Delete: stale `*.template` files in both dirs (replaced by `predicate install`)

- [ ] **Step 1: Delete the stale templates**

```bash
git rm packages/predicate-skill/hooks/vscode-copilot/settings.json.template \
       packages/predicate-skill/hooks/cursor/mcp.json.template
```

- [ ] **Step 2: Rewrite `hooks/vscode-copilot/README.md`**

````markdown
# VS Code Copilot adapter (MCP-only)

VS Code Copilot consumes the Predicate MCP server (the 9 `kg_*` tools).
It has no usable session/stop lifecycle hooks, so there is no automatic
turn capture — reasoning queries work, capture does not.

## Install

From your project root:

```sh
npx predicate-skill install vscode
```

This writes `.vscode/mcp.json` (pointing `node` at the bundled
`server.bundle.mjs` with the oxigraph backend) and drops `AGENTS.md` so
Copilot knows when to use the `kg_*` tools. Restart VS Code.

## Verify

Open the MCP panel; `predicate` should be listed with its tools. Ask a
structural question ("what depends on X?") and confirm a `kg_*` tool runs.
````

- [ ] **Step 3: Rewrite `hooks/cursor/README.md`**

````markdown
# Cursor adapter (MCP-only)

Cursor consumes the Predicate MCP server (the 9 `kg_*` tools). It has no
usable lifecycle hooks, so there is no automatic turn capture — reasoning
queries work, capture does not.

## Install

From your project root:

```sh
npx predicate-skill install cursor
```

This writes `.cursor/mcp.json` (pointing `node` at the bundled
`server.bundle.mjs` with the oxigraph backend) and drops `AGENTS.md`.
Restart Cursor and enable the `predicate` server in Settings → MCP.

## Verify

Settings → MCP shows `predicate` with its tools. Ask a structural
question and confirm a `kg_*` tool runs.
````

- [ ] **Step 4: Verify**

Run: `pnpm --filter predicate-skill bundle && echo OK`
Expected: bundle OK, `OK`.

- [ ] **Step 5: Commit**

```bash
git add -A packages/predicate-skill/hooks/vscode-copilot packages/predicate-skill/hooks/cursor
git commit -m "docs(vscode,cursor): MCP-only install via predicate install"
```

---

## Phase 6 — Plugin description, packaging, and platform doctor

### Task 11: Remove OpenCode from `plugin.json`, add generated files to `files`

**Files:**
- Modify: `packages/predicate-skill/.claude-plugin/plugin.json` (description)
- Modify: `packages/predicate-skill/package.json` (`files` array)

- [ ] **Step 1: Edit `plugin.json` description**

Change the description so it no longer says "OpenCode":

```
"description": "Local reasoning knowledge graph (RDF/OWL) for AI agents — 9 kg_* MCP tools + cross-platform Stop-hook turn extraction (Claude Code + Codex CLI + Gemini CLI) + reasoning bridge for action data. Disk-backed native Oxigraph by default, in-process WASM fallback.",
```

- [ ] **Step 2: Add generated artifacts to the npm `files` allowlist**

In `packages/predicate-skill/package.json`, add to the `files` array:

```json
    "AGENTS.md",
    "GEMINI.md",
    ".codex-plugin",
    ".mcp.json",
    "gemini-extension.json",
    ".agents"
```

- [ ] **Step 3: Verify the package contents include them**

Run: `cd packages/predicate-skill && npm pack --dry-run 2>&1 | grep -E "AGENTS.md|GEMINI.md|codex-plugin|gemini-extension|\.mcp\.json|marketplace.json"`
Expected: all six paths appear in the listing.

- [ ] **Step 4: Commit**

```bash
git add packages/predicate-skill/.claude-plugin/plugin.json packages/predicate-skill/package.json
git commit -m "chore(skill): drop OpenCode from description; ship generated adapters"
```

---

### Task 12: `predicate doctor <platform>` checks

Extend the existing `doctor` to optionally validate a platform's wiring (MCP server boots on oxigraph; hook scripts resolve the CLI).

**Files:**
- Modify: `packages/predicate-cli/src/commands/doctor.ts`
- Modify: `packages/predicate-cli/src/index.ts` (pass args to doctor)
- Test: `packages/predicate-cli/tests/doctor-platform.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/predicate-cli/tests/doctor-platform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { platformChecks } from '../src/commands/doctor.js';

describe('platformChecks', () => {
  it('codex/gemini report hook-script presence and never reference FUSEKI', () => {
    const checks = platformChecks('codex');
    expect(checks.some((c) => c.name === 'hook scripts')).toBe(true);
    expect(JSON.stringify(checks)).not.toContain('FUSEKI');
  });
  it('unknown platform yields an error check', () => {
    const checks = platformChecks('bogus');
    expect(checks[0].ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter predicate-cli test doctor-platform`
Expected: FAIL — `platformChecks` not exported.

- [ ] **Step 3: Add `platformChecks` to `doctor.ts` and accept an arg**

Add near the top of `doctor.ts`:

```typescript
import { resolve, dirname as dn } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PlatformCheck { name: string; ok: boolean; detail?: string }

const PLATFORM_HOOK_DIR: Record<string, string> = {
  codex: 'hooks/codex-cli',
  gemini: 'hooks/gemini-cli',
};

export function platformChecks(platform: string): PlatformCheck[] {
  const dir = PLATFORM_HOOK_DIR[platform];
  if (!dir) {
    return [{ name: 'platform', ok: false, detail: `unknown platform '${platform}' (codex|gemini)` }];
  }
  const here = dn(fileURLToPath(import.meta.url));
  // Bundled CLI sits at predicate-skill root; hooks/ is a sibling.
  const root = resolve(here);
  const scripts = ['session-start.sh', 'stop.sh'];
  const checks: PlatformCheck[] = [];
  const presence = scripts.map((s) => existsSync(resolve(root, dir, s)));
  checks.push({
    name: 'hook scripts',
    ok: presence.every(Boolean),
    detail: scripts.join(', '),
  });
  return checks;
}
```

Change the `doctor` signature to accept args and branch:

```typescript
export async function doctor(args: string[] = []): Promise<number> {
  const platform = args[0];
  if (platform) {
    const checks = platformChecks(platform);
    for (const c of checks) console.log(`${c.ok ? 'ok ' : 'FAIL'}  ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    return checks.every((c) => c.ok) ? 0 : 1;
  }
  // ... existing backend/tbox checks unchanged ...
```

(Leave the existing health-check body in place after the new branch.)

- [ ] **Step 4: Pass args from `index.ts`**

Change the doctor case:

```typescript
    case 'doctor':          return doctor(process.argv.slice(3));
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter predicate-cli test doctor-platform`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/predicate-cli/src/commands/doctor.ts \
        packages/predicate-cli/src/index.ts \
        packages/predicate-cli/tests/doctor-platform.test.ts
git commit -m "feat(cli): predicate doctor <codex|gemini> validates hook wiring"
```

---

### Task 13: Full-suite verification + top-level README install matrix

**Files:**
- Modify: `packages/predicate-skill/README.md` (install section)

- [ ] **Step 1: Run the whole test + build suite**

Run:
```bash
pnpm -r --filter './packages/*' build
pnpm --filter predicate-cli test
pnpm --filter predicate-agent test
pnpm --filter predicate-skill exec vitest run
pnpm --filter predicate-skill bundle
```
Expected: all green; bundle prints `adapters regenerated + verified in sync`. If anything fails, fix before continuing.

- [ ] **Step 2: Update `packages/predicate-skill/README.md` install section**

Replace the per-platform install instructions with a matrix matching the implemented reality:

````markdown
## Install

| Platform | Command | Capture loop |
|---|---|---|
| Claude Code | `/plugin marketplace add NordicAgents/predicate` | yes (Stop hook) |
| Codex CLI | `codex plugin marketplace add NordicAgents/predicate` then enable; set `[features] plugin_hooks = true` and approve via `/hooks` | yes (Stop hook) |
| Gemini CLI | `gemini extensions install https://github.com/NordicAgents/predicate` | yes (AfterAgent hook) |
| VS Code Copilot | `npx predicate-skill install vscode` | no (tools only) |
| Cursor | `npx predicate-skill install cursor` | no (tools only) |

All platforms run the same local Oxigraph-backed MCP server (the 9 `kg_*`
tools) and read the same reasoning guidance (`SKILL.md` on Claude;
generated `AGENTS.md`/`GEMINI.md` elsewhere). OpenCode is not supported.
````

- [ ] **Step 3: Commit**

```bash
git add packages/predicate-skill/README.md
git commit -m "docs: install matrix for Claude/Codex/Gemini/VSCode/Cursor"
```

---

## Self-review notes (for the implementer)

- **Generated files are never hand-edited.** AGENTS.md, GEMINI.md, `.codex-plugin/plugin.json`, `.mcp.json`, `gemini-extension.json`, and `hooks/gemini-cli/hooks.json` come from `gen-adapters.mjs`. The `bundle` step fails if a committed copy drifts. If you need to change their content, change `SKILL.md` or `adapter-spec.mjs`/`gen-adapters.mjs`, then regenerate.
- **Codex `${PLUGIN_ROOT}` in `.mcp.json`:** if Codex turns out not to expand env-var syntax inside `.mcp.json` args during testing, fall back to a relative `args: ["server.bundle.mjs"]` (Codex resolves plugin-relative paths from the plugin dir) — verify against a real Codex install in Task 7 Step 6 and adjust the generator.
- **Gemini SessionStart output key:** `hookSpecificOutput.additionalContext` is used (verified against Gemini hooks docs), distinct from Claude's `additional_context`. If a live Gemini test shows the banner missing, re-check the key.
- **`predicate install` server path:** `bundledServerPath()` assumes `server.bundle.mjs` sits beside `cli.bundle.mjs` in the published package — true for the npm/npx artifact. The source-tree fallback is best-effort for local dev.
