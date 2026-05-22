#!/usr/bin/env bash
# Gemini CLI SessionStart hook.
set -euo pipefail
export PREDICATE_PLUGIN_ROOT="${PREDICATE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
source "$(dirname "$0")/../lib/resolve-cli.sh"
predicate_cli up --if-needed >/dev/null 2>&1 || true
MSG="$(predicate_cli sessionstart 2>/dev/null || echo 'Predicate: run `predicate up` to initialise the store.')"
jq -n --arg m "$MSG" '{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: $m } }'
