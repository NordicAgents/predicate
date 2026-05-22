#!/usr/bin/env bash
# Claude Code Stop hook: reads the Stop-hook JSON payload from stdin,
# runs structured turn extraction (predicate extract), then a
# maintenance sweep. Fail-open: any error returns exit 0 so capture
# never blocks the user's next prompt.
set -uo pipefail

# Prefer the CLI bundled with the plugin (works even when `predicate` isn't on
# PATH after a marketplace install); fall back to a global install otherwise.
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" && -f "${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs" ]]; then
  predicate_cli() { node "${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs" "$@"; }
elif command -v predicate >/dev/null 2>&1; then
  predicate_cli() { predicate "$@"; }
else
  exit 0
fi

# Buffer stdin so we can tee it into extract.
payload="$(cat || true)"

if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate_cli extract --from-stdin >/dev/null 2>&1 || true
fi

predicate_cli maintain >/dev/null 2>&1 || true
exit 0
