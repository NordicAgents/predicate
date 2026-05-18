# Predicate

**Reasoning memory for AI agents — a knowledge graph that compounds with use.**

[![npm](https://img.shields.io/npm/v/predicate-skill?label=npm&color=blue)](https://www.npmjs.com/package/predicate-skill)
[![marketplace](https://img.shields.io/badge/Claude%20Code-Marketplace-blue)](https://github.com/NordicAgents/predicate)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/NordicAgents/predicate?style=flat&color=yellow)](https://github.com/NordicAgents/predicate/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/NordicAgents/predicate?color=green)](https://github.com/NordicAgents/predicate/commits)

## The Problem

An AI coding or research agent loses most of its value to two failures: it
forgets across sessions, and it can only answer single-hop lookups. Ask
*"why did login break?"* and a RAG system returns documents containing the
word *login*. It cannot traverse
`auth.ts → validateToken → jwt.verify → JWT_SECRET → .env.production`,
cannot tell you the blast radius of a rename, and cannot say which of two
documents contradicts the other. The "agent memory" category mostly stores
text or vectors with light graph structure on top — it does not separate
schema from data, does not run a reasoner, does not track provenance per
fact, and grows without bound until the operator cleans up by hand.

### How Predicate solves it

Predicate is an MCP skill that gives the agent a real reasoning graph,
not a search index.

1. **RDF/OWL, not retrieval.** Facts are stored as triples in Apache Jena
   Fuseki. A curated OWL 2 RL ruleset materializes entailments through
   SPARQL `CONSTRUCT` rules; SHACL covers closed-world validation. The
   model formulates SPARQL against a freshly read schema — pre-baked
   queries are forbidden — and reads logically entailed answers, never
   hand-derived ones.
2. **Provenance per triple.** Every fact carries source, time, confidence,
   and extraction method via RDF-star. Low-confidence triples stay visible
   to queries but are excluded from the inference closure so they cannot
   poison entailment. `kg_explain` returns the backward-chained derivation
   for any claim with citations.
3. **Schema as code, with a use-gated promotion loop.** The TBox lives in
   git as Turtle. The agent never edits it directly — it proposes deltas
   to `kg:tbox-staging`. The reasoner validates each proposal; only after
   N successful queries inside a TTL is a delta promoted into `kg:tbox`.
   Unused proposals expire quietly. The graph cannot thrash because the
   gate, not the goal source, is the safety mechanism.
4. **Goal-conditioned growth.** Concepts enter because a goal needed
   them, not because a document mentioned them. `kg_research_goal`
   decomposes a goal, detects schema or data gaps, and runs research only
   where the existing graph cannot answer. Periodic generalization and a
   reaper sweep keep size bounded.
5. **Cross-session continuity.** A Stop hook on each platform extracts
   typed triples from the turn — files modified, commands that succeeded
   or failed, decisions reached — and asserts them into `kg:abox`. The
   reasoner derives `Hotspot`, `FlakyCommand`, and `ActiveFile` from
   action data so `kg_ask` can answer "what is unstable here?" without
   re-reading the repo next session.

## Install

Prerequisites everywhere: **Docker** (for Fuseki) and **Node 20+**.

<details open>
<summary><strong>Claude Code</strong> — plugin marketplace, fully automatic</summary>

**Install:**

```bash
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`). Then start the graph:

```bash
predicate up
```

**Verify:**

```bash
predicate doctor
```

All checks should show OK. The doctor validates Docker, Fuseki, the named
graphs, the reasoner, and plugin registration.

**Slash commands:**

| Command | What it does |
|---|---|
| `/predicate:up` | Start Fuseki and bootstrap the 9 named graphs. |
| `/predicate:down` | Stop Fuseki, keep the volume. |
| `/predicate:doctor` | Health check across Docker, Fuseki, TBox, tools. |
| `/predicate:stats` | Triples, ABox, inferred, TBox counts; inferred ratio; unused-concept ratio. |
| `/predicate:ask <question>` | Free-form question routed through `kg_ask`. |

**Routing:** Automatic. The SessionStart hook injects a one-line KG
status banner. PreToolUse, PostToolUse, and Stop hooks capture tool
calls and extract typed session triples — no file is written to your
project.

<details>
<summary>Alternative — MCP-only install (no hooks or slash commands)</summary>

```bash
claude mcp add predicate -- npx -y predicate-skill
```

This gives you all `kg_*` tools without lifecycle hooks. Good for a quick
trial before installing the full plugin.

</details>

</details>

<details>
<summary><strong>Any MCP-capable client</strong> — npm install</summary>

```bash
npm install -g predicate-skill
predicate up
predicate doctor
```

The bundled MCP server lives at the package's `bin` entry. Point any
MCP-over-stdio client at `predicate-skill` (or
`node /path/to/predicate-skill/server.bundle.mjs`) with env
`FUSEKI_URL=http://localhost:3030` and `PREDICATE_DATASET=predicate`.

</details>

<details>
<summary><strong>Cursor</strong> — MCP + maintenance scripts</summary>

**Install:**

1. Install context-mode globally and start Fuseki:

   ```bash
   npm install -g predicate-skill
   predicate up
   ```

2. Copy the MCP config template to `~/.cursor/mcp.json` and replace
   `__PLUGIN_DIR__` with the absolute path to the installed
   `predicate-skill` directory:

   ```bash
   cp $(npm root -g)/predicate-skill/hooks/cursor/mcp.json.template ~/.cursor/mcp.json
   ```

3. Reload MCP servers (Cmd-Shift-P → "Reload MCP servers").

**Verify:** Open Cursor Settings → MCP and confirm "predicate" is
connected. In agent chat, type `predicate stats`.

**Routing:** Cursor has no native SessionStart / Stop events. The
SessionStart, PreCompact, and Stop maintenance scripts under
`hooks/cursor/` can be wired via cron or a shell alias — see
`hooks/cursor/README.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong> — MCP + sessionStart + preCompress + stop hooks</summary>

**Install:**

1. Install and start Fuseki:

   ```bash
   npm install -g predicate-skill
   predicate up
   ```

2. Merge the template into `~/.gemini/settings.json`, replacing
   `__PLUGIN_DIR__` with the absolute path to the installed
   `predicate-skill` directory:

   ```bash
   cat $(npm root -g)/predicate-skill/hooks/gemini-cli/settings.json.template
   ```

3. Restart Gemini CLI.

**Verify:** `/mcp list` should show `predicate: ... Connected`.

**Routing:** Automatic via the three hook events. The Stop hook pipes
the transcript through `predicate extract --from-stdin --platform gemini`
so session triples land in `kg:abox` after every turn.

</details>

<details>
<summary><strong>VS Code Copilot</strong> — MCP via settings.json</summary>

**Install:**

1. Install and start Fuseki:

   ```bash
   npm install -g predicate-skill
   predicate up
   ```

2. Merge `hooks/vscode-copilot/settings.json.template` into your VS Code
   `settings.json`, replacing `__PLUGIN_DIR__`. Restart VS Code.

**Verify:** Open Copilot Chat and type `predicate stats`.

**Routing:** VS Code Copilot does not yet expose SessionStart / PreCompact
/ Stop events. See `hooks/vscode-copilot/README.md` for manual and
VS Code-task wiring of the maintenance scripts.

</details>

<details>
<summary><strong>OpenCode</strong> — MCP + session.started + session.compacted + session.stopped hooks</summary>

**Install:**

1. Install and start Fuseki:

   ```bash
   npm install -g predicate-skill
   predicate up
   ```

2. Merge `hooks/opencode/opencode.json.template` into
   `~/.config/opencode/opencode.json`, replacing `__PLUGIN_DIR__`.

3. Restart OpenCode.

**Verify:** In the OpenCode session, type `predicate stats`.

**Routing:** Automatic via the three lifecycle events. The
session.stopped hook pipes the transcript through
`predicate extract --from-stdin --platform opencode`.

</details>

<details>
<summary><strong>Codex CLI</strong> — MCP via config.toml</summary>

**Install:**

1. Install and start Fuseki:

   ```bash
   npm install -g predicate-skill
   predicate up
   ```

2. Merge `hooks/codex-cli/config.toml.template` into
   `~/.codex/config.toml`, replacing `__PLUGIN_DIR__`.

**Verify:** Launch `codex` and type `predicate stats`.

**Routing:** Codex CLI has no lifecycle events yet. See
`hooks/codex-cli/README.md` for shell-alias wiring of the maintenance
scripts.

</details>

<details>
<summary><strong>Continue.dev</strong> — MCP via config.yaml</summary>

In `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: predicate
    command: predicate-skill
    env:
      FUSEKI_URL: http://localhost:3030
      PREDICATE_DATASET: predicate
```

Then `predicate up` and restart Continue.

</details>

## Bootstrap modes

On first `predicate up`, choose how to seed the schema:

- **Community ontology** — install a bundled vocabulary (`top`,
  `codebase`, `foaf`, `schema-org-lite`, `fhir-core`) from the catalog
  in `packages/predicate-ontology/catalog/`.
- **Bring your own** — upload a Turtle file as the initial TBox.
- **Empty** — start with no schema; let the agent grow vocabulary through
  the propose → validate → 3-uses-in-7-days promotion gate.

Schema-learning is toggleable at runtime via `kg_config_set` /
`kg_config_get`.

## MCP tools

The bundled server exposes 11 tools over stdio:

| Tool | What it does |
|---|---|
| `kg_explore_schema` | Returns the TBox slice for a concept so the model uses real predicates. |
| `kg_ask` | Executes a caller-drafted SPARQL query against asserted + inferred graphs. Logs to `kg:usage`, truncates results, supports `includeRemote: true` for peer-federated queries. |
| `kg_assert` | Writes a triple to `kg:abox` with RDF-star provenance. Rejects undeclared predicates. |
| `kg_explain` | Returns the backward-chained derivation for a claim, with cited provenance. |
| `kg_propose_schema` | Stages a `SchemaDelta` proposal in `kg:tbox-staging`. |
| `kg_research_goal` | Decompose a goal → gap-detect → optionally execute research → return a plan. |
| `kg_stats` | Triples, ABox, inferred, TBox counts; inferred ratio; unused-concept ratio. |
| `kg_maintain` | Runs reaper, generalizer, and promotion sweeper, then re-materializes inferred. |
| `kg_capture` | Records a tool invocation (toolName, input, output, sessionId, phase) into `kg:usage`. Used by PreToolUse / PostToolUse hooks. |
| `kg_config_get` / `kg_config_set` | Read or update runtime config (e.g. schema-learning toggle). |

## CLI

```
predicate up                # docker compose up + bootstrap the 9 named graphs
predicate init              # initialize kg:tbox (community / upload / empty)
predicate down              # stop Fuseki, keep the volume
predicate doctor            # health checks (docker, fuseki, tbox, tools)
predicate stats             # current kg_stats output
predicate sessionstart      # one-line KG status banner (used by hook scripts)
predicate maintain          # reaper + generalizer + promotion sweeper
predicate capture           # record a tool call in kg:usage (opt-in: PREDICATE_RAW_CAPTURE=1)
predicate extract           # read a Stop-hook payload and assert typed triples to kg:abox
predicate sessions          # list recent extracted sessions (modifiedFiles / ok / fail)
predicate captures          # list raw kg:usage ToolCall captures
predicate recall <query>    # substring search over session history (files + commands)
predicate dashboard         # serve a localhost web view of session history + reasoning output

predicate peer add <name> <sparql-endpoint>   # register a teammate's Fuseki
predicate peer list | peer remove
predicate export-sessions [--since DATE] [--user NAME]
predicate import-sessions <file.trig>

predicate ld init           # register DBpedia + Wikidata as external LD peers
predicate ld list
predicate ld ask <query>    # one-shot SPARQL across all registered LD endpoints

predicate --version
predicate --help
```

## Environment

| Var | Default | What it controls |
|---|---|---|
| `FUSEKI_URL` | `http://localhost:3030` | Where the MCP server reaches Fuseki. |
| `PREDICATE_DATASET` | `predicate` | Fuseki dataset name. |
| `PREDICATE_CAPTURE_SKIP` | *(empty)* | Comma-separated tool names suppressed by `kg_capture`. |
| `PREDICATE_CAPTURE_TRUNCATE` | `500` | Max chars per captured input/output field. |
| `PREDICATE_RAW_CAPTURE` | unset | When `1`, raw PreToolUse/PostToolUse captures are persisted to `kg:usage`. |
| `ANTHROPIC_API_KEY` | unset | Enables the LLM-augmented decomposer fallback in `kg_research_goal`. |

## What's in this directory

| Path | Purpose |
|---|---|
| `.claude-plugin/plugin.json` | MCP + skills + hooks registration for the Claude Code marketplace. |
| `server.bundle.mjs` | Bundled MCP server — runs without `node_modules` at runtime. |
| `cli.bundle.mjs` | Bundled `predicate` CLI, surfaced via this package's `bin` entry. |
| `skills/predicate/SKILL.md` | Host-agent contract: triggers, workflow, HARD-GATE anti-patterns, worked examples. |
| `skills/predicate-doctor/`, `skills/predicate-stats/` | Operator skills. |
| `commands/{up,down,doctor,stats,ask}.md` | Slash-command definitions for `/predicate:*`. |
| `hooks/hooks.json` | Claude Code hook registration (SessionStart, PreToolUse, PostToolUse, Stop). |
| `hooks/{session-start,pre-tool-use,post-tool-use,stop}.sh` | Claude Code lifecycle hooks — each delegates to a `predicate` CLI subcommand. |
| `hooks/{cursor,gemini-cli,vscode-copilot,opencode,codex-cli}/` | Per-platform hook scripts + config templates + per-platform README. |
| `compose/docker-compose.yml`, `compose/fuseki/config.ttl` | Fuseki + TDB2 config launched by `predicate up`. |

## Rebuilding the bundles

The bundles are committed so the marketplace install path works without
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
pnpm test
```

## License

Elastic License 2.0 (ELv2) — source-available. See [`LICENSE`](LICENSE).
