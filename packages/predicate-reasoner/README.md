# predicate-reasoner

The reasoning engine. A curated set of **21 OWL 2 RL rules** runs as SPARQL
`CONSTRUCT` rules, **forward-chained to a fixpoint**, materializing entailments
into `kg:inferred`. SHACL shapes provide closed-world validation, and an
explanation module reconstructs a cited **inference trace** for any derived claim
(powering `kg_explain`).

Part of the [Predicate](https://github.com/NordicAgents/predicate#readme)
monorepo.

## What it does

- **Closure.** `src/closure.ts` + `src/fixpoint.ts` apply the rule set
  repeatedly until no new triples are produced.
- **Rules.** `src/rules/` holds the OWL 2 RL subset (subclass/subproperty,
  domain/range, functional/inverse-functional, disjointness, transitivity, …)
  plus the domain derive-only classes (`Hotspot`, `FlakyCommand`, `ActiveFile`).
- **Validation.** `src/shacl.ts` + `src/validate.ts` run SHACL shapes for
  closed-world constraint checks and inconsistency detection.
- **Explanation.** `src/explain.ts` walks back from a claim to the rule that
  produced it and the asserted premises it depends on, each cited with provenance.

Low-confidence triples are excluded from the closure so they cannot poison
entailment.

## Dependencies

`rdf-validate-shacl`, `n3`, and `predicate-mcp` (for graph access types).

## Scripts

```bash
pnpm build
pnpm test        # vitest — rule-by-rule entailment + SHACL fixtures
pnpm typecheck
```
