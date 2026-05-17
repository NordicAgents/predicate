# Codex CLI adapter

## Install MCP server

Merge `config.toml.template` into `~/.codex/config.toml`, replacing
`__PLUGIN_DIR__` with the absolute path to this package. The 8 `kg_*`
tools will be available the next time you launch `codex`.

## Hooks

Codex CLI does not expose SessionStart, PreCompact, or Stop lifecycle
events as of writing. The three scripts in this directory are provided
so you can:

1. Run `session-start.sh` manually and paste output into your initial
   Codex prompt. Or alias:

```sh
# in ~/.zshrc or ~/.bashrc
codex() { command codex --context "$(predicate sessionstart 2>/dev/null)" "$@"; }
```

2. Wire `pre-compact.sh` and `stop.sh` to cron for periodic maintenance:

```cron
*/30 * * * * /absolute/path/hooks/codex-cli/pre-compact.sh >/dev/null 2>&1
```

If Codex CLI adds lifecycle hooks in the future, this adapter is ready
to wire them — script logic is unchanged.
