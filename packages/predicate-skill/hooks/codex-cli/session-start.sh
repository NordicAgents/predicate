#!/usr/bin/env bash
# Codex CLI session-start adapter. Codex has no native SessionStart event;
# run this manually before a session and paste the output as initial context,
# or alias it to `codex` in your shell rc.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
