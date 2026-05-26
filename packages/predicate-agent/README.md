# predicate-agent

The growth and maintenance logic that keeps the graph useful over time: goal
tracking, goal decomposition, gap detection, schema proposals, the use-gated
promotion sweeper, generalization, and turn extraction.

Part of the [Predicate](https://github.com/NordicAgents/predicate#readme)
monorepo. Consumed by `predicate-mcp` (`kg_research_goal`, `kg_maintain`,
`kg_extract_judgments`) and by the CLI's capture/extract path.

## Modules

| Module | Role |
|---|---|
| `goal-store.ts` | Persists research goals and their resolution state in `kg:goals`. |
| `decomposer.ts` / `semantic-decomposer.ts` | Break a goal into sub-questions; report which predicates the live TBox can/cannot answer. |
| `gap-detector.ts` | Find missing schema needed to satisfy a goal. |
| `schema-proposer.ts` | Stage `SchemaDelta` proposals into `kg:tbox-staging`. |
| `promotion-sweeper.ts` | Promote staged deltas only after N successful uses inside a TTL; expire the rest. |
| `generalizer.ts` | Periodically generalize concepts to keep the graph bounded. |
| `turn-extractor.ts` / `semantic-extractor.ts` / `extractor.ts` | Extract typed triples (files modified, commands passed/failed) from a session turn into `kg:abox`. |
| `transcript-adapters.ts` | Normalize Stop-hook payloads from different hosts. |
| `research-goal.ts` / `research-source.ts` | Orchestrate optional research execution against a goal. |
| `completion-provider.ts` | Optional LLM-augmented decomposer fallback (needs `ANTHROPIC_API_KEY`). |

## Schema lifecycle

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontSize": "14px",
    "primaryColor": "#FFD23F",
    "primaryTextColor": "#1A1A1A",
    "primaryBorderColor": "#1A1A1A",
    "lineColor": "#1A1A1A",
    "secondaryColor": "#FF6B6B",
    "tertiaryColor": "#4ECDC4",
    "noteBkgColor": "#FFF7E1",
    "noteTextColor": "#1A1A1A",
    "noteBorderColor": "#1A1A1A"
  }
}}%%
stateDiagram-v2
  direction LR
  [*] --> Staging: <b>kg_propose_schema</b><br/>SchemaProposer.propose()
  Staging --> Validated: reasoner accepts<br/>(no contradictions)
  Staging --> Expired: TTL elapsed,<br/>no references
  Validated --> Promoted: N usages within TTL<br/><b>PromotionSweeper.promote()</b>
  Validated --> Expired: TTL elapsed
  Promoted --> Demoted: <b>kg_demote</b><br/>LifecycleController.move()
  Expired --> [*]
  Demoted --> [*]

  classDef stage     fill:#FFD23F,stroke:#1A1A1A,stroke-width:3px,color:#1A1A1A,font-weight:bold
  classDef validated fill:#4ECDC4,stroke:#1A1A1A,stroke-width:3px,color:#1A1A1A,font-weight:bold
  classDef promoted  fill:#06D6A0,stroke:#1A1A1A,stroke-width:3px,color:#1A1A1A,font-weight:bold
  classDef expired   fill:#1A535C,stroke:#1A1A1A,stroke-width:3px,color:#FFFFFF,font-weight:bold
  classDef demoted   fill:#FF6B6B,stroke:#1A1A1A,stroke-width:3px,color:#FFFFFF,font-weight:bold

  class Staging stage
  class Validated validated
  class Promoted promoted
  class Expired expired
  class Demoted demoted

  note right of Staging
    graph: <b>kg:tbox-staging</b>
  end note
  note right of Promoted
    graph: <b>kg:tbox</b>
    drops kg:inferred to
    force re-materialization
  end note
```

Source: [`docs/diagrams/schema-lifecycle.mmd`](../../docs/diagrams/schema-lifecycle.mmd).

## Dependencies

`@anthropic-ai/sdk` (optional fallback only), `predicate-mcp`, `predicate-reasoner`.

## Scripts

```bash
pnpm build
pnpm test        # vitest
pnpm typecheck
```
