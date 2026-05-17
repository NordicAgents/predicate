#!/usr/bin/env bash
# OpenCode session-start adapter. OpenCode reads stdout as additional context
# when wired to the session.started event.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
