# Predicate Phase 1 — Ergonomics Design

**Date:** 2026-05-21
**Status:** Approved (design); to be planned next
**Predecessor:** Phase 0 correctness hardening (shipped, v2.4.0). See
`2026-05-21-predicate-hardening-and-roadmap-design.md` for the roadmap context.

## Goal

Make Predicate's tools effortless for a host model to use correctly — remove the
recurring friction the end-to-end evaluation surfaced — without touching the
reasoning engine, the 21 rules, or ontology semantics.

Four ergonomics items, anchored by auto-materialization:

1. **Auto-materialization** (anchor) — `kg_ask`/`kg_explain` transparently
   re-reason when the ABox changed, so a forgotten `kg_maintain` never yields a
   silently-stale answer (every E2E agent hit this).
2. **`kg_ask` question-or-sparql** — drop the "both required" constraint.
3. **Generalized teaching errors** — every tool names the bad field on rejection.
4. **Per-line transcript resilience** — `extract` skips a bad line, keeps the rest.

## 1. Auto-materialization (lazy-on-read, dirty flag)

### Architecture

A persisted singleton marker in `kg:meta` tracks whether the ABox has changed
since the inferred graph was last materialized:

```
<urn:predicate:materialization-state> pred:aboxDirty "true"^^xsd:boolean .
```

It lives in the graph (like all other Predicate state), so it survives server
restarts and is shared across the CLI and MCP processes that open the same store.

### Components

- **`markAboxDirty(client)`** — sets the marker to `true`. Called from `kgAssert`
  (`packages/predicate-mcp/src/tools/kg-assert.ts`), which is the single common
  ABox write path: `extract`, `kg_extract_judgments`, and replay all funnel
  through `kgAssert`. One call site covers every ABox mutation.
- **`materializeIfDirty(client)`** — new helper (e.g.
  `packages/predicate-mcp/src/materialize.ts`). Reads the marker via one ASK; if
  dirty, runs `runFixpoint(client, RULES, { tboxGraph:'kg:tbox',
  aboxGraphs:['kg:abox'], inferredGraph:'kg:inferred', closureCutoff:0.5 })` —
  the **reasoner only**, not the reaper/sweeper/generalizer — then sets the
  marker to `false`. If clean, returns immediately (the ASK is the only cost).
- **Call sites:** `materializeIfDirty` runs at the top of `kgAsk`
  (`tools/kg-ask.ts`) and `kgExplain` (`tools/kg-explain.ts`), before they read
  `kg:inferred`.
- **`kg_maintain`** is unchanged in behavior but also clears the marker — it
  already re-materializes via `runFixpoint`, so after a maintain the ABox is not
  dirty. Set the marker `false` at the end of `kgMaintain`.

### Data flow

```
kg_assert(...)   -> write kg:abox + markAboxDirty(true)   [no reasoning]
kg_assert(...)   -> still dirty
kg_ask(...)      -> materializeIfDirty: dirty? yes -> runFixpoint -> dirty=false -> query
kg_ask(...)      -> materializeIfDirty: dirty? no  -> query directly (fast)
kg_maintain(...) -> full pass (reaper/generalizer/sweeper/fixpoint) -> dirty=false
```

### Error handling

If `runFixpoint` throws inside `materializeIfDirty`, the read (`kg_ask`/
`kg_explain`) fails loudly with that error. Serving a stale or half-materialized
answer silently would violate the trust property Phase 0 established. The dirty
marker is left `true` on failure so the next read retries materialization.

### Edge cases

- **First read on a fresh store:** if the marker triple is absent, treat as
  *not dirty* (nothing asserted yet) — an absent marker means no ABox writes
  have occurred, or materialization is current. `markAboxDirty` creates it.
  (Implication: a store whose ABox predates this feature and was never
  re-asserted would not auto-materialize on first read; `kg_maintain` still
  works and sets the marker. Acceptable — new asserts mark dirty correctly.)
- **Concurrent processes:** the store is effectively single-writer in practice
  (one MCP server). No locking beyond the existing adapter behavior is added.

## 2. `kg_ask` question-or-sparql

`question` becomes optional; `sparql` stays required.

- `AskInput.question` → `question?: string` (`tools/kg-ask.ts`).
- The zod schema in `registry.ts` for `kg_ask` → `question: z.string().optional()`.
- `logUsage` tolerates a missing question — log an empty string for
  `pred:question` (the SPARQL is still logged in full).
- The read-only `FORBIDDEN`-keyword guard is unchanged.

No NL→SPARQL generation: that needs an LLM and would undercut the mandated
`kg_explore_schema → draft SPARQL` workflow. `sparql` remains the required input.

## 3. Generalized teaching errors

Extend the Phase 0 `kg_assert` pattern so every tool names the offending field
on bad input instead of emitting a raw `ZodError` dump or an opaque `undefined`
crash. Target handlers: `kg_propose_schema`, `kg_explore_schema`,
`kg_research_goal`, `kg_extract_judgments`.

- Add a shared helper (e.g. `parseInput(schema, raw, toolName)` in
  `tools/registry.ts` or a small `tools/parse-input.ts`) that runs
  `schema.safeParse(raw)` and, on failure, throws
  `<toolName>: <field path> <zod message>` (first issue is sufficient).
- Route each listed tool's handler through it.
- Add `kg_assert`-style runtime guards anywhere an internal helper can still
  crash on structurally-bad-but-type-valid input.

## 4. Per-line transcript resilience

In `extractTranscript` (`packages/predicate-cli/src/commands/extract.ts`),
replace the all-or-nothing `lines.map((l) => JSON.parse(l))` with a per-line
try/parse:

- Skip a line that fails to parse; increment a `skippedLines` counter.
- Surface skips through the Phase 0 rejection-warning channel: `extract` prints
  `predicate extract: WARNING — skipped N unparseable transcript line(s)` to
  stderr when `N > 0`.
- A single bad line no longer aborts the whole session; the remaining lines are
  extracted normally.
- `ExtractTranscriptResult` gains `skippedLines: number` (alongside the existing
  `rejections`).

## Testing strategy (TDD per item)

- **Auto-materialization (anchor):** `kg_assert` a transitive chain then `kg_ask`
  the inferred closure with NO explicit `kg_maintain` — rows appear. A second
  consecutive `kg_ask` does NOT re-run the fixpoint (assert via a spy on the
  reasoner or a `MaterializationCompleted`-event count delta of 0). A
  `materializeIfDirty` whose `runFixpoint` throws makes `kg_ask` reject and
  leaves the marker dirty.
- **kg_ask question-or-sparql:** `kgAsk` with `{ sparql }` and no `question`
  succeeds and logs usage.
- **Teaching errors:** at least two target tools return a field-naming error for
  a malformed input (not a raw ZodError).
- **Transcript resilience:** a transcript with one malformed line + valid lines
  yields `skippedLines === 1`, captures the valid lines, and the CLI warns.
- **Regression:** full workspace suite green; re-run the three E2E use cases.

## Non-goals

- No NL→SPARQL generation.
- No incremental/delta reasoning — a full `runFixpoint` on dirty is acceptable
  at current scale.
- No change to the 21 rules, ontology semantics, or `kg_explain`'s depth-bound
  prover (the materialized-conflict re-derivation limitation stays a Phase 3
  item).
- No new MCP tools.
