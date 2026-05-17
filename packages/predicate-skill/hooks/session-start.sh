#!/usr/bin/env bash
# SessionStart hook for Claude Code: emits a short context block telling
# the agent what's in the KG. Delegates to `predicate sessionstart` so the
# message format stays in one place.
set -euo pipefail

if MSG="$(predicate sessionstart 2>/dev/null)"; then
  :
else
  MSG="Predicate: Fuseki not reachable; KG tools may fail. Start it with \`predicate up\`."
fi

jq -n --arg m "$MSG" '{ additional_context: $m }'
