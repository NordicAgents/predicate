#!/usr/bin/env python3
"""E3 baseline arm: stream CONFLICT-BENCH fixture facts through Mem0's ingest
pipeline and record what its LLM write policy does to planted conflicts.

Usage (run with one of the two venvs under baselines/):
    .venv-classic/bin/python mem0_ingest.py <fixture_dir> [options]   # mem0ai 1.0.11 (classic ADD/UPDATE/DELETE arm)
    .venv/bin/python         mem0_ingest.py <fixture_dir> [options]   # mem0ai 2.0.11 (current additive-only arm)

The fixture dir must contain episodes/e01.jsonl, episodes/e02.jsonl and
oracle.json (CONFLICT-BENCH layout). Each episode line is {"s","p","o"}
with optional "lit": true. Every fact becomes one natural-language
sentence and one Memory.add() call, in stream order (e01 then e02).

Outputs (under --results-dir):
    mem0-ops.<fixture>.<arm>.jsonl      one line per add(): fact, NL text, returned memory ops, latency
    mem0-verdicts.<fixture>.<arm>.json  per planted conflict: surviving values, op history, verdict

Verdicts: preserved-both | silently-resolved-to-one | lost-both | unclear.
Survival is computed from the FULL final memory state (get_all), not just
vector search, so retrieval noise cannot masquerade as destruction; the
per-subject search() hits are recorded alongside for the retrieval view.

Everything is local/key-free: Ollama LLM + Ollama nomic-embed-text embedder +
embedded Qdrant (path mode, no server). Telemetry is disabled.
"""

import argparse
import inspect
import json
import logging
import os
import re
import shutil
import sys
import time
from pathlib import Path

os.environ.setdefault("MEM0_TELEMETRY", "False")


class LogTap(logging.Handler):
    """Captures mem0's internal INFO logs per add() call. The classic pipeline
    logs every LLM write decision (including NONE, which add() does not
    return), so this is the only place a silent drop is visible."""

    def __init__(self):
        super().__init__(level=logging.INFO)
        self.lines: list[str] = []

    def emit(self, record):
        try:
            self.lines.append(f"{record.name}: {record.getMessage()}")
        except Exception:
            pass

    def drain(self):
        out, self.lines = self.lines, []
        return out


def install_log_tap() -> LogTap:
    tap = LogTap()
    lg = logging.getLogger("mem0")
    lg.setLevel(logging.INFO)
    lg.addHandler(tap)
    return tap

OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("E3_EMBED_MODEL", "nomic-embed-text:latest")
EMBED_DIMS = 768


# ---------------------------------------------------------------- fixtures

def local_name(iri: str) -> str:
    """Strip an IRI to its local name; literals (no #, no scheme) pass through."""
    if not isinstance(iri, str):
        return str(iri)
    if "#" in iri:
        return iri.rsplit("#", 1)[1]
    if "://" in iri:
        return iri.rsplit("/", 1)[1]
    return iri


def fact_to_text(fact: dict) -> str:
    s = local_name(fact["s"])
    p = local_name(fact["p"])
    o = fact["o"] if fact.get("lit") else local_name(fact["o"])
    if p == "type":
        return f"{s} is a {o}."
    if p == "email":
        return f"Record {s}: email is {o}."
    if p == "reportsTo":
        return f"{s} reports to {o}."
    if p == "office":
        return f"{s} works in {o}."
    if p == "memberOf":
        return f"{s} is a member of {o}."
    if p == "collaboratesWith":
        return f"{s} collaborates with {o}."
    return f"{s}: {p} is {o}."


def load_stream(fixture_dir: Path):
    stream = []
    for ep_idx, name in enumerate(sorted((fixture_dir / "episodes").glob("e*.jsonl")), start=1):
        for line in name.read_text().splitlines():
            line = line.strip()
            if line:
                stream.append((ep_idx, json.loads(line)))
    return stream


# ---------------------------------------------------------------- mem0 setup

def mem0_version() -> str:
    try:
        from importlib.metadata import version
        return version("mem0ai")
    except Exception:
        return "unknown"


def pipeline_kind(ver: str) -> str:
    """classic = per-add LLM ADD/UPDATE/DELETE decisions; v2add = additive-only extraction."""
    return "classic" if ver.split(".")[0] in ("0", "1") else "v2add"


