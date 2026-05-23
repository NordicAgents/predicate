# Event-sourced extraction + MCP surface reduction

- **Date:** 2026-05-20
- **Status:** Draft (awaiting review)
- **Scope:** `predicate-cli`, `predicate-mcp`, docs/manifests

## Motivation

Two related changes that emerged from the same insight:

1. **MCP surface reduction (11 → 8 tools).** Of the 11 registered `kg_*`
   tools, three are not agent intents:
   - `kg_capture` — telemetry. The lifecycle hooks call the CLI
     (`predicate capture`), which calls the `kgCapture()` function directly.
     Nothing routes through the MCP tool; the model never has reason to log
     its own tool calls. It is pure context overhead on the model surface.
   - `kg_config_get` / `kg_config_set` — operator config (the
     `schema-learning` toggle, `init-mode`, `init-ontology`). These are
     setup/admin operations, not reasoning steps. They belong on the CLI.

   Each MCP tool's schema sits in the model's context on every call, and a
   crowded toolset degrades selection accuracy. The 8 survivors each map to a
   distinct agent intent: `kg_explore_schema`, `kg_ask`, `kg_assert`,
   `kg_explain`, `kg_propose_schema`, `kg_research_goal`, `kg_stats`,
   `kg_maintain`.

2. **Event-sourced extraction (`predicate extract --replay`).** Typed
   extraction into `kg:abox` is heuristic and lossy. The transcript is the
   real event log (richer than the opt-in `kg:usage` capture stream, and
   already what `extract` reads). Making `kg:abox`'s extracted slice a
   rebuildable projection of the transcripts decouples the Stop hook from
   correctness: if the extractor improves or the hook misfires, you replay.

## Goals

- Remove `kg_capture`, `kg_config_get`, `kg_config_set` from the MCP
  registry **without losing any capability**: capture stays via hooks/CLI;
  config gains a CLI path.
- Add `predicate config get|set` so the `schema-learning` toggle (and the
  init keys) remain controllable after the MCP tools are gone.
- Add `predicate extract --replay <path>` that rebuilds the extraction-derived
  slice of `kg:abox` from stored transcripts, idempotently, **without
  destroying model-authored facts**.

## Non-goals

- No change to the 8 retained MCP tools.
- No new named graph for extraction output (the existing provenance `source`
  is a sufficient discriminator — see below). YAGNI.
- No staging-graph swap / zero-downtime rebuild — unnecessary for a local
  single-user store. YAGNI.
- Not changing the live (Stop-hook) extraction path; `--replay` reuses it.
- `--since` / `--session` filters deferred (the directory is the unit).

## Key facts this design relies on

- `kg:abox` has **two writers**: extraction (via `extract` → `kgAssert`) and
  the model directly (via the `kg_assert` MCP tool). It is **not** a pure
  projection of the transcript log — so a full wipe-and-replay would silently
  delete authoritative model-asserted facts. (`packages/predicate-mcp/src/tools/kg-assert.ts`)
- Extraction stamps every triple's provenance `source` with the session URI
  `urn:predicate:session:<sessionId>` (`turn-extractor.ts:91`). Manual
  `kg_assert` calls never use that URN shape. **This is the discriminator**
  that lets us rebuild only the derived slice.
- `kg_assert` is `INSERT DATA`. The fact triple is set-idempotent, but the
  RDF-star provenance annotation carries a fresh timestamp each call, so a
  naive re-assert *stacks* duplicate provenance. Replay therefore must
  **delete-then-reassert**, not merge.

## Part A — MCP surface reduction

### A1. Registry

In `packages/predicate-mcp/src/tools/registry.ts`, remove the three tool
definitions (and the now-unused imports `kgCapture`, `kgConfigGet`,
`kgConfigSet` from the registry only). The implementation modules
(`kg-capture.ts`, `kg-config.ts`) **stay** — they are consumed by the CLI.

### A2. New CLI command: `predicate config`

New file `packages/predicate-cli/src/commands/config.ts`, wired into
`index.ts` (import + `case 'config'` + help line). Reuses the existing
`kgConfigGet` / `kgConfigSet` functions verbatim (same pattern as
`capture.ts` reusing `kgCapture`).

```
predicate config get [<key>]          # one value, or all if key omitted
predicate config set <key> <value>    # key ∈ schema-learning|init-mode|init-ontology
```

- `set schema-learning true|false` → boolean; other keys are strings.
- Reuses the `z.enum(['schema-learning','init-mode','init-ontology'])`
  validation already in `kg-config.ts`.
- Exit 2 on bad key/value, 0 on success, prints the resulting value.

### A3. Fallout

- `packages/predicate-mcp/tests/index.test.ts` — the tool-list assertion
  drops the three names (expected count 11 → 8).
- New test `packages/predicate-cli/tests/config.test.ts` — get/set round-trip,
  bad-key rejection, `--help`.
- Docs/manifests: `README.md`, `packages/predicate-skill/README.md`,
  `plugin.json`, `marketplace.json`, `predicate-doctor/SKILL.md` — update the
  tool count "11" → "8", drop `kg_capture`/`kg_config_*` from tool tables, add
  the `predicate config` CLI line. Rebuild bundles.

### A4. Versioning note

Removing model-facing tools is a breaking change to the MCP contract. Suggest
this lands as part of a **minor or major** bump (decide at release). Flagged,
not decided here.

## Part B — `predicate extract --replay <path>`

### B1. CLI shape

