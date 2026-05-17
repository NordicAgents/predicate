#!/usr/bin/env bash
# VS Code Copilot session-start adapter. VS Code has no native SessionStart
# hook today — run this manually before invoking Copilot Chat, or wire it
# to a VS Code task in tasks.json.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
