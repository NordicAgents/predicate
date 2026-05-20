# Predicate

**Reasoning memory for AI agents — a self-improving knowledge graph that grows with use.**

Predicate gives an AI coding or research agent a structured graph it can
query, reason over, and grow with use. Facts are stored as RDF triples
with per-triple provenance and confidence. An OWL 2 RL reasoner
materializes entailments deterministically and produces an explanation
path for every derived claim. The schema is versioned like code and
evolves under a propose → validate → use-gated promotion loop.
Everything runs locally — no daemon, no Docker by default — and nothing
leaves the machine.

What that buys an agent that a flat memory doesn't:

- **Auditable answers.** `kg_explain` returns the chain of triples and
  rules that produced a claim, each step cited back to its source and
  confidence. Useful when the agent's output drives a change you have to
  defend.
- **Contradictions surface instead of averaging out.** When two sources
  disagree about a fact the schema marks as functional or disjoint, the
  reasoner flags the conflict rather than silently picking one.
- **The graph remembers, and the schema earns its keep.** Facts persist
  across sessions with provenance. New schema only becomes durable after
  three real queries reference it within a week — proposals nothing
  references expire from staging on their own.

See [`docs/predicate-prd.md`](docs/predicate-prd.md) for the full product brief.

## How it works

- **Storage.** In-process Oxigraph by default (file-backed N-Quads in
  `~/.predicate/store/`); Apache Jena Fuseki / TDB2 as an opt-in backend via
  `PREDICATE_BACKEND=fuseki`. Either way the layout is 9 named graphs that
  separate slow-changing schema (`kg:tbox`) from fast-flowing facts
  (`kg:abox`), materialized entailments (`kg:inferred`), per-triple metadata
  (`kg:provenance`), goals (`kg:goals`), usage logs (`kg:usage`), staging
  (`kg:tbox-staging`), version history (`kg:meta`), and peer registry
  (`kg:peers`).
- **Reasoning.** A curated OWL 2 RL rule set runs as SPARQL `CONSTRUCT` rules
  to a fixpoint, plus SHACL shapes for closed-world validation. Logical
  entailment is the engine's job; the model formulates queries and
  interprets results.
- **Provenance.** Every triple is annotated with source, time, confidence,
  and extraction method using RDF-star. Low-confidence triples remain
  visible to queries but are excluded from the inference closure so they
  cannot poison entailment.
- **Schema lifecycle.** The agent proposes deltas to `kg:tbox-staging`,
  never to `kg:tbox` directly. Proposals are promoted only after the
  reasoner accepts them and they have been used by N successful queries
  inside a TTL; unused proposals expire quietly. Every promotion is a
  git-tracked Turtle commit.
- **Goal-conditioned growth.** Concepts enter the graph because a goal
  needed them, not because a document mentioned them. The promotion gate
  makes inferred goals safe by construction.

## Install

**Prerequisites: Node 20+.** That is all the default install needs. Docker is only required if you opt into the Fuseki backend (see "Alternative backends" below).

<details open>
<summary><strong>Claude Code</strong> — marketplace install (SKILL.md + hooks + slash commands)</summary>

```
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`). Then:

```bash
predicate up        # starts Fuseki, creates the 9 named graphs
predicate doctor    # confirms everything is green
```

Slash commands: `/predicate:up`, `/predicate:down`, `/predicate:doctor`,
`/predicate:stats`, `/predicate:ask <question>`.

</details>

<details>
<summary><strong>Cursor</strong> — MCP + maintenance scripts</summary>

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate && pnpm install && pnpm build

cp packages/predicate-skill/hooks/cursor/mcp.json.template ~/.cursor/mcp.json
# Edit ~/.cursor/mcp.json: replace __PLUGIN_DIR__ with the absolute path to
# this checkout's packages/predicate-skill directory.

predicate up
```

Reload MCP servers in Cursor (Cmd-Shift-P → "Reload MCP servers"). See
`packages/predicate-skill/hooks/cursor/README.md` for optional cron wiring
of the SessionStart, PreCompact, and Stop scripts.

</details>

<details>
<summary><strong>Continue.dev</strong> — MCP via config.yaml</summary>

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

See `packages/predicate-skill/hooks/gemini-cli/README.md` for the three
hook events.

</details>

<details>
<summary><strong>VS Code Copilot</strong> — MCP via settings.json</summary>

Merge `packages/predicate-skill/hooks/vscode-copilot/settings.json.template`
into your VS Code `settings.json`, replacing `__PLUGIN_DIR__`. Restart
VS Code. VS Code does not currently expose lifecycle events; the adapter
README documents manual + VS Code task wiring for the maintenance
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

</details>

<details>
<summary><strong>Codex CLI</strong> — MCP via ~/.codex/config.toml</summary>

Merge `packages/predicate-skill/hooks/codex-cli/config.toml.template` into
`~/.codex/config.toml`, replacing `__PLUGIN_DIR__`. Codex CLI has no
lifecycle events; see the adapter README for shell-alias wiring of the
maintenance scripts.

</details>

<details>
<summary><strong>Any MCP-capable client</strong></summary>

Any client that speaks MCP over stdio can use the bundled server directly:

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate && pnpm install && pnpm build
predicate up

# Point your MCP client at:
#   node /absolute/path/to/predicate/packages/predicate-skill/server.bundle.mjs
# with env FUSEKI_URL=http://localhost:3030 PREDICATE_DATASET=predicate
```

</details>

<details>
<summary><strong>From npm</strong></summary>

