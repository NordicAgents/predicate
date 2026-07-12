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

## Zep / Graphiti arm (E3b) — BUILT, ingest deferred until Ollama is free

Graphiti (Zep's OSS engine) is the interesting contrast: it does NOT delete on
conflict — it does **temporal edge invalidation** (marks the superseded fact
edge `invalid_at`/`expired_at` when a contradicting edge arrives; the old edge
stays in Neo4j). So the three-way comparison is:

| system | write policy on conflict |
|---|---|
| Mem0 classic | destructive UPDATE/DELETE (old value gone) |
| Mem0 2.x | additive; both values coexist, nothing flags them |
| Graphiti/Zep | old edge invalidated with timestamp (recoverable, but the LLM decides *which* edge is "old" — for genuinely concurrent contradictions it silently picks a winner rather than surfacing a conflict) |
| Predicate | both preserved + `j:ValueConflict` materialized |

**The valid-vs-invalidated distinction IS the finding.** Temporal supersession
is *resolution-with-an-audit-trail*: the losing value survives on an
invalidated edge, so nothing is destroyed — but at the read surface only the
winning edge is "current", the writer never signals that a disagreement
happened, and a reader who does not explicitly query history sees exactly what
Mem0-classic's reader sees: one value, silently chosen. Recoverable is not the
same as SURFACED. `graphiti_ingest.py` therefore scores each planted conflict
against ALL edges including invalidated ones (direct Cypher, not Graphiti
search) and separates `survived_valid` from `survived_invalidated`:

- `preserved-both-valid` — both values on currently-valid edges (unflagged
  coexistence, Mem0-2.x mode)
- `temporally-resolved` — one valid, one invalidated: supersession, the
  EXPECTED Graphiti behavior; audit-trailed but unsurfaced resolution
- `silently-lost` — a value on NO edge at all (valid or invalid): extraction
  dropped it, no audit trail either
- `unclear` — ingest errors touched the subject, or neither value on a valid edge

### Infrastructure (stood up 2026-07-12, verified non-LLM end to end)

- Docker Desktop daemon up; container **`predicate-neo4j`** = `neo4j:5.26`
  (graphiti-core requires server 5.26), ports 7687 (bolt) + 7474 (http),
  auth `neo4j/predicate-e3`. Bolt connectivity verified (kernel 5.26.28).
- **`.venv-graphiti/`** = Python 3.12 + `graphiti-core==0.29.2`
  (neo4j driver 6.2.0, openai 2.45.0).
- Key-free config, all three Graphiti clients on Ollama's OpenAI-compatible
  endpoint (`http://localhost:11434/v1`, `api_key="ollama"`):
  `OpenAIGenericClient` (qwen3.5:latest, think=False patched via extra_body
  with transparent fallback, mirroring `mem0_ingest.patch_no_think`),
  `OpenAIEmbedder` (nomic-embed-text, 768 dims), `OpenAIRerankerClient`
  (only used by `search()`, which verdicts bypass).
- Schema init (`--init-only`) needs NO LLM: it builds Neo4j indices/
  constraints only. Note: graphiti-core logs benign
  `EquivalentSchemaRuleAlreadyExists` ERRORs during init (concurrent
  `CREATE INDEX IF NOT EXISTS` racing inside its own gather) — all 33 indices
  come up ONLINE; ignore the noise.
- Verdict classification smoke-tested by planting synthetic valid+invalidated
  edges: correctly yields `temporally-resolved` with
  `survived_valid=[m2] / survived_invalidated=[m1]`.

Recreate from scratch:

```sh
docker run -d --name predicate-neo4j -p 7687:7687 -p 7474:7474 \
  -e NEO4J_AUTH=neo4j/predicate-e3 neo4j:5.26
cd packages/predicate-eval/baselines
uv venv .venv-graphiti --python 3.12
uv pip install --python .venv-graphiti/bin/python graphiti-core   # ==0.29.2
.venv-graphiti/bin/python graphiti_ingest.py ../fixtures/conflict-d20 --init-only  # non-LLM smoke
```

### Deferred run (blocked ONLY on the in-flight Mem0/Ollama ingest)

The ingest is LLM-bound through Ollama and must not run concurrently with the
Mem0 arm. It is wired into the chain supervisor below as the executable hook
`run_after_ingest.d/30-graphiti.sh` (runs automatically after the Mem0 arms).
To launch it standalone once Ollama is free — one command:

```sh
cd packages/predicate-eval/baselines
nohup bash run_after_ingest.d/30-graphiti.sh > results/run.graphiti.chain.log 2>&1 &
```

The hook guards on docker, (re)starts `predicate-neo4j` if needed, waits for
bolt (up to 3 min), then runs conflict-d20 followed by conflict-xr-small,
logging to `results/run.graphiti.<fixture>.log`. Manual per-fixture equivalent:

```sh
.venv-graphiti/bin/python graphiti_ingest.py ../fixtures/conflict-d20
.venv-graphiti/bin/python graphiti_ingest.py ../fixtures/conflict-xr-small

# options: --max-facts 5 (smoke)  --resume (continue an interrupted run)
#          --verdicts-only (re-score the graph as it stands; no LLM calls)
```

One `add_episode()` per fact (EpisodeType.text), same NL rendering as the
Mem0 arm (helpers imported from `mem0_ingest.py`), monotonic
`reference_time` (base + i minutes) so bi-temporal ordering matches stream
order, `group_id=e3b-<fixture>` isolating fixtures in the shared Neo4j.
Expect Graphiti to be slower per fact than Mem0 classic (entity extraction +
resolution + edge extraction + invalidation passes; several LLM calls per
episode, ~4k-context qwen3.5 — if extraction truncates, raise Ollama's
`num_ctx` or drop to `--max-facts` smoke first).

### Outputs (`results/`)

- `graphiti-ops.<fixture>.jsonl` — one line per `add_episode()`: the fact, the
  NL text, reference_time, new edges (uuid/fact/valid_at/invalid_at), edges
  newly invalidated by this episode (the supersession op log), latency.
- `graphiti-verdicts.<fixture>.json` — per planted oracle conflict:
  `{subject, predicate, values, survived_valid, survived_invalidated, missing,
  verdict, subject_valid_edges, subject_invalidated_edges}` + top-level counts
  and graph stats (`n_edges_total`, `n_edges_invalidated`). For xr fixtures
  also per-coreference-pair rows: did Graphiti's entity resolution ever LINK
  the two records sharing an email (`linked` via cross-record edge, merged
  entity node, or shared email neighbour), plus pair-level verdicts.

### OPENAI_API_KEY fallback (both systems)

If a key is available (stronger extraction, faster):
- Mem0: `{"llm": {"provider": "openai", "config": {"model": "gpt-4o-mini"}}, "embedder": {"provider": "openai", "config": {"model": "text-embedding-3-small", "embedding_dims": 1536}}}` — swap into `build_memory()` in `mem0_ingest.py`.
- Graphiti: default `OpenAIClient`/`OpenAIEmbedder` with `OPENAI_API_KEY` env, no config needed.

Keep the Ollama runs as the headline numbers (fully reproducible, key-free);
report an OpenAI run only as a robustness check that verdicts are not an
artifact of local-model extraction quality.

## Chain — post-ingest experiment supervisor (`run_after_ingest.sh`)

Single-Ollama-box sequencer: everything below competes for the same local
Ollama, so it runs as ONE detached chain that first WAITS for the in-flight
classic-arm ingest to exit (no live `python … mem0_ingest.py` and no
`run_e3_classic.sh`, or `results/mem0-verdicts.conflict-xr-small.classic-qwen3.5.json`
exists; poll 60 s), then runs sequentially with a 4 h per-step timeout
(portable watchdog — macOS has no coreutils `timeout`):

1. **(a) Mem0 v2add arm** — `.venv/bin/python mem0_ingest.py` on
   `conflict-d20` then `conflict-xr-small`. No isolation flags needed: the
   harness tags state with the pipeline arm (`.mem0db/<fixture>.v2add-qwen3.5`,
   collection `e3_<fixture>_v2add_qwen3_5`), so it cannot collide with the
   classic run's DBs.
2. **(b) drop-in hooks** — every *executable* `run_after_ingest.d/*.sh`,
   lexical order (e.g. a Graphiti arm dropped in by another agent); dir may be
   absent.
3. **(c) flat-auto sweep** — for `openai:qwen3.5:latest@weak` and
   `openai:gemma4:e4b@mid` (Ollama's OpenAI-compatible endpoint via
   `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_API_KEY=ollama`):
   `conflict-xr-small` flat-all, `conflict-xr-small --retrieved`
   (flat-retrieved, k-hop=2 contexts), `conflict-d20` flat-all — each
   `--runs 1`, scoreboards land in
   `../results/flat-multimodel.<domain>.<arm>.jsonl`.

Arm it (survives terminal close; single-instance guarded via
`results/run.chain.supervisor.pid`):

```sh
cd packages/predicate-eval/baselines
nohup bash run_after_ingest.sh > results/run.chain.supervisor.log 2>&1 &
```

Logs: supervisor timeline in `results/run.chain.supervisor.log`; each step's
stdout/stderr in `results/run.chain.<step>.log`.
