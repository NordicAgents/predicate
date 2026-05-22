# OxigraphServerAdapter — Disk-backed native Oxigraph as the default backend

**Date:** 2026-05-22
**Status:** Design (approved for spec write-up; pending user review)
**Branch:** `oxigraph-server-backend`

## Problem

Predicate's default backend (`PREDICATE_BACKEND=oxigraph`) is the **WASM build of
Oxigraph** (`vendor/oxigraph/`, v0.5.8), opened with `new Store()`. That store is
**in-memory**: the entire graph lives in RAM and is persisted only by serializing
the whole graph to an N-Quads file (`dump`) and reloading it (`load`) on startup.

Two consequences:

1. **Memory ceiling.** The graph must fit in RAM, and startup is O(n) in graph size
   (parse the whole `.nq` file every session).
2. **Durability window.** Facts asserted since the last snapshot are lost on a crash.

The WASM build cannot be made disk-backed: its `Store` class exposes only
`constructor(quads?)`, `dump`, `load`, `add/delete/has/match`, `query`, `update` —
there is **no `Store.open(path)` and no RocksDB**. On-disk RocksDB storage exists
only in Oxigraph's **native** form (the Rust `oxigraph` CLI / `oxigraph serve`).

The existing `fuseki` backend already provides disk-backed, durable, RAM-bounded
storage — but requires running a **JVM** (Apache Jena Fuseki), which is heavy and an
external dependency users must install and manage themselves.

## Goal

Add a third backend, **native Oxigraph running as a managed local daemon**, and make
it the **default** — giving users disk-backed, durable, RAM-bounded reasoning with
**no JVM** and **no manual server management**, while never being worse than today's
zero-dependency WASM experience.

Non-goals (YAGNI): data migration (there are no existing users), authentication,
remote/non-localhost binding, multi-dataset servers, bundling binaries into npm.

## Key facts (verified 2026-05-22)

- Latest Oxigraph release is **v0.5.8** — the *same version* predicate already vendors
  for WASM. Same engine, same SPARQL/RDF-star semantics across both backends.
- Prebuilt server binaries cover all six targets we care about:
  `oxigraph_v0.5.8_aarch64_apple`, `oxigraph_v0.5.8_x86_64_apple`,
  `oxigraph_v0.5.8_aarch64_linux_gnu`, `oxigraph_v0.5.8_x86_64_linux_gnu`,
  `oxigraph_v0.5.8_aarch64_windows_msvc.exe`, `oxigraph_v0.5.8_x86_64_windows_msvc.exe`.
- `oxigraph serve` exposes SPARQL 1.1 HTTP endpoints `/query`, `/update`, and `/store`
  (Graph Store Protocol), defaulting to `localhost:7878`. Flags: `--location <dir>`
  (storage path) and `--bind <addr:port>`.
- RDF-star is supported **natively**, so — unlike `FusekiAdapter` — no
  `text/turtle`-instead-of-`application/n-triples-star` MIME workaround is needed.

## Architecture

Native Oxigraph is run as a **managed localhost daemon** and accessed over the same
SPARQL 1.1 HTTP protocol the `FusekiAdapter` already uses. The new backend is
therefore structurally a sibling of `FusekiAdapter`. Three new units, each with one
responsibility:

### `src/storage/oxigraph-server.ts` — `OxigraphServerAdapter`

Implements the existing 8-method `StorageAdapter` interface (`select`, `ask`,
`update`, `knownGraphs`, `loadTurtle`, `serializeGraph`, `clearGraph`, `ready`,
`close`) via `fetch` against `http://127.0.0.1:<port>`. Near-identical to
`FusekiAdapter` with two simplifications:

- **No `Authorization` header** (local-only daemon; same trust model as the WASM
  store, which has no auth either).
- **No RDF-star MIME workaround** — request `application/n-triples-star` directly for
  `nt-star`; `serializeGraph`/`loadTurtle` use the native MIME types.

