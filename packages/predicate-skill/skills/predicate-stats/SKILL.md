---
name: predicate-stats
description: Show current graph metrics — triple counts, inferred ratio, unused-concept ratio. Use when the user asks "how big is the graph", "what's the inferred ratio", "show stats", or wants to track v1 success metrics from the PRD.
---

# When to use

- The user asks "how many triples", "graph size", "stats", "metrics".
- The user wants to track the bounded-growth metric (`unusedConceptRatio < 0.15`).
- Before/after a `kg_maintain` run to see what changed.

# Workflow

1. Call `kg_stats`.
2. Render the result as a compact table:

```
triples                123
abox                   45
inferred                8
tbox                   70
classes                12
inferredRatio        0.151
unusedConceptRatio   0.500
materializationLatencyMsP95   0
```

3. If `unusedConceptRatio > 0.15`, note that the bounded-growth metric is currently failing the PRD §16 target and the next `kg_maintain` run should help.
4. If `materializationLatencyMsP95 == 0`, note that no materialization events have been recorded yet (this is normal until the reasoner runs).
