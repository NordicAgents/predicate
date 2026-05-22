#!/usr/bin/env bash
# Claude Code PreToolUse hook: records {toolName, input, sessionId, phase:"pre"}
# in kg:usage. Reads Claude Code's hook payload JSON from stdin and delegates
# to `predicate capture --from-stdin`. Fails open: any error returns exit 0
# so the user's tool invocation is never blocked by capture logic.
set -uo pipefail

# Prefer the CLI bundled with the plugin (works even when `predicate` isn't on
# PATH after a marketplace install); fall back to a global install otherwise.
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" && -f "${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs" ]]; then
  node "${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs" capture --from-stdin --phase pre >/dev/null 2>&1 || true
elif command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre >/dev/null 2>&1 || true
fi
exit 0
