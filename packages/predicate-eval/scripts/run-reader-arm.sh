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

# A8.4 roster — FOUR collectable models.
#
# qwen/qwen3.5-122b-a10b is ABSENT because the vendor DECOMMISSIONED it
# mid-run: HTTP 410 "has reached its end of life on 2026-07-20". This is NOT a
# roster decision and NOT a precedent under A7.2 (which governs removal on
# THROUGHPUT grounds and remains unbroken). No credential, pacing, or patience
# retrieves a model that no longer exists.
#
# Qwen's 2,088 already-collected cells STAND and are analysed (5 of 7 domains
# COMPLETE: d20, h3-nk1, h3-nk3, xr-small, chain-m3). chain-m2 and tausig will
# never exist for it — a permanent 2,424-cell shortfall, reported as such per
# A5.2.7/A8.3. Do NOT delete reader.*.qwen_*.jsonl: unlike a de-registered
# model, Qwen was never de-registered, and its raw logs are now the ONLY
# evidence for a model nobody can query again.
MODELS=(
  "openai:deepseek-ai/deepseek-v4-flash@b"
  "openai:google/gemma-4-31b-it@d"
  "openai:minimaxai/minimax-m3@f"
  "openai:nvidia/nemotron-3-super-120b-a12b@g"
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

# 4 shards saturated the gateway's per-model request rate. Diagnosis: with our
# own load stopped, 4 concurrent bare calls all return 200 — so this is a
# sustained REQUEST-RATE limit, not a concurrency ceiling, and it is
# overwhelmingly per-model (minimax-m3: 2575 of 2894 429s, 327 of 331 transport
# failures; every other model near-clean). Lower total rate + per-model pacing.
MAX_PARALLEL="${MAX_PARALLEL:-2}"
PASSES="${PASSES:-100}"

echo "=== reader arm: $((${#DOMAINS[@]} * ${#MODELS[@]})) shards, max ${MAX_PARALLEL} parallel, up to ${PASSES} passes"
echo "=== started $(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pass in $(seq 1 "$PASSES"); do
  echo ""
  echo "########## PASS ${pass}/${PASSES}  $(date -u +%H:%M:%SZ) ##########"
  for domain in "${DOMAINS[@]}"; do
    for model in "${MODELS[@]}"; do
      while [ "$(jobs -rp | wc -l)" -ge "$MAX_PARALLEL" ]; do sleep 5; done
      # Per-model pacing (operational only — same prompts, cells, runs; slower).
      # A7.2 closed the roster to speed-motivated change, so a rate-limited
      # model is PACED, not dropped.
      pace=0
      case "$model" in
        *minimax*)  pace=3000 ;;   # 89% of all 429s; needs the widest gap
        *nemotron*) pace=1000 ;;   # 318 of 2894 429s
      esac
      ( npx tsx src/reader/run-reader-cli.ts "$domain" --model "$model" --runs 3 --resume --pace-ms "$pace" \
          2>&1 | sed "s|^|[p${pass}] |" ) &
      sleep 2   # stagger starts so shards do not all hit the gateway together
    done
  done
  wait

  # Progress ledger. expected = 188 instances x 8 sources x 3 runs x 4 collectable models + Qwen 2,088 banked (A8.4).
  total=$(cat results/reader/*.jsonl 2>/dev/null | wc -l)
  echo "--- pass ${pass} complete: ${total}/20136 attainable cells written (22560 registered; 2424 permanently lost to the Qwen EOL, A8.3) ($(date -u +%H:%M:%SZ))"
  if [ "$total" -ge 20136 ]; then
    echo "=== ARM COMPLETE at pass ${pass}, $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    exit 0
  fi
done

echo "=== passes exhausted; arm still INCOMPLETE — re-invoke to continue"
exit 1
