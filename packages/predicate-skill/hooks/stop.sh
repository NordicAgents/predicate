#!/usr/bin/env bash
# Stop hook: extract typed triples from the turn, then maintenance sweep.
# Fail-open: any error exits 0 so capture never blocks the next prompt.
set -uo pipefail
source "$(dirname "$0")/lib/resolve-cli.sh"

payload="$(cat || true)"
if [ -n "$payload" ]; then
  printf '%s' "$payload" | predicate_cli extract --from-stdin >/dev/null 2>&1 || true
fi
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
