---
name: ask
description: Ask the knowledge graph a structural question. Composes kg_explore_schema → kg_ask → kg_explain.
---

# /predicate:ask <question>

Treat the arguments as the user's question. Follow the SKILL.md workflow:

1. Call `kg_explore_schema(concept)` for the main subject in the question.
2. Draft fresh SPARQL against `kg:abox ∪ kg:inferred` using predicates from
   the schema slice.
3. Call `kg_ask` to execute.
4. Call `kg_explain` for each load-bearing claim in the answer, with cited
   provenance.

Do NOT invent predicates — use only what `kg_explore_schema` returned. If a
predicate is missing, call `kg_propose_schema` instead of fabricating.
