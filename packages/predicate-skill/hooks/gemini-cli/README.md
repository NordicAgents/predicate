# Gemini CLI adapter

## Install

Merge `settings.json.template` into `~/.gemini/settings.json`, replacing
`__PLUGIN_DIR__` with the absolute path to this package
(e.g. `/Users/you/code/predicate/packages/predicate-skill`).

Restart Gemini CLI. The 8 `kg_*` tools will be available; the three hook
scripts will fire on `sessionStart`, `preCompress`, and `stop`.

## Hooks reference

| Event | Script | What it does |
|---|---|---|
| `sessionStart` | `session-start.sh` | Prints KG status line; Gemini reads stdout as context. |
| `preCompress` | `pre-compact.sh` | Runs `predicate maintain` before context compression. |
| `stop` | `stop.sh` | Runs `predicate maintain` on session close. |

## If your Gemini version doesn't expose hooks

The `hooks` block is harmless if unsupported. You can still run each script
manually or via cron — see `../cursor/README.md` for cron examples; the
syntax is identical.

## Verify wiring

Run `gemini --debug` and start a fresh session; you should see Predicate's
KG status line printed in the debug output before your first prompt.
