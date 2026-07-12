#!/bin/bash
# E3 -> E1 chain supervisor: waits for the RUNNING classic-arm Mem0 ingest of
# conflict-xr-small to finish (Ollama busy until then), then runs sequentially:
#   (a) Mem0 2.x additive arm (v2add) ingest: conflict-d20, conflict-xr-small
#   (b) any executable drop-in hooks in run_after_ingest.d/*.sh (lexical order)
#   (c) the multi-tier flat-auto sweep against local Ollama (qwen3.5, gemma4)
#
# Arm with:
#   cd packages/predicate-eval/baselines
#   nohup bash run_after_ingest.sh > results/run.chain.supervisor.log 2>&1 &
#
# State isolation note for (a): mem0_ingest.py derives the arm tag from the
# installed mem0ai version ("v2add-qwen3.5" under .venv, vs "classic-qwen3.5"
# under .venv-classic) and namespaces BOTH the on-disk DB (.mem0db/<fixture>.<arm>)
# and the Qdrant collection (e3_<fixture>_<arm>) with it — so no extra
# --db-root/--user-id flag is needed to avoid colliding with classic-run state.
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
RESULTS="$SCRIPT_DIR/results"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
mkdir -p "$RESULTS"

STEP_TIMEOUT=14400 # 4h per step
VERDICTS="$RESULTS/mem0-verdicts.conflict-xr-small.classic-qwen3.5.json"

log() { echo "[chain $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ---- single-instance guard -------------------------------------------------
PIDFILE="$RESULTS/run.chain.supervisor.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  log "another chain supervisor (pid $(cat "$PIDFILE")) is alive — exiting"
  exit 1
fi
echo $$ >"$PIDFILE"

# ---- portable per-step timeout (macOS has no coreutils `timeout`) ----------
run_with_timeout() {
  # $1 = seconds, rest = command. Kills the command (and its direct children) on expiry.
  local secs="$1"
  shift
  "$@" &
  local cmd_pid=$!
  (
    elapsed=0
    while [ "$elapsed" -lt "$secs" ] && kill -0 "$cmd_pid" 2>/dev/null; do
      sleep 30
      elapsed=$((elapsed + 30))
    done
    if kill -0 "$cmd_pid" 2>/dev/null; then
      echo "[chain] TIMEOUT after ${secs}s -> killing pid $cmd_pid" >&2
      pkill -TERM -P "$cmd_pid" 2>/dev/null
      kill -TERM "$cmd_pid" 2>/dev/null
      sleep 10
      pkill -KILL -P "$cmd_pid" 2>/dev/null
      kill -KILL "$cmd_pid" 2>/dev/null
    fi
  ) &
  local wd_pid=$!
  wait "$cmd_pid"
  local rc=$?
  kill "$wd_pid" 2>/dev/null
  wait "$wd_pid" 2>/dev/null
  return $rc
}

run_step() {
  # $1 = step name (log file suffix), $2 = command string (run via bash -c)
  local name="$1" cmd="$2" rc
  log "STEP $name START: $cmd"
  run_with_timeout "$STEP_TIMEOUT" bash -c "$cmd" >"$RESULTS/run.chain.$name.log" 2>&1
  rc=$?
  log "STEP $name EXIT rc=$rc (log: results/run.chain.$name.log)"
  return $rc
}

# ---- wait for the classic ingest chain to release Ollama -------------------
# NB: other watcher processes on this box have "mem0_ingest.py|run_e3_classic"
# in their command line, so a bare `pgrep -f` never clears. Match the actual
# Python ingest process by its comm, and the classic supervisor by the full
# script name "run_e3_classic.sh" (watchers only carry the bare stem).
ingest_running() {
  local pid
  for pid in $(pgrep -f 'mem0_ingest\.py' 2>/dev/null); do
    case "$(ps -o comm= -p "$pid" 2>/dev/null)" in
    *[Pp]ython*) return 0 ;;
    esac
  done
  return 1
}
classic_running() { pgrep -f 'run_e3_classic\.sh' >/dev/null 2>&1; }

log "supervisor started pid=$$ repo=$REPO_ROOT"
log "WAITING: polling every 60s until the classic ingest exits (no python mem0_ingest.py AND no run_e3_classic.sh), or until $VERDICTS exists"
while :; do
  if [ -f "$VERDICTS" ]; then
    log "proceed: verdicts file exists ($VERDICTS)"
    break
  fi
  if ! ingest_running && ! classic_running; then
    log "proceed: no live mem0_ingest.py / run_e3_classic.sh processes"
    break
  fi
  sleep 60
done
sleep 15 # small grace so Ollama finishes tearing down the last request

# ---- (a) Mem0 2.x additive-only arm ----------------------------------------
if [ -f "$SCRIPT_DIR/results/mem0-verdicts.conflict-d20.v2add-qwen3.5.json" ]; then
  log "SKIP a1-mem0-v2add.conflict-d20: verdicts already exist"
else
  run_step "a1-mem0-v2add.conflict-d20" \
    "cd '$SCRIPT_DIR' && .venv/bin/python mem0_ingest.py ../fixtures/conflict-d20 --resume"
fi
if [ -f "$SCRIPT_DIR/results/mem0-verdicts.conflict-xr-small.v2add-qwen3.5.json" ]; then
  log "SKIP a2-mem0-v2add.conflict-xr-small: verdicts already exist"
else
  run_step "a2-mem0-v2add.conflict-xr-small" \
    "cd '$SCRIPT_DIR' && .venv/bin/python mem0_ingest.py ../fixtures/conflict-xr-small --resume"
fi

# ---- (b) drop-in hooks (e.g. a Graphiti arm another agent may add) ---------
HOOKS_DIR="$SCRIPT_DIR/run_after_ingest.d"
if [ -d "$HOOKS_DIR" ]; then
  for f in "$HOOKS_DIR"/*.sh; do
    [ -e "$f" ] || continue
    if [ ! -x "$f" ]; then
      log "skipping non-executable hook: $f"
      continue
    fi
    run_step "b-hook.$(basename "$f" .sh)" "cd '$SCRIPT_DIR' && source '$f'"
  done
else
  log "no hooks dir ($HOOKS_DIR) — skipping step (b)"
fi

# ---- (c) multi-tier flat-auto sweep (Ollama via OpenAI-compatible API) -----
SWEEP_ENV="OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama PREDICATE_BACKEND=oxigraph-wasm PREDICATE_STORE_PATH=:memory:"
for MODEL in 'openai:qwen3.5:latest@weak' 'openai:gemma4:e4b@mid'; do
  MSLUG="${MODEL//[^A-Za-z0-9._-]/-}"
  run_step "c-$MSLUG.conflict-xr-small.flat-all" \
    "cd '$REPO_ROOT' && env $SWEEP_ENV pnpm --filter predicate-eval flat-auto conflict-xr-small --models '$MODEL' --runs 1"
  run_step "c-$MSLUG.conflict-xr-small.flat-retrieved" \
    "cd '$REPO_ROOT' && env $SWEEP_ENV pnpm --filter predicate-eval flat-auto conflict-xr-small --models '$MODEL' --runs 1 --retrieved"
  run_step "c-$MSLUG.conflict-d20.flat-all" \
    "cd '$REPO_ROOT' && env $SWEEP_ENV pnpm --filter predicate-eval flat-auto conflict-d20 --models '$MODEL' --runs 1"
done

log "CHAIN COMPLETE"
rm -f "$PIDFILE"
