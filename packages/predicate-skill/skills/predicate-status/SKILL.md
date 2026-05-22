---
name: predicate-status
description: Check the Predicate stack and show graph metrics. Use when the user asks "is predicate working", "what's the status", "check predicate", "how big is the graph", "how many triples", "inferred ratio", "show stats/metrics", or any kg_* tool just returned an unexpected error.
---

# When to use

- The user asks "is predicate up", "check predicate", "what's wrong with the kg".
- The user asks "how many triples", "graph size", "stats", "metrics", "inferred ratio".
- A `kg_*` MCP tool just returned a connection or auth error.
- After bringing Fuseki up, to confirm the seed TBox loaded.
- Before/after a `kg_maintain` run to see what changed, or to track the v1 PRD metrics.

# Workflow

A single `kg_stats` call backs both the health check and the metrics. Always do the
reachability gate first — there are no metrics to show if the stack is down.

1. **Health gate.** Call `kg_stats`.
   - If it errors with connection-refused or 401, **Fuseki is not reachable.** Tell the
     user to run `predicate up` (or `pnpm fuseki:up` from a dev clone) and stop here.
   - If `s.tbox == 0`, the TBox did not load — flag it before showing anything else.
2. **Report health**, leading with anything broken:
   - `s.tbox > 0` → TBox is loaded.
   - `s.classes` → declared classes (should be ≥ 10 for the seed codebase TBox).
   - Optionally call `kg_explore_schema("File")` to confirm the seed TBox is the
     codebase domain.
3. **Show metrics** as a compact table:

```
triples                123
abox                    45
inferred                 8
tbox                    70
classes                 12
inferredRatio        0.151
unusedConceptRatio   0.500
materializationLatencyMsP95   0
```

4. **Flag PRD targets:**
   - `unusedConceptRatio > 0.15` → bounded-growth metric (PRD §16) is failing; the next
     `kg_maintain` run should help.
   - `materializationLatencyMsP95 == 0` → no materialization events recorded yet (normal
     until the reasoner runs).

# Report format

When healthy, lead with the one-line status, then the table:

> Predicate is **up**. TBox: N classes. ABox: M triples. Inferred: K.
> Materialization p95: X ms. (or: "no materialization events yet")

If anything is off, lead with what's broken and the one-liner fix, then the numbers.
