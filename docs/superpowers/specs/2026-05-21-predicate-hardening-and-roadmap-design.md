# Predicate — Hardening & Improvement Design

**Date:** 2026-05-21
**Status:** Approved (design); Phase 0 to be planned next
**Source:** End-to-end evaluation of v2.3.0 across three use cases (codebase reasoning, session-history extraction, judgment + schema evolution), run via the real MCP stdio surface + CLI on isolated Oxigraph stores.

## Goal

Fix every bug surfaced by the E2E and set a sequenced strategy to make Predicate
more reliable, more usable, and more adopted — without disturbing the reasoning
engine, which the evaluation confirmed is correct and fast.

Release shape (decided): **fast correctness patch first (Phase 0), then phased
ergonomics / adoption / depth work.**

## Analysis: six themes, not six bugs

The reasoning engine works. Transitive closure, OWL2 property-chain inference,
judgment-conflict surfacing (r20/r21), provenance via `kg_explain`, the N≥3
schema-promotion gate, and SHACL/TBox discipline all produced correct,
explainable results in sub-50ms. Every defect found lives in the **plumbing and
the contract with the host agent**, and clusters into six root-cause themes:

1. **Durability gap.** The Oxigraph adapter flushes `.nq` files on a 300ms
   debounce, force-flushed only in `close()`. The server bundle registers no
   `SIGTERM`/`SIGINT`/`beforeExit` handler (confirmed in `server.bundle.mjs`:
   `FLUSH_DEBOUNCE_MS` default 300, no `process.on(...)` flush hook). When the
   MCP host terminates the server, writes inside the debounce window are lost.
   The recent commit `574a09d` fixed the *read/reload* side, not flush-on-exit.
2. **Honesty gap.** The system hides its own failures. `extract` prints
   `asserted=7 rejected=6` and exits 0; `sessions` then shows all-zero counts.
   `kg_assert` with a bare-string object yields an opaque
   `Cannot read properties of undefined (reading 'replace')` instead of a
   validation error. Most damaging for an agent instructed to *trust* the graph.
3. **Broken happy-path gate.** `kg_explore_schema` — step 1 of the mandated
   workflow — crashes on common inputs (`"Session"`, `"Command"`, `"reads"`,
   `"dependsOn"`) with `error at 8:x: expected ENCODE_FOR_URI`, while
   `"Function"`/`"File"`/full IRIs work. A SPARQL-escaping bug on the first gate.
4. **Hidden preconditions.** Too many implicit "you must first…": session
   capture silently no-ops unless the `codebase` ontology is initialized;
   inferences don't appear until `kg_maintain` is called; the promotion target
   dir must pre-exist; a promotion "use" means a `kg_ask` whose SPARQL *text*
   contains the IRI (an `kg_assert` of the predicate does not count).
5. **Schema ↔ mental-model mismatch.** `kg_ask` requires *both* `question` and
   `sparql` (never auto-generates); `kg_assert.object` must be `{type,value}`;
   the explore param is `concept`, not `query`.
6. **Dead observability.** `materializationLatencyMsP95` is always 0 —
   `kg_maintain`'s fixpoint time is never recorded — so the headline latency
   metric is unusable.

Themes 1–3 are reliability/trust; 4–5 are ergonomics; 6 is cross-cutting
observability.

## Phase 0 — Fast correctness patch

Ships every P0/P1 plus the cheap P2s. Each item maps to a theme above.

### 0.1 Durability (Theme 1) — P0
Add a `SIGTERM` / `SIGINT` / `beforeExit` handler in the MCP server that awaits
`adapter.close()` (force-flush) before exiting. Keep the 300ms debounce for
write batching during normal operation.

- **Design decision D2 (resolved):** signal-handler + retain debounce, rather
  than synchronous write-through. Write-through is simpler to reason about but
  penalizes every write; the handler closes the actual lifecycle gap (host
  SIGTERM, separate CLI/server processes sharing a store) with no steady-state
  cost.

### 0.2 Promoted-dir resolution (Theme 1) — P0
Resolve the schema-promotion target into the **store directory**
(`<store>/promoted/<id>.ttl`) instead of the source-tree path
`…/predicate-ontology/tbox/promoted/` that is absent from the packaged skill.
Retain the `PREDICATE_PROMOTED_DIR` override. Without this, a met N≥3 gate
crashes the entire `kg_maintain` call with ENOENT and nothing promotes.

