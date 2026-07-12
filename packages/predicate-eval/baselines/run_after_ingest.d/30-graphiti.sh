#!/bin/bash
# 30-graphiti.sh — E3b Zep/Graphiti arm (chain-runner hook).
#
# Sourced (or executed) by the run_after_ingest.d chain runner once the Mem0
# ingest has finished and Ollama is free. Runs the Graphiti ingest for
# conflict-d20 then conflict-xr-small via .venv-graphiti. nohup-safe: reads
# nothing from the tty, logs to results/run.graphiti.<fixture>.log.
#
# Also runnable standalone:
#   cd packages/predicate-eval/baselines
#   nohup bash run_after_ingest.d/30-graphiti.sh > results/run.graphiti.chain.log 2>&1 &
#
# Guards (each skips gracefully so a sourcing chain runner is never killed):
#   - docker CLI present and daemon up
#   - predicate-neo4j container running (starts or creates it if not)
#   - bolt reachable, .venv-graphiti present

_e3b_self="${BASH_SOURCE:-$0}"
_e3b_dir="$(cd "$(dirname "$_e3b_self")/.." 2>/dev/null && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "[30-graphiti] docker CLI not found; skipping E3b arm"
  return 0 2>/dev/null || exit 0
fi
if ! docker info >/dev/null 2>&1; then
  echo "[30-graphiti] docker daemon not running (open -a Docker); skipping E3b arm"
  return 0 2>/dev/null || exit 0
fi
if [ -z "$_e3b_dir" ] || [ ! -x "$_e3b_dir/.venv-graphiti/bin/python" ]; then
  echo "[30-graphiti] .venv-graphiti missing under $_e3b_dir (see README 'Zep / Graphiti arm'); skipping"
  return 0 2>/dev/null || exit 0
fi

# Ensure the Neo4j container is up (created by the E3b infra pass; recreate if gone).
if ! docker ps --format '{{.Names}}' | grep -qx predicate-neo4j; then
  if docker ps -a --format '{{.Names}}' | grep -qx predicate-neo4j; then
    echo "[30-graphiti] starting stopped predicate-neo4j container"
    docker start predicate-neo4j >/dev/null
  else
    echo "[30-graphiti] creating predicate-neo4j container (neo4j:5.26)"
    docker run -d --name predicate-neo4j -p 7687:7687 -p 7474:7474 \
      -e NEO4J_AUTH=neo4j/predicate-e3 neo4j:5.26 >/dev/null
  fi
fi

# Wait for bolt (Neo4j cold start is ~15-30 s), up to 3 minutes.
_e3b_ok=""
for _ in $(seq 1 36); do
  if "$_e3b_dir/.venv-graphiti/bin/python" - <<'PYEOF' >/dev/null 2>&1
from neo4j import GraphDatabase
d = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "predicate-e3"))
d.verify_connectivity(); d.close()
PYEOF
  then _e3b_ok=1; break; fi
  sleep 5
done
if [ -z "$_e3b_ok" ]; then
  echo "[30-graphiti] bolt://localhost:7687 not reachable after 3 min; skipping E3b arm"
  return 0 2>/dev/null || exit 0
fi

mkdir -p "$_e3b_dir/results"
# --resume: no-op on a fresh run (empty group/ops); after a watchdog or crash
# kill, a re-armed chain continues from the last completed fact instead of
# restarting a multi-hour ingest.
for _e3b_fix in conflict-d20 conflict-xr-small; do
  _e3b_log="$_e3b_dir/results/run.graphiti.$_e3b_fix.log"
  echo "[30-graphiti] $(date '+%F %T') ingest $_e3b_fix -> $_e3b_log"
  "$_e3b_dir/.venv-graphiti/bin/python" "$_e3b_dir/graphiti_ingest.py" \
    "$_e3b_dir/../fixtures/$_e3b_fix" --resume </dev/null >>"$_e3b_log" 2>&1
  echo "[30-graphiti] $(date '+%F %T') $_e3b_fix done (exit $?)"
done
echo "[30-graphiti] E3b arm complete; verdicts in $_e3b_dir/results/graphiti-verdicts.*.json"
