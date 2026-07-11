# E3 — real-system baseline arms (agent-memory ingest pipelines)

Tests whether agent-memory systems' INGEST pipelines destructively resolve
conflicting facts at WRITE time (LLM ADD/UPDATE/DELETE decisions), where
Predicate preserves both values and surfaces a `j:ValueConflict`.

Everything here is key-free and local: Ollama (LLM + embedder) and embedded
Qdrant in path mode (no server, no Docker).

## Mem0 — two arms, two venvs (this is deliberate)

Code inspection of mem0ai finding (2026-07-11): the OSS `Memory.add()` pipeline
**changed between 1.x and 2.x**.

| arm | venv | mem0ai | write policy |
|---|---|---|---|
| `classic` | `.venv-classic/` | 1.0.11 (last pre-2.0) | two-phase: fact extraction, then a second LLM call decides **ADD / UPDATE / DELETE / NONE** per fact against the top-5 similar existing memories (`get_update_memory_messages`, `mem0/memory/main.py`). This is the destructive-resolution mechanism described in the Mem0 paper and is E3's target. |
| `v2add` | `.venv/` | 2.0.11 | "V3 phased batch pipeline": **additive-only** extraction (`ADDITIVE_EXTRACTION_PROMPT`); `DEFAULT_UPDATE_MEMORY_PROMPT` still ships in `configs/prompts.py` but is never invoked by `memory/main.py`. No UPDATE/DELETE at ingest; dedup is via hash + "skip if semantically equivalent". Conflicting values can coexist — but nothing ever flags them. |

Both arms are paper-relevant: `classic` measures destructive resolution;
`v2add` measures the successor failure mode (conflicts preserved but never
surfaced — silent coexistence instead of silent resolution).

### Setup (recreate from scratch)

```sh
cd packages/predicate-eval/baselines
uv venv .venv --python 3.12          && uv pip install --python .venv/bin/python         'mem0ai==2.0.11' ollama
uv venv .venv-classic --python 3.12  && uv pip install --python .venv-classic/bin/python 'mem0ai==1.0.11' ollama
ollama pull nomic-embed-text   # 274 MB embedder; qwen3.5:latest is the default chat model
```

### Run

```sh
# classic destructive arm (the primary E3 arm)
.venv-classic/bin/python mem0_ingest.py ../fixtures/conflict-d20
.venv-classic/bin/python mem0_ingest.py ../fixtures/conflict-xr-small

# current additive arm
.venv/bin/python mem0_ingest.py ../fixtures/conflict-d20

# options: --model gemma4:e4b   --max-facts 10 (smoke)   --verdicts-only (recompute
# verdicts from an existing DB + ops file without re-ingesting)
```

One `add()` per fact, in stream order (episodes/e01.jsonl then e02.jsonl),
fixed `user_id=e3`. Each fact `{"s","p","o","lit"?}` is rendered to one NL
sentence with IRIs stripped to local names (`"p06 reports to m1."`,
`"Record s1-p002: email is p002@ex.com."`).

Runtime: ~15–30 s per fact on this machine (2 local LLM calls per add in the
classic arm) → conflict-d20 (135 facts) ≈ 45–70 min; conflict-xr-small
(345 facts) ≈ 2–3 h. Run under `nohup`/background and use `--verdicts-only`
to harvest results from a finished (or killed) run.

### Outputs (`results/`)

- `mem0-ops.<fixture>.<arm>.jsonl` — one line per `add()`: the fact, the NL
  text, every memory op returned (`ADD`/`UPDATE` incl. `previous_memory`/
  `DELETE`), the mem0-internal log slice (the ONLY place `NONE` decisions and
  raw LLM actions are visible), latency.
- `mem0-verdicts.<fixture>.<arm>.json` — per planted oracle conflict:
  `{subject, predicate, values, survived, lost_mechanism, op_history,
  search_hits, verdict}` with verdict ∈ `preserved-both |
  silently-resolved-to-one | lost-both | unclear`, plus top-level counts.
  For xr fixtures also a per-coreference-pair section: did ingest ever link
  the two records sharing an email (`linked`), and pair-level verdicts.

Survival is judged against the FULL final memory state (`get_all`), not just
vector search, so retrieval noise cannot masquerade as destruction; per-subject
`search()` hits are recorded alongside as the retrieval view. If the LLM emits
malformed ops the row records the error and the affected conflicts are marked
`unclear`.

## Zep / Graphiti arm — PLANNED, blocked on Docker/Neo4j

Graphiti (Zep's OSS engine) is the interesting contrast: it does NOT delete on
conflict — it does **temporal edge invalidation** (marks the old fact edge
`invalid_at` when a contradicting edge arrives). So the three-way comparison is:

| system | write policy on conflict |
|---|---|
| Mem0 classic | destructive UPDATE/DELETE (old value gone) |
| Mem0 2.x | additive; both values coexist, nothing flags them |
| Graphiti/Zep | old edge invalidated with timestamp (recoverable, but the LLM decides *which* edge is "old" — for genuinely concurrent contradictions it silently picks a winner rather than surfacing a conflict) |
| Predicate | both preserved + `j:ValueConflict` materialized |

Blocked here because Graphiti requires Neo4j (or FalkorDB) and the local
Docker daemon is down. Plan when unblocked:

```sh
timeout 10 docker info || (echo "docker still down"; exit 1)
docker run -d --name e3-neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/e3password neo4j:5
pip install graphiti-core   # in a third venv
```

Graphiti config, key-free: `OpenAIGenericClient` pointed at Ollama's
OpenAI-compatible endpoint (`base_url=http://localhost:11434/v1`,
`api_key="ollama"`, model `qwen3.5:latest`) + `OpenAIEmbedder` with the same
base_url and `nomic-embed-text`. Then mirror `mem0_ingest.py`: one
`add_episode()` per fact, capture created/invalidated edges per episode
(edge `valid_at`/`invalid_at` transitions are the op log), and score the same
oracle conflicts: an invalidated-but-queryable old value counts as
`preserved-recoverable`, an old value the default search no longer returns
counts as `silently-resolved-to-one` at the retrieval surface.

### OPENAI_API_KEY fallback (both systems)

If a key is available (stronger extraction, faster):
- Mem0: `{"llm": {"provider": "openai", "config": {"model": "gpt-4o-mini"}}, "embedder": {"provider": "openai", "config": {"model": "text-embedding-3-small", "embedding_dims": 1536}}}` — swap into `build_memory()` in `mem0_ingest.py`.
- Graphiti: default `OpenAIClient`/`OpenAIEmbedder` with `OPENAI_API_KEY` env, no config needed.

Keep the Ollama runs as the headline numbers (fully reproducible, key-free);
report an OpenAI run only as a robustness check that verdicts are not an
artifact of local-model extraction quality.
