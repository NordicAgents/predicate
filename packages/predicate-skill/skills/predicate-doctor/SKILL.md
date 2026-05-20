---
name: predicate-doctor
description: Run a health check on the Predicate stack — Fuseki reachability, TBox loaded, all 8 kg_* tools responsive. Use when the user asks "is predicate working", "what's the status", or any kg_* tool just returned an unexpected error.
---

# When to use

- The user asks "is predicate up", "check predicate", "what's wrong with the kg".
- A `kg_*` MCP tool just returned a connection or auth error.
- After bringing Fuseki up for the first time, to confirm the seed TBox loaded.

# Workflow

1. Call `kg_stats`. If it errors with a connection refused or 401, **Fuseki is not reachable** — tell the user to run `predicate up` (or `pnpm fuseki:up` from a dev clone) and stop here.
2. If `kg_stats` succeeds, report:
   - `s.tbox > 0` → TBox is loaded.
   - `s.classes` → number of declared classes (should be ≥ 10 for the seed codebase TBox).
   - `s.triples`, `s.abox`, `s.inferred` → graph sizes.
3. Optionally call `kg_explore_schema("File")` to confirm the seed TBox is the codebase domain.

# Report format

A short summary in this shape:

> Predicate is **up**. TBox: N classes. ABox: M triples. Inferred: K. Last
> materialization p95: X ms. (or: "no materialization events yet")

If anything is off, lead with what's broken and the one-liner fix.
