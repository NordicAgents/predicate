# predicate-skill

Claude Code plugin packaging the Predicate MCP server + SKILL.md + SessionStart hook.

## Install

    # From the repo root
    pnpm fuseki:up
    pnpm --filter predicate-mcp build

    # In Claude Code, add the plugin pointing at this directory.

## Files

- `.claude-plugin/plugin.json` — registers the predicate MCP server + skill + hooks.
- `skills/predicate/SKILL.md` — host-agent contract: triggers, workflow, anti-patterns.
- `hooks/hooks.json` + `hooks/session-start.sh` — surface KG status at session boot.
