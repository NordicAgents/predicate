# Oxigraph storage adapter — design

**Status:** approved for implementation planning
**Date:** 2026-05-19
**Author:** brainstorming session
**Supersedes:** none

---

## 1. Goal

Add an Oxigraph storage adapter to Predicate, make it the default for new installs, and keep Fuseki working as an opt-in backend. The change targets one outcome: drop Docker from the default install path so the skill installs with `npm install` alone.

## 2. Non-goals

- Not rewriting the reasoner. The CONSTRUCT-to-fixpoint loop ships unchanged.
- Not changing the MCP tool surface. All `kg_*` tools keep the same signatures and semantics.
- Not adding an Oxigraph HTTP sidecar mode in this iteration. Can land later as a third adapter if a user needs it.
- Not renaming packages or relicensing.
- Not solving multi-project isolation. One store per install remains a known v0.1 limitation.
- Not changing federation. SPARQL `SERVICE` clauses work in Oxigraph; `kg_ask(includeRemote: true)` is unaffected.

## 3. Approach

**C: adapter pattern, defaulting to in-process Oxigraph.**

Introduce a `StorageAdapter` interface. Two implementations ship:

- `OxigraphAdapter` — in-process, uses the `oxigraph` npm package (N-API binding), RocksDB on disk. **Default.**
- `FusekiAdapter` — HTTP, the current `SparqlClient` behavior, wrapped to satisfy the new interface. **Opt-in via `PREDICATE_BACKEND=fuseki`.**

Selected at startup by a single config flag. The reasoner, MCP tools, hooks, and CLI never know which is live.

Rationale: the seam already exists informally — `SparqlClient` is the single chokepoint for SPARQL I/O. Formalizing it costs little, preserves existing Fuseki users, and makes the PRD's "swap in GraphDB/RDFox later" story concrete instead of vaporware.

## 4. Architecture

```
            ┌────────────────────────────────┐
            │   MCP tools / reasoner / CLI    │
            │   (no awareness of backend)     │
            └────────────────┬───────────────┘
                             │
                  StorageAdapter interface
                             │
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
     OxigraphAdapter   FusekiAdapter      (future: GraphDB,
       (default,       (HTTP, opt-in        RDFox HTTP adapters
        in-process)    via env var)         using FusekiAdapter
                                            shape)
                             │
                  per-backend bootstrap module
              (named-graph creation, schema seed)
```

## 5. Adapter interface

Single TypeScript interface lives in `packages/predicate-mcp/src/storage/adapter.ts`:

```ts
export interface StorageAdapter {
  // Query
  select(query: string): Promise<SelectBindings>;
  ask(query: string): Promise<boolean>;
  update(query: string): Promise<void>;

  // Graph inspection
  knownGraphs(): Promise<string[]>;

  // Bulk I/O (new — replace ad-hoc data-endpoint calls)
  loadTurtle(turtle: string, graph: string): Promise<void>;
  serializeGraph(graph: string, format: 'turtle' | 'nt'): Promise<string>;
  clearGraph(graph: string): Promise<void>;

  // Lifecycle
  ready(): Promise<void>;
  close(): Promise<void>;
}
```

Existing call sites in `packages/predicate-mcp`, `packages/predicate-reasoner`, `packages/predicate-cli`, and `packages/predicate-agent` migrate from `SparqlClient` to `StorageAdapter`. The migration is mechanical because the four query/update methods already exist on `SparqlClient` with identical signatures.

The three bulk-I/O methods (`loadTurtle`, `serializeGraph`, `clearGraph`) consolidate logic currently duplicated across `init.ts` and the `dataEndpoint` calls in the Fuseki path.

## 6. Named-graph mapping

No change. Oxigraph supports SPARQL 1.1 named graphs natively (`GRAPH <kg:tbox> { … }`). The `GRAPH` constants in `packages/predicate-mcp/src/graphs.ts` map 1:1 to both backends.

For Oxigraph, "creating" an empty named graph means inserting a marker triple and immediately deleting it — the same trick the current Fuseki `init.ts` uses. Oxigraph honors `INSERT DATA { GRAPH <...> { } }` semantics identically.

## 7. SHACL

Unchanged. `packages/predicate-reasoner/src/shacl.ts` already uses `rdf-validate-shacl` against locally-materialized data via `adapter.select(...)`. It does not call any backend-specific SHACL endpoint. Works against any adapter that serves SPARQL SELECT.

This was the largest concern entering the design. It is already not a problem.

## 8. Reasoner integration

Unchanged. `packages/predicate-reasoner/src/fixpoint.ts` only calls `adapter.update(sparqlString)` and `adapter.select(sparqlString)` in its CONSTRUCT-to-fixpoint loop. Same SPARQL strings, same semantics, against either backend.

RDF-star round-trip is verified by a conformance test (§13). The `oxigraph` npm package supports RDF-star reads and writes natively.

## 9. Bootstrap

The bootstrap logic — creating the 9 named graphs, seeding `kg:meta` with version metadata — moves from `packages/predicate-cli/src/commands/init.ts` into a new module `packages/predicate-server/src/bootstrap.ts` that takes a `StorageAdapter` and is backend-agnostic.

The Fuseki-specific bits (docker-compose, TDB2 config) move to `packages/predicate-server/backends/fuseki/`. The Oxigraph-specific bits (default store path discovery, RocksDB open) live in `packages/predicate-server/backends/oxigraph/`.

