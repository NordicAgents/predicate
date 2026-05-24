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
# Step 1 — emit one task per question to results/tier2-tasks.org.jsonl
pnpm --filter predicate-eval tier2 emit org
# Follow the DRIVING-TIER2.md workflow: the model drafts SPARQL per question
# into an answers file, e.g. results/tier2-answers.org.jsonl ({"id","sparql"} per line)

# Step 2 — score the answers against the ground truth at the final episode
pnpm --filter predicate-eval tier2 score org results/tier2-answers.org.jsonl
```

Scored rows are appended to `results/tier2-scoreboard.jsonl` and the
Tier1-vs-Tier2 table is printed, ending with the one-line summary:
`aggregate: t1=<n> t2=<n> gap=<n> sparql_valid_rate=<n>`.

### Baselines (org / Claude Haiku, in-session)

| prompt | t2 | gap | sparql_valid_rate |
|---|---|---|---|
| TBox-only | 0.00 | 1.00 | 0.13 |
| + graph-URI/PREFIX conventions + sample IRIs | 0.75 | 0.25 | 1.00 |

The first run's 7/8 parse failures were prompt deficiencies, not model
incapacity: it lacked the `kg:abox`/`kg:inferred` graph-URI convention and
the individual-IRI scheme. After `buildPrompt` was enriched (see
`DRIVING-TIER2.md`), **every query parsed** and accuracy rose to 0.75 with the
same model. The 2 residual misses are semantic (wrong relation direction;
missing UNION of inferred for an inferred type) — the next lever is a stronger
drafting model.

---

## Flat baseline (Tier 0 — does the reasoner earn its keep?)

The control for the whole project: give the model the **same information** the
reasoner+SPARQL pipeline has — the TBox plus every asserted ABox fact, in its
context — and let it answer directly in JSON. No materialization, no SPARQL, no
graph engine (`src/rigs/flat-baseline.ts`, `pnpm --filter predicate-eval flat
emit|score <domain>`). This isolates whether *mechanizing* the reasoning beats
letting the model do it in-context.

**First three-way (org / Haiku, final episode):**

| approach | accuracy |
|---|---|
| Tier 1 — golden SPARQL + reasoner | 1.00 |
| Tier 2 — model writes SPARQL + reasoner | 0.75 |
| Flat (Tier 0) — model reasons in-context, no engine | 0.65 |

Reasoner advantage over flat ≈ **0.35** at this scale. **Read it carefully:** the
flat failures are weak-model slips (direction confusion on the "management chain"
question; a whiffed lookup of a fact that was right there), not context-size
limits — at 8 facts everything fits. So this 0.35 is mostly "the deterministic
engine is exact where a weak model is sloppy," and a stronger model would likely
shrink it. **The decisive experiment is still open:** scale the fixtures to
hundreds/thousands of facts and hold model strength fixed — the reasoner's value
is the regime where flat in-context *collapses* (can't fit or can't find the
facts) while the graph holds. That crossover, if it exists, is Predicate's reason
to exist.
