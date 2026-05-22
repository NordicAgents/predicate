# Cursor adapter (MCP-only)

Cursor consumes the Predicate MCP server (the 9 `kg_*` tools). It has no
usable lifecycle hooks, so there is no automatic turn capture — reasoning
queries work, capture does not.

## Install

From your project root:

```sh
npx predicate-skill install cursor
```

This writes `.cursor/mcp.json` (pointing `node` at the bundled
`server.bundle.mjs` with the oxigraph backend) and drops `AGENTS.md`.
Restart Cursor and enable the `predicate` server in Settings → MCP.

## Verify

Settings → MCP shows `predicate` with its tools. Ask a structural
question and confirm a `kg_*` tool runs.