```bash
npm install -g predicate-skill
predicate up
predicate doctor

# Or one-shot MCP without a global install:
claude mcp add predicate -- npx -y predicate-skill
```

</details>

## Alternative backends

Predicate ships two storage adapters:

- **Oxigraph (default).** In-process, on-disk store at `~/.predicate/store/` (one N-Quads file per named graph, loaded on `predicate up`, flushed on writes). No Docker, no daemon, sub-second cold start. This is what you get unless you set the env var below.
- **Fuseki (opt-in).** Apache Jena Fuseki in Docker — same as previous releases. Set `PREDICATE_BACKEND=fuseki`. Requires Docker.

To migrate an existing Fuseki install to Oxigraph in place:

```bash
predicate migrate --from fuseki --to oxigraph
unset PREDICATE_BACKEND   # or remove it from your shell rc
predicate down            # stop the Fuseki container, your data is in Oxigraph now
```

## Bootstrap modes

On first `predicate up`, choose how to seed the schema:

- **Community ontology.** Install a bundled vocabulary — `top`, `codebase`,
  `foaf`, `schema-org-lite`, or `fhir-core`. The catalog lives at
  `packages/predicate-ontology/catalog/`.
- **Bring your own.** Upload a Turtle file as the initial TBox.
- **Empty.** Start with no schema; let the agent grow vocabulary through the
  propose → validate → 3-uses-in-7-days promotion gate.

Schema-learning is toggleable at runtime via the `kg_config_set` /
`kg_config_get` MCP tools.

## MCP tools

| Tool | What it does |
|---|---|
| `kg_explore_schema` | Returns the TBox slice for a concept (classes, properties, characteristics) so the model uses real predicates. |
| `kg_ask` | Executes a caller-drafted SPARQL query against asserted + inferred graphs. Logs to `kg:usage`, truncates results. Supports `includeRemote: true` to merge results from registered peers. |
| `kg_assert` | Writes a triple to `kg:abox` with RDF-star provenance. Rejects undeclared predicates. |
| `kg_explain` | Returns the backward-chained derivation for a claim, with cited provenance. |
| `kg_propose_schema` | Stages a `SchemaDelta` proposal in `kg:tbox-staging`. |
| `kg_research_goal` | Decompose a goal → gap-detect → optionally execute research → return a plan. |
| `kg_stats` | Triples, ABox, inferred, TBox counts; inferred ratio; unused-concept ratio. |
| `kg_maintain` | Runs reaper, generalizer, and promotion sweeper, then re-materializes inferred. |
| `kg_capture` | Records a tool invocation (toolName, input, output, sessionId, phase) into `kg:usage`. Used by PreToolUse/PostToolUse hook scripts. |
| `kg_config_set` / `kg_config_get` | Read or update runtime config (e.g. schema-learning toggle). |

## CLI

```
predicate up                # docker compose up + bootstrap the 9 named graphs
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

## Dashboard

```bash
predicate dashboard
```

Serves a localhost web view at `http://127.0.0.1:4040` with recent sessions,
hotspots (files modified in ≥3 sessions), flaky commands (failed in ≥2
sessions), active files (touched in the most recent session), and a stats
snapshot. Read-only; auto-refreshes every 30s. `--port N` to override;
`--no-open` to skip launching a browser.

## Federation

Predicate is single-user by default but can share session history across a
team without merging stores.

- `predicate peer add <name> <endpoint>` registers a teammate's Fuseki in
  `kg:peers`.
- `predicate export-sessions` dumps the local session-history slice as a
  TriG file wrapped in a per-export named graph
  (`urn:predicate:export:<user>:<timestamp>`), so a receiving instance can
  hold multiple peers' data side-by-side without collision.
- `predicate import-sessions <file.trig>` loads such a file; each named
  graph is preserved as-is and never mixed into local `kg:abox`.
- `kg_ask` with `includeRemote: true` runs the SPARQL locally and against
  every registered peer, merging results with a `?peer` column tagging
  origin. Per-peer errors are caught — a dead peer never crashes the query.

A thin Linked-Data layer reuses the same registry to query public
endpoints (`predicate ld ask`) without writing remote results back to
`kg:abox`.

## Derived classes

The reasoner materializes a small set of derive-only classes into
`kg:inferred` so action data becomes queryable:

| Derived class | Means |
|---|---|
| `codebase:Hotspot` | File modified in ≥3 sessions |
| `codebase:FlakyCommand` | Command that has failed in ≥2 sessions |
| `codebase:ActiveFile` | File modified in the single most-recent session |

## Packages

| Package | Purpose |
|---|---|
| `predicate-server` | Fuseki / TDB2 in Docker; bootstrap of the 9 named graphs |
| `predicate-mcp` | MCP server exposing the `kg_*` tools |
| `predicate-reasoner` | OWL 2 RL reasoner + SHACL validation + `kg_explain` |
| `predicate-agent` | Goal store, decomposer, gap detector, research orchestrator, schema proposer, sweeper, generalizer |
| `predicate-cli` | The `predicate` CLI |
| `predicate-ontology` | Versioned TBox catalog, SHACL shapes, meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | Distributable plugin — bundled server + CLI + SKILL.md + per-client hooks |

## Development

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate
pnpm install
pnpm build            # builds all packages + the plugin bundle
pnpm test             # runs against the active backend (default Oxigraph in-process)
                      # set PREDICATE_BACKEND=fuseki and `predicate up` first to test against Fuseki
```

## License

Elastic License 2.0 (ELv2) — source-available. See [`LICENSE`](packages/predicate-skill/LICENSE).
