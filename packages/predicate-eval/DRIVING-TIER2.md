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

## Baselines (org, host model = Haiku via in-session subagents)

| run | t1 | t2 | gap | sparql_valid_rate |
|---|---|---|---|---|
| 2026-05-24 — TBox-only prompt | 1.00 | 0.00 | 1.00 | 0.13 |
| 2026-05-24 — improved prompt  | 1.00 | 0.75 | 0.25 | 1.00 |

**First run (TBox-only prompt):** 7 of 8 queries failed to parse — they used `org:`/`kg:inferred`
without declaring prefixes / `<>`, and guessed wrong individual IRIs (`http://ex/org#Dana` vs
`http://ex/org/dana`). The prompt gave the TBox but neither the `kg:` graph-URI convention nor
the individual-IRI scheme.

**Improved prompt** (`buildPrompt` now states: query `GRAPH <kg:abox>`/`<kg:inferred>` with angle
brackets, declare every PREFIX, UNION inferred for entailments; plus a sample of real individual
IRIs from the data): **sparql_valid_rate 0.13 → 1.00** (all syntax failures gone) and **accuracy
0.00 → 0.75** with the *same model*. The 2 residual misses are semantic, not syntactic:
- **org-q01** used `manages` (subordinates) instead of `reportsTo+` (managers) — wrong direction.
- **org-q04** queried only `kg:abox` for `quinn a Person`, but that type is inferred — no UNION.

Takeaway: the model-writes-SPARQL mechanic is viable with a decent prompt; the remaining gap is
genuine model reasoning error (a stronger drafting model is the next lever to test).

## Future automation
The `CompletionProvider` seam (`predicate-agent/src/completion-provider.ts`) lets an
MCP-sampling driver (hosts that implement sampling) or an `ANTHROPIC_API_KEY` driver
produce the answers file unattended, without changing the rig.
