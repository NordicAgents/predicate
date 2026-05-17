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
<summary><strong>Cursor</strong> — MCP-only via settings.json</summary>

Cursor reads MCP servers from `~/.cursor/mcp.json` (or the project-local
`.cursor/mcp.json`). Add this entry:

```json
{
  "mcpServers": {
    "predicate": {
      "command": "node",
      "args": ["/absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs"],
      "env": {
        "FUSEKI_URL": "http://localhost:3030",
        "PREDICATE_DATASET": "predicate"
      }
    }
  }
}
```

Substitute the absolute path to your local clone of this repo. Then in Cursor,
invoke the 8 `kg_*` tools directly — Cursor doesn't read `SKILL.md`, so you'll
need to guide it. (Bring Fuseki up first: `predicate up`.)

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
<summary><strong>OpenCode</strong> — MCP-only via plugin manifest</summary>

OpenCode reads plugins via `openclaw.plugin.json`. Add an MCP server entry
pointing at the bundle, or wrap as a plugin if your version supports it. For a
minimal MCP server registration consult the OpenCode docs; the bundle path is:

```
/absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
```

Env vars: `FUSEKI_URL`, `PREDICATE_DATASET`.

</details>

<details>
<summary><strong>Any-MCP / Gemini CLI / Codex CLI / generic</strong></summary>

Any client that speaks MCP over stdio can use the bundled server directly:

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate
pnpm install && pnpm build
predicate up

# Then point your MCP-capable tool at:
#   node /absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
# with env FUSEKI_URL=http://localhost:3030 PREDICATE_DATASET=predicate
```

For Gemini CLI specifically, the MCP block in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "predicate": {
      "command": "node",
      "args": ["/absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs"]
    }
  }
}
```

Hook adapters (`BeforeTool`/`AfterTool` integration like context-mode has)
are Claude-Code-only in v1.2. Other platforms get the 8 `kg_*` tools, which
work without hooks.

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

## CLI

```
predicate up           # docker compose up + bootstrap graphs + load TBox
predicate down         # stop fuseki, keep the volume
predicate doctor       # health checks (docker, fuseki, tbox, tools)
predicate stats        # current kg_stats output
predicate --version
predicate --help
```

## Packages

| Package | Purpose |
|---|---|
| `predicate-server` | Fuseki/TDB2 in Docker; 8 named graphs (dev workflow) |
| `predicate-mcp` | MCP server; 8 tools, all implemented |
| `predicate-reasoner` | OWL 2 RL reasoner (16 rules) + SHACL + kg_explain |
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

**v1.2 — multi-platform.** Distributable via Claude Code marketplace, Cursor,
Continue.dev, OpenCode, and any generic MCP client. npm publish prep complete
(maintainer-gated). Slash commands shipped for the five common ops.

Earlier milestones (in order): `v0.1.0-foundation` → `v0.2.0-discipline` →
`v0.3a.0-goals-and-gaps` → `v0.3b.0-research-execution` →
`v0.3c.0-schema-evolution` → `v1.0.0` → `v1.1.0-distribution` →
`v1.2.0-multiplatform`.

Deferred to v1.3 (see spec §17): materialization caching, tag-while-deriving
for `kg_explain`, intent-aware `ResearchSource` filtering, journal-based
cross-system promotion atomicity, LLM-augmented decomposer + extractor,
non-Claude-Code hook adapters.
