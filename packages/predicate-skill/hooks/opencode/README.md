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
| `session.stopped` | `stop.sh` | Runs `predicate maintain` on session close. |

## Verify wiring

Start an OpenCode session and check the debug log; you should see
Predicate's KG status line in the initial context, and `predicate maintain`
output when the session compacts or stops.

## If event names changed in your OpenCode version

Consult `opencode --help events` (or the OpenCode docs) for the current
event names. The scripts are event-agnostic — only the template's `on:`
keys need to match.
