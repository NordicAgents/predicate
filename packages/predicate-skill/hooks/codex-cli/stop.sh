#!/usr/bin/env bash
# Codex CLI Stop hook: extract typed triples, then maintenance. Fail-open.
set -uo pipefail
source "$(dirname "$0")/../lib/resolve-cli.sh"
payload="$(cat || true)"
if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate_cli extract --from-stdin >/dev/null 2>&1 || true
fi
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