The `predicate-server` package gains a programmatic export shape; it is no longer docker-compose-only.

## 10. Default + migration

- **New installs:** Oxigraph default. Store at `$XDG_DATA_HOME/predicate/store/` if `XDG_DATA_HOME` is set, else `~/.predicate/store/`. RocksDB files written on first `predicate up`.
- **Existing Fuseki users:** continue to work by setting `PREDICATE_BACKEND=fuseki`. No silent breakage and no auto-migration. If the env var is unset and a Fuseki instance is reachable on the historical port, `predicate doctor` prints a non-interactive one-line notice ("Detected Fuseki at localhost:3030 — set PREDICATE_BACKEND=fuseki to keep using it, or run `predicate migrate --from fuseki --to oxigraph` to switch"). The notice is informational only; doctor never modifies state.
- **Migration command:** `predicate migrate --from fuseki --to oxigraph` walks each named graph, calls `fusekiAdapter.serializeGraph(g, 'nt')`, and feeds the result through `oxigraphAdapter.loadTurtle(...)` (N-Triples is a Turtle subset). Round-trip is verified by triple-count parity per graph.

## 11. CLI changes

- **`predicate up`** branches on the backend at the top. Oxigraph path: open the store, run the backend-agnostic bootstrap. Fuseki path: existing `docker compose up` + bootstrap.
- **`predicate down`:** Oxigraph path closes the store cleanly. Fuseki path runs `docker compose down`.
- **`predicate doctor`:** backend-aware checks. Oxigraph: verify store path is writable, the store opens, each of the 9 named graphs is queryable. Fuseki: existing Docker + `/$/ping` checks.
- **`predicate init`** loses its direct Fuseki coupling; calls the new bootstrap module with the active adapter.
- **`predicate migrate`** is new (see §10).

The doctor output gains a `Backend: oxigraph (in-process)` or `Backend: fuseki (http://localhost:3030)` line as its first row.

## 12. Install story

The default install reduces from:

```
Docker daemon → pull fuseki image → mount volume → expose port 3030
→ JVM warm-up → HTTP between Node and Fuseki
```

to:

```
npm install -g predicate-skill → predicate up → store opens in ~/.predicate/store/
```

`predicate doctor` for the default install reports `Backend: oxigraph (in-process)` and zero Docker checks.

The README install section is rewritten: **Prerequisites: Node 20+.** The Docker prerequisite moves into the Fuseki-opt-in subsection with a clear "you only need this if you want Fuseki / GraphDB" framing.

## 13. Testing

- **Adapter conformance suite** at `packages/predicate-mcp/tests/storage/conformance.test.ts`. Any new adapter must pass. Cases: select round-trip, update round-trip, RDF-star triple round-trip (`<< :s :p :o >> :confidence 0.8 .`), named-graph isolation (write into `kg:a`, query `kg:b`, expect empty), `clearGraph` semantics, federated `SERVICE` clause through to a stub endpoint.
- **Existing reasoner / MCP / agent test suites** run twice in CI via a `BACKEND={oxigraph,fuseki}` matrix.
- **Migration test** under `packages/predicate-server/tests/migrate.test.ts`: load a fixture into Fuseki, migrate to Oxigraph, assert triple-count parity per graph plus byte-equal Turtle after canonical sort.
- **No new dependencies in the test harness** — existing tests already assume a live `StorageAdapter` and don't mock at the HTTP layer.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `oxigraph` npm package has gaps on a niche platform | Document supported platforms in README; opt-in Fuseki adapter remains a fallback for unsupported targets. |
| RDF-star semantics in `oxigraph` differ subtly from Jena | Conformance test pins behavior; failure aborts the release. |
| Migration loses provenance during Turtle round-trip | Use N-Triples (RDF-star variant `nt-star`) for migration; conformance test covers this. |
| Existing Fuseki users surprised by default change | Detect a reachable Fuseki on `predicate doctor` first run; print a one-line migration notice. Do not silently switch them. |
| CI matrix doubles test time | Acceptable; both adapters share the same test bodies, and Oxigraph runs without Docker so its leg is faster on average. |

## 15. Out of scope (deferred)

- **Oxigraph HTTP sidecar mode.** If demanded later, lands as a third adapter (`OxigraphHttpAdapter`) reusing 80% of `FusekiAdapter`.
- **Multi-project isolation.** Still one store per install. Solving this is a separate spec.
- **Replacing the CONSTRUCT-to-fixpoint reasoner with RDFox-style incremental materialization.** Tracked in the PRD's "open questions" as a longer-term upgrade.
- **`PREDICATE_STORE_PATH` env var.** Custom store locations can land in v1.1; default-only for this work.

## 16. Acceptance criteria

The work is done when:

1. `npm install -g predicate-skill && predicate up && predicate doctor` succeeds on a clean machine with no Docker installed.
2. All existing reasoner / MCP / agent / CLI tests pass under both `BACKEND=oxigraph` and `BACKEND=fuseki`.
3. The adapter conformance suite passes for both adapters.
4. `predicate migrate --from fuseki --to oxigraph` round-trips a 10k-triple fixture with triple-count parity per graph.
5. README's default install section requires only Node 20+. Docker moves to the Fuseki opt-in section.
6. No change to the MCP tool surface (verified by snapshotting the tool list before and after).