def build_memory(model: str, db_dir: Path, collection: str):
    from mem0 import Memory

    cfg = {
        "llm": {
            "provider": "ollama",
            "config": {
                "model": model,
                "temperature": 0.0,
                "max_tokens": 1200,
                "top_p": 0.1,
                "ollama_base_url": OLLAMA_URL,
            },
        },
        "embedder": {
            "provider": "ollama",
            "config": {
                "model": EMBED_MODEL,
                "embedding_dims": EMBED_DIMS,
                "ollama_base_url": OLLAMA_URL,
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": collection,
                "embedding_model_dims": EMBED_DIMS,
                "path": str(db_dir / "qdrant"),
                "on_disk": True,
            },
        },
        "history_db_path": str(db_dir / "history.db"),
        "version": "v1.1",
    }
    try:
        return Memory.from_config(cfg)
    except Exception:
        cfg.pop("version", None)
        return Memory.from_config(cfg)


def patch_no_think(memory):
    """qwen3.5/gemma4 are thinking models; ollama enables thinking by default,
    which burns the token budget before the JSON answer. Force think=False,
    falling back transparently if the server/model rejects the parameter."""
    try:
        client = memory.llm.client
        orig = client.chat

        def chat(*args, **kwargs):
            if "think" not in kwargs:
                try:
                    return orig(*args, think=False, **kwargs)
                except Exception:
                    return orig(*args, **kwargs)
            return orig(*args, **kwargs)

        client.chat = chat
    except Exception as exc:  # pragma: no cover
        print(f"[warn] could not patch think=False: {exc}", file=sys.stderr)


def mem_search(memory, query: str, user_id: str, k: int = 15):
    params = inspect.signature(memory.search).parameters
    if "top_k" in params:  # mem0ai >= 2.x
        res = memory.search(query, top_k=k, filters={"user_id": user_id})
    else:  # classic
        res = memory.search(query, user_id=user_id, limit=k, rerank=False)
    return res.get("results", res) if isinstance(res, dict) else res


def mem_get_all(memory, user_id: str):
    params = inspect.signature(memory.get_all).parameters
    if "user_id" in params:
        res = memory.get_all(user_id=user_id, limit=5000)
    else:
        res = memory.get_all(filters={"user_id": user_id}, limit=5000)
    return res.get("results", res) if isinstance(res, dict) else res


# ---------------------------------------------------------------- verdicts

def token_re(tok: str):
    # word-ish boundaries that also treat '-' as part of the token, so 'p002'
    # does NOT match inside 's1-p002' but 's1-p002' matches whole.
    return re.compile(rf"(?<![\w-]){re.escape(tok)}(?![\w-])", re.IGNORECASE)


def mentions(text: str, tok: str) -> bool:
    return bool(token_re(tok).search(text or ""))


def op_texts(op: dict):
    return [t for t in (op.get("memory"), op.get("previous_memory")) if t]


