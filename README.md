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
| `predicate-mcp` | MCP server; 8 tools, all implemented |
| `predicate-reasoner` | OWL 2 RL reasoner (16 rules) + SHACL + kg_explain |
| `predicate-agent` | Goal store, decomposer, gap detector, research sources + extractors, schema proposer, promotion sweeper, generalizer |
| `predicate-ontology` | Versioned TBox + SHACL shapes + meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | SKILL.md + plugin.json + SessionStart hook |

## Status

**v1.0 complete.** All 8 MCP tools implemented: `kg_explore_schema`, `kg_ask`,
`kg_assert`, `kg_explain`, `kg_propose_schema`, `kg_research_goal`,
`kg_stats`, `kg_maintain`. The agent loop is closed end-to-end:
goal → decompose → gap-detect → research → extract → assert → query →
explain, with the schema-evolution loop (propose → stage → validate →
usage gate → promote) running alongside via `kg_maintain`. Generalization
detector proposes new classes when ≥K untyped instances share a structural
fingerprint. `kg_stats` exposes the PRD §12 success metrics.

Deferred to v1.1 (see spec §17 known gaps): materialization caching,
tag-while-deriving for `kg_explain`, intent-aware `ResearchSource`
filtering, journal-based cross-system promotion atomicity, LLM-augmented
decomposer + extractor.
