#!/bin/bash
# Salvage chain: fair-parser multi-tier reruns + a2 resume + graphiti.
# Every step guarded by a free-disk check (skip below 3GB, never crash the chain).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$SCRIPT_DIR/results/run.salvage.supervisor.log"
log() { echo "[salvage $(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
free_gb() { df -g /System/Volumes/Data | awk 'NR==2 {print $4}'; }
step() {
  local name="$1"; shift
  if [ "$(free_gb)" -lt 3 ]; then log "SKIP $name: <3GB free disk"; return 0; fi
  log "STEP $name START"
  ( eval "$@" ) >> "$SCRIPT_DIR/results/run.salvage.$name.log" 2>&1
  log "STEP $name EXIT rc=$?"
}
log "salvage supervisor started pid=$$"
REPO=/Users/mx/Documents/Work/MX/Research/predicate
ENV="OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory:"
for M in "openai:qwen3.5:latest@weak" "openai:gemma4:e4b@mid"; do
  MSAFE=$(echo "$M" | tr ':@' '--')
  step "c2-$MSAFE.xr.flat-all"      "cd '$REPO' && env $ENV pnpm --filter predicate-eval flat-auto conflict-xr-small --models '$M' --runs 1"
  step "c2-$MSAFE.xr.flat-retrieved" "cd '$REPO' && env $ENV pnpm --filter predicate-eval flat-auto conflict-xr-small --models '$M' --runs 1 --retrieved"
  step "c2-$MSAFE.d20.flat-all"     "cd '$REPO' && env $ENV pnpm --filter predicate-eval flat-auto conflict-d20 --models '$M' --runs 1"
done
step "a2-resume" "cd '$SCRIPT_DIR' && .venv/bin/python mem0_ingest.py ../fixtures/conflict-xr-small --resume"
step "graphiti"  "cd '$SCRIPT_DIR' && source run_after_ingest.d/30-graphiti.sh"
log "SALVAGE COMPLETE"
