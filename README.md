# Predicate

A local-first MCP skill that gives AI agents a knowledge graph they can reason
over and that improves itself with use.

See [`docs/predicate-prd.md`](docs/predicate-prd.md) for the product brief,
[`docs/superpowers/specs/2026-05-16-predicate-design.md`](docs/superpowers/specs/2026-05-16-predicate-design.md)
for the v1 architecture.

## Quick install (Claude Code)

Prerequisites: **Docker** (for Fuseki) and **Node 20+**.

```
/plugin marketplace add mxresearch/predicate
/plugin install predicate@predicate
```

Restart Claude Code (or `/reload-plugins`). Then bring Fuseki up — the plugin
ships a CLI for this:

```bash
predicate up           # starts Fuseki, loads the seed TBox + meta + shapes
predicate doctor       # confirms everything is green
```

Try it in Claude:

> "Why did login break?"

Claude will call `kg_explore_schema → kg_ask → kg_explain` against your graph.
To load a codebase as an ABox in one shot, ask:

> "Research goal: what depends on auth.ts transitively. Use my code at
> /path/to/repo as the corpus."

That routes through `kg_research_goal(executeResearch=true, corpusRoot=...)`,
which fetches the files, extracts triples, and asserts them through
`kg_assert` (TBox-membership-gated, RDF-star-provenance-tagged).

## MCP-only install (any tool that speaks MCP)

If you only want the 8 `kg_*` tools and don't want the SKILL.md / hooks:

```bash
git clone https://github.com/mxresearch/predicate
cd predicate
pnpm install && pnpm build
predicate up

claude mcp add predicate -- node "$(pwd)/packages/predicate-skill/server.bundle.mjs" \
  --env FUSEKI_URL=http://localhost:3030 \
  --env PREDICATE_DATASET=predicate
```

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

**v1.1 — distributable.** All 8 MCP tools implemented; the agent loop is
closed end-to-end (goal → decompose → gap-detect → research → extract →
assert → query → explain) with schema-evolution gates (propose → stage →
validate → usage gate → promote). One-command Claude Code install via the
marketplace path. Operator CLI for Fuseki ops.

Deferred to v1.2 (see spec §17): materialization caching, tag-while-deriving
for `kg_explain`, intent-aware `ResearchSource` filtering, journal-based
cross-system promotion atomicity, LLM-augmented decomposer + extractor,
web/code research sources beyond `DocsResearchSource`, npm publish.
