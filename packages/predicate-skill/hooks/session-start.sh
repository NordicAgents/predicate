#!/usr/bin/env bash
# SessionStart hook for Claude Code: makes sure the local Oxigraph store and
# seed TBox exist (idempotent auto-bootstrap), then emits a short context
# block describing what's in the KG. Delegates to the `predicate` CLI so the
# message format stays in one place.
set -euo pipefail

# Prefer the CLI bundled with the plugin (works even when `predicate` isn't on
# PATH after a marketplace install); fall back to a global install otherwise.
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" && -f "${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs" ]]; then
  predicate_cli() { node "${CLAUDE_PLUGIN_ROOT}/cli.bundle.mjs" "$@"; }
else
  predicate_cli() { predicate "$@"; }
fi

# First session after install: open the store and load the TBox if the graph
# isn't initialised yet. --if-needed makes this a no-op once it's set up.
predicate_cli up --if-needed >/dev/null 2>&1 || true

if MSG="$(predicate_cli sessionstart 2>/dev/null)"; then
  :
else
  MSG="Predicate: knowledge graph not ready. Run \`predicate up\` to initialise the local Oxigraph store."
fi

jq -n --arg m "$MSG" '{ additional_context: $m }'
