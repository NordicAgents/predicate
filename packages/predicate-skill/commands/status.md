---
name: status
description: Health-check the Predicate stack (Docker + Fuseki + TBox) and show graph metrics.
---

# /predicate:status

1. Run the shell command `predicate doctor` for the user. Fallback to
   `node ${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs doctor` if not on PATH.
   For each `[ ]` (failed) check, give the user the one-line fix from the
   doctor's `— ...` detail field.

2. Call the `kg_stats` MCP tool — this also confirms the tools actually
   respond. Format the result as a compact table:

```
triples              N
abox                 N
inferred             N
tbox                 N
classes              N
inferredRatio        N.NNN
unusedConceptRatio   N.NNN
materializationLatencyMsP95   N
```

Flag if `unusedConceptRatio > 0.15` (PRD §16 bounded-growth target) — suggest
`/predicate:maintain` (or `kg_maintain` MCP call) to reclaim space.
