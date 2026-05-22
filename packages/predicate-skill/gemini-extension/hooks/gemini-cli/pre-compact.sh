#!/usr/bin/env bash
# Gemini CLI PreCompress hook: maintenance sweep before context compression.
set -uo pipefail
export PREDICATE_PLUGIN_ROOT="${PREDICATE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
source "$(dirname "$0")/../lib/resolve-cli.sh"
predicate_cli maintain >/dev/null 2>&1 || true
exit 0
