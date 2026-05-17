#!/usr/bin/env bash
# Cursor pre-compact adapter: trims low-confidence stale facts and
# promotes any matured staged TBox proposals before context compaction.
# Cursor has no native PreCompact event — run manually or via cron, e.g.:
#   */30 * * * * /path/to/hooks/cursor/pre-compact.sh
set -euo pipefail
predicate maintain
