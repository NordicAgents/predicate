# VS Code Copilot adapter

## Install MCP server

Merge `settings.json.template` into your VS Code `settings.json`
(User or Workspace), replacing `__PLUGIN_DIR__` with the absolute path
to this package. Restart VS Code. The 8 `kg_*` tools will be available
to Copilot Chat.

## Hooks

VS Code Copilot does not expose SessionStart, PreCompact, or Stop
lifecycle events as of writing. The three scripts in this directory
are provided so you can:

1. Run `session-start.sh` manually before opening Copilot Chat and
   paste the output into a prompt as initial context.

2. Wire `pre-compact.sh` and `stop.sh` to cron for periodic KG
   maintenance — see `../cursor/README.md` for cron examples.

3. Use them in VS Code tasks (`.vscode/tasks.json`):

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "predicate: session start",
      "type": "shell",
      "command": "bash ${workspaceFolder}/packages/predicate-skill/hooks/vscode-copilot/session-start.sh"
    },
    {
      "label": "predicate: maintain",
      "type": "shell",
      "command": "bash ${workspaceFolder}/packages/predicate-skill/hooks/vscode-copilot/pre-compact.sh"
    }
  ]
}
```

If VS Code adds lifecycle hooks for Copilot Chat in the future, this
adapter is ready to wire them — script logic is unchanged.
