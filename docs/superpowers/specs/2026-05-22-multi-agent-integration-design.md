# Multi-Agent Integration Design

**Date:** 2026-05-22
**Status:** Approved (design), pending implementation plan
**Scope:** Make Predicate install and run cleanly on agent platforms beyond Claude Code, in priority order **Codex CLI → Gemini CLI → VS Code Copilot → Cursor**. OpenCode is explicitly **out of scope** and removed.

## Problem

Predicate ships as a working Claude Code plugin (MCP server + skills + Stop-hook capture loop). Per-platform adapters exist under `hooks/{codex-cli,gemini-cli,opencode,cursor,vscode-copilot}/`, but they were written from assumptions and never validated against the real platforms. As of 2026 they are not merely stale — they are **broken**:

1. **Stale backend.** Every non-Claude MCP template injects `FUSEKI_URL=http://localhost:3030`. Predicate moved to the native Oxigraph daemon (`PREDICATE_BACKEND=oxigraph`) in v2.6. Non-Claude users get an MCP server pointed at a backend that no longer exists.
2. **Hooks can't find the CLI.** Claude's `session-start.sh`/`stop.sh` resolve the bundled CLI via `${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs` with a global-`predicate` fallback. The gemini/codex scripts only check `command -v predicate`, so without a global install they silently no-op (no session banner, no capture).
3. **Guidance is Claude-only.** The reasoning workflow (when/how to use the `kg_*` tools) lives in `skills/*/SKILL.md`, which only Claude Code loads. Other agents get raw tools with no behavioral guidance.
4. **Wrong platform mechanics.** Gemini's adapter uses non-existent event names (`sessionStart`/`stop`/`preCompress`); the real names are `SessionStart`/`AfterAgent`/`SessionEnd`/`PreCompress`. (The OpenCode adapter's `"events":[{on,run}]` mechanism never existed — but OpenCode is now out of scope and deleted.)

## Platform reality (2026, source-verified)

| Platform | Native packaging | Hooks / capture loop | Instruction file |
|---|---|---|---|
| **Claude Code** | `.claude-plugin/plugin.json` + marketplace | `SessionStart`, `Stop` (stdin JSON) | `CLAUDE.md` |
| **Codex CLI** | Full plugin + marketplace (`.codex-plugin/plugin.json`, `skills/`, `hooks/hooks.json`, `.mcp.json`); honors `CLAUDE_PLUGIN_ROOT` | `SessionStart`, `Stop`, Pre/PostToolUse (no PreCompact); behind `[features] plugin_hooks=true` + one-time `/hooks` approval | `AGENTS.md` |
| **Gemini CLI** | Extensions (`gemini-extension.json` + gallery); `gemini extensions install <git>` | `SessionStart`, **`AfterAgent`**, `SessionEnd`, `PreCompress` (PascalCase) | `GEMINI.md` via `contextFileName` |
| **VS Code Copilot** | MCP via `.vscode/mcp.json` | none usable | own rules files |
| **Cursor** | MCP via `.cursor` config | none usable | own rules files |

**Key insight:** Codex and Gemini both converged on the Claude Code plugin model. Claude + Codex + Gemini can share one bundle (skills + hooks + MCP), with thin per-platform manifests. The existing `hooks/hooks.json` (`SessionStart`/`Stop`, `${CLAUDE_PLUGIN_ROOT}`) is already Codex-compatible; Gemini needs only an event-name remap.

## Design

### 1. One portable core, generated per-platform shells

The product is already platform-agnostic: the **MCP server** (`server.bundle.mjs`), the **`predicate` CLI** (called by hooks), and the **behavioral guidance**. Only four things vary per platform: MCP registration, hook wiring + event names, guidance-file format, and distribution. Keep one canonical source for each and **generate** the per-platform shells — never hand-maintain parallel copies (that drift is the root cause of the current breakage).

### 2. Tiered support model

- **Tier 1 — full parity, shared plugin bundle: Claude, Codex, Gemini.** Same `skills/` + hooks + MCP config. Codex reuses `hooks/hooks.json` as-is. Gemini gets a generated `hooks/hooks.json` with its real event names; the existing `extract --platform gemini` transcript adapter feeds the deterministic extractor.
- **Tier 2 — tools + guidance: VS Code Copilot, Cursor.** Register the MCP server via the platform's config + ship the instruction file. No auto-capture (no usable lifecycle hooks).

