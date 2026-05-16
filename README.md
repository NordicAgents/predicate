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
| `predicate-mcp` | MCP server; 8 tools (3 implemented in Phase 1, 5 stubs) |
| `predicate-ontology` | Versioned TBox + SHACL shapes |
| `predicate-eval` | End-to-end demo + multi-hop eval harness |
| `predicate-skill` | SKILL.md + plugin.json + SessionStart hook |

## Status

Phase 1 (Foundation) complete. Phase 2 (Discipline — OWL 2 RL CONSTRUCT rule layer,
SHACL validation, kg_explain) is the next plan in `docs/superpowers/plans/`.
