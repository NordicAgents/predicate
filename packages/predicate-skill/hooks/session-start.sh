#!/usr/bin/env bash
# SessionStart hook: ensure the local Oxigraph store + seed TBox exist
# (idempotent), then emit a short KG context block on stdout.
set -euo pipefail
source "$(dirname "$0")/lib/resolve-cli.sh"

predicate_cli up --if-needed >/dev/null 2>&1 || true

if MSG="$(predicate_cli sessionstart 2>/dev/null)"; then
  :
else
  MSG="Predicate: knowledge graph not ready. Run \`predicate up\` to initialise the local Oxigraph store."
fi

jq -n --arg m "$MSG" '{ additional_context: $m }'
