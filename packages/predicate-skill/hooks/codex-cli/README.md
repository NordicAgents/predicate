# Codex CLI adapter

Codex CLI (v0.117+) uses the Claude Code plugin model and honors
`CLAUDE_PLUGIN_ROOT`, so Predicate installs as a native Codex plugin:
the bundled `skills/`, `hooks/hooks.json` (`SessionStart`/`Stop`), and the
generated `.mcp.json` are consumed directly.

## Install

```sh
codex plugin marketplace add NordicAgents/predicate
# then enable "predicate" in the interactive plugin browser
```

## Two one-time gotchas

1. Plugin hooks are gated behind a feature flag. In `~/.codex/config.toml`:
   ```toml
   [features]
   plugin_hooks = true
   ```
2. Codex requires you to approve non-managed hooks once via the `/hooks`
   command before they run.

## Verify

Start `codex`; you should see Predicate's KG status line in the initial
context. After a turn, `predicate sessions` should list the new session.
