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
