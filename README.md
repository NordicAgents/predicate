# Predicate

**Reasoning memory for AI agents — a self-improving knowledge graph that grows with use.**

Predicate gives an AI agent a structured graph it can
query, reason over, and grow with use. Facts are stored as RDF triples
with per-triple provenance and confidence. An OWL 2 RL reasoner
materializes entailments deterministically and produces an explanation
path for every derived claim. The schema is versioned like code and
evolves under a propose → validate → use-gated promotion loop.
Everything runs locally — **no daemon, no Docker by default** — and
nothing leaves the machine.

What that buys an agent that a flat memory doesn't:

- **Auditable answers.** `kg_explain` returns the chain of triples and
  rules that produced a claim, each step cited back to its source and
  confidence.
- **Contradictions surface instead of averaging out.** When two sources
  disagree about a fact the schema marks as functional or disjoint, the
  reasoner flags the conflict rather than silently picking one.
- **The graph remembers, and the schema earns its keep.** Facts persist
  across sessions. New schema only becomes durable after three real
  queries reference it within a week — unused proposals expire on their own.

See [`docs/predicate-prd.md`](docs/predicate-prd.md) for the full product brief.

## Quick start

**Prerequisite: Node 20+.** Nothing else — no Docker, no database to run.

```bash
npm install -g predicate-skill
predicate up        # creates the local store + the 8 named graphs
predicate doctor    # all checks green
```

That's it. Your knowledge graph lives at `~/.predicate/store/` (in-process
Oxigraph, file-backed). Ask the agent a question and it uses the `kg_*`
MCP tools automatically.

## Use it in your agent

<details open>
<summary><strong>Claude Code</strong> — one-command marketplace install</summary>

```
/plugin marketplace add NordicAgents/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`), then:

```bash
predicate up
predicate doctor
```

Hooks, slash commands, and the `kg_*` tools are wired automatically.
Slash commands: `/predicate:up`, `/predicate:down`, `/predicate:doctor`,
`/predicate:stats`, `/predicate:ask <question>`.

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g predicate-skill
predicate up
cp "$(npm root -g)/predicate-skill/hooks/cursor/mcp.json.template" ~/.cursor/mcp.json
```

Edit `~/.cursor/mcp.json` and replace `__PLUGIN_DIR__` with
`$(npm root -g)/predicate-skill`. Reload MCP servers (Cmd-Shift-P →
"Reload MCP servers"). See `hooks/cursor/README.md` for optional cron
wiring of the maintenance scripts.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/gemini-cli/settings.json.template`
into `~/.gemini/settings.json`, replacing `__PLUGIN_DIR__` with
`$(npm root -g)/predicate-skill`. See `hooks/gemini-cli/README.md` for the
SessionStart / PreCompress / Stop hook events.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/opencode/opencode.json.template`
into `~/.config/opencode/opencode.json`, replacing `__PLUGIN_DIR__`.

</details>

<details>
<summary><strong>VS Code Copilot</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/vscode-copilot/settings.json.template`
into your VS Code `settings.json`, replacing `__PLUGIN_DIR__`. Restart
VS Code.

