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
