---
name: predicate
description: Local reasoning knowledge graph for "why", "what breaks if", and "what's connected to" questions. OWL-backed, provenance-tracked, schema-versioned. Use instead of RAG when the question is structural rather than fuzzy-semantic.
---

<EXTREMELY-IMPORTANT>
Do NOT invent predicates. ALWAYS call `kg_explore_schema` before drafting SPARQL.
If a predicate you need does not exist, call `kg_propose_schema` — never use
`kg_assert` with a fabricated property name.
</EXTREMELY-IMPORTANT>

# When to use this skill

Use Predicate when the user asks:
- **Why** something happened ("why did login break?")
- **What breaks if** X changes ("blast radius of renaming `validateToken`?")
- **What's connected to** X transitively ("everything downstream of `JWT_SECRET`?")
- **Where the contradiction is** ("these two docs disagree — which holds?")

Do NOT use Predicate for:
- Fuzzy semantic recall ("find docs about login" — use vector search)
- One-shot Q&A with no entities/relations

# Workflow

Follow this sequence. Each step has a hard gate.

1. **Explore the schema first.** Call `kg_explore_schema(concept)` to learn the
   predicates available. Do not draft SPARQL without doing this.
2. **Draft fresh SPARQL.** Compose a query against `kg:abox` and `kg:inferred`.
   Pre-baked templates are forbidden. The query should be specific to the
   concept slice you just read.
3. **Execute via `kg_ask`.** Pass the question and SPARQL. Inspect rows. If
   empty or odd, refine — narrow filters, broaden graphs, check for typos.
4. **Cite provenance.** For every claim the user might act on, call
   `kg_explain` to surface the inference path. Show the user the SOURCE,
   CONFIDENCE, and METHOD for the load-bearing triples.
5. **Assert only after research.** If you learned something new in the session,
   call `kg_assert(triple, source, confidence, method)`. Confidence must be
   honest (parsed code: 0.95+; extracted from prose: 0.6–0.8).
6. **Propose schema only when ABox cannot represent the fact.** If the gap is
   structural (no class or property exists), call `kg_propose_schema(delta,
   justification)`. The promotion gate requires the proposed concept be used
   in N ≥ 3 successful queries within 7 days before it joins the live TBox.

# HARD-GATE anti-patterns

- ❌ Dumping raw text into `kg_assert` — assertions are triples, not prose.
- ❌ Querying `kg:inferred` to write back into `kg:abox`.
- ❌ Bypassing SHACL by writing to graphs that skip validation.
- ❌ Inventing predicates — always check the TBox first.

# Worked examples

## 1. Why did login break?

```
kg_explore_schema("Function")     # learn :calls, :declaredIn, :reads
kg_ask(
  question="What does login depend on?",
  sparql="""
    PREFIX c: <https://predicate.dev/codebase#>
    SELECT ?dep WHERE {
      { GRAPH <kg:abox> { <https://predicate.dev/codebase/auth.ts#login> c:reads|c:calls ?dep } }
      UNION
      { GRAPH <kg:inferred> { <https://predicate.dev/codebase/auth.ts#login> c:dependsOn ?dep } }
    }
  """
)
kg_explain("auth.ts#login depends on JWT_SECRET")
```

## 2. Blast radius of renaming `validateToken`

```
kg_explore_schema("calls")
kg_ask(
  question="What calls validateToken transitively?",
  sparql="""
    PREFIX c: <https://predicate.dev/codebase#>
    SELECT ?caller WHERE {
      GRAPH <kg:inferred> { ?caller c:calls* <...#validateToken> }
    }
  """
)
```

## 3. Contradiction detection

```
kg_ask(
  question="Any disjoint-class violations?",
  sparql="""
    PREFIX c: <https://predicate.dev/codebase#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    SELECT ?x ?a ?b WHERE {
      GRAPH <kg:inferred> { ?x a ?a, ?b }
      GRAPH <kg:tbox> { ?a owl:disjointWith ?b }
    }
  """
)
```

## 4. Schema gap → propose

```
# User asks: "which services own these endpoints?"
# kg_explore_schema reveals: no :owns property exists
kg_propose_schema(
  delta="""
    @prefix c: <https://predicate.dev/codebase#> .
    c:Service a owl:Class .
    c:owns a owl:ObjectProperty ;
      rdfs:domain c:Service ; rdfs:range c:Endpoint .
  """,
  justification="Goal G-123 asks 'which service owns /login'; no current property captures service-to-endpoint ownership."
)
# This goes to kg:tbox-staging. The promotion gate requires 3 successful uses in 7 days.
```
