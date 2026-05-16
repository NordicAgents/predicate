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
for TBOX in "../predicate-ontology/tbox/codebase.ttl" \
            "../predicate-ontology/meta/predicate-meta.ttl"; do
  if [ -f "$TBOX" ]; then
    echo "loading TBox from $TBOX"
    curl -fsS -u "admin:${ADMIN_PASSWORD}" -X POST \
      --header "Content-Type: text/turtle" \
      --data-binary "@$TBOX" \
      "$HOST/$DATASET/data?graph=kg:tbox"
  fi
done
echo "bootstrap complete"
