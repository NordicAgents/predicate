---
name: stats
description: Show current Predicate graph metrics via `kg_stats`.
---

# /predicate:stats

Call the `kg_stats` MCP tool. Format the result as a compact table:

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
