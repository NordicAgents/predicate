# predicate-cli

The `predicate` command-line interface — lifecycle (`up`/`down`/`doctor`),
inspection (`stats`/`sessions`/`recall`/`dashboard`), maintenance (`maintain`/
`schema`/`config`), capture/extract for session turns, backend `migrate`, and
`install` for MCP-only hosts.

Part of the [Predicate](https://github.com/NordicAgents/predicate#readme)
monorepo. Bundled into `predicate-skill` as `cli.bundle.mjs` and shipped as the
`predicate` bin.

## Commands

Each command lives in `src/commands/`. The full reference (flags, store-path
resolution, env vars) is in the
[skill README](../predicate-skill/README.md#cli-reference).

```
up  init  down  doctor  stats  sessionstart  maintain  capture  extract
sessions  captures  recall  dashboard  schema  config  migrate  install
--version  --help
```

## Common usage

```bash
predicate up        # open the store + bootstrap the 8 named graphs
predicate doctor    # backend-aware health checks
predicate stats     # triple / abox / inferred / tbox counts
predicate dashboard # localhost view of session history + reasoning output
predicate recall <query>
```

## Dependencies

`predicate-agent`, `predicate-mcp`, `predicate-reasoner`, `predicate-server`.

## Scripts

```bash
pnpm build
pnpm test        # vitest
pnpm typecheck
```

The version string is injected at bundle time from `predicate-skill`'s
`package.json`; running unbundled reports `0.0.0-dev`.
