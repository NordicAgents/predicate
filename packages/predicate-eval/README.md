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

---

## Tier 2 (agent-driven, no API key)

### What it measures

Tier 2 asks whether the **host model can draft correct SPARQL** for each
research question, versus the vetted golden queries that Tier 1 uses. Two
numbers come out of a Tier 2 run:

| Signal | Definition |
|---|---|
| **gap** | `t1 − t2` — how much accuracy is lost when the model writes the queries instead of a human |
| **sparql_valid_rate** | Fraction of drafted queries that parse and execute without error |

A gap of 0 means the model's drafted SPARQL is as good as the golden queries.
`sparql_valid_rate` isolates the syntactic problem from the semantic one.

Tier 2 scores only at the **final-episode state** (all facts loaded). Tier 1
owns the per-episode compounding curve; Tier 2 adds the LLM-writes-SPARQL
reliability dimension.

### Why agent-driven

Claude Code does not support the MCP `sampling/createMessage` protocol
([issue #1785](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1785)),
so Tier 2 is driven in-session: for each question a subagent drafts SPARQL
following the workflow in `DRIVING-TIER2.md`, writing answers to a JSON file.
The `emit` CLI step produces that file; `score` consumes it.

The `CompletionProvider` seam in
`predicate-agent/src/completion-provider.ts` is designed so that an
MCP-sampling driver or a direct `ANTHROPIC_API_KEY` driver can replace the
in-session approach for unattended runs on hosts that support them.

### How to run

```bash
# Step 1 — emit one question-set as a task for the host model to answer
pnpm --filter predicate-eval tier2 emit org
# Follow the DRIVING-TIER2.md workflow: the model drafts SPARQL per question
# and writes answers to a file such as results/tier2-org-answers.json

# Step 2 — score the answers against the ground truth at the final episode
pnpm --filter predicate-eval tier2 score org results/tier2-org-answers.json
```

Results are written to `results/tier2-<domain>-scored.json` and printed as a
one-line summary: `t1=<n> t2=<n> gap=<n> sparql_valid_rate=<n>`.

### First baseline

**org / Claude Haiku (in-session)**

```
t1=1.00  t2=0.00  gap=1.00  sparql_valid_rate=0.13
```

7 of 8 drafted queries failed to parse. Root causes identified:

- The prompt did not supply the `kg:abox` / `kg:inferred` graph-URI
  conventions, so the model omitted the `FROM NAMED` / `GRAPH` clauses
  required by the Oxigraph endpoint.
- The 1 syntactically valid query returned empty results because it used a
  wrong individual-IRI scheme (bare labels instead of the full
  `https://predicate.test/org#…` IRIs).

**Next improvements:** enrich `buildPrompt` with the graph-URI convention and
a sample of real individual IRIs from the loaded corpus, and trial a stronger
drafting model (Sonnet or Opus).