### 3. Single source of truth + generated artifacts

Canonical inputs in `predicate-skill/`:
- `skills/predicate-reasoning/SKILL.md` — the guidance source.
- MCP env contract: `PREDICATE_BACKEND=oxigraph`, `PREDICATE_DATASET=predicate`.
- `hooks/hooks.json` — Claude/Codex hook shape.

A new build step (`scripts/gen-adapters.mjs`, invoked from `bundle`) emits, and the build asserts the outputs are in sync:
- `AGENTS.md` (Codex + Cursor + universal fallback) and `GEMINI.md`, both generated from `SKILL.md`.
- Manifests: `.codex-plugin/plugin.json` (+ `.mcp.json` + `marketplace.json`), `gemini-extension.json` (+ Gemini-specific `hooks/hooks.json` with remapped event names).
- All manifest versions synced to `package.json` (the bundle script already syncs the CLI version string).

### 4. Cross-cutting correctness fixes

1. Replace stale `FUSEKI_URL` everywhere with the oxigraph env contract.
2. Add a shared `hooks/lib/resolve-cli.sh`: try the platform's plugin-root env (`PLUGIN_ROOT`/`CLAUDE_PLUGIN_ROOT` for Codex, `${extensionPath}` for Gemini) → bundled `cli.bundle.mjs`; fall back to global `predicate`; else no-op. All hook scripts source it.
3. Fix Gemini's event names (`SessionStart`/`AfterAgent`/`SessionEnd`/`PreCompress`).
4. **Remove OpenCode completely:** delete `hooks/opencode/`, drop the `extract --platform opencode` adapter and its fixtures, and remove "OpenCode" from `plugin.json`'s description.

### 5. Installation (native per platform)

- **Claude:** `/plugin marketplace add NordicAgents/predicate` (unchanged).
- **Codex:** `codex plugin marketplace add NordicAgents/predicate` → enable. Document the two gotchas: `[features] plugin_hooks = true` and the one-time `/hooks` approval.
- **Gemini:** `gemini extensions install https://github.com/NordicAgents/predicate` → restart. (Gallery listing is a later follow-up.)
- **VS Code Copilot / Cursor (no marketplace):** `npx predicate-skill install <platform>` — a small CLI subcommand that writes the correct MCP block into `.vscode/mcp.json` / `.cursor` config and drops the instruction file. No hand-editing; runs via npx without a global install.

### 6. Validation

- Add a transcript fixture for the **Gemini `AfterAgent`** payload to `predicate-eval`, asserting `extract --platform gemini` produces the expected triples. (Codex `Stop` reuses the existing Claude Stop-payload path.)
- `predicate doctor <platform>`: verify the MCP server boots on the oxigraph backend and that hook scripts resolve the CLI.

## Sequencing

Front-load the cross-cutting fixes (§4) since they unblock every platform, then proceed in priority order:

1. **Cross-cutting fixes** — oxigraph env contract, `resolve-cli.sh`, remove OpenCode.
2. **Generator** — `scripts/gen-adapters.mjs` producing `AGENTS.md`/`GEMINI.md` + manifests; wire into `bundle` with sync assertions.
3. **Codex** — `.codex-plugin/plugin.json`, `.mcp.json`, `marketplace.json`; verify Stop-hook capture; install docs.
4. **Gemini** — `gemini-extension.json`, remapped hooks, `GEMINI.md`; `AfterAgent` fixture; install docs.
5. **VS Code Copilot** — `predicate-skill install vscode` + `.vscode/mcp.json` template + instructions.
6. **Cursor** — `predicate-skill install cursor` + `.cursor` config + instructions.

## Out of scope

- OpenCode (removed).
- Continue.dev.
- Gemini extension gallery submission (later follow-up).
- Auto-capture on VS Code Copilot / Cursor (no usable lifecycle hooks).

## Non-goals / constraints

- Do not regress the working Claude Code path; build outward from it.
- Generated artifacts must never be hand-edited; the build fails if they drift from source.
