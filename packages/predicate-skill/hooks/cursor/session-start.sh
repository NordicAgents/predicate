#!/usr/bin/env bash
# Cursor session-start adapter: emits a plain text status line.
# Cursor reads stdout when invoked from a custom rule script;
# can also be run manually and pasted into .cursor/rules/predicate.md.
set -euo pipefail
predicate sessionstart 2>/dev/null || \
  echo "Predicate: Fuseki not reachable; run \`predicate up\` first."
