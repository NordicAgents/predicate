#!/usr/bin/env bash
# Claude Code PreToolUse hook: records {toolName, input, sessionId, phase:"pre"}
# in kg:usage. Reads Claude Code's hook payload JSON from stdin and delegates
# to `predicate capture --from-stdin`. Fails open: any error returns exit 0
# so the user's tool invocation is never blocked by capture logic.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase pre >/dev/null 2>&1 || true
fi
exit 0
