# Cursor adapter

Predicate exposes its 8 `kg_*` tools to Cursor over MCP, plus three optional
maintenance scripts you can wire into cron.

## 1. MCP server

Copy `mcp.json.template` to `.cursor/mcp.json` (project-local) or
`~/.cursor/mcp.json` (global), replacing `__PLUGIN_DIR__` with the absolute
path to your local clone, e.g. `/Users/you/code/predicate/packages/predicate-skill`.

Then in Cursor restart MCP (Cmd-Shift-P → "Reload MCP servers") and the 8
`kg_*` tools will be available.

## 2. Optional: SessionStart context

Cursor has no native SessionStart event. Two options:

**a. Manual:** Run `bash session-start.sh` in your terminal; paste the
output into `.cursor/rules/predicate.md`.

**b. Cron:** Refresh the rule file periodically:

```cron
*/10 * * * * bash /absolute/path/hooks/cursor/session-start.sh > /project/.cursor/rules/predicate.md
```

## 3. Optional: PreCompact maintenance

Cursor has no native PreCompact event. Wire `pre-compact.sh` to cron so the
KG stays tidy between sessions:

```cron
*/30 * * * * /absolute/path/hooks/cursor/pre-compact.sh >/dev/null 2>&1
```

## 4. Optional: Stop maintenance

Run `bash stop.sh` manually after a long session, or wire it into a shell
shutdown alias.

## Notes

All scripts require `predicate` on `$PATH`. Install with
`npm install -g predicate-skill`, or use the absolute path:
`/abs/path/to/predicate/packages/predicate-skill/cli.bundle.mjs`.
