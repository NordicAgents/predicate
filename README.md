# Predicate

A local-first MCP skill that gives AI agents a knowledge graph they can reason
over and that improves itself with use.

See [`docs/predicate-prd.md`](docs/predicate-prd.md) for the product brief,
[`docs/superpowers/specs/2026-05-16-predicate-design.md`](docs/superpowers/specs/2026-05-16-predicate-design.md)
for the v1 architecture.

## Install

Prerequisites everywhere: **Docker** (for Fuseki) and **Node 20+**.

<details open>
<summary><strong>Claude Code</strong> — marketplace, full plugin (SKILL.md + hooks + slash commands)</summary>

```
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`). Then:

```bash
predicate up           # starts Fuseki, loads seed TBox + meta + shapes
predicate doctor       # confirms everything is green
```

Slash commands available: `/predicate:up`, `/predicate:down`, `/predicate:doctor`,
`/predicate:stats`, `/predicate:ask <question>`.

</details>

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

<details>
<summary><strong>Continue.dev</strong> — MCP-only via config.yaml</summary>

In `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: predicate
    command: node
    args:
      - /absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
    env:
      FUSEKI_URL: http://localhost:3030
      PREDICATE_DATASET: predicate
```

</details>

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

<details>
<summary><strong>From npm (after publish)</strong></summary>

Once `predicate-skill` is published to npm (see `docs/superpowers/plans/2026-05-17-predicate-phase-6-publish-and-multiplatform.md` for the publish flow), users can:

```bash
npm install -g predicate-skill
predicate up
predicate doctor

# Or one-shot MCP without global install:
claude mcp add predicate -- npx -y predicate-skill
```

Status: package metadata is publish-ready (Phase 6); the `npm publish`
itself is gated by maintainer credentials.

</details>

## Tools

| Tool | What it does |
|---|---|
| `kg_explore_schema` | Returns the TBox slice for a concept (classes, properties, characteristics). |
| `kg_ask` | Executes a caller-drafted SPARQL query, logs to `kg:usage`, truncates results. |
| `kg_assert` | Writes a triple to `kg:abox` with RDF-star provenance; rejects undeclared predicates. |
| `kg_explain` | Returns a backward-chained derivation for a claim, with cited provenance. |
| `kg_propose_schema` | Stages a `SchemaDelta` proposal in `kg:tbox-staging`. |
| `kg_research_goal` | Decompose a goal → gap-detect → (optional) execute research → return a plan. |
| `kg_stats` | Triples / abox / inferred / tbox counts, inferred ratio, unused-concept ratio. |
| `kg_maintain` | Runs reaper + generalizer + promotion sweeper. |
| `kg_capture` | Record a tool invocation (toolName, input, output, sessionId, phase) into `kg:usage`. Used by PreToolUse/PostToolUse hook scripts. |

## CLI

```
predicate up             # docker compose up + bootstrap graphs + load TBox
predicate down           # stop fuseki, keep the volume
predicate doctor         # health checks (docker, fuseki, tbox, tools)
predicate stats          # current kg_stats output
predicate sessionstart   # one-line KG status banner (used by hook scripts)
predicate maintain       # reaper + generalizer + promotion sweeper
predicate capture        # record a tool call in kg:usage (opt-in: PREDICATE_RAW_CAPTURE=1)
predicate extract        # read a Stop-hook payload and assert typed triples to kg:abox
predicate --version
predicate --help
```

## Packages

| Package | Purpose |
|---|---|
| `predicate-server` | Fuseki/TDB2 in Docker; 8 named graphs (dev workflow) |
| `predicate-mcp` | MCP server; 8 tools, all implemented |
| `predicate-reasoner` | OWL 2 RL reasoner (19 rules) + SHACL + kg_explain |
| `predicate-agent` | Goal store, decomposer, gap detector, research, schema proposer, sweeper, generalizer |
| `predicate-cli` | `predicate up/down/doctor/stats` CLI |
| `predicate-ontology` | Versioned TBox + SHACL shapes + meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | Claude Code plugin — bundled server + CLI + SKILL.md + hooks |

## Development

Clone, install, build, test, run:

```bash
git clone https://github.com/mxresearch/predicate
cd predicate
pnpm install
pnpm build            # builds all packages + the plugin bundle
pnpm test             # 148 tests against a live Fuseki
pnpm fuseki:up        # for development; `predicate up` is the user-facing alias
```

See `docs/superpowers/plans/` for the per-phase implementation plans
(Foundation through Distribution).

## Status

**v1.8 — Cross-platform Stop extraction.** Stop-hook turn extraction
now works on Gemini CLI and OpenCode alongside Claude Code. `predicate
extract --from-stdin` accepts a new `--platform claude-code|gemini|opencode`
flag (default `claude-code`) that selects a per-platform transcript
adapter. Each adapter is a pure function that maps the platform's
JSONL events into the canonical assistant/user tool_use/tool_result
shape the deterministic extractor already understands, so the
downstream pipeline (deterministic + semantic extractors → kg_assert
→ SHACL → reasoner) is unchanged. The Gemini and OpenCode `stop.sh`
hooks now pipe stdin into `predicate extract --from-stdin --platform <p>`
before invoking `predicate maintain`, mirroring Claude Code's flow.

Notes on the new adapters:

- Gemini CLI and OpenCode transcript schemas are not formally
  documented and may vary by version. The adapters use permissive
  field-candidate matching (e.g. `id | toolCallId | tool_use_id`) and
  fall through silently on unrecognized shapes — empty triples are
  acceptable, crashes are not.
- All three `stop.sh` scripts are fail-open (exit 0 on any error) so a
  capture failure never blocks the user's next prompt.

**v1.7 — Reasoning bridge for action data.** The 16-rule OWL 2 RL
reasoner is now joined by three derive-only rules (R17 Hotspot, R18
FlakyCommand, R19 ActiveFile) that turn Phase 9's extracted
`modifiedIn`/`failedIn`/`at` action triples into queryable derived
classes in `kg:inferred`. `kg_maintain` now runs the fixpoint after
the sweep, so `kg:inferred` reflects the current action graph after
every Stop-hook extraction + maintenance pass.

The derived classes (see SKILL.md §4):

| Derived class | Means |
|---|---|
| `codebase:Hotspot` | File modified in >= 3 sessions |
| `codebase:FlakyCommand` | Command that has failed in >= 2 sessions |
| `codebase:ActiveFile` | File modified in the single most-recent session |

Earlier milestones (in order): `v0.1.0-foundation` → `v0.2.0-discipline` →
`v0.3a.0-goals-and-gaps` → `v0.3b.0-research-execution` →
`v0.3c.0-schema-evolution` → `v1.0.0` → `v1.1.0-distribution` →
`v1.2.0-multiplatform` → `v1.3.0-platform-hooks` → `v1.4.0-tool-capture` →
`v1.5.0-stop-extract` → `v1.6.x-hooks-fixes` → `v1.7.0-reasoning-bridge` →
`v1.8.0-cross-platform-stop`.

Deferred to v1.6 (see spec §17): cross-validation between deterministic
and semantic extractors; cross-platform Stop-hook extraction
(Gemini / OpenCode have different transcript shapes); `predicate
captures` query CLI; materialization caching; tag-while-deriving for
`kg_explain`; intent-aware `ResearchSource` filtering; journal-based
cross-system promotion atomicity.
