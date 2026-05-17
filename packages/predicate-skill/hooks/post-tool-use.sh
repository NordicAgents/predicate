#!/usr/bin/env bash
# Claude Code PostToolUse hook: records {toolName, input, output, sessionId,
# phase:"post"} in kg:usage. Reads Claude Code's hook payload JSON from stdin
# and delegates to `predicate capture --from-stdin`. Fails open.
set -uo pipefail

if command -v predicate >/dev/null 2>&1; then
  predicate capture --from-stdin --phase post >/dev/null 2>&1 || true
fi
exit 0