### 0.3 Honesty (Theme 2) — P1
1. MCP tools that can partially reject (`kg_assert`, and the `extract` summary)
   **return the rejected triples and the per-triple reason**, not just counts.
2. `extract` prints a prominent stderr warning when anything is rejected, with a
   running summary. Default exit code stays **0** (Stop-hook safety — a
   non-zero exit can disrupt the host session); add a `--strict` flag that exits
   non-zero when rejections occur, for CI / manual runs.
3. `kg_assert` with a bare-string object returns a teaching error
   (`object must be {type:"uri"|"literal", value, datatype?}`), not the opaque
   `undefined.replace`.

### 0.4 Workflow gate (Theme 3) — P1
Fix the `kg_explore_schema` SPARQL construction so class names, property names,
and full IRIs all resolve. Add a test matrix covering: a class label, a property
label that collides with a SPARQL keyword prefix (e.g. `Command`, `reads`), and
a full IRI.

### 0.5 Session capture out-of-the-box (Theme 4) — P1
- **Design decision D1 (resolved):** move the session/history predicates
  (`Session`, `modifiedIn`, `succeededIn`, `failedIn`, `commandText`) into the
  **default bootstrap vocabulary** so session-history capture works in empty
  mode without an explicit `init --ontology codebase`. Session capture is a
  flagship feature and must not depend on a code-specific ontology.
  - *Rejected alt:* have `extract` auto-init the codebase ontology — it pulls in
    code-specific classes a non-code project doesn't want.
- Combined with 0.3, an un-seeded store now both captures correctly **and**
  warns loudly if anything is still rejected.

### 0.6 Latency metric (Theme 6) — P2
Record `kg_maintain`'s fixpoint materialization time into
`materializationLatencyMsP95` so the metric reflects reality.

### 0.7 Verification — round-trip self-test
Extend `predicate doctor` into a real end-to-end self-test:
`assert → maintain → ask → explain → kill server → reopen → confirm persisted`.
This both closes the Theme-6 trust gap and is the standing regression guard for
Theme 1 (durability). Doctor should report each step pass/fail with the
one-line fix on failure.

### Out of Phase 0 (deferred, with reasons)
- **Idempotent re-extraction** (duplicate session rows on re-run): the vehicle is
  the existing `2026-05-20-event-sourced-extraction-and-mcp-surface-reduction`
  spec — Phase 3, not a quick patch.
- **Per-line transcript resilience** (one bad JSONL line aborts the transcript):
  Phase 1 ergonomics.

## Forward roadmap (planned after Phase 0 ships)

### Phase 1 — Ergonomics (Themes 4, 5)
- **Auto/lazy materialization:** a dirty-flag on the ABox so `kg_ask` and
  `kg_explain` transparently re-reason when the ABox changed since the last
  fixpoint. Eliminates the "0 conflicts because I forgot `kg_maintain`" trap.
- **Flexible `kg_ask`:** accept question-only *or* sparql-only (not both
  required).
- **Self-teaching errors everywhere:** every rejection names the fix.
- **Promotion-gate clarity:** document that a "use" is a query referencing the
  IRI; reconsider whether `kg_assert` of the staged predicate should count.
- **Per-line transcript resilience:** skip bad lines, capture the rest.

### Phase 2 — Adoption
- **`predicate demo`:** seeds a sample graph and runs the "why did login break"
  query end-to-end, showing transitive inference + provenance — a 60-second wow.
- **Docs:** a concrete transcript-JSONL example; implicit preconditions made
  explicit; a recipes page.
- **`doctor`-driven onboarding:** ontology presence, store writability, and the
  round-trip self-test as the first-run experience.

### Phase 3 — Depth
- Idempotent, event-sourced re-extraction (existing 2026-05-20 spec).
- Richer deterministic capture (more relation types without an API key).
- Federation / external linked-data (existing phase-14 / phase-15 plans).

## Testing strategy

- Phase 0 lands with unit/integration coverage per fix, but the **round-trip
  self-test (0.7) is the keystone** — it exercises durability, materialization,
  query, explain, and persistence in one flow and runs in `predicate doctor`.
- Re-run the three E2E use cases (codebase reasoning, session history, judgment)
  against the patched build and confirm each P0/P1 finding is resolved with real
  output, mirroring the original evaluation.

## Non-goals

- No change to the reasoning engine, the 21 rules, or the ontology semantics.
- No new MCP tools in Phase 0 (surface-reduction is tracked separately).
- No RAG/retrieval framing — Predicate remains a reasoning layer, not a recall
  improvement.
