---
name: doctor
description: Run health checks on the Predicate stack — Docker + Fuseki + TBox.
---

# /predicate:doctor

Run the shell command `predicate doctor` for the user. Fallback to
`node ${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs doctor` if not on PATH.

Read the output. For each `[ ]` (failed) check, give the user the
one-line fix from the doctor's `— ...` detail field.

Then call `kg_stats` via MCP to sanity-check that tools actually respond.
