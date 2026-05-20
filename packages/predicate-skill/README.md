# Predicate

**Reasoning memory for AI agents — a self-improving knowledge graph that grows with use.**

[![npm](https://img.shields.io/npm/v/predicate-skill?label=npm&color=blue)](https://www.npmjs.com/package/predicate-skill)
[![marketplace](https://img.shields.io/badge/Claude%20Code-Marketplace-blue)](https://github.com/NordicAgents/predicate)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/NordicAgents/predicate?style=flat&color=yellow)](https://github.com/NordicAgents/predicate/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/NordicAgents/predicate?color=green)](https://github.com/NordicAgents/predicate/commits)

## Quick start

**Prerequisite: Node 20+.** No Docker, no database to run.

```bash
npm install -g predicate-skill
predicate up        # creates the local store + the 8 named graphs
predicate doctor    # all checks green
```

Your knowledge graph lives at `~/.predicate/store/` (in-process Oxigraph,
file-backed). Done.

## What it is

An AI coding or research agent loses continuity across sessions, and what
it does remember it cannot defend. Predicate is an MCP skill that gives the
agent a real reasoning graph instead of a flat memory:

1. **RDF/OWL with logical entailment.** Facts are stored as triples in a
   local RDF store (Oxigraph by default; Fuseki opt-in). A curated OWL 2 RL
   ruleset materializes entailments through SPARQL `CONSTRUCT` rules; SHACL
   covers closed-world validation. The model formulates SPARQL against a
   freshly read schema and reads logically entailed answers — never
   hand-derived ones.
2. **Provenance per triple.** Every fact carries source, time, confidence,
   and extraction method via RDF-star. Low-confidence triples stay visible
   to queries but are excluded from the inference closure so they cannot
   poison entailment. `kg_explain` returns the cited derivation for any claim.
3. **Schema as code, with a use-gated promotion loop.** The agent never
   edits the schema directly — it proposes deltas to `kg:tbox-staging`. A
   delta is promoted into `kg:tbox` only after N successful queries inside a
   TTL. Unused proposals expire quietly, so the graph cannot thrash.
4. **Goal-conditioned growth.** Concepts enter because a goal needed them,
   not because a document mentioned them. Periodic generalization and a
   reaper sweep keep size bounded.
5. **Cross-session continuity.** A Stop hook extracts typed triples from
   each turn — files modified, commands that passed or failed — into
   `kg:abox`. The reasoner derives `Hotspot`, `FlakyCommand`, and
   `ActiveFile` so `kg_ask` can answer "what is unstable here?" next session
   without re-reading the repo.

## Use it in your agent

<details open>
<summary><strong>Claude Code</strong> — one-command marketplace install</summary>

```bash
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`), then:

```bash
predicate up
predicate doctor
```

`doctor` reports the active backend and checks what that backend needs —
store directory writable (Oxigraph) or Docker + Fuseki reachable (opt-in) —
plus the named graphs, the reasoner, and plugin registration.

**Slash commands:**

| Command | What it does |
|---|---|
| `/predicate:up` | Open the backend and bootstrap the 8 named graphs. |
| `/predicate:down` | Close the backend (no daemon on Oxigraph; `docker compose down` on Fuseki). |
| `/predicate:doctor` | Backend-aware health check. |
| `/predicate:stats` | Triple / ABox / inferred / TBox counts and ratios. |
| `/predicate:ask <question>` | Free-form question routed through `kg_ask`. |

**Routing:** Automatic. SessionStart injects a one-line status banner;
PreToolUse / PostToolUse / Stop hooks capture tool calls and extract typed
session triples — no file is written to your project.

<details>
<summary>Alternative — MCP-only (no hooks or slash commands)</summary>

```bash
claude mcp add predicate -- npx -y predicate-skill
```

All `kg_*` tools, no lifecycle hooks. Good for a quick trial.

</details>

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g predicate-skill
predicate up
cp "$(npm root -g)/predicate-skill/hooks/cursor/mcp.json.template" ~/.cursor/mcp.json
```

Edit `~/.cursor/mcp.json`, replacing `__PLUGIN_DIR__` with
`$(npm root -g)/predicate-skill`. Reload MCP servers (Cmd-Shift-P →
"Reload MCP servers"), then type `predicate stats` in agent chat to verify.

Cursor has no native session events; the SessionStart / PreCompact / Stop
maintenance scripts under `hooks/cursor/` can be wired via cron or a shell
alias — see `hooks/cursor/README.md`.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/gemini-cli/settings.json.template`
into `~/.gemini/settings.json`, replacing `__PLUGIN_DIR__`. Restart Gemini
CLI; `/mcp list` should show `predicate: ... Connected`. The Stop hook pipes
each transcript through `predicate extract` so session triples land in
`kg:abox` after every turn.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/opencode/opencode.json.template`
into `~/.config/opencode/opencode.json`, replacing `__PLUGIN_DIR__`. Restart
OpenCode; type `predicate stats` to verify. The session.stopped hook runs
`predicate extract` automatically.

</details>

<details>
<summary><strong>VS Code Copilot</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/vscode-copilot/settings.json.template`
into your VS Code `settings.json`, replacing `__PLUGIN_DIR__`. Restart VS
Code; type `predicate stats` in Copilot Chat to verify. VS Code exposes no
lifecycle events yet — see `hooks/vscode-copilot/README.md` for manual / task
wiring of the maintenance scripts.

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/codex-cli/config.toml.template`
into `~/.codex/config.toml`, replacing `__PLUGIN_DIR__`. Launch `codex` and
type `predicate stats` to verify. No lifecycle events yet — see
`hooks/codex-cli/README.md` for shell-alias wiring.

</details>

<details>
<summary><strong>Continue.dev</strong></summary>

In `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: predicate
    command: predicate-skill
```

Then `predicate up` and restart Continue.

</details>

## Storage backends

- **Oxigraph (default).** In-process, file-backed at `~/.predicate/store/`
  (one N-Quads file per named graph). No Docker, no daemon, sub-second
  start. You get this unless you opt out.
- **Fuseki (opt-in).** Apache Jena Fuseki / TDB2 in Docker. Set
  `PREDICATE_BACKEND=fuseki`. Requires Docker.

Migrate an existing Fuseki store to Oxigraph in place:

```bash
predicate migrate --from fuseki --to oxigraph
unset PREDICATE_BACKEND
predicate down            # stop the Fuseki container; data is now in Oxigraph
```

## Bootstrap modes

On first `predicate up`:

- **Community ontology** — install a bundled vocabulary (`top`, `codebase`,
  `foaf`, `schema-org-lite`, `fhir-core`).
- **Bring your own** — upload a Turtle file as the initial TBox.
- **Empty** — start with no schema; the agent grows vocabulary through the
  propose → validate → 3-uses-in-7-days promotion gate.

Non-interactive: `predicate init --mode community --ontology codebase`
(or `--mode empty`). Schema-learning toggles at runtime via
`kg_config_set` / `kg_config_get`.

## MCP tools

The bundled server exposes 11 tools over stdio:

| Tool | What it does |
|---|---|
| `kg_explore_schema` | Returns the TBox slice for a concept so the model uses real predicates. |
| `kg_ask` | Runs a caller-drafted SPARQL query against asserted + inferred graphs. |
| `kg_assert` | Writes a triple to `kg:abox` with RDF-star provenance. Rejects undeclared predicates. |
| `kg_explain` | Returns the backward-chained derivation for a claim, with cited provenance. |
| `kg_propose_schema` | Stages a `SchemaDelta` proposal in `kg:tbox-staging`. |
| `kg_research_goal` | Decompose a goal → gap-detect → optionally execute research → return a plan. |
| `kg_stats` | Triple / ABox / inferred / TBox counts and ratios. |
| `kg_maintain` | Runs reaper, generalizer, and promotion sweeper, then re-materializes inferred. |
| `kg_capture` | Records a tool invocation into `kg:usage`. Used by the lifecycle hooks. |
| `kg_config_get` / `kg_config_set` | Read or update runtime config. |

## CLI

```
predicate up                # open the store (Oxigraph default) + bootstrap the 8 graphs
predicate init              # seed kg:tbox (community / upload / empty)
predicate down              # close the store (or stop the Fuseki container)
predicate doctor            # backend-aware health checks
predicate stats             # current kg_stats output
predicate migrate --from fuseki --to oxigraph   # move an existing Fuseki store to Oxigraph
predicate maintain          # reaper + generalizer + promotion sweeper
predicate extract           # read a Stop-hook payload and assert typed triples to kg:abox
predicate sessions          # list recent extracted sessions
predicate recall <query>    # substring search over session history
predicate dashboard         # localhost web view of session history + reasoning output

predicate --version
predicate --help
```

## Environment

| Var | Default | What it controls |
|---|---|---|
| `PREDICATE_BACKEND` | `oxigraph` | Storage backend: `oxigraph` (in-process) or `fuseki` (Docker, opt-in). |
| `PREDICATE_STORE_PATH` | `~/.predicate/store` | Oxigraph store directory (respects `XDG_DATA_HOME`). |
| `FUSEKI_URL` | `http://localhost:3030` | Fuseki endpoint — only used when `PREDICATE_BACKEND=fuseki`. |
| `PREDICATE_DATASET` | `predicate` | Fuseki dataset name — only used with the Fuseki backend. |
| `PREDICATE_CAPTURE_TRUNCATE` | `500` | Max chars per captured input/output field. |
| `PREDICATE_RAW_CAPTURE` | unset | When `1`, raw PreToolUse/PostToolUse captures are persisted to `kg:usage`. |
| `ANTHROPIC_API_KEY` | unset | Enables the LLM-augmented decomposer fallback in `kg_research_goal`. |

## What's in this package

| Path | Purpose |
|---|---|
| `.claude-plugin/plugin.json` | MCP + skills + hooks registration for the Claude Code marketplace. |
| `server.bundle.mjs` | Bundled MCP server (`oxigraph` loaded from `node_modules` at runtime). |
| `cli.bundle.mjs` | Bundled `predicate` CLI, surfaced via this package's `bin`. |
| `skills/predicate/SKILL.md` | Host-agent contract: triggers, workflow, anti-patterns, worked examples. |
| `commands/{up,down,doctor,stats,ask}.md` | Slash-command definitions for `/predicate:*`. |
| `hooks/` | Claude Code lifecycle hooks + per-platform templates (cursor, gemini-cli, vscode-copilot, opencode, codex-cli). |
| `compose/` | Fuseki + TDB2 docker-compose config — only used by the opt-in Fuseki backend. |
| `catalog/`, `meta/` | Bundled ontology catalog + meta vocabulary for `predicate init`. |

## Rebuilding the bundles

The bundles are committed so the marketplace install path works without a
build step. To rebuild after a source change:

```bash
pnpm --filter predicate-skill bundle
```

`oxigraph` is kept external (it ships a native `.wasm` asset that can't be
inlined) and is declared in `dependencies`, so `npm install -g predicate-skill`
fetches it automatically.

## License

Elastic License 2.0 (ELv2) — source-available. See [`LICENSE`](LICENSE).