Endpoint mapping: query/ask → `POST /query`; update → `POST /update`; bulk Turtle
read/write → `GET`/`POST /store?graph=<iri>`.

`ready()` delegates to the daemon module (`ensureUp()`); `close()` does **not** stop
the daemon (it is shared — see lifecycle), it only releases client state.

### `src/storage/oxigraph-binary.ts` — acquisition

Pure, side-effect-isolated logic:

- `detectTarget()` → maps `process.platform` + `process.arch` to the v0.5.8 asset name.
- `ensureBinary()` → if `~/.predicate/bin/oxigraph[.exe]` is absent: download the
  pinned asset from the pinned GitHub release URL, **verify SHA-256 against a pinned
  table**, `chmod +x`, cache. Returns the binary path.
- Checksum mismatch → throw (never execute an unverified binary).
- Unsupported platform/arch → throw `BackendUnavailable`.

The pinned SHA-256 table (one per asset) is filled in at implementation time from the
v0.5.8 release; the *mechanism* is fixed here.

### `src/storage/oxigraph-daemon.ts` — per-store daemon supervision

The daemon is keyed by **store path**, not by machine (see Concurrency). State for a
given store lives in a handshake file **inside that store dir**:
`<store>/oxigraph.json` = `{ host, port, pid, version }`.

- `ensureUp(storePath)`:
  1. Read `<store>/oxigraph.json`. If present and the PID is alive and the health
     endpoint answers → return its `{host, port}` (connect, do not spawn).
  2. Otherwise (no file / dead PID / silent port = stale): pick a free localhost port,
     `spawn` `oxigraph serve --location <storePath> --bind 127.0.0.1:<port>`, poll the
     health endpoint until live (bounded retries), then write `<store>/oxigraph.json`.
