#!/bin/zsh
# E3 supervisor: resume/complete d20 classic, then run xr-small classic.
# Detached via nohup so harness timeouts cannot kill the ingest runs.
cd "$(dirname "$0")"
.venv-classic/bin/python mem0_ingest.py ../fixtures/conflict-d20 --resume \
  >> results/run.conflict-d20.classic-qwen3.5.log 2>&1
.venv-classic/bin/python mem0_ingest.py ../fixtures/conflict-xr-small \
  > results/run.conflict-xr-small.classic-qwen3.5.log 2>&1
echo "E3 classic runs complete $(date)" >> results/run.supervisor.log
