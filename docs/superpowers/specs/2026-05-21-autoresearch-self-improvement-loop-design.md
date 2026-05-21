# Autoresearch self-improvement loop — design

**Date:** 2026-05-21
**Status:** Approved (design); pending implementation plan
**Branch:** hardening-and-roadmap

## Summary

Port the [karpathy/autoresearch](https://github.com/karpathy/autoresearch) pattern —
an autonomous overnight loop that edits one bounded surface, runs a fixed-budget
fitness function, and keeps or discards each change against a single metric — to
Predicate. The goal is a self-improving development loop: **Predicate improving
Predicate**, judged by an eval scoreboard built from Predicate's own value props.

Built in two phases, in this order:

1. **Phase 1 — the scoreboard.** Promote `predicate-eval` from a demo into a
   trustworthy, deterministic fitness function emitting a versioned 4-axis
   `scorecard.json`. This is the frozen `prepare.py` analogue. No loop yet.
2. **Phase 2 — the loop.** A Claude Agent SDK driver that proposes one edit to a
   curated **knob surface**, runs `pnpm test` + the scoreboard, and keeps-or-reverts
   per an accept gate. Knob-only to start; surface widened later.

The leverage and the risk both live in Phase 1 (the fitness function and the knob
registry). The Phase-2 driver is small.

## The karpathy → Predicate mapping

| autoresearch | Predicate equivalent |
|---|---|
| `prepare.py` (frozen) | `predicate-eval` scoreboard + fixtures — the fitness function, never edited by the loop |
| `train.py` (the one editable file) | a curated **knob surface**: reasoner rule set, extraction/judgment prompts, promotion-gate thresholds, SHACL shapes |
| `val_bpb` (scalar metric) | a **4-axis scorecard** (multi-hop accuracy, recall fidelity, contradiction detection, explanation soundness) |
| 5-minute train budget | one eval run (full fixture suite) per iteration |
| keep/discard on `val_bpb` | green tests **AND** no axis regresses **AND** ≥1 axis improves → auto-commit to branch |
| `program.md` | the loop's system brief: what knobs exist, how to read the scorecard, the accept rule |

## Strategy decision

**Strategy A — in-repo TypeScript harness driven by the Claude Agent SDK.** A new
`predicate-autoresearch` workspace package. Self-contained, language-consistent
with the monorepo, runs unattended via the CLI. Rejected alternatives: harness-driven
via `/loop` + scheduled agents (couples the loop to the Claude Code harness and puts
accept-gate logic in a prompt rather than tested code); external Python orchestrator
(adds a Python/TS boundary through a pure-TS monorepo).

## Architecture

New workspace package `predicate-autoresearch`. Phase 1 ships the scoreboard and
fixtures; Phase 2 adds the knob surface and the loop driver on top.

### Phase 1 — the scoreboard (fitness function)

```
predicate-autoresearch/
  fixtures/                 # the eval corpus, versioned (the "data")
    multihop/               # questions needing 2+ hops + gold answers
    recall/                 # transcript -> expected captured facts/judgments
    contradiction/          # conflicting facts on functional/disjoint preds + expected flag
    explanation/            # claims + gold derivation shape
  src/
    scoreboard.ts           # runs all axes against a fresh ephemeral store, emits scorecard.json
    axes/
      multihop.ts           # accuracy: gold-answer match over kg_ask + reasoner
      recall.ts             # capture fidelity: precision/recall of facts/judgments
      contradiction.ts      # detection rate + false-positive rate
      explanation.ts        # soundness: every step cited, provenance real, no hallucinated links
    harness.ts              # spins an isolated Oxigraph store per run
```

The four axes, each scored independently, map directly to Predicate's value props:

- **Multi-hop answer accuracy** — does `kg_ask` + the reasoner return correct
  answers to questions requiring chaining 2+ facts/rules? The core
  "reasoning memory" claim.
- **Recall / capture fidelity** — after a session transcript, are the right
  facts/judgments captured and retrievable later? Precision/recall against
  transcript fixtures. The "memory that persists" claim.
- **Contradiction detection** — when fixtures contain conflicting facts on
  functional/disjoint predicates, does the reasoner flag the conflict instead of
  silently averaging? Reports both detection rate and false-positive rate.
- **Explanation soundness** — does `kg_explain` return a valid derivation: every
  step cited, provenance real, no hallucinated links? Guards the "auditable" claim.

**Phase-1 design rules:**

- **Each axis returns a 0–1 score plus raw counts.** The scorecard reports all four
  side by side; there is no blended scalar. This is the primary anti-Goodhart
  defense — the loop cannot trade one axis off invisibly.
- **Isolated ephemeral store per run.** `harness.ts` creates a temp-dir Oxigraph
  store per run and tears it down after. A run never touches `~/.predicate`, and
  runs are reproducible.
- **`scorecard.json` is the artifact** both humans and the loop read.
  Schema-versioned; records per-axis score + counts + the **fixture-set hash** it
  was computed against. A score is only comparable to another at the same fixture
  hash.
- **Deterministic and fast** — must run dozens of times a night without flakiness.

### Phase 2 — the loop

```
predicate-autoresearch/
  knobs/                    # THE ONLY editable surface in Phase 2
    reasoner-rules/         # the OWL 2 RL CONSTRUCT rule set (data)
    prompts/                # extraction + judgment-distillation prompts
    thresholds.json         # promotion gate (N uses / TTL days), confidence cutoffs
    shapes/                 # SHACL shapes
  src/
    loop.ts                 # the driver
    knob-registry.ts        # declares what's editable + validates a proposed edit is in-bounds
    accept-gate.ts          # green tests AND no-axis-regression AND >=1-axis-gain
    journal.ts              # append-only log of every iteration
```

The knob surface is the `train.py` analogue: high-leverage, low-blast-radius, and
expressed as **data** (rules, prompts, thresholds, shapes) rather than arbitrary
code. The existing reasoner/extraction code must be refactored so these knobs are
loaded from `knobs/` rather than hardcoded — that refactor is part of Phase 2 setup.

**Iteration loop (`loop.ts`):**

1. Read `scorecard.json` (current baseline) + the journal of what's been tried.
2. Agent SDK proposes **one** knob edit, constrained by `knob-registry`. An edit
   outside the registry is rejected before anything runs.
3. Run `pnpm test` (full suite). Red → revert knob files, journal, next iteration.
4. Run `scoreboard`. Compute per-axis delta vs the baseline scorecard.
5. **Accept gate** (`accept-gate.ts`): tests green AND no axis regressed AND ≥1 axis
   improved → `git commit` to the `autoresearch/<date>` branch and adopt the new
   scorecard as baseline. Otherwise → `git checkout` the knob files, journal the
   reason.
6. Repeat until `--hours N` or `--iterations N` budget is exhausted.

**Morning review:** `git log autoresearch/<date>` plus the journal. Every kept change
is a green-tested, non-regressing commit; every rejected idea is recorded with its
scorecard delta so the loop (and the human) don't re-try it.

### CLI surface

```
predicate autoresearch --hours 8              # run the loop for a wall-clock budget
predicate autoresearch --iterations 50        # or a fixed iteration count
predicate eval                                # Phase 1: run the scoreboard once, print scorecard
```

(Exact CLI wiring is an implementation-plan concern; listed here to fix intent.)

## Safety / anti-Goodhart model

- **Tests are a hard gate, not an axis.** The loop cannot raise the score by
  breaking behavior the eval does not cover — the existing unit suite must stay
  green to accept any change.
- **No-regression rule across all four axes** prevents trading explanation
  soundness for multi-hop accuracy (or any such swap).
- **Held-out fixture split.** A fraction of fixtures are *not* shown in the
  per-iteration scorecard the agent optimizes against; they are scored and reported
  separately at the end of a run. Held-out diverging from the optimized set is the
  overfitting signal — the run is suspect.
- **Knob registry as blast-radius cap.** Phase 2 literally cannot touch arbitrary
  source; the editable set is enumerated data validated by `knob-registry.ts`.
- **Everything on a branch.** `main` is never auto-touched; winners land on
  `autoresearch/<date>`.

## Out of scope (YAGNI)

- Widening the editable surface beyond knobs — explicitly deferred ("knobs first,
  widen later"); only revisited once the loop + scoreboard are proven.
- Distributed / multi-GPU style parallel runs — single-process overnight loop only.
- Any in-product "autoresearch mode" exposed to end users — this is a development
  tool for improving the skill, not a runtime Predicate feature.
- Auto-merging to `main` or opening PRs automatically.

## Open questions for the implementation plan

- Where the four fixture corpora come from initially: hand-authored gold sets vs.
  derived from existing `predicate-eval` cases vs. mined from real session
  transcripts. (Likely a seed of hand-authored + a path to grow from transcripts.)
- The exact knob-loading refactor needed in `predicate-reasoner` /
  `predicate-agent` so rules/prompts/thresholds/shapes load from `knobs/`.
- Agent SDK invocation details for the proposer step (model, tool surface, how the
  journal + scorecard are presented as context).
