#!/usr/bin/env bash
set -euo pipefail
HOST="${FUSEKI_URL:-http://localhost:3030}"
for i in $(seq 1 60); do
  if curl -fsS "$HOST/\$/ping" >/dev/null 2>&1; then
    echo "fuseki up"; exit 0
  fi
  sleep 1
done
echo "fuseki did not start" >&2
exit 1
