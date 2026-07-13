#!/usr/bin/env bash
#
# build-evidence.sh — one-command evidence build for paper1 (publication plan
# Phase 0: "Create a clean experiment manifest and one-command evidence build").
#
# Rebuilds every deterministic (non-LLM) evidence artifact for the conflict
# benchmark from the frozen mechanism-v0 fixtures, verifies the fixtures are
# byte-identical to what the committed generators produce, and writes a
# sha256-addressed summary manifest under papers/paper1/evidence/.
#
# Usage (from repo root — any cwd works, paths are script-relative):
#   ./scripts/build-evidence.sh                       # all stages, all domains
#   ./scripts/build-evidence.sh --stage fixtures      # only fixture drift check
#   ./scripts/build-evidence.sh --stage deterministic --domain conflict-xr-small
#   ./scripts/build-evidence.sh --stage summary       # re-hash existing outputs
#
# Stages (canonical order; --stage may be repeated):
#   fixtures       regenerate conflict fixtures into a TEMP dir and diff against
#                  the committed ones — FAILS on any drift; never overwrites.
#   deterministic  per domain: instance manifest, tier-1 eval (mechanism-v0
#                  only), exact baselines (key-join + sparql-groupby +
#                  key-join-x), retrieval-policy sweep (hops 1-4), reasoner
#                  instance arm, instance-level scoring.
#   verdicts       phase-1 hypothesis verdicts H3/H6/H7/H8 (Amendment A2.4)
#                  over the full domain set -> results/instances/phase1-verdicts.json.
#   summary        papers/paper1/evidence/summary-<gitsha>[-dirty].json with
#                  path + sha256 + row count for every produced file + a table.
#
# LLM arms (src/pinned/flat-pinned-cli.ts) are deliberately NOT part of this
# script: they need API keys and network. Their raw logs live under
# packages/predicate-eval/results/raw/ and are frozen by commit, not rebuilt.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVAL_DIR="$REPO_ROOT/packages/predicate-eval"
EVIDENCE_DIR="$REPO_ROOT/papers/paper1/evidence"

# The eval store MUST be the in-process wasm backend, never a developer daemon.
export PREDICATE_BACKEND=oxigraph-wasm
export PREDICATE_STORE_PATH=:memory:

ALL_STAGES=(fixtures deterministic verdicts summary)
# mechanism-v0 (frozen 2026-07-12) + phase1-v3 (Amendment A2, frozen at landing).
ALL_DOMAINS=(conflict-d20 conflict-xr-small conflict-xr-scale
  conflict-chain-m2 conflict-chain-m3 conflict-h3-nk1 conflict-h3-nk3 conflict-tausig)

# The legacy tier-1 8-question eval is a mechanism-v0 continuity metric only
# (Amendment A2.6): it does not run on phase1-v3 domains.
is_v3_domain() { case "$1" in conflict-chain-*|conflict-h3-*|conflict-tausig) return 0 ;; *) return 1 ;; esac; }

