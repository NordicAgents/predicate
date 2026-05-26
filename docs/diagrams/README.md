# Diagrams

Canonical Mermaid sources. The same blocks are embedded inline in the relevant
READMEs so they render on GitHub without an extra click; edit here first and
copy the block over.

| File | PNG | Embedded in | What it shows |
|---|---|---|---|
| [`architecture.mmd`](architecture.mmd) | [`architecture.png`](../../assets/figures/architecture.png) | root [`README.md`](../../README.md) | System box diagram: agent → MCP → tools → reasoner → 8 named graphs. |
| [`runtime-flow.mmd`](runtime-flow.mmd) | [`runtime-flow.png`](../../assets/figures/runtime-flow.png) | root [`README.md`](../../README.md) | Sequence of capture → assert → reason → ask/explain across two turns. |
| [`schema-lifecycle.mmd`](schema-lifecycle.mmd) | [`schema-lifecycle.png`](../../assets/figures/schema-lifecycle.png) | [`predicate-agent/README.md`](../../packages/predicate-agent/README.md) | State machine: propose → validate → promote-or-expire. |
| [`scale-findings.mmd`](scale-findings.mmd) | [`scale-findings.png`](../../assets/figures/scale-findings.png) | [`predicate-eval/SCALE-FINDINGS.md`](../../packages/predicate-eval/SCALE-FINDINGS.md) | Reasoner materialization latency vs. session count (the headline scaling result). |

PNGs in [`assets/figures/`](../../assets/figures/) are rendered at 2× scale on a
white background — use these for slides, papers, or social cards where Mermaid
won't render. Regenerate any one with:

```bash
npx -y -p @mermaid-js/mermaid-cli mmdc \
  -i docs/diagrams/<name>.mmd \
  -o assets/figures/<name>.png \
  -b white -s 2
```