def compute_verdicts(fixture_dir: Path, memory, user_id: str, ops_rows: list, arm: str, model: str):
    oracle = json.loads((fixture_dir / "oracle.json").read_text())
    conflicts = oracle.get("conflicts", [])
    coref = oracle.get("coreference", [])
    email_of = {}  # record IRI -> shared email key (xr fixtures)
    for pair in coref:
        for rec in pair.get("records", []):
            email_of[rec] = pair.get("email")

    final_memories = [
        (m.get("memory") or m.get("data") or "") for m in mem_get_all(memory, user_id)
    ]

    ingest_errors = [r for r in ops_rows if r.get("error")]

    def subject_memories(subj_tok: str, email: str | None):
        out = []
        for t in final_memories:
            if mentions(t, subj_tok) or (email and mentions(t, email)):
                out.append(t)
        return out

    verdict_rows = []
    counts = {"preserved-both": 0, "silently-resolved-to-one": 0, "lost-both": 0, "unclear": 0}
    for c in conflicts:
        subj_tok = local_name(c["about"])
        pred_tok = local_name(c["predicate"])
        email = email_of.get(c["about"])
        vals = [local_name(v) for v in c["values"]]

        subj_mems = subject_memories(subj_tok, email)
        survived = [v for v in vals if any(mentions(t, v) for t in subj_mems)]

        # op history touching this subject (or its shared-key email)
        history = []
        for row in ops_rows:
            for op in row.get("ops", []):
                if any(
                    mentions(t, subj_tok) or (email and mentions(t, email))
                    for t in op_texts(op)
                ):
                    history.append(
                        {
                            "i": row["i"],
                            "episode": row["episode"],
                            "event": op.get("event"),
                            "memory": op.get("memory"),
                            "previous_memory": op.get("previous_memory"),
                        }
                    )

        # how did each missing value die?
        mechanism = {}
        for v in vals:
            if v in survived:
                continue
            mech = "never-extracted"
            for h in history:
                if h["event"] == "DELETE" and mentions(h.get("memory") or "", v):
                    mech = "deleted"
                elif h["event"] == "UPDATE" and mentions(h.get("previous_memory") or "", v) and not mentions(
                    h.get("memory") or "", v
                ):
                    mech = "overwritten-by-update"
                elif mech == "never-extracted" and h["event"] == "ADD" and mentions(h.get("memory") or "", v):
                    mech = "added-then-lost"
            mechanism[v] = mech

        subj_errored = any(
            mentions(r.get("text", ""), subj_tok) for r in ingest_errors
        )
        if len(survived) == 2:
            verdict = "preserved-both"
        elif len(survived) == 1:
            verdict = "silently-resolved-to-one" if not subj_errored else "unclear"
        elif subj_errored or ingest_errors:
            verdict = "unclear"
        else:
            verdict = "lost-both"
        counts[verdict] += 1

        # retrieval view: what an agent would actually see for this subject
        try:
            hits = [
                (h.get("memory") or h.get("data") or "")
                for h in mem_search(memory, subj_tok, user_id, k=10)
            ]
        except Exception as exc:
            hits = [f"<search failed: {exc}>"]
        row = {
            "id": c.get("id"),
            "subject": subj_tok,
            "predicate": pred_tok,
            "values": vals,
            "survived": survived,
            "lost_mechanism": mechanism,
            "verdict": verdict,
            "final_subject_memories": subj_mems,
            "search_hits": hits,
            "op_history": history,
        }
        if email:
            row["shared_email"] = email
        verdict_rows.append(row)

    # cross-record pair analysis (xr fixtures): does ingest ever CONNECT the
    # two records that co-refer only via the shared email literal?
    pair_rows = []
    pair_counts = {}
    for pair in coref:
        recs = [local_name(r) for r in pair.get("records", [])]
        email = pair.get("email")
        # "linked" definition: a single memory mentioning BOTH record ids, or
        # mentioning the shared email plus BOTH conflicting values.
        pair_conf = [c for c in conflicts if local_name(c["about"]) in recs]
        pair_values = sorted({local_name(v) for c in pair_conf for v in c["values"]})
        linked = [t for t in final_memories if all(mentions(t, r) for r in recs)]
        email_bridge = (
            [t for t in final_memories if email and mentions(t, email) and sum(mentions(t, v) for v in pair_values) >= 2]
            if pair_values
            else []
        )
        surviving_pair_values = [
            v
            for v in pair_values
            if any(
                mentions(t, v) and (any(mentions(t, r) for r in recs) or (email and mentions(t, email)))
                for t in final_memories
            )
        ]
        if pair.get("conflicted"):
            if len(surviving_pair_values) >= 2:
                pv = "preserved-both"
            elif len(surviving_pair_values) == 1:
                pv = "silently-resolved-to-one"
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
                "surviving_values": surviving_pair_values,
                "cross_record_linked_memories": linked,
                "email_bridge_memories": email_bridge,
                "linked": bool(linked or email_bridge),
                "verdict": pv,
            }
        )
        pair_counts[pv] = pair_counts.get(pv, 0) + 1

    return {
        "fixture": fixture_dir.name,
        "arm": arm,
        "model": model,
        "mem0_version": mem0_version(),
        "pipeline": pipeline_kind(mem0_version()),
        "embed_model": EMBED_MODEL,
        "n_facts_ingested": len(ops_rows),
        "n_ingest_errors": len(ingest_errors),
        "n_final_memories": len(final_memories),
        "conflict_counts": counts,
        "pair_counts": pair_counts or None,
        "n_pairs_linked": sum(1 for p in pair_rows if p["linked"]) if pair_rows else None,
        "conflicts": verdict_rows,
        "pairs": pair_rows or None,
    }


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fixture_dir", type=Path)
    ap.add_argument("--model", default="qwen3.5:latest", help="Ollama chat model for mem0's LLM")
    ap.add_argument("--user-id", default="e3")
    ap.add_argument("--max-facts", type=int, default=None, help="smoke-test cap")
    ap.add_argument("--results-dir", type=Path, default=Path(__file__).parent / "results")
    ap.add_argument("--db-root", type=Path, default=Path(__file__).parent / ".mem0db")
    ap.add_argument("--verdicts-only", action="store_true",
                    help="skip ingest; recompute verdicts from the existing DB + ops file")
    ap.add_argument("--resume", action="store_true",
                    help="continue an interrupted run: keep DB, skip facts already in the ops file, append")
    ap.add_argument("--tag", default=None, help="override arm tag used in filenames")
    args = ap.parse_args()

    fixture_dir = args.fixture_dir.resolve()
    ver = mem0_version()
    kind = pipeline_kind(ver)
    arm = args.tag or f"{kind}-{args.model.split(':')[0].replace('/', '_')}"
    db_dir = args.db_root / f"{fixture_dir.name}.{arm}"
    args.results_dir.mkdir(parents=True, exist_ok=True)
    ops_path = args.results_dir / f"mem0-ops.{fixture_dir.name}.{arm}.jsonl"
    verdicts_path = args.results_dir / f"mem0-verdicts.{fixture_dir.name}.{arm}.json"

    print(f"[e3] mem0ai={ver} pipeline={kind} arm={arm} model={args.model}", file=sys.stderr)
    print(f"[e3] fixture={fixture_dir}", file=sys.stderr)
    print(f"[e3] db={db_dir}", file=sys.stderr)

    if not args.verdicts_only and not args.resume and db_dir.exists():
        shutil.rmtree(db_dir)
    db_dir.mkdir(parents=True, exist_ok=True)

    memory = build_memory(args.model, db_dir, collection=f"e3_{fixture_dir.name}_{arm}".replace("-", "_").replace(".", "_"))
    patch_no_think(memory)

    if args.verdicts_only:
        ops_rows = [json.loads(l) for l in ops_path.read_text().splitlines() if l.strip()]
    else:
        stream = load_stream(fixture_dir)
        if args.max_facts:
            stream = stream[: args.max_facts]
        tap = install_log_tap()
        ops_rows = []
        if args.resume and ops_path.exists():
            ops_rows = [json.loads(l) for l in ops_path.read_text().splitlines() if l.strip()]
            print(f"[e3] resuming: {len(ops_rows)} facts already ingested", file=sys.stderr)
        n_done = len(ops_rows)
        t_start = time.time()
        with ops_path.open("a" if ops_rows else "w") as f:
            for i, (ep, fact) in enumerate(stream):
                if i < n_done:
                    continue
                text = fact_to_text(fact)
                t0 = time.time()
                err = None
                tap.drain()
                try:
                    res = memory.add(text, user_id=args.user_id)
                    ops = res.get("results", res) if isinstance(res, dict) else res
                except Exception as exc:
                    ops = []
                    err = f"{type(exc).__name__}: {exc}"
                row = {
                    "i": i,
                    "episode": ep,
                    "fact": fact,
                    "text": text,
                    "ops": ops,
                    "log": tap.drain(),
                    "t_ms": round((time.time() - t0) * 1000),
                }
                if err:
                    row["error"] = err
                ops_rows.append(row)
                f.write(json.dumps(row, default=str) + "\n")
                f.flush()
                events = ",".join(op.get("event", "?") for op in ops) or ("ERR" if err else "NOOP")
                print(
                    f"[e3] {i + 1}/{len(stream)} ep{ep} {row['t_ms']}ms {events:20s} {text}",
                    file=sys.stderr,
                    flush=True,
                )
        print(f"[e3] ingest done in {round(time.time() - t_start)}s", file=sys.stderr)

    verdicts = compute_verdicts(fixture_dir, memory, args.user_id, ops_rows, arm, args.model)
    verdicts_path.write_text(json.dumps(verdicts, indent=2, default=str) + "\n")
    print(f"[e3] ops      -> {ops_path}", file=sys.stderr)
    print(f"[e3] verdicts -> {verdicts_path}", file=sys.stderr)
    print(json.dumps({k: verdicts[k] for k in ("conflict_counts", "pair_counts", "n_pairs_linked", "n_final_memories", "n_ingest_errors")}, indent=2))


if __name__ == "__main__":
    main()