</details>

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
npm install -g predicate-skill
predicate up
```

Merge `$(npm root -g)/predicate-skill/hooks/codex-cli/config.toml.template`
into `~/.codex/config.toml`, replacing `__PLUGIN_DIR__`.

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

<details>
<summary><strong>Any MCP-capable client</strong></summary>

Point any stdio MCP client at the bundled server:

```bash
npm install -g predicate-skill
predicate up
# server command:
#   node "$(npm root -g)/predicate-skill/server.bundle.mjs"
```

</details>

## Storage backends

Predicate ships two interchangeable storage backends behind one adapter:

- **Oxigraph (default).** In-process, file-backed at `~/.predicate/store/`
  (one N-Quads file per named graph). No Docker, no daemon, sub-second
  start. You get this unless you opt out.
- **Fuseki (opt-in).** Apache Jena Fuseki / TDB2 in Docker. Set
  `PREDICATE_BACKEND=fuseki`. Requires Docker. Useful for very large
  graphs or sharing one store across processes.

Already on Fuseki and want to switch? Migrate in place:

```bash
predicate migrate --from fuseki --to oxigraph
unset PREDICATE_BACKEND     # drop it from your shell rc too
predicate down              # stop the Fuseki container; your data is now in Oxigraph
```

## How it works

- **Storage.** 8 named graphs separate slow-changing schema (`kg:tbox`)
  from fast-flowing facts (`kg:abox`), materialized entailments
  (`kg:inferred`), per-triple metadata (`kg:provenance`), goals
  (`kg:goals`), usage logs (`kg:usage`), staging (`kg:tbox-staging`),
  and version history (`kg:meta`).
- **Reasoning.** A curated OWL 2 RL rule set runs as SPARQL `CONSTRUCT`
  rules to a fixpoint, plus SHACL shapes for closed-world validation.
  Logical entailment is the engine's job; the model formulates queries
  and interprets results.
- **Provenance.** Every triple is annotated with source, time, confidence,
  and extraction method using RDF-star. Low-confidence triples stay
  visible to queries but are excluded from the inference closure so they
  cannot poison entailment.
- **Schema lifecycle.** The agent proposes deltas to `kg:tbox-staging`,
  never to `kg:tbox` directly. A proposal is promoted only after the
  reasoner accepts it and it has been used by N successful queries inside
  a TTL; unused proposals expire quietly.
- **Goal-conditioned growth.** Concepts enter the graph because a goal
  needed them, not because a document mentioned them. The promotion gate
  makes inferred goals safe by construction.

## Bootstrap modes

On first `predicate up`, choose how to seed the schema:

- **Community ontology** — install a bundled vocabulary (`top`,
  `codebase`, `foaf`, `schema-org-lite`, `fhir-core`).
- **Bring your own** — upload a Turtle file as the initial TBox.
- **Empty** — start with no schema; the agent grows vocabulary through the
  propose → validate → 3-uses-in-7-days promotion gate.

Run non-interactively with `predicate init --mode community --ontology codebase`
(or `--mode empty`). Schema-learning is toggleable at runtime via the
`kg_config_set` / `kg_config_get` MCP tools.

## MCP tools

| Tool | What it does |
|---|---|
| `kg_explore_schema` | Returns the TBox slice for a concept so the model uses real predicates. |
| `kg_ask` | Runs a caller-drafted SPARQL query against asserted + inferred graphs. |
| `kg_assert` | Writes a triple to `kg:abox` with RDF-star provenance. Rejects undeclared predicates. |
| `kg_explain` | Returns the backward-chained derivation for a claim, with cited provenance. |
| `kg_propose_schema` | Stages a `SchemaDelta` proposal in `kg:tbox-staging`. |
| `kg_research_goal` | Decompose a goal → gap-detect → optionally execute research → return a plan. |
| `kg_stats` | Triples, ABox, inferred, TBox counts; inferred ratio; unused-concept ratio. |
| `kg_maintain` | Runs reaper, generalizer, and promotion sweeper, then re-materializes inferred. |
| `kg_capture` | Records a tool invocation into `kg:usage`. Used by the lifecycle hooks. |
| `kg_config_get` / `kg_config_set` | Read or update runtime config (e.g. schema-learning toggle). |

## CLI

```
predicate up                # open the store (Oxigraph default) + bootstrap the 8 graphs
predicate init              # seed kg:tbox (community / upload / empty)
predicate down              # close the store (or stop the Fuseki container)
predicate doctor            # backend-aware health checks
predicate stats             # current kg_stats output
predicate migrate --from fuseki --to oxigraph   # move an existing Fuseki store to Oxigraph
predicate maintain          # reaper + generalizer + promotion sweeper
predicate recall <query>    # substring search over session history (files + commands)
predicate dashboard         # localhost web view of session history + reasoning output

predicate --version
predicate --help
```

## Dashboard

```bash
predicate dashboard
```

Serves a read-only localhost view at `http://127.0.0.1:4040` — recent
sessions, hotspots (files modified in ≥3 sessions), flaky commands
(failed in ≥2 sessions), active files, and a stats snapshot. Auto-refreshes
every 30s. `--port N` to override; `--no-open` to skip the browser.

## Derived classes

The reasoner materializes a few derive-only classes into `kg:inferred` so
action data becomes queryable:

| Derived class | Means |
|---|---|
| `codebase:Hotspot` | File modified in ≥3 sessions |
| `codebase:FlakyCommand` | Command that has failed in ≥2 sessions |
| `codebase:ActiveFile` | File modified in the single most-recent session |

## Packages

| Package | Purpose |
|---|---|
| `predicate-mcp` | MCP server, the `kg_*` tools, and the storage adapters (Oxigraph + Fuseki) |
| `predicate-server` | Backend-agnostic graph bootstrap; Fuseki docker-compose for the opt-in backend |
| `predicate-reasoner` | OWL 2 RL reasoner + SHACL validation + `kg_explain` |
| `predicate-agent` | Goal store, decomposer, gap detector, research orchestrator, schema proposer, sweeper, generalizer |
| `predicate-cli` | The `predicate` CLI |
| `predicate-ontology` | Versioned TBox catalog, SHACL shapes, meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | The distributable npm package — bundled server + CLI + SKILL.md + per-client hooks |

## Development

```bash
git clone https://github.com/NordicAgents/predicate
cd predicate
pnpm install
pnpm build            # builds all packages + the plugin bundle
pnpm test             # runs against the default Oxigraph backend, no Docker needed
                      # for the Fuseki leg: PREDICATE_BACKEND=fuseki + a running Fuseki
```

## License

Elastic License 2.0 (ELv2) — source-available. See [`LICENSE`](packages/predicate-skill/LICENSE).
