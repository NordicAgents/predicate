#!/usr/bin/env python3
"""E3b baseline arm: stream CONFLICT-BENCH fixture facts through Graphiti
(Zep's OSS temporal-KG engine) and record what its bi-temporal write policy
does to planted conflicts.

Usage (run with the graphiti venv under baselines/):
    .venv-graphiti/bin/python graphiti_ingest.py <fixture_dir> [options]

The fixture dir must contain episodes/e01.jsonl, episodes/e02.jsonl and
oracle.json (CONFLICT-BENCH layout). Facts are rendered to natural language
with the EXACT same helpers as mem0_ingest.py (imported, not copied), and each
fact becomes one Graphiti add_episode() call in stream order (e01 then e02)
with a monotonically increasing reference_time.

Graphiti's contrast with Mem0: it does NOT delete on contradiction — it marks
the superseded edge invalid (bi-temporal `invalid_at` / `expired_at`), so the
old value stays queryable. That is temporal RESOLUTION-with-audit-trail: the
LLM still silently picks a winner; nothing surfaces the disagreement to a
reader who does not ask for history. Verdicts therefore distinguish values
surviving on VALID edges from values surviving only on INVALIDATED edges.

Outputs (under --results-dir):
    graphiti-ops.<fixture>.jsonl    one line per add_episode(): fact, NL text,
                                    new edges, newly invalidated edges, latency
    graphiti-verdicts.<fixture>.json  per planted conflict: {subject, predicate,
                                    values, survived_valid, survived_invalidated,
                                    verdict} + full edge detail and counts

Verdicts:
    preserved-both-valid   both values on currently-valid edges (nothing resolved;
                           coexistence — still unflagged, mirrors mem0 2.x mode)
    temporally-resolved    one value valid, the other on an invalidated edge —
                           supersession, the EXPECTED Graphiti behavior
    silently-lost          a value appears on NO edge at all (valid or invalid):
                           extraction dropped it, no audit trail
    unclear                ingest errors touched the subject, or neither value
                           on any valid edge

Everything is local/key-free: Ollama LLM (OpenAI-compatible endpoint) +
Ollama nomic-embed-text embedder + Neo4j in Docker (container predicate-neo4j,
bolt://localhost:7687, auth neo4j/predicate-e3).

Verdicts are computed by DIRECT Cypher over the full graph (all RELATES_TO
entity edges incl. invalidated), not Graphiti's search() — so reranker/
retrieval noise cannot masquerade as destruction, mirroring mem0_ingest.py's
get_all()-based survival rule. No LLM call is made in --verdicts-only or
--init-only modes.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# Reuse the exact NL rendering + oracle-matching helpers from the Mem0 arm so
# both systems ingest byte-identical sentences and are scored the same way.
from mem0_ingest import fact_to_text, load_stream, local_name, mentions  # noqa: E402

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "predicate-e3")
OLLAMA_OPENAI_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434") + "/v1"
EMBED_MODEL = os.environ.get("E3_EMBED_MODEL", "nomic-embed-text:latest")
EMBED_DIMS = 768
BASE_TIME = datetime(2026, 1, 1, tzinfo=timezone.utc)  # reference_time = BASE + i minutes


# ---------------------------------------------------------------- graphiti setup

def graphiti_version() -> str:
    try:
        from importlib.metadata import version
        return version("graphiti-core")
    except Exception:
        return "unknown"


def build_graphiti(model: str):
    """Graphiti wired entirely to Ollama's OpenAI-compatible endpoint. All three
    clients (LLM, embedder, reranker) are constructed key-free; construction
    makes NO network calls."""
    from graphiti_core import Graphiti
    from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient
    from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
    from graphiti_core.llm_client.config import LLMConfig
    from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient

    llm_config = LLMConfig(
        api_key="ollama",
        base_url=OLLAMA_OPENAI_URL,
        model=model,
        small_model=model,
        temperature=0.0,
        max_tokens=2048,
    )
    llm = OpenAIGenericClient(config=llm_config)
    patch_no_think(llm)
    embedder = OpenAIEmbedder(
        config=OpenAIEmbedderConfig(
            api_key="ollama",
            base_url=OLLAMA_OPENAI_URL,
            embedding_model=EMBED_MODEL,
            embedding_dim=EMBED_DIMS,
        )
    )
    reranker = OpenAIRerankerClient(config=llm_config)  # only used by search(); verdicts bypass it
    return Graphiti(
        NEO4J_URI,
        NEO4J_USER,
        NEO4J_PASSWORD,
        llm_client=llm,
        embedder=embedder,
        cross_encoder=reranker,
    )


def patch_no_think(llm_client):
    """qwen3.5 is a thinking model; via Ollama's OpenAI-compatible endpoint the
    thinking tokens can burn the budget before the JSON answer. Try passing
    Ollama's think=False through extra_body, falling back transparently if the
    server rejects it (mirrors mem0_ingest.patch_no_think)."""
    try:
        client = llm_client.client  # AsyncOpenAI
        orig = client.chat.completions.create

        async def create(*args, **kwargs):
            if "extra_body" not in kwargs:
                try:
                    return await orig(*args, extra_body={"think": False}, **kwargs)
                except Exception:
                    return await orig(*args, **kwargs)
            return await orig(*args, **kwargs)

        client.chat.completions.create = create
    except Exception as exc:  # pragma: no cover
        print(f"[warn] could not patch think=False: {exc}", file=sys.stderr)


# ---------------------------------------------------------------- graph access
# Verdict queries go straight to Neo4j so they need no LLM/embedder and can be
# run any time after (or during) an ingest.

def neo4j_driver():
    from neo4j import GraphDatabase
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def dt_str(v):
    return None if v is None else str(v)


def fetch_all_edges(driver, group_id: str):
    """Every entity edge in the group, INCLUDING invalidated ones. Graphiti's
    bi-temporal model marks superseded edges (invalid_at = validity-time end,
    expired_at = system-time supersession) instead of deleting them — this
    query is the whole point of the arm."""
    q = """
    MATCH (a:Entity)-[e:RELATES_TO]->(b:Entity)
    WHERE e.group_id = $gid
    RETURN a.name AS source, b.name AS target, e.name AS rel, e.fact AS fact,
           e.uuid AS uuid, e.created_at AS created_at,
           e.valid_at AS valid_at, e.invalid_at AS invalid_at, e.expired_at AS expired_at
    ORDER BY e.created_at
    """
    with driver.session() as s:
        return [
            {
                "uuid": r["uuid"],
                "source": r["source"],
                "target": r["target"],
                "rel": r["rel"],
                "fact": r["fact"],
                "created_at": dt_str(r["created_at"]),
                "valid_at": dt_str(r["valid_at"]),
                "invalid_at": dt_str(r["invalid_at"]),
                "expired_at": dt_str(r["expired_at"]),
                "invalidated": r["invalid_at"] is not None or r["expired_at"] is not None,
            }
            for r in s.run(q, gid=group_id)
        ]


def fetch_entity_names(driver, group_id: str):
    with driver.session() as s:
        return [
            r["name"]
            for r in s.run(
                "MATCH (n:Entity) WHERE n.group_id = $gid RETURN n.name AS name", gid=group_id
            )
        ]


def fetch_invalidated_uuids(driver, group_id: str) -> set:
    with driver.session() as s:
        return {
            r["uuid"]
            for r in s.run(
                "MATCH (:Entity)-[e:RELATES_TO]->(:Entity) "
                "WHERE e.group_id = $gid AND (e.invalid_at IS NOT NULL OR e.expired_at IS NOT NULL) "
                "RETURN e.uuid AS uuid",
                gid=group_id,
            )
        }


def clear_group(driver, group_id: str):
    with driver.session() as s:
        s.run("MATCH (n {group_id: $gid}) DETACH DELETE n", gid=group_id)


# ---------------------------------------------------------------- verdicts

def edge_texts(edge: dict):
    return [t for t in (edge.get("fact"), edge.get("source"), edge.get("target")) if t]


def edge_mentions(edge: dict, tok: str) -> bool:
    return any(mentions(t, tok) for t in edge_texts(edge))


def compute_verdicts(fixture_dir: Path, driver, group_id: str, ops_rows: list, model: str):
    oracle = json.loads((fixture_dir / "oracle.json").read_text())
    conflicts = oracle.get("conflicts", [])
    coref = oracle.get("coreference", [])
    email_of = {}  # record IRI -> shared email key (xr fixtures)
    for pair in coref:
        for rec in pair.get("records", []):
            email_of[rec] = pair.get("email")

    all_edges = fetch_all_edges(driver, group_id)
    entity_names = fetch_entity_names(driver, group_id)
    ingest_errors = [r for r in ops_rows if r.get("error")]

    def subject_edges(subj_tok: str, email: str | None):
        return [
            e
            for e in all_edges
            if edge_mentions(e, subj_tok) or (email and edge_mentions(e, email))
        ]

    verdict_rows = []
    counts = {
        "preserved-both-valid": 0,
        "temporally-resolved": 0,
        "silently-lost": 0,
        "unclear": 0,
    }
    for c in conflicts:
        subj_tok = local_name(c["about"])
        pred_tok = local_name(c["predicate"])
        email = email_of.get(c["about"])
        vals = [local_name(v) for v in c["values"]]

        s_edges = subject_edges(subj_tok, email)
        valid_edges = [e for e in s_edges if not e["invalidated"]]
        invalid_edges = [e for e in s_edges if e["invalidated"]]

        survived_valid = [v for v in vals if any(edge_mentions(e, v) for e in valid_edges)]
        survived_invalidated = [
            v
            for v in vals
            if v not in survived_valid and any(edge_mentions(e, v) for e in invalid_edges)
        ]
        missing = [v for v in vals if v not in survived_valid and v not in survived_invalidated]

        subj_errored = any(mentions(r.get("text", ""), subj_tok) for r in ingest_errors)
        if len(survived_valid) == 2:
            verdict = "preserved-both-valid"
        elif len(survived_valid) == 1 and len(survived_invalidated) == 1:
            verdict = "temporally-resolved"  # supersession: the EXPECTED Graphiti behavior
        elif len(survived_valid) == 1 and missing:
            verdict = "silently-lost" if not subj_errored else "unclear"
        else:  # 0 valid values (both invalidated / both missing) or errored subject
            verdict = "unclear"
        counts[verdict] += 1

        row = {
            "id": c.get("id"),
            "subject": subj_tok,
            "predicate": pred_tok,
            "values": vals,
            "survived_valid": survived_valid,
            "survived_invalidated": survived_invalidated,
            "missing": missing,
            "verdict": verdict,
            "subject_valid_edges": valid_edges,
            "subject_invalidated_edges": invalid_edges,
        }
        if email:
            row["shared_email"] = email
        verdict_rows.append(row)

    # cross-record pair analysis (xr fixtures): does Graphiti's entity
    # resolution ever CONNECT the two records that co-refer only via the
    # shared email literal? (mirrors mem0_ingest's pair section)
    pair_rows = []
    pair_counts = {}
    for pair in coref:
        recs = [local_name(r) for r in pair.get("records", [])]
        email = pair.get("email")
        pair_conf = [c for c in conflicts if local_name(c["about"]) in recs]
        pair_values = sorted({local_name(v) for c in pair_conf for v in c["values"]})

        # linked if: one edge mentions BOTH records; or a single Entity node
        # name mentions both (LLM merged them); or both records share an
        # email-mentioning neighbour entity.
        both_edge = [e for e in all_edges if all(edge_mentions(e, r) for r in recs)]
        merged_nodes = [n for n in entity_names if all(mentions(n, r) for r in recs)]

        def neighbours(tok):
            out = set()
            for e in all_edges:
                if mentions(e.get("source") or "", tok):
                    out.add(e.get("target"))
                if mentions(e.get("target") or "", tok):
                    out.add(e.get("source"))
            return out

        shared_email_neighbour = (
            [
                n
                for n in (neighbours(recs[0]) & neighbours(recs[1]))
                if n and email and mentions(n, email)
            ]
            if email and len(recs) == 2
            else []
        )
        linked = bool(both_edge or merged_nodes or shared_email_neighbour)

        surviving_valid = [
            v
            for v in pair_values
            if any(
                not e["invalidated"]
                and edge_mentions(e, v)
                and (any(edge_mentions(e, r) for r in recs) or (email and edge_mentions(e, email)))
                for e in all_edges
            )
        ]
        if pair.get("conflicted"):
            if len(surviving_valid) >= 2:
                pv = "preserved-both-valid"
            elif len(surviving_valid) == 1:
                pv = "temporally-resolved-or-lost"
            elif ingest_errors:
                pv = "unclear"
            else:
                pv = "lost-both"
        else:
            pv = "benign-pair"
        pair_rows.append(
            {
                "email": email,
                "records": recs,
                "conflicted": bool(pair.get("conflicted")),
                "pair_values": pair_values,
                "surviving_valid_values": surviving_valid,
                "cross_record_edges": both_edge,
                "merged_entity_nodes": merged_nodes,
                "shared_email_neighbours": shared_email_neighbour,
                "linked": linked,
                "verdict": pv,
            }
        )
        pair_counts[pv] = pair_counts.get(pv, 0) + 1

    return {
        "fixture": fixture_dir.name,
        "arm": "graphiti",
        "model": model,
        "graphiti_version": graphiti_version(),
        "neo4j_uri": NEO4J_URI,
        "group_id": group_id,
        "embed_model": EMBED_MODEL,
        "n_facts_ingested": len(ops_rows),
        "n_ingest_errors": len(ingest_errors),
        "n_entities": len(entity_names),
        "n_edges_total": len(all_edges),
        "n_edges_invalidated": sum(1 for e in all_edges if e["invalidated"]),
        "conflict_counts": counts,
        "pair_counts": pair_counts or None,
        "n_pairs_linked": sum(1 for p in pair_rows if p["linked"]) if pair_rows else None,
        "conflicts": verdict_rows,
        "pairs": pair_rows or None,
    }


# ---------------------------------------------------------------- ingest

def edge_brief(e) -> dict:
    return {
        "uuid": e.uuid,
        "fact": e.fact,
        "name": e.name,
        "valid_at": dt_str(e.valid_at),
        "invalid_at": dt_str(e.invalid_at),
        "expired_at": dt_str(e.expired_at),
    }


async def run_ingest(args, fixture_dir: Path, group_id: str, ops_path: Path, driver):
    from graphiti_core.nodes import EpisodeType

    graphiti = build_graphiti(args.model)
    try:
        await graphiti.build_indices_and_constraints()

        stream = load_stream(fixture_dir)
        if args.max_facts:
            stream = stream[: args.max_facts]

        ops_rows = []
        if args.resume and ops_path.exists():
            ops_rows = [json.loads(l) for l in ops_path.read_text().splitlines() if l.strip()]
            print(f"[e3b] resuming: {len(ops_rows)} facts already ingested", file=sys.stderr)
        elif ops_path.exists() and not args.resume:
            ops_path.unlink()
        if not args.resume:
            clear_group(driver, group_id)
        n_done = len(ops_rows)

        t_start = time.time()
        invalidated_before = fetch_invalidated_uuids(driver, group_id)
        with ops_path.open("a" if ops_rows else "w") as f:
            for i, (ep, fact) in enumerate(stream):
                if i < n_done:
                    continue
                text = fact_to_text(fact)
                ref_time = BASE_TIME + timedelta(minutes=i)
                t0 = time.time()
                err = None
                new_edges = []
                try:
                    res = await graphiti.add_episode(
                        name=f"{fixture_dir.name}-{i:04d}",
                        episode_body=text,
                        source=EpisodeType.text,
                        source_description=f"CONFLICT-BENCH {fixture_dir.name} episode {ep}",
                        reference_time=ref_time,
                        group_id=group_id,
                    )
                    new_edges = [edge_brief(e) for e in res.edges]
                except Exception as exc:
                    err = f"{type(exc).__name__}: {exc}"
                invalidated_after = fetch_invalidated_uuids(driver, group_id)
                newly_invalidated_uuids = invalidated_after - invalidated_before
                invalidated_before = invalidated_after
                newly_invalidated = [
                    e
                    for e in fetch_all_edges(driver, group_id)
                    if e["uuid"] in newly_invalidated_uuids
                ]
                row = {
                    "i": i,
                    "episode": ep,
                    "fact": fact,
                    "text": text,
                    "reference_time": ref_time.isoformat(),
                    "new_edges": new_edges,
                    "newly_invalidated": newly_invalidated,
                    "t_ms": round((time.time() - t0) * 1000),
                }
                if err:
                    row["error"] = err
                ops_rows.append(row)
                f.write(json.dumps(row, default=str) + "\n")
                f.flush()
                events = (
                    f"+{len(new_edges)}edge"
                    + (f" !{len(newly_invalidated)}inval" if newly_invalidated else "")
                    if not err
                    else "ERR"
                )
                print(
                    f"[e3b] {i + 1}/{len(stream)} ep{ep} {row['t_ms']}ms {events:18s} {text}",
                    file=sys.stderr,
                    flush=True,
                )
        print(f"[e3b] ingest done in {round(time.time() - t_start)}s", file=sys.stderr)
        return ops_rows
    finally:
        await graphiti.close()


async def run_init_only(args):
    """Non-LLM smoke: bolt connectivity + graphiti client construction + schema
    (indices/constraints) init. Makes zero LLM/embedder calls."""
    graphiti = build_graphiti(args.model)
    try:
        await graphiti.build_indices_and_constraints()
        print("[e3b] init-only OK: neo4j reachable, graphiti clients built, indices/constraints ensured", file=sys.stderr)
    finally:
        await graphiti.close()


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fixture_dir", type=Path)
    ap.add_argument("--model", default="qwen3.5:latest", help="Ollama chat model (OpenAI-compatible endpoint)")
    ap.add_argument("--group-id", default=None, help="Graphiti group_id (default: e3b-<fixture>)")
    ap.add_argument("--max-facts", type=int, default=None, help="smoke-test cap")
    ap.add_argument("--results-dir", type=Path, default=Path(__file__).parent / "results")
    ap.add_argument("--verdicts-only", action="store_true",
                    help="skip ingest; compute verdicts from the graph as it stands (no LLM calls)")
    ap.add_argument("--init-only", action="store_true",
                    help="smoke: connect + build indices/constraints, then exit (no LLM calls)")
    ap.add_argument("--resume", action="store_true",
                    help="continue an interrupted run: keep graph, skip facts already in the ops file, append")
    ap.add_argument("--tag", default=None, help="override tag used in filenames")
    args = ap.parse_args()

    logging.basicConfig(level=logging.WARNING)
    fixture_dir = args.fixture_dir.resolve()
    tag = args.tag or fixture_dir.name
    group_id = args.group_id or f"e3b-{fixture_dir.name}"
    args.results_dir.mkdir(parents=True, exist_ok=True)
    ops_path = args.results_dir / f"graphiti-ops.{tag}.jsonl"
    verdicts_path = args.results_dir / f"graphiti-verdicts.{tag}.json"

    print(f"[e3b] graphiti-core={graphiti_version()} model={args.model} group_id={group_id}", file=sys.stderr)
    print(f"[e3b] fixture={fixture_dir}", file=sys.stderr)
    print(f"[e3b] neo4j={NEO4J_URI}", file=sys.stderr)

    if args.init_only:
        asyncio.run(run_init_only(args))
        return

    driver = neo4j_driver()
    try:
        driver.verify_connectivity()
        if args.verdicts_only:
            ops_rows = (
                [json.loads(l) for l in ops_path.read_text().splitlines() if l.strip()]
                if ops_path.exists()
                else []
            )
        else:
            ops_rows = asyncio.run(run_ingest(args, fixture_dir, group_id, ops_path, driver))

        verdicts = compute_verdicts(fixture_dir, driver, group_id, ops_rows, args.model)
        verdicts_path.write_text(json.dumps(verdicts, indent=2, default=str) + "\n")
        print(f"[e3b] ops      -> {ops_path}", file=sys.stderr)
        print(f"[e3b] verdicts -> {verdicts_path}", file=sys.stderr)
        print(json.dumps({k: verdicts[k] for k in (
            "conflict_counts", "pair_counts", "n_pairs_linked",
            "n_entities", "n_edges_total", "n_edges_invalidated", "n_ingest_errors",
        )}, indent=2))
    finally:
        driver.close()


if __name__ == "__main__":
    main()
