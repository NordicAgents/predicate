#!/usr/bin/env bash
# Gemini CLI stop adapter: runs maintenance on session close.
# Wire to the `stop` event in settings.json.
set -euo pipefail
predicate maintain
