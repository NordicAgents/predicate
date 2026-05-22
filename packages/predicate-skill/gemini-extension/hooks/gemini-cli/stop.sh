#!/usr/bin/env bash
# Gemini CLI AfterAgent hook: extract typed triples for the turn, then maintain.
set -uo pipefail
export PREDICATE_PLUGIN_ROOT="${PREDICATE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
source "$(dirname "$0")/../lib/resolve-cli.sh"
payload="$(cat || true)"
if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate_cli extract --from-stdin --platform gemini >/dev/null 2>&1 || true
fi
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
