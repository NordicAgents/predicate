# predicate-eval

End-to-end demo and evaluation harness: load a corpus, run multi-hop questions
through the agent + reasoner, and run ontology CI checks. Not published — a
development and validation tool.

Part of the [Predicate](https://github.com/NordicAgents/predicate#readme)
monorepo.

## What's inside

| File | Role |
|---|---|
| `src/load-corpus.ts` | Seed the graph from a fixture corpus. |
| `src/ask.ts` | Run questions end-to-end (assert → reason → ask → explain). |
| `src/research-questions.ts` | Multi-hop question set for the eval. |
| `src/judgment-corpus.ts` | Corpus for judgment-extraction evaluation. |
| `src/ontology-ci.ts` | CI check that the bundled ontology stays valid. |

## Run it

```bash
pnpm demo            # tsx load-corpus.ts && tsx ask.ts
pnpm ontology-check  # tsx ontology-ci.ts
pnpm test            # vitest
```

## Dependencies

`predicate-agent`, `predicate-mcp`, `predicate-reasoner`, `tsx`.

---

## Eval harness (deterministic, Tier 1)

Tasks 1–14 on the `eval-harness` branch built a deterministic, self-contained
evaluation spine. It does not call any LLM at runtime.

### What it measures

| Signal | Definition |
|---|---|
| **Multi-hop accuracy** | Fraction of oracle-derived answer keys matched per episode |
| **Compounding curve** | Accuracy vs episode index — shows how answer quality grows as facts accumulate |
| **Reasoning lift** | `accuracy(inference on) − accuracy(inference off)` — the net contribution of OWL rules |
| **Boundedness** | Triple count, inferred-triple count, unused-concept ratio, materialize latency per episode |

Three domains ship as fixtures: **org** (org-chart inverse/transitive), **research** (citation
chains + contradiction), **coding** (dependency graph).

### How to run

```bash
# Run one domain (also: research, coding)
pnpm --filter predicate-eval eval org

# Run all tests
pnpm --filter predicate-eval test

# Type-check
pnpm --filter predicate-eval typecheck
```

Results append to `packages/predicate-eval/results/scoreboard.jsonl` (one JSON
row per `episode × inference` condition). The CLI prints an ASCII accuracy/lift
curve after each run.

### How to read the curve

Accuracy rises across episodes because each episode adds more captured facts.
The harness scores against the **final** ground truth for the whole fixture, so
early episodes legitimately score lower — that falling-off-the-back is the
compounding signal you want to see recover.

`lift > 0` means the OWL reasoner contributed answers the raw ABox facts alone
could not supply. A lift of 0 means all answers were already present as direct
triples; a negative lift would indicate a reasoning regression.

### Tier 1 is NOT the product experience

Tier 1 runs vetted golden SPARQL directly against the graph. It tests whether
the **reasoning is correct** and **growth is bounded**. It deliberately bypasses
the LLM-writes-SPARQL hot path.

A green Tier 1 does **not** mean "the product works end-to-end." That is Tier 2
(host-model sampling), which is a separate, deferred plan. Tier 1 passing is a
necessary, not sufficient, condition.

### Findings

The following were discovered empirically during construction. They are
load-bearing for understanding how the harness and reasoner interact.

**Abox materialization requires provenance.** The reasoner's `closureEligible()`
excludes `kg:abox` triples that lack a `kg:provenance` confidence ≥ 0.5
annotation. The harness seeds `confidence=1` on captured triples before calling
`materialize()` so transitive rules fire correctly. Implication: real capture
must attach provenance or inference silently does nothing.

**Reasoning-dependent golden queries read `abox ∪ inferred`; direct questions read `kg:abox`.**
Reasoning-dependent questions (transitive, inverse, type-inference) union the asserted and
inferred graphs — matching how the real product queries (PRD §8.3). This makes **lift
conservative**: the inference-off control still answers from the raw ABox facts, so lift
measures only what OWL inference adds *beyond* recall (not the base facts themselves). It also
makes every domain able to reach 1.0 consistently — the base edge comes from `kg:abox`, the
derived closure from `kg:inferred`. (Earlier, querying `kg:inferred` only, research capped at
0.93 because `influencedBy` has no inverse to round-trip its base edge; the union fixes that.)
Direct questions query `kg:abox` and are unaffected by inference mode.

**Naive fixpoint does not scale (scaling probe).** On a subclass chain the
materializer computes the full O(n²) closure with a naive re-run-all-rules
fixpoint: ~100 triples ≈ 10 s, ~200 ≈ 60 s, ~500 ≈ 400 s. The PRD's target
probe sizes (1 k–50 k) are infeasible with the current reasoner. This is
empirical evidence for prioritising semi-naive / delta materialization, and
explains the existing 25 k scale-gate.
