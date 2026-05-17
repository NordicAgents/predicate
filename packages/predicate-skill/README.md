# predicate-skill

Distributable Predicate package: bundled MCP server + `predicate` CLI +
Claude Code plugin (SKILL.md + hooks + slash commands) + per-platform
hook adapters for Cursor, Gemini CLI, VS Code Copilot, OpenCode, and
Codex CLI. This is the install target for both the Claude Code
marketplace and the npm path.

Current version: **1.5.0** (`v1.5.0-stop-extract`).

## Install

Prerequisites everywhere: **Docker** (for Fuseki) and **Node 20+**.

### Claude Code marketplace

```
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

### npm (any MCP-capable host)

```bash
npm install -g predicate-skill
predicate up
predicate doctor
```

Or one-shot without a global install:

```bash
claude mcp add predicate -- npx -y predicate-skill
```

### Other platforms

See the platform-specific config templates and READMEs under `hooks/`:

| Platform | Subdirectory | Hook events wired |
|---|---|---|
| Claude Code | `hooks/` (root) | SessionStart, PreToolUse, PostToolUse, Stop |
| Gemini CLI | `hooks/gemini-cli/` | sessionStart, preCompress, stop |
| Cursor | `hooks/cursor/` | manual / cron only (no native events) |
| VS Code Copilot | `hooks/vscode-copilot/` | manual / VS Code tasks |
| OpenCode | `hooks/opencode/` | session.started, session.compacted, session.stopped |
| Codex CLI | `hooks/codex-cli/` | manual / shell alias / cron |

## CLI

```
predicate up             # docker compose up + bootstrap graphs + load TBox
predicate down           # stop fuseki, keep the volume
predicate doctor         # health checks (docker, fuseki, tbox)
predicate stats          # current kg_stats output
predicate sessionstart   # one-line KG status banner (used by hook scripts)
predicate maintain       # reaper + generalizer + promotion sweeper
predicate capture        # record a tool invocation in kg:usage (opt-in: PREDICATE_RAW_CAPTURE=1)
predicate extract        # read a Stop-hook payload and assert typed triples to kg:abox
predicate --version
predicate --help
```

## MCP tools

The bundled server exposes 9 tools over stdio: `kg_explore_schema`,
`kg_ask`, `kg_assert`, `kg_explain`, `kg_propose_schema`,
`kg_research_goal`, `kg_stats`, `kg_maintain`, `kg_capture`.

Env vars consumed at runtime:

- `FUSEKI_URL` (default `http://localhost:3030`)
- `PREDICATE_DATASET` (default `predicate`)
- `PREDICATE_CAPTURE_SKIP` (comma list of tool names to suppress in `kg_capture`, default empty)
- `PREDICATE_CAPTURE_TRUNCATE` (max chars per captured input/output field, default `500`)

## What's in this directory

- `.claude-plugin/plugin.json` — MCP server + skills + hooks registration for the Claude Code marketplace path.
- `server.bundle.mjs` — bundled MCP server (no `node_modules` required at runtime).
- `cli.bundle.mjs` — bundled `predicate` CLI, surfaced via this package's `bin` entry.
- `skills/predicate/SKILL.md` — host-agent contract: triggers, workflow, HARD-GATE anti-patterns, worked examples.
- `skills/predicate-doctor/SKILL.md`, `skills/predicate-stats/SKILL.md` — operator skills.
- `commands/{up,down,doctor,stats,ask}.md` — slash-command definitions for `/predicate:*`.
- `hooks/hooks.json` — Claude Code hook registration (SessionStart, PreToolUse, PostToolUse).
- `hooks/session-start.sh`, `hooks/pre-tool-use.sh`, `hooks/post-tool-use.sh` — Claude Code lifecycle hooks; each delegates to a `predicate` CLI subcommand.
- `hooks/{cursor,gemini-cli,vscode-copilot,opencode,codex-cli}/` — per-platform hook scripts + config templates + per-platform README.
- `compose/docker-compose.yml`, `compose/fuseki/config.ttl` — Fuseki + TDB2 config that `predicate up` launches.

## Rebuilding the bundles

Bundles are committed so the marketplace install path works without
`pnpm install`. To rebuild after a source change:

```bash
pnpm --filter predicate-skill bundle
```

Or rebuild everything (all workspace packages plus the bundles):

```bash
pnpm build
```

## Tests

The full workspace test suite runs against a live Fuseki:

```bash
predicate up
pnpm test           # 160 tests across 5 packages
```

## License

Apache-2.0. See `LICENSE`.
