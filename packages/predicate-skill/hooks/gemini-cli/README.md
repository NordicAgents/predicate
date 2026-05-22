# Gemini CLI adapter

Predicate installs as a native Gemini CLI **extension**. The
`gemini-extension.json` manifest (package root) registers the MCP server
via `${extensionPath}`, loads `GEMINI.md` as context, and wires
`hooks/gemini-cli/hooks.json` to the real Gemini events: `SessionStart`,
`AfterAgent` (end of turn), and `PreCompress`.

## Install

```sh
gemini extensions install https://github.com/NordicAgents/predicate
# restart Gemini CLI
```

(For the lighter MCP-only path without hooks:
`gemini mcp add predicate -s user -- node /abs/path/server.bundle.mjs`.)

## Verify

`gemini --debug`, start a fresh session: Predicate's KG status line appears
in the debug output before your first prompt. After a turn, `predicate
sessions` lists the new session.
