#!/usr/bin/env bash
set -euo pipefail
HOST="${FUSEKI_URL:-http://localhost:3030}"
DATASET="predicate"
ADMIN_PASSWORD="${PREDICATE_ADMIN_PASSWORD:-changeme}"

for g in kg:tbox kg:tbox-staging kg:abox kg:inferred kg:provenance kg:goals kg:usage kg:meta kg:peers; do
  curl -fsS -u "admin:${ADMIN_PASSWORD}" -X POST \
    --header "Content-Type: application/sparql-update" \
    --data "CREATE SILENT GRAPH <$g>" \
    "$HOST/$DATASET/update"
done
echo "graphs created (kg:tbox empty — run \`predicate init\` to load an ontology)"
