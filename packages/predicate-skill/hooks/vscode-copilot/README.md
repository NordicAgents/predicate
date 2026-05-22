# VS Code Copilot adapter (MCP-only)

VS Code Copilot consumes the Predicate MCP server (the 9 `kg_*` tools).
It has no usable session/stop lifecycle hooks, so there is no automatic
turn capture — reasoning queries work, capture does not.

## Install

From your project root:

```sh
npx predicate-skill install vscode
```

This writes `.vscode/mcp.json` (pointing `node` at the bundled
`server.bundle.mjs` with the oxigraph backend) and drops `AGENTS.md` so
Copilot knows when to use the `kg_*` tools. Restart VS Code.

## Verify

Open the MCP panel; `predicate` should be listed with its tools. Ask a
structural question ("what depends on X?") and confirm a `kg_*` tool runs.
