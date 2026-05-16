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
| `predicate-mcp` | MCP server; 8 tools (6 implemented, 2 stubs: kg_propose_schema, kg_stats) |
| `predicate-reasoner` | OWL 2 RL reasoner (16 rules) + SHACL + kg_explain |
| `predicate-agent` | Goal store, decomposer, gap detector, research sources + extractors, orchestrator |
| `predicate-ontology` | Versioned TBox + SHACL shapes + meta vocabulary |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | SKILL.md + plugin.json + SessionStart hook |

## Status

Phase 3b (Research Execution) complete: `predicate-agent` now executes the
research loop end-to-end via `ResearchSource` interface + `DocsResearchSource` +
three regex `Extractor`s. `kg_research_goal(goal, executeResearch=true,
corpusRoot=…)` fetches files, extracts candidate triples, and asserts them
through `kg_assert` (which already enforces TBox membership). Phase 3c
(schema-evolution loop — real `kg_propose_schema` + `PromotionSweeper`) is
next; outline at the bottom of
`docs/superpowers/plans/2026-05-16-predicate-phase-3a-goals-and-gaps.md`.
