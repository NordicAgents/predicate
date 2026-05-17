#!/usr/bin/env bash
# OpenCode pre-compact adapter. Wire to the session.compacted event
# (fires immediately before OpenCode compresses chat history).
set -euo pipefail
predicate maintain