- `stop(storePath)`: read the handshake, `SIGTERM` the PID, remove the handshake file.
- Errors (binary missing, won't start, port races, RocksDB lock contention) surface as
  `BackendUnavailable`.

Dependency direction: `OxigraphServerAdapter` → `oxigraph-daemon` → `oxigraph-binary`.
Consumers above the storage layer (`factory.ts`, the `kg_*` tools) see only the
unchanged `StorageAdapter` interface.

## Storage location (unchanged)

The native backend reuses the existing `resolveStorePath()` /
`resolveStorePathForScope()` logic verbatim. RocksDB writes its files (SST/WAL/
MANIFEST) into the resolved store directory instead of a single `.nq` snapshot. No new
location logic, no new env var.

Resolution precedence (existing, `config.ts`):

1. `PREDICATE_STORE_PATH` — explicit override (also wins over `--scope`).
2. An existing `.predicate/store` found walking up from cwd — reuse.
3. `<git-root>/.predicate/store` — in-repo, per-project (auto-gitignored).
4. `<homeRoot>/projects/<hash>/store` — non-repo dirs, keyed by path hash.
5. `<homeRoot>/store` — global, `--scope user`.

`predicate up --scope local|project|user` (and the no-flag "auto" mode) all map to a
store path via `resolveStorePathForScope()`; the daemon registry keys on that path, so
all four modes are absorbed with no backend-specific handling. Because
`PREDICATE_STORE_PATH` outranks `--scope`, `predicate up` always spawns the daemon for
exactly the store the long-running MCP server will later connect to.

## Default + automatic fallback

`factory.ts` `getAdapter()` gains the new backend and a fallback wrapper.

Backend names (renaming is free — no existing users):

| `PREDICATE_BACKEND` | Engine |
|---|---|
| `oxigraph` (**new default**) | native Oxigraph daemon, RocksDB on disk |
| `oxigraph-wasm` | today's in-process WASM store (fallback / opt-in) |
| `fuseki` | unchanged |

`BackendName` becomes `'oxigraph' | 'oxigraph-wasm' | 'fuseki'`.

**Fallback rule:** when the backend resolves to `oxigraph`, the factory attempts
`OxigraphServerAdapter` and calls `ready()`. If it throws `BackendUnavailable`
(offline, checksum failure, unsupported platform, daemon won't start), the factory
logs one clear warning and transparently constructs the `oxigraph-wasm` adapter
instead. **Worst case equals today's behavior.** An explicit non-default
`PREDICATE_BACKEND` (`oxigraph-wasm` / `fuseki`) never triggers native acquisition or
fallback.

The plugin `plugin.json` env is updated so `PREDICATE_BACKEND=oxigraph` now selects the
native default (or the line is dropped, letting the default win).

## Concurrency model

RocksDB permits a single writer process per directory (exclusive lock). Predicate
stores are **per-project**, so there is not one store but many (one per repo/scope).
`oxigraph serve` serves exactly one `--location`. Therefore the daemon is a
**singleton per store path**, not per machine:

- Two sessions resolving the **same** store path → share one daemon (the RocksDB lock
  is satisfied; N HTTP clients share one writer).
- Two sessions in **different** repos → two independent daemons on different ports, no
  conflict — mirroring the isolation the WASM model gives for free.

Lifecycle commands:

- `predicate up [--scope …]` → `ensureUp(resolvedStorePath)` (acquire binary if needed,
  spawn, health-check).
- `predicate down` → `stop(resolvedStorePath)`; `predicate down --all` sweeps every
  recorded handshake file.

## Error handling

| Condition | Behavior |
|---|---|
| Binary unavailable (network/platform) | `BackendUnavailable` → WASM fallback; reported by `doctor` |
| Checksum mismatch | hard fail acquisition (never run unverified) → `BackendUnavailable` → fallback |
| Daemon won't start / port race | retry once on a fresh port; if still failing → `BackendUnavailable` → fallback |
| Stale handshake (dead PID / silent port) | treat as not-up; re-spawn |
| RocksDB lock contention | surfaced as `BackendUnavailable` → fallback |

`predicate doctor` reports: which backend is **actually live**, the oxigraph binary
version, daemon PID/port for the resolved store, and whether a fallback occurred and
why.

## Testing

- **Binary module**: unit-test `detectTarget()` platform/arch → asset mapping and
  SHA-256 verification (mock the download).
- **Daemon module**: spawn against a temp `--location`; assert health; assert a second
  `ensureUp()` for the same path **reuses** rather than respawns; assert `stop()`
  cleans up the handshake file.
- **Adapter conformance**: run the existing `tests/storage/conformance.test.ts` against
  `OxigraphServerAdapter` (it already runs against the other adapters). This is the
  primary correctness guarantee — the new backend must behave identically.
- **Fallback**: simulate `BackendUnavailable`; assert the factory yields a working
  `oxigraph-wasm` adapter.
- **Concurrency**: two adapters on the same store dir → assert one daemon and both can
  read/write.

These tests are gated on the native binary being fetchable in CI; on platforms/CI legs
where it is not, they fall back to the conformance suite already covering
`oxigraph-wasm`.

## Open implementation details (decided during implementation, not blocking)

- **Default port**: a fixed default offset from oxigraph's own 7878 (e.g. 7879) to
  avoid clobbering a user's own oxigraph on 7878, then a free ephemeral port if taken.
- **Pinned SHA-256 table**: filled from the v0.5.8 release assets.
- **Health endpoint / readiness poll**: exact path and retry/backoff bounds.

## Files touched

New:
- `packages/predicate-mcp/src/storage/oxigraph-server.ts`
- `packages/predicate-mcp/src/storage/oxigraph-binary.ts`
- `packages/predicate-mcp/src/storage/oxigraph-daemon.ts`

Modified:
- `packages/predicate-mcp/src/storage/adapter.ts` (`BackendName` union)
- `packages/predicate-mcp/src/storage/factory.ts` (new case + fallback wrapper)
- `packages/predicate-cli/src/commands/up.ts` and `down` (daemon lifecycle)
- `packages/predicate-skill/.claude-plugin/plugin.json` (default backend env)
- `doctor` reporting (live backend / binary version / daemon status)
- Tests under `packages/predicate-mcp/tests/storage/`
