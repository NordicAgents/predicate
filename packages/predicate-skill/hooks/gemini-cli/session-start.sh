#!/usr/bin/env bash
# Gemini CLI session-start adapter. Gemini reads stdout as additional context
# when wired via the `hooks` block in ~/.gemini/settings.json (event: "sessionStart").
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
