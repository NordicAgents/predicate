#!/usr/bin/env bash
# Shared CLI resolver, sourced by every platform hook script.
# Defines predicate_cli() that prefers the CLI bundled with the plugin
# (resolved from whichever plugin-root env var the host platform sets),
# then falls back to a global `predicate` on PATH, else a no-op that
# returns non-zero so callers can fail-open.
#
# Platform plugin-root env vars, highest priority first (matches the loop below):
#   PREDICATE_PLUGIN_ROOT - manual/explicit override; wins when present
#   CLAUDE_PLUGIN_ROOT    - Claude Code, and Codex (Codex sets it for compat)
#   PLUGIN_ROOT           - Codex native

_predicate_bundled_cli() {
  local root
  for root in "${PREDICATE_PLUGIN_ROOT:-}" "${CLAUDE_PLUGIN_ROOT:-}" "${PLUGIN_ROOT:-}"; do
    if [[ -n "$root" && -f "$root/cli.bundle.mjs" ]]; then
      printf '%s' "$root/cli.bundle.mjs"
      return 0
    fi
  done
  return 1
}

if _CLI_BUNDLE="$(_predicate_bundled_cli)"; then
  predicate_cli() { node "$_CLI_BUNDLE" "$@"; }
elif command -v predicate >/dev/null 2>&1; then
  predicate_cli() { predicate "$@"; }
else
  predicate_cli() { return 127; }
fi
