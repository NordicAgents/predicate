#!/usr/bin/env bash
set -euo pipefail
HOST="${FUSEKI_URL:-http://localhost:3030}"
DATASET="predicate"
ADMIN_PASSWORD="${PREDICATE_ADMIN_PASSWORD:-changeme}"

for g in kg:tbox kg:tbox-staging kg:abox kg:inferred kg:provenance kg:goals kg:usage kg:meta; do
  echo "creating graph $g"
  curl -fsS -u "admin:${ADMIN_PASSWORD}" -X POST \
    --header "Content-Type: application/sparql-update" \
    --data "CREATE SILENT GRAPH <$g>" \
    "$HOST/$DATASET/update"
done

# Load seed TBox
TBOX_PATH="${PREDICATE_TBOX_PATH:-../predicate-ontology/tbox/codebase.ttl}"
if [ -f "$TBOX_PATH" ]; then
  echo "loading TBox from $TBOX_PATH"
  curl -fsS -u "admin:${ADMIN_PASSWORD}" -X POST \
    --header "Content-Type: text/turtle" \
    --data-binary "@$TBOX_PATH" \
    "$HOST/$DATASET/data?graph=kg:tbox"
fi
echo "bootstrap complete"
