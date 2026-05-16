# Predicate

A local-first MCP skill that gives AI agents a knowledge graph they can reason
over and that improves itself with use.

See [`docs/predicate-prd.md`](docs/predicate-prd.md) for the product brief,
[`docs/superpowers/specs/2026-05-16-predicate-design.md`](docs/superpowers/specs/2026-05-16-predicate-design.md)
for the v1 architecture.

## Quickstart

    pnpm install
    pnpm fuseki:up                          # Fuseki + 8 named graphs + seed TBox
    pnpm --filter predicate-mcp build       # compile the MCP server
    pnpm --filter predicate-eval demo       # load fixture corpus + run 3 questions

Wire the skill into Claude Code by adding `packages/predicate-skill` as a
plugin source.

## Packages

| Package | Purpose |
|---|---|
| `predicate-server` | Fuseki/TDB2 in Docker; 8 named graphs |
| `predicate-mcp` | MCP server; 8 tools (7 implemented, 1 stub: kg_stats) |
| `predicate-reasoner` | OWL 2 RL reasoner (16 rules) + SHACL + kg_explain |
| `predicate-agent` | Goal store, decomposer, gap detector, research sources + extractors, schema proposer, promotion sweeper |
| `predicate-ontology` | Versioned TBox + SHACL shapes + meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | SKILL.md + plugin.json + SessionStart hook |

## Status

Phase 3c (Schema Evolution) complete: `kg_propose_schema` is real (replacing
the last schema-side stub) and accepts the full `SchemaDelta` tagged union
from spec §6.1. `PromotionSweeper` runs validation + usage gates and
performs atomic promotion (Turtle file written to disk, `kg:inferred`
dropped, `pred:SchemaPromoted` + `pred:TBoxVersionAdvanced` events emitted).
The sweeper runs alongside the thin reaper inside `kg_maintain`. Only
`kg_stats` remains as a stub — Phase 4 (efficiency: kg_stats + generalization
detector) is next.
