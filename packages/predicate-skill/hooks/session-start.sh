#!/usr/bin/env bash
# SessionStart hook: emits a short context block telling the agent
# how many open goals and active concepts Predicate is tracking.
set -euo pipefail
FUSEKI="${FUSEKI_URL:-http://localhost:3030}"
DS="${PREDICATE_DATASET:-predicate}"

if ! curl -fsS "$FUSEKI/$/ping" >/dev/null 2>&1; then
  jq -n '{ additional_context: "Predicate: Fuseki not reachable; KG tools may fail. Start it with `pnpm fuseki:up`." }'
  exit 0
fi

GOALS=$(curl -fsS "$FUSEKI/$DS/query" \
  --data-urlencode "query=PREFIX pred: <https://predicate.dev/meta#>
  SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:goals> { ?g pred:status \"active\" } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[0].n.value // "0"')

CONCEPTS=$(curl -fsS "$FUSEKI/$DS/query" \
  --data-urlencode "query=SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH <kg:tbox> { ?c a <http://www.w3.org/2002/07/owl#Class> } }" \
  --header "Accept: application/sparql-results+json" \
  | jq -r '.results.bindings[0].n.value // "0"')

MSG="Predicate ready: ${GOALS} active goals, ${CONCEPTS} TBox classes. Use kg_explore_schema before drafting SPARQL."
jq -n --arg m "$MSG" '{ additional_context: $m }'
