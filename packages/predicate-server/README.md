# predicate-server

Apache Jena Fuseki 5.x + TDB2, bound to localhost only.

## Use

    pnpm docker:up      # start, wait for health, create 8 named graphs, load TBox
    pnpm docker:down    # stop, preserve data volume
    pnpm docker:nuke    # stop and delete the TDB2 volume

## Named graphs

`kg:tbox`, `kg:tbox-staging`, `kg:abox`, `kg:inferred`,
`kg:provenance`, `kg:goals`, `kg:usage`, `kg:meta`.

## Endpoint

    http://localhost:3030/predicate/{query,update,data}

## Auth

`/predicate/update` requires HTTP Basic auth (`admin` / `$PREDICATE_ADMIN_PASSWORD`,
default `changeme`). The bootstrap script reads `$PREDICATE_ADMIN_PASSWORD`
automatically. SPARQL queries to `/predicate/query` are unauthenticated.

## Note on empty graphs

TDB2 does not persist a named graph until it holds at least one triple, so
`CREATE SILENT GRAPH <kg:foo>` is effectively a no-op on its own. The bootstrap
script runs the `CREATE` for documentation/auditability, but the graphs
materialize on first write. SPARQL queries against an unwritten named graph
return empty results without error — which is the contract this project relies on.
