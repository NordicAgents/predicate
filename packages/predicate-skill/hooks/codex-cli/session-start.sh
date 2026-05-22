#!/usr/bin/env bash
# Codex CLI SessionStart hook. Codex injects PLUGIN_ROOT/CLAUDE_PLUGIN_ROOT.
set -euo pipefail
source "$(dirname "$0")/../lib/resolve-cli.sh"
predicate_cli up --if-needed >/dev/null 2>&1 || true
MSG="$(predicate_cli sessionstart 2>/dev/null || echo 'Predicate: run `predicate up` to initialise the store.')"
jq -n --arg m "$MSG" '{ additional_context: $m }'
