# predicate-mcp

The MCP server at the heart of Predicate: it exposes the **9 `kg_*` tools** over
stdio, owns the **storage adapters**, and runs **materialization** (forward
chaining + provenance) over the 8 named graphs.

Part of the [Predicate](https://github.com/NordicAgents/predicate#readme)
monorepo.

## The 9 tools

`kg_explore_schema`, `kg_ask`, `kg_assert`, `kg_explain`, `kg_propose_schema`,
`kg_research_goal`, `kg_extract_judgments`, `kg_stats`, `kg_maintain`. They are
declared in `src/tools/registry.ts` and dispatched from `src/index.ts`. See the
[skill README](../predicate-skill/README.md#mcp-tools) for what each does.

## Storage adapters

Selected by `PREDICATE_BACKEND` (default `oxigraph`); built in `src/storage/factory.ts`.

| Backend | Adapter | Notes |
|---|---|---|
| `oxigraph` (default) | `DefaultOxigraphAdapter` | Native Oxigraph daemon first, in-process WASM fallback. |
| `oxigraph-wasm` | `OxigraphAdapter` | In-process WASM only. |
| `fuseki` | `FusekiAdapter` | HTTP SPARQL endpoint (Apache Jena Fuseki / TDB2, Docker). |

All adapters implement the common interface in `src/storage/adapter.ts`.

## Named graphs

The 8 graphs (`src/graphs.ts`): `kg:tbox`, `kg:tbox-staging`, `kg:abox`,
`kg:inferred`, `kg:provenance`, `kg:goals`, `kg:usage`, `kg:meta`.

## Key modules

- `src/materialize.ts` — runs the reasoner's CONSTRUCT closure into `kg:inferred`.
- `src/provenance.ts` — RDF-star provenance annotation for asserted triples.
- `src/config.ts` — backend + store-path resolution from env.
- `src/sparql/` — query/update helpers shared across adapters.

## Dependencies

`@modelcontextprotocol/sdk`, `oxigraph`, and `predicate-reasoner`.

## Scripts

```bash
pnpm build       # tsc
pnpm test        # vitest (runs against the default Oxigraph backend)
pnpm typecheck
```

The compiled entry (`dist/src/index.js`) is also exposed as the `predicate-mcp`
bin for direct stdio use.
