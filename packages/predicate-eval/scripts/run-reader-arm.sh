#!/usr/bin/env bash
# Reader-arm driver (pre-registration Amendment A5.2).
#
# Runs the FULL registered arm: 7 domains x 3 models x 8 context sources x 3
# runs. Nothing here shrinks the registered cell count to fit a rate limit —
# the endpoint's throughput is an operational problem, not a licence to move
# what was registered.
#
# Concurrency lives HERE, not in a provider: PinnedProvider swaps
# globalThis.fetch to capture raw logs and is not concurrency-safe, so each
# shard is its own process. The cap is deliberately low because the gateway
# 429s under load and contention makes accepted calls slower, not faster.
#
# Every pass uses --resume, and cells whose call never landed (429/503/timeout)
# are left UNWRITTEN by the runner rather than zero-filled, so repeated passes
# converge on a complete arm instead of a fabricated one.
#
#   nohup ./scripts/run-reader-arm.sh > reader-arm.log 2>&1 &
#
# Re-invoking is always safe: completed cells are skipped.
set -uo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(cd ../.. && pwd)"

# shellcheck disable=SC1091
set -a; . "$REPO_ROOT/.env"; set +a

export PREDICATE_BACKEND=oxigraph-wasm
export PREDICATE_STORE_PATH=:memory:

# A5.2.6 frozen roster — three lineages, verified reachable 2026-07-16.
MODELS=(
  "openai:z-ai/glm-5.2@a"
  "openai:deepseek-ai/deepseek-v4-flash@b"
  "openai:qwen/qwen3.5-122b-a10b@c"
)
# A5.2.3 registered domains. Ordered SMALLEST FIRST: if the arm never finishes,
# whole domains are complete rather than every domain half-done.
DOMAINS=(
  conflict-d20        # 14 instances
  conflict-h3-nk1     # 16
  conflict-h3-nk3     # 16
  conflict-xr-small   # 16
  conflict-chain-m3   # 25
  conflict-chain-m2   # 41
  conflict-tausig     # 60
)

MAX_PARALLEL="${MAX_PARALLEL:-4}"
PASSES="${PASSES:-100}"

echo "=== reader arm: $((${#DOMAINS[@]} * ${#MODELS[@]})) shards, max ${MAX_PARALLEL} parallel, up to ${PASSES} passes"
echo "=== started $(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pass in $(seq 1 "$PASSES"); do
  echo ""
  echo "########## PASS ${pass}/${PASSES}  $(date -u +%H:%M:%SZ) ##########"
  for domain in "${DOMAINS[@]}"; do
    for model in "${MODELS[@]}"; do
      while [ "$(jobs -rp | wc -l)" -ge "$MAX_PARALLEL" ]; do sleep 5; done
      ( npx tsx src/reader/run-reader-cli.ts "$domain" --model "$model" --runs 3 --resume \
          2>&1 | sed "s|^|[p${pass}] |" ) &
      sleep 2   # stagger starts so shards do not all hit the gateway together
    done
  done
  wait

  # Progress ledger. expected = 188 instances x 8 sources x 3 runs x 3 models.
  total=$(cat results/reader/*.jsonl 2>/dev/null | wc -l)
  echo "--- pass ${pass} complete: ${total}/13536 cells written ($(date -u +%H:%M:%SZ))"
  if [ "$total" -ge 13536 ]; then
    echo "=== ARM COMPLETE at pass ${pass}, $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    exit 0
  fi
done

echo "=== passes exhausted; arm still INCOMPLETE — re-invoke to continue"
exit 1