usage() {
  sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

STAGES=()
DOMAINS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)  shift; [[ $# -gt 0 ]] || { usage; exit 1; }; STAGES+=("$1") ;;
    --domain) shift; [[ $# -gt 0 ]] || { usage; exit 1; }; DOMAINS+=("$1") ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
  shift
done
[[ ${#STAGES[@]} -eq 0 ]] && STAGES=("${ALL_STAGES[@]}")
[[ ${#DOMAINS[@]} -eq 0 ]] && DOMAINS=("${ALL_DOMAINS[@]}")

contains() { local x needle="$1"; shift; for x in "$@"; do [[ "$x" == "$needle" ]] && return 0; done; return 1; }

for s in "${STAGES[@]}"; do
  contains "$s" "${ALL_STAGES[@]}" || { echo "unknown stage: $s (valid: ${ALL_STAGES[*]})" >&2; exit 1; }
done
for d in "${DOMAINS[@]}"; do
  contains "$d" "${ALL_DOMAINS[@]}" || { echo "unknown domain: $d (valid: ${ALL_DOMAINS[*]})" >&2; exit 1; }
done

run() { echo "+ $*" >&2; "$@"; }

# ---------------------------------------------------------------- preamble --
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
GIT_DIRTY=0
[[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]] && GIT_DIRTY=1
NODE_VERSION="$(node --version)"
PNPM_VERSION="$(pnpm --version)"

echo "== build-evidence preamble =="
echo "git sha:   $GIT_SHA (dirty=$GIT_DIRTY)"
echo "node:      $NODE_VERSION"
echo "pnpm:      $PNPM_VERSION"
echo "backend:   PREDICATE_BACKEND=$PREDICATE_BACKEND PREDICATE_STORE_PATH=$PREDICATE_STORE_PATH"
echo "stages:    ${STAGES[*]}"
echo "domains:   ${DOMAINS[*]}"
echo

TMP_DIR=""
# NB: must end successfully — under macOS bash 3.2 + set -e, a failing last
# command in the EXIT trap overrides the script's exit status.
cleanup() { [[ -z "$TMP_DIR" ]] || rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# ---------------------------------------------------------------- fixtures --
# Regenerate the conflict fixtures into a temp dir and require byte-identity
# with the committed fixtures. mechanism-v0 is FROZEN: this stage never writes
# into fixtures/, and any drift is a hard failure — either the generator or the
# committed fixture changed, and that must be an explicit, reviewed commit.
stage_fixtures() {
  echo "== stage: fixtures (drift check against frozen mechanism-v0) =="
  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/predicate-evidence-fixtures.XXXXXX")"

  local need_v1=0 need_v2=0 need_v3=0 d
  for d in "${DOMAINS[@]}"; do
    case "$d" in
      conflict-d*)  need_v1=1 ;;
      conflict-xr*) need_v2=1 ;;
      *) is_v3_domain "$d" && need_v3=1 ;;
    esac
  done

  [[ $need_v1 -eq 1 ]] && run pnpm --filter predicate-eval run conflict-gen "$TMP_DIR"
  [[ $need_v2 -eq 1 ]] && run pnpm --filter predicate-eval run conflict-gen-v2 "$TMP_DIR"
  [[ $need_v3 -eq 1 ]] && run pnpm --filter predicate-eval run conflict-gen-v3 "$TMP_DIR"

  local drift=0
  for d in "${DOMAINS[@]}"; do
    # instances.json is a DERIVED manifest (rebuilt in stage deterministic),
    # not a generator output — exclude it from the frozen-bytes comparison.
    if diff -r -x instances.json "$TMP_DIR/$d" "$EVAL_DIR/fixtures/$d" > /dev/null 2>&1; then
      echo "fixtures/$d: byte-identical to regenerated output — OK"
    else
      drift=1
      echo "FIXTURE DRIFT in fixtures/$d (mechanism-v0 is frozen; committed fixtures were NOT touched):" >&2
      diff -r -x instances.json "$TMP_DIR/$d" "$EVAL_DIR/fixtures/$d" >&2 || true
    fi
  done
  rm -rf "$TMP_DIR"; TMP_DIR=""
  if [[ $drift -eq 1 ]]; then
    echo "FATAL: fixture regeneration is not byte-identical. Reconcile generator vs committed fixtures in an explicit commit before building evidence." >&2
    exit 1
  fi
  echo
}

# ------------------------------------------------------------ deterministic --
stage_deterministic() {
  echo "== stage: deterministic (manifest, tier-1, exact, retrieval, reasoner, scoring) =="
  local d
  for d in "${DOMAINS[@]}"; do
    echo "-- domain: $d --"
    run pnpm --filter predicate-eval run instances-manifest "$d"
    is_v3_domain "$d" || run pnpm --filter predicate-eval run eval "$d"
    run pnpm --filter predicate-eval run exact "$d" --system all
    run pnpm --filter predicate-eval run retrieval-policies "$d" --hops 1,2,3,4
    run pnpm --filter predicate-eval run instances-reasoner "$d"
    run pnpm --filter predicate-eval run instances-score "$d" \
      "results/exact/exact-key-join.$d.jsonl" \
      "results/exact/sparql-groupby.$d.jsonl" \
      "results/exact/exact-key-join-x.$d.jsonl" \
      "results/instances/reasoner-r14r23r22.$d.jsonl" \
      "results/retrieval/retrieval.$d.jsonl"
    echo
  done
}

# ----------------------------------------------------------------- verdicts --
# H3/H6/H7/H8 verdicts (Amendment A2.4) need results for the FULL domain set;
# on a domain-filtered build the stage is skipped with a notice.
stage_verdicts() {
  echo "== stage: verdicts (phase-1 hypotheses H3/H6/H7/H8) =="
  if [[ ${#DOMAINS[@]} -ne ${#ALL_DOMAINS[@]} ]]; then
    echo "skipping verdicts: domain-filtered build (needs all domains: ${ALL_DOMAINS[*]})"
    echo
    return 0
  fi
  run pnpm --filter predicate-eval run phase1-verdicts
  echo
}

# ------------------------------------------------------------------ summary --
stage_summary() {
  echo "== stage: summary =="
  mkdir -p "$EVIDENCE_DIR"
  local suffix="${GIT_SHA:0:12}"
  [[ $GIT_DIRTY -eq 1 ]] && suffix="$suffix-dirty"
  # A domain-filtered build must not clobber the canonical full summary.
  [[ ${#DOMAINS[@]} -ne ${#ALL_DOMAINS[@]} ]] && suffix="$suffix-partial"
  local out="$EVIDENCE_DIR/summary-$suffix.json"
  # Disclose which stages actually ran in THIS invocation: a '--stage summary'
  # run re-badges whatever results are on disk, and the summary must say so.
  run node "$REPO_ROOT/scripts/lib/evidence-summary.mjs" \
    --repo-root "$REPO_ROOT" \
    --git-sha "$GIT_SHA" \
    --dirty "$GIT_DIRTY" \
    --node-version "$NODE_VERSION" \
    --pnpm-version "$PNPM_VERSION" \
    --domains "$(IFS=,; echo "${DOMAINS[*]}")" \
    --stages-run "$(IFS=,; echo "${STAGES[*]}")" \
    --out "$out"
}

for s in "${ALL_STAGES[@]}"; do
  if contains "$s" "${STAGES[@]}"; then
    "stage_$s"
  fi
done

echo "build-evidence: done."
