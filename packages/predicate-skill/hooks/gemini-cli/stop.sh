#!/usr/bin/env bash
# Gemini CLI stop hook: reads the Stop-hook JSON payload from stdin,
# runs structured turn extraction (predicate extract --platform gemini),
# then a maintenance sweep. Fail-open: any error returns exit 0 so
# capture never blocks the user's next prompt.
set -uo pipefail

if ! command -v predicate >/dev/null 2>&1; then
  exit 0
fi

# Buffer stdin so we can pipe it into extract.
payload="$(cat || true)"

if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate extract --from-stdin --platform gemini >/dev/null 2>&1 || true
fi

predicate maintain >/dev/null 2>&1 || true
exit 0