```
predicate extract --replay <path> [--platform claude-code|gemini|opencode]
```

- `<path>` is a directory (replay every `*.jsonl` in it) or a single
  transcript file.
- `--platform` defaults to `claude-code` (passthrough to the existing adapter
  selection).
- The existing `--from-stdin` mode is unchanged.

### B2. Session identity for a raw transcript

Live extraction gets `session_id` from the Stop-hook payload. On replay there
is no payload, so each transcript file synthesizes one:

- `session_id` = the file's basename without extension (Claude Code stores
  transcripts as `<session-uuid>.jsonl`).
- `transcript_path` = the file itself.

This produces the **same** `sessionUri` the live path would have, so a
session replayed offline is reconciled against exactly the triples its live
extraction wrote. (Documented as a claude-code-first convention; other
platforms pass `--platform` and the same filename-stem rule applies.)

### B3. Per-session scoped rebuild

For each transcript (= one session URI `S = urn:predicate:session:<id>`):

1. **Delete the prior derived slice for S.** Remove from `kg:abox` every
   triple whose provenance `source` is `S` — but only if `S` is its *sole*
   source (see "shared triples" below) — and remove those provenance
   annotations from `kg:provenance`:

   ```sparql
   DELETE {
     GRAPH <kg:abox> { ?s ?p ?o }
     GRAPH <kg:provenance> { << ?s ?p ?o >> ?pp ?po }
   }
   WHERE {
     GRAPH <kg:provenance> {
       << ?s ?p ?o >> <https://industriagents.com/predicate/meta#source> "S" .
       << ?s ?p ?o >> ?pp ?po .
     }
     FILTER NOT EXISTS {
       GRAPH <kg:provenance> {
         << ?s ?p ?o >> <https://industriagents.com/predicate/meta#source> ?other .
         FILTER (?other != "S")
       }
     }
   }
   ```

   (`S` rendered as the exact source literal extraction wrote.)

2. **Re-extract + re-assert.** Run the existing deterministic + semantic
   extractors over the transcript and `kgAssert` each triple — identical to
   the live path. Because step 1 cleared the prior pass, provenance does not
   stack.

Model-authored facts (provenance source ≠ a session URI) are never matched by
step 1 and are preserved untouched.

**Shared triples (edge case).** If the model directly asserted the *same*
`s p o` that extraction also derived, that single `kg:abox` triple carries
provenance from both `S` and a non-session source. The `FILTER NOT EXISTS`
guard means step 1 leaves such a triple **fully intact** (fact + all
provenance) rather than risk deleting an authoritative fact. Consequence: on
re-extraction the triple is re-asserted, stacking a fresh `S` provenance
annotation onto the shared RDF-star subject. This is a rare collision and a
minor provenance imperfection; cleaning it requires per-assertion reified
provenance, which is **out of scope** here (tracked separately).

### B4. Re-materialize inferred (once)

After all sessions are replayed, drop and rebuild `kg:inferred` via the
existing reasoner fixpoint (the same mechanism `kg_maintain` /
`promotion-sweeper` use: `DROP SILENT GRAPH <kg:inferred>` then re-run
`CONSTRUCT` rules to fixpoint). Done once at the end, not per session, to
avoid O(sessions) reasoning passes.

### B5. Idempotency & safety

- Replaying the same directory twice converges: step 1 makes each session's
  rebuild self-cleaning.
- A malformed transcript fails that **one** session loudly (logged, non-zero
  contribution to a summary count) but does not abort the whole replay or
  corrupt other sessions — each session is its own delete+reassert unit.
- Replay is **not** fail-open like the hooks (it is an explicit operator
  action), so it prints a clear per-session summary and a final tally:
  `replayed N sessions, asserted X, rejected Y, errors Z`.

## Data flow

```
                      live path (unchanged)
  Stop hook ──stdin──> predicate extract ──┐
                                           ├─> extractors ─> kgAssert ─> kg:abox + kg:provenance
  replay:  *.jsonl ──> predicate extract ──┘        (per session: DELETE source=S, then re-assert)
  --replay <dir>        (synthesizes session_id                │
                         from filename)                        └─ after all sessions: rebuild kg:inferred
```

## Error handling

| Case | Behavior |
|---|---|
| `<path>` missing / no `*.jsonl` | exit 2, message |
| transcript file unparseable | skip that session, log, increment error tally, continue |
| `kgAssert` rejects a triple (undeclared predicate / bad confidence) | counted as `rejected`, same as live path |
| reasoner fixpoint fails | exit 1, surface the error (the abox rebuild already succeeded) |

## Testing

- **A2:** `config.test.ts` — set/get round-trip per key, boolean coercion for
  `schema-learning`, bad-key/bad-value rejection, `--help`.
- **A3:** updated `index.test.ts` asserts exactly the 8 tool names.
- **B:** `extract-replay.test.ts` —
  - replay a fixture transcript dir → expected triples in `kg:abox` with
    `source = urn:predicate:session:<stem>`;
  - **idempotency:** replay twice → identical triple + provenance counts (no
    stacking);
  - **preservation:** pre-seed a manual `kg_assert` fact (non-session source),
    replay, assert it survives;
  - malformed transcript in the dir → that session errors, others succeed.

## Open questions for the reviewer

1. Version bump level for the breaking MCP change (A4) — minor or major?
2. `--platform` per-file vs per-run: assume per-run (one flag for the whole
   directory). Acceptable, or do mixed-platform dirs need per-file detection?
   (Default: per-run, YAGNI.)
