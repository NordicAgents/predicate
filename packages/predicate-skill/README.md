# predicate-skill

Claude Code plugin packaging the Predicate MCP server + SKILL.md + SessionStart
hook + operator skills. This is the install target for the marketplace path.

## Install (via marketplace)

```
/plugin marketplace add mxresearch/predicate
/plugin install predicate@predicate
```

After install, bring Fuseki up:

```bash
predicate up
predicate doctor
```

## What's in this directory

- `.claude-plugin/plugin.json` — MCP server + skills + hooks registration.
- `server.bundle.mjs` — bundled MCP server (no `node_modules` required).
- `cli.bundle.mjs` — bundled `predicate` CLI, surfaced via the package's `bin`.
- `skills/predicate/SKILL.md` — host-agent contract: triggers, workflow,
  HARD-GATE anti-patterns, four worked examples.
- `skills/predicate-doctor/SKILL.md`, `skills/predicate-stats/SKILL.md` —
  operator skills.
- `hooks/hooks.json` + `hooks/session-start.sh` — SessionStart hook that
  surfaces current goal/class counts.
- `compose/docker-compose.yml`, `compose/fuseki/config.ttl` — Fuseki config
  the CLI launches.

## Rebuilding the bundles

Bundles are committed so the marketplace install path works without
`pnpm install`. To rebuild after a source change:

```bash
pnpm --filter predicate-skill bundle
```

Or rebuild everything:

```bash
pnpm build
```
