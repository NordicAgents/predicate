# Driving Tier 2 (agent-driven, no API key)

Tier 2 measures whether the host model can draft SPARQL that answers each question,
versus Tier 1's vetted golden queries. Claude Code does not support MCP sampling
(issue #1785), so the model is driven in-session by the agent.

## Steps
1. Emit tasks:  `pnpm --filter predicate-eval tier2 emit org`
   → writes `results/tier2-tasks.org.jsonl` (one `{id,domain,questionText,type,schema,graphsHint}` per line).
2. For each task line, the controller asks the host model to draft ONE SPARQL query
   using `buildPrompt(task)` (src/tier2-prompt.ts) as the instruction. Dispatch one
   subagent per task (or batch) whose entire job is: read the prompt, output only the
   SPARQL. Collect `{id, sparql}` lines into `results/tier2-answers.org.jsonl`.
   The drafting agent must NOT be given the golden query or the answer key.
3. Score:  `pnpm --filter predicate-eval tier2 score org results/tier2-answers.org.jsonl`
   → appends to `results/tier2-scoreboard.jsonl` and prints the Tier1-vs-Tier2 gap.

## Interpreting the gap
- `gap ≈ 0`: the model drafts SPARQL as good as the vetted golden queries.
- `gap > 0`: the model underperforms — inspect `sparql_valid_rate` (syntax failures) vs
  valid-but-wrong (semantic misses). This is the LLM-writes-SPARQL reliability number.
- A high `gap` with high `sparql_valid_rate` means the queries run but retrieve the wrong
  thing (schema misuse); a low `sparql_valid_rate` means syntactic/SPARQL-star failures.

## First baseline (org, 2026-05-24, host model = Haiku via in-session subagents)

```
aggregate: t1=1.00 t2=0.00 gap=1.00 sparql_valid_rate=0.13
```

7 of 8 drafted queries failed to parse; the 1 that parsed returned empty. Root causes
(NOT tuned away — this is the honest first number):
- **Missing prefix/graph conventions.** Queries used `org:`/`kg:inferred` without declaring
  prefixes and `FROM kg:inferred` without `<>`. The prompt never states that the `kg:` graphs
  are URIs and that no prefixes are predeclared.
- **Unknown individual-IRI scheme.** The only parseable query used `http://ex/org#Dana`
  (capitalized, `#`) but individuals are `http://ex/org/dana`. The schema slice is the TBox
  only — no individual-IRI examples.

This is the LLM-writes-SPARQL reliability number the harness was built to measure. It is
dominated by an underspecified prompt and a weak model. Highest-leverage improvements before
the next run: (1) add the `kg:abox`/`kg:inferred` graph-URI convention and a couple of sample
individual IRIs to `buildPrompt`; (2) try a stronger drafting model. Re-run and compare the gap.

## Future automation
The `CompletionProvider` seam (`predicate-agent/src/completion-provider.ts`) lets an
MCP-sampling driver (hosts that implement sampling) or an `ANTHROPIC_API_KEY` driver
produce the answers file unattended, without changing the rig.
