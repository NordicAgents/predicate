#!/usr/bin/env bash
# Gemini CLI pre-compress adapter: runs maintenance before Gemini compacts
# the chat context. Wire to the `preCompress` event in settings.json.
set -euo pipefail
predicate maintain
