---
name: predicate
description: Local reasoning knowledge graph for "why", "what breaks if", and "what's connected to" questions. OWL-backed, provenance-tracked, schema-versioned. Use when the question is structural — about relations, transitive dependencies, contradictions, or prior-session state.
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
- **What was done previously** ("which files did I modify last session?",
  "did `pnpm test` pass last time?", "what commands have failed most often?") —
  the Stop-hook extractor records every prior session's tool calls into
  `kg:abox` as `pred:Session` + `codebase:modifiedIn` / `succeededIn` /
  `failedIn` triples. See worked example 4.

Do NOT use Predicate for:
- Fuzzy semantic recall over unstructured text ("find docs about login")
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

## 4. Session history — "which files did I touch last session?"

When the user references prior work, query the session-history slice that
the Stop-hook extractor maintains in `kg:abox`. The relevant predicates
are `pred:Session` (the session entity), `codebase:modifiedIn`,
`codebase:succeededIn`, `codebase:failedIn`, `codebase:commandText`.

```
kg_explore_schema("Session")         # confirm the predicates
kg_ask(
  question="Which files did I modify in the most recent session?",
  sparql="""
    PREFIX pred: <https://predicate.dev/meta#>
    PREFIX cb:   <https://predicate.dev/codebase#>
    SELECT ?file ?session ?at WHERE {
      GRAPH <kg:abox> {
        ?session a pred:Session ; pred:at ?at .
        ?file cb:modifiedIn ?session .
      }
    } ORDER BY DESC(?at) LIMIT 20
  """
)
```

Other useful queries on this slice:

```
# Commands that have failed most often (debug-cycle hotspots)
SELECT ?text (COUNT(?session) AS ?failures) WHERE {
  GRAPH <kg:abox> {
    ?cmd a cb:Command ; cb:commandText ?text ; cb:failedIn ?session .
  }
} GROUP BY ?text ORDER BY DESC(?failures)

# Files modified in this session that also failed a command (suspect debug targets)
SELECT DISTINCT ?file WHERE {
  GRAPH <kg:abox> {
    ?file cb:modifiedIn ?session .
    ?cmd  cb:failedIn   ?session .
  }
}
```

Cite the session URI as provenance when the answer is "you last touched
auth.ts in session ses-X".

The reasoner derives additional classes on top of the raw action data
(refreshed by every `predicate maintain` run):

| Derived class | Means |
|---|---|
| `codebase:Hotspot` | File modified in >= 3 sessions — likely active work-in-progress |
| `codebase:FlakyCommand` | Command that has failed in >= 2 sessions — suspect debug target |
| `codebase:ActiveFile` | File modified in the single most-recent session |

Query them directly via `kg:inferred`:

```sparql
PREFIX cb: <https://predicate.dev/codebase#>
SELECT ?file WHERE { GRAPH <kg:inferred> { ?file a cb:Hotspot } }
```

## 5. Memory recall — "what did I do with X recently?"

For substring-match recall over session history, call `predicate recall`
(or `kg_ask` with the equivalent SPARQL). Useful when the user asks
"what did I work on related to X?" or "did I ever run command Y?"

```sparql
PREFIX cb:   <https://predicate.dev/codebase#>
PREFIX pred: <https://predicate.dev/meta#>
SELECT ?file (COUNT(DISTINCT ?session) AS ?n) (MAX(?at) AS ?lastAt)
WHERE {
  GRAPH <kg:abox> {
    ?file cb:modifiedIn ?session .
    ?session pred:at ?at .
    FILTER (CONTAINS(LCASE(STR(?file)), LCASE("auth")))
  }
} GROUP BY ?file ORDER BY DESC(?lastAt)
```

Combine with the `cb:Hotspot` / `cb:FlakyCommand` / `cb:ActiveFile` derived
classes from `kg:inferred` for richer answers ("is auth.ts a hotspot?").

Shell shortcut:

```bash
predicate recall auth          # files + commands matching "auth"
predicate recall "pnpm test"   # commands matching exact substring
predicate recall auth --json   # machine-readable output
```

## 6. Schema gap → propose

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

## Federation

If teammates also use Predicate, they can share session-history:

```bash
# On Alice's machine:
predicate export-sessions --user alice > alice.trig
# Send to Bob (Slack, scp, etc.)

# On Bob's machine:
predicate import-sessions alice.trig
predicate peer add alice http://alice.local:3030/predicate/query  # optional, for live queries

# Then kg_ask can union local + remote:
kg_ask --include-remote ...
```

This MVP is offline-friendly: no realtime sync, no auth. Each user's data
lives in a separate named graph so there are no merge conflicts. Same-IRI
collisions (e.g. `file:///work/auth.ts` from two users) are treated as
the same resource by RDF — use `owl:sameAs` if you want them merged, or
namespace your files per-user if you want them separate.

## External Linked Data

For canonical public knowledge (Wikidata, DBpedia), call `predicate ld
ask` instead of trying to recall from training data. Examples:

```bash
predicate ld init  # one-time

predicate ld ask 'SELECT ?label WHERE {
  <http://dbpedia.org/resource/JSON> rdfs:label ?label .
  FILTER (LANG(?label) = "en")
} LIMIT 1'
```

Use cases:
- "Is library X deprecated?" → check Wikidata for last-release metadata
- "Who maintains project Y?" → DBpedia abstract
- "What's the canonical URI for concept Z?" → both

`predicate ld init` registers `dbpedia` and `wikidata` as peers in
`kg:peers` with `pred:peerKind "external-ld"`. The marker keeps them
distinct from team peers — `predicate peer list` shows everything
side-by-side with a `kind` column; `predicate ld list` filters to just
the LD endpoints. Results from `ld ask` are NOT written back to local
`kg:abox` — each call re-fetches, so don't run this in tight loops.

## Goal decomposition

The default `kg_research_goal` uses a pattern-based decomposer
(deterministic, fast, predictable). For questions that don't match any
pattern, you can opt-in to LLM-augmented decomposition by passing
`useLlmDecomposer: true`. The LLM (Claude Haiku) is constrained to
emit only the known intent kinds — invented kinds are filtered out.
If no `ANTHROPIC_API_KEY` is set, it transparently falls back to the
deterministic decomposer's 'unknown' result. The response includes a
`decomposerKind` field (`"deterministic"` or `"semantic"`) so you know
which path produced the sub-questions. Pattern-matched questions like
"what calls X" skip the LLM entirely.

## Schema-learning toggle (v2.0)

The autonomous proposer (Generalizer) runs by default — when the agent
asserts a triple using a not-yet-declared pattern that appears in >= K
instances, it auto-stages a `kg_propose_schema` candidate. The sweeper
promotes after 3 successful uses.

To pause that loop (e.g., the user says "stop adding new predicates"):

```
kg_config_set({ key: "schema-learning", value: false })
```

When off:
- The Generalizer skips proposal generation.
- `kg_propose_schema` (explicit MCP calls) STILL works.
- The PromotionSweeper STILL promotes existing staged proposals.

Re-enable with `kg_config_set({ key: "schema-learning", value: true })`.
Read current state with `kg_config_get({ key: "schema-learning" })`.

## Init / bootstrap (v2.0)

Predicate v2.0 boots empty. On first `predicate up`, the user picks one
of three modes via `predicate init` (interactive prompt or flags):

- **community**: bundled ontology (codebase, foaf, schema-org-lite, fhir-core)
- **upload**: user-supplied .ttl
- **empty**: meta + minimal top vocab; agent grows it via propose -> 3-use -> promote

The chosen mode is stored at `<urn:predicate:config>` in kg:meta and the
SessionStart banner reflects it.
