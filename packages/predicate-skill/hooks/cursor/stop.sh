#!/usr/bin/env bash
# Cursor session-end adapter: runs maintenance on session close.
# Cursor has no native Stop event — run manually after each session.
set -euo pipefail
predicate maintain
