---
name: up
description: Bring Fuseki up via `predicate up` (Docker Compose + bootstrap graphs + load seed TBox).
---

# /predicate:up

Run the shell command `predicate up` for the user.

If `predicate` is not on PATH, fall back to:
`node ${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs up`

Report the exit code. If non-zero, run `predicate doctor` and report what's failing.
