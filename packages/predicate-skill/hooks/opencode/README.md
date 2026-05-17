# OpenCode adapter

## Install

Merge `opencode.json.template` into `~/.config/opencode/opencode.json`
(or your project-local `opencode.json`), replacing `__PLUGIN_DIR__` with
the absolute path to this package.

Restart OpenCode. The 8 `kg_*` tools will be available, and the three
hook scripts will fire on `session.started`, `session.compacted`, and
`session.stopped`.

## Hooks reference

| Event | Script | What it does |
|---|---|---|
| `session.started` | `session-start.sh` | Prints KG status line; OpenCode reads stdout as context. |
| `session.compacted` | `pre-compact.sh` | Runs `predicate maintain` before context compression. |
| `session.stopped` | `stop.sh` | Reads the Stop-hook JSON payload from stdin, pipes it to `predicate extract --from-stdin --platform opencode` to assert typed triples for the turn, then runs `predicate maintain`. Fail-open: any error exits 0. |

> **Stop-hook extraction (v1.8.0+):** `stop.sh` now invokes
> `predicate extract --from-stdin --platform opencode` before
> maintenance. The `--platform opencode` flag selects the OpenCode
> transcript adapter that maps `{event:"tool.before", tool:{...}}` /
> `{event:"tool.after", result|error}` events into the canonical shape
> the deterministic extractor understands. The adapter is permissive
> and falls through silently on unrecognized shapes, so it never blocks
> your next prompt.

## Verify wiring

Start an OpenCode session and check the debug log; you should see
Predicate's KG status line in the initial context, and `predicate maintain`
output when the session compacts or stops.

## If event names changed in your OpenCode version

Consult `opencode --help events` (or the OpenCode docs) for the current
event names. The scripts are event-agnostic — only the template's `on:`
keys need to match.
