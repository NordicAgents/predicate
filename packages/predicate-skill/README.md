# predicate-skill

**Reasoning memory for AI agents — a self-improving knowledge graph that grows with use.**

[![npm](https://img.shields.io/npm/v/predicate-skill?label=npm&color=blue)](https://www.npmjs.com/package/predicate-skill)
[![marketplace](https://img.shields.io/badge/Claude%20Code-Marketplace-blue)](https://github.com/NordicAgents/predicate)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](https://nodejs.org)
[![GitHub stars](https://img.shields.io/github/stars/NordicAgents/predicate?style=flat&color=yellow)](https://github.com/NordicAgents/predicate/stargazers)

This is the distributable package: a **bundled MCP server**, the **`predicate`
CLI**, the host-agent reasoning contract (`SKILL.md` / `AGENTS.md`), and
ready-to-use integration adapters for every supported client. No build step —
the bundles are committed and shipped.

> New to the project? Start with the [project overview](https://github.com/NordicAgents/predicate#readme).

## Quick start

**Prerequisite: Node 20+.** No Docker, no database to run.

```bash
npm install -g predicate-skill
predicate up        # creates the local store + the 8 named graphs
predicate doctor    # all checks green
```

Your knowledge graph lives at `~/.predicate/store/` (in-process Oxigraph,
file-backed), or in a project-local `.predicate/store` when run inside a repo.
Done.

## Install / use it in your agent

All clients run the same local Oxigraph-backed MCP server (the 9 `kg_*` tools)
and read the same reasoning guidance (`SKILL.md` on Claude Code; generated
`AGENTS.md` / `GEMINI.md` elsewhere). "Capture" = automatic Stop-hook turn
extraction into `kg:abox`.

| Platform | Install | Capture |
|---|---|---|
| **Claude Code** | `/plugin marketplace add NordicAgents/predicate` | ✅ |
| **Codex CLI** | `codex plugin marketplace add NordicAgents/predicate` | ✅ |
| **Gemini CLI** | `gemini extensions install https://github.com/NordicAgents/predicate` | ✅ |
| **VS Code Copilot** | `npx predicate-skill install vscode` | tools only |
| **Cursor** | `npx predicate-skill install cursor` | tools only |
| **Any stdio MCP client** | `node "$(npm root -g)/predicate-skill/server.bundle.mjs"` | tools only |

<details open>
<summary><strong>Claude Code</strong></summary>

```
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`), then `predicate up` and
`predicate doctor`. Hooks, slash commands, and the `kg_*` tools are wired
automatically.

| Slash command | What it does |
|---|---|
| `/predicate:up` | Open the backend and bootstrap the 8 named graphs. |
| `/predicate:down` | Close the backend (no daemon on Oxigraph; `docker compose down` on Fuseki). |
| `/predicate:status` | Backend-aware health check + triple / ABox / inferred / TBox counts. |
| `/predicate:ask <question>` | Free-form question routed through `kg_ask`. |

SessionStart injects a one-line status banner; PreToolUse / PostToolUse / Stop
hooks capture tool calls and extract typed session triples — nothing is written
to your project.

**MCP-only (no hooks or slash commands):** `claude mcp add predicate -- npx -y predicate-skill`

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

Codex (v0.117+) uses the Claude Code plugin model and honors
`CLAUDE_PLUGIN_ROOT`, so Predicate installs as a native plugin:

```bash
codex plugin marketplace add NordicAgents/predicate
# then enable "predicate" in the interactive plugin browser
```

Two one-time gotchas: set `[features] plugin_hooks = true` in
`~/.codex/config.toml`, and approve the hooks once via `/hooks`. See
`hooks/codex-cli/README.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

Installs as a self-contained extension (own MCP server, `GEMINI.md` context, and
`SessionStart` / `AfterAgent` / `PreCompress` hooks):

```bash
gemini extensions install https://github.com/NordicAgents/predicate
# restart Gemini CLI
```

Lighter MCP-only path (no capture):
`gemini mcp add predicate -s user -- node /abs/path/server.bundle.mjs`. See
`hooks/gemini-cli/README.md`.

</details>

<details>
<summary><strong>VS Code Copilot</strong> / <strong>Cursor</strong> (MCP-only)</summary>

Neither exposes usable lifecycle hooks, so reasoning queries work but there is no
automatic turn capture. From your project root:

```bash
npx predicate-skill install vscode    # writes .vscode/mcp.json + AGENTS.md
npx predicate-skill install cursor    # writes .cursor/mcp.json + AGENTS.md
```

Restart the editor. See `hooks/vscode-copilot/README.md` and
`hooks/cursor/README.md`.

</details>

## MCP tools

The bundled server exposes **9 tools** over stdio:

| Tool | What it does |
|---|---|
| `kg_explore_schema` | Returns the TBox slice (classes, sub/super, properties, characteristics) for a concept so the model uses real predicates. |
| `kg_ask` | Runs a caller-drafted SPARQL `SELECT`/`ASK` against asserted + inferred graphs; logs usage. Read-only. |
| `kg_assert` | Writes a triple to `kg:abox` with RDF-star provenance (source, confidence, method). Rejects undeclared predicates. |
| `kg_explain` | Returns one valid inference trace for a claim, with cited provenance for every asserted premise. |
| `kg_propose_schema` | Stages a `SchemaDelta` proposal (add-class, add-property, refine-class, or breaking) in `kg:tbox-staging`. |
| `kg_research_goal` | Decomposes a goal and reports which predicates the live TBox can/cannot answer. |
| `kg_extract_judgments` | Returns the `j:` schema slice, current judgments about touched entities, and a brief instructing the host model to distill this session's judgments. Makes no LLM call. |
| `kg_stats` | Triple / ABox / inferred / TBox counts, inferred ratio, unused-concept ratio, and materialization latency. |
| `kg_maintain` | Runs reaper, generalizer, and promotion sweeper, then re-materializes inferred. |

## Worked example

```text
1. kg_explore_schema { "concept": "codebase:File" }
   → File, properties: modifiedInSession, partOf …; derived class Hotspot

2. kg_assert { "subject": "file:src/auth.ts", "predicate": "codebase:modifiedInSession",
               "object": "session:42", "confidence": 0.95, "source": "stop-hook" }
   → asserted into kg:abox with RDF-star provenance

   (after the same file is touched in 3 sessions, the reasoner materializes:)
   file:src/auth.ts  rdf:type  codebase:Hotspot   → kg:inferred

3. kg_ask { "sparql": "SELECT ?f WHERE { ?f a codebase:Hotspot }" }
   → file:src/auth.ts

4. kg_explain { "claim": "file:src/auth.ts a codebase:Hotspot" }
   → rule: Hotspot ⇐ modifiedInSession in ≥3 distinct sessions
     premises: session:40, session:41, session:42  (each cited, conf 0.95)
```

The answer isn't asserted — it's *derived*, and every step traces back to a
cited fact.

## CLI reference

```text
predicate <command>

  up            Open the store + load the seed TBox. Resolves a store path:
                reuse a parent .predicate/store; else <git-root>/.predicate/store
                (auto-gitignored); else ~/.predicate/projects/<hash>/store.
                  --scope local|project|user   force a specific store
                  --if-needed                  no-op if already initialised
  init          Initialize kg:tbox: community ontology, uploaded Turtle, or empty.
  down          Stop the Oxigraph daemon (or Fuseki), preserving data.  --all sweeps all daemons
  doctor        Backend-aware health checks: docker, fuseki, tbox.
  stats         Print kg_stats output for the live graph.
  sessionstart  Print a one-line KG status banner (used by hook scripts).
  maintain      Run kg_maintain (reaper + generalizer + promotion sweeper).
  capture       Record a tool invocation in kg:usage (opt-in via PREDICATE_RAW_CAPTURE).
  extract       Read a Stop-hook payload from stdin and extract typed triples into kg:abox.
                  --replay <path>   rebuild the extracted abox slice from transcripts
  sessions      List recent extracted sessions (modifiedFiles / succeeded / failed counts).
  captures      List raw kg:usage ToolCall captures (opt-in raw-capture path).
  recall        Substring search over session history (files + commands).
  dashboard     Serve a localhost web view of session history + reasoning output.
  schema        List / approve / reject pending kg:tbox-staging proposals.
  config        Get/set runtime config (schema-learning toggle, init keys).
  migrate       Migrate data, e.g. --from fuseki --to oxigraph.
  install       Write MCP config + AGENTS.md for an MCP-only host: install <vscode|cursor>.

  --version     Print the predicate version.
  --help        Show usage.
```

### Dashboard

```bash
predicate dashboard
```

Serves a read-only view at `http://127.0.0.1:4040` — recent sessions, hotspots
(files modified in ≥3 sessions), flaky commands (failed in ≥2 sessions), active
files, and a stats snapshot. Auto-refreshes every 30s. `--port N` to override;
`--no-open` to skip the browser.

## Storage backends

- **Oxigraph (default).** In-process, file-backed (one N-Quads file per named
  graph). Tries a native Oxigraph daemon first and falls back to in-process WASM
  — no Docker, no daemon to manage, sub-second start. You get this unless you opt
  out.
- **Fuseki (opt-in).** Apache Jena Fuseki / TDB2 in Docker. Set
  `PREDICATE_BACKEND=fuseki`. Requires Docker; useful for very large graphs or
  sharing one store across processes.

Migrate an existing Fuseki store to Oxigraph in place:

```bash
predicate migrate --from fuseki --to oxigraph
unset PREDICATE_BACKEND          # drop it from your shell rc too
predicate down                   # stop the Fuseki container; data is now in Oxigraph
```

## Bootstrap modes

On first `predicate up` (or via `predicate init`):

- **Community ontology** — install a bundled vocabulary (`top`, `codebase`,
  `foaf`, `schema-org-lite`, `fhir-core`).
- **Bring your own** — upload a Turtle file as the initial TBox.
- **Empty** — start with no schema; the agent grows vocabulary through the
  propose → validate → 3-uses-in-7-days promotion gate.

Non-interactive: `predicate init --mode community --ontology codebase` (or
`--mode empty`). Schema-learning toggles at runtime via `predicate config get|set`.

## Environment

| Var | Default | What it controls |
|---|---|---|
| `PREDICATE_BACKEND` | `oxigraph` | Backend: `oxigraph` (native daemon → WASM fallback), `oxigraph-wasm` (in-process only), or `fuseki` (Docker, opt-in). |
| `PREDICATE_STORE_PATH` | resolved per scope | Explicit Oxigraph store path; overrides scope resolution. |
| `FUSEKI_URL` | `http://localhost:3030` | Fuseki endpoint — only used when `PREDICATE_BACKEND=fuseki`. |
| `PREDICATE_DATASET` | `predicate` | Fuseki dataset name — only used with the Fuseki backend. |
| `PREDICATE_ADMIN_USER` | `admin` | Fuseki admin user for `/update`. |
| `PREDICATE_ADMIN_PASSWORD` | `changeme` | Fuseki admin password for `/update`. |
| `PREDICATE_RAW_CAPTURE` | unset | When `1`, raw PreToolUse/PostToolUse captures are persisted to `kg:usage`. |
| `PREDICATE_CAPTURE_SKIP` | unset | Comma-list of tools to skip when raw capture is on. |
| `PREDICATE_CAPTURE_TRUNCATE` | `500` | Max chars per captured input/output field. |
| `ANTHROPIC_API_KEY` | unset | Fallback LLM provider when MCP host sampling is unavailable — used by `kg_research_goal`'s LLM decomposer (`useLlmDecomposer=true`) and by semantic extraction. |

## What's in this package

| Path | Purpose |
|---|---|
| `server.bundle.mjs` | Bundled MCP server (`oxigraph` loaded from `node_modules` at runtime). |
| `cli.bundle.mjs` | Bundled `predicate` CLI, surfaced via this package's `bin`. |
| `.claude-plugin/plugin.json` | MCP + skills + hooks registration for the Claude Code marketplace. |
| `.codex-plugin/`, `.mcp.json` | Generated Codex plugin manifest + MCP registration. |
| `gemini-extension/` | Generated self-contained Gemini CLI extension (own manifest, GEMINI.md, hooks, bundled server/CLI). |
| `skills/predicate-reasoning/SKILL.md` | Host-agent contract: triggers, workflow, anti-patterns, worked examples. |
| `commands/{up,down,status,ask}.md` | Slash-command definitions for `/predicate:*`. |
| `hooks/` | Shared CLI resolver + Claude Code lifecycle hooks + per-platform adapters (codex-cli, gemini-cli, cursor, vscode-copilot). |
| `AGENTS.md` | Generated from SKILL.md; reasoning guidance for Codex / Cursor / VS Code. |
| `compose/` | Fuseki + TDB2 docker-compose config — only used by the opt-in Fuseki backend. |
| `catalog/`, `meta/` | Bundled ontology catalog + meta vocabulary for `predicate init`. |
| `dashboard/` | Static assets for `predicate dashboard`. |

> The adapters in `hooks/`, `.codex-plugin/`, `gemini-extension/`, and `AGENTS.md`
> are **generated** — edit the sources and rebuild, don't hand-edit them.

## Rebuilding the bundles

The bundles are committed so the marketplace install path works without a build
step. To rebuild after a source change (from the monorepo root):

```bash
pnpm --filter predicate-skill bundle
```

`oxigraph` is kept external (it ships a native `.wasm` asset that can't be
inlined) and is declared in `dependencies`, so `npm install -g predicate-skill`
fetches it automatically.

## License

Elastic License 2.0 (ELv2) — source-available. See [`LICENSE`](LICENSE).
