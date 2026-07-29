#!/usr/bin/env python3
"""Frozen record-level dense and BM25+dense hybrid retrieval baselines.

The corpus unit is one RDF subject. A query is the serialized seed record.
Dense retrieval uses cosine similarity over normalized all-MiniLM-L6-v2
embeddings. The hybrid is unsupervised reciprocal-rank fusion (RRF, k=60) of
the dense ranking and the same BM25 formulation used by the TypeScript arm.

Examples:
  uv run --project dense --frozen python dense/run_dense_retrieval.py \
    conflict-xr-small --top-k 1,2,4,8,16,32,64,128,256,512
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
RRF_K = 60
TOKEN_RE = re.compile(r"[a-z0-9@._+-]{2,}")


def local_name(term: str) -> str:
    return re.split(r"[/#]", term)[-1]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def load_triples(domain_dir: Path) -> list[dict[str, Any]]:
    triples: list[dict[str, Any]] = []
    for path in sorted((domain_dir / "episodes").glob("*.jsonl")):
        triples.extend(read_jsonl(path))
    return triples


def serialize_record(subject: str, triples: list[dict[str, Any]]) -> str:
    fields = [f"record {local_name(subject)}"]
    for triple in sorted(triples, key=lambda item: (item["p"], item["o"])):
        fields.append(f"{local_name(triple['p'])} {local_name(triple['o'])}")
    return ". ".join(fields) + "."


def lexical_tokens(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


def bm25_rankings(documents: list[str]) -> list[list[int]]:
    tokenized = [lexical_tokens(text) for text in documents]
    count = max(1, len(tokenized))
    avg_dl = sum(map(len, tokenized)) / count
    document_frequency: Counter[str] = Counter()
    for terms in tokenized:
        document_frequency.update(set(terms))
    term_frequencies = [Counter(terms) for terms in tokenized]
    rankings: list[list[int]] = []
    for query_index, query_terms in enumerate(tokenized):
        scores: list[tuple[float, int]] = []
        for document_index, terms in enumerate(tokenized):
            if document_index == query_index:
                continue
            score = 0.0
            frequencies = term_frequencies[document_index]
            for term in set(query_terms):
                frequency = frequencies[term]
                if frequency == 0:
                    continue
                df = document_frequency[term]
                inverse_df = math.log(1 + (count - df + 0.5) / (df + 0.5))
                denominator = frequency + 1.2 * (
                    1 - 0.75 + 0.75 * len(terms) / max(1, avg_dl)
                )
                score += inverse_df * frequency * 2.2 / denominator
            scores.append((-score, document_index))
        rankings.append([index for _, index in sorted(scores)])
    return rankings


def dense_rankings(embeddings: np.ndarray) -> list[list[int]]:
    scores = embeddings @ embeddings.T
    rankings: list[list[int]] = []
    for query_index, row in enumerate(scores):
        candidates = [
            (-float(score), index)
            for index, score in enumerate(row)
            if index != query_index
        ]
        rankings.append([index for _, index in sorted(candidates)])
    return rankings


def rrf_rankings(
    dense: list[list[int]], bm25: list[list[int]]
) -> list[list[int]]:
    fused: list[list[int]] = []
    for dense_order, bm25_order in zip(dense, bm25, strict=True):
        scores: defaultdict[int, float] = defaultdict(float)
        for order in (dense_order, bm25_order):
            for rank, document_index in enumerate(order, start=1):
                scores[document_index] += 1.0 / (RRF_K + rank)
        fused.append(
            [
                index
                for index, _ in sorted(
                    scores.items(), key=lambda item: (-item[1], item[0])
                )
            ]
        )
    return fused


def triple_id(triple: dict[str, Any]) -> str:
    return f"{triple['s']}|{triple['p']}|{triple['o']}"


def ntriple_bytes(triple: dict[str, Any]) -> bytes:
    if triple.get("lit") is True:
        object_text = json.dumps(triple["o"], ensure_ascii=False)
    else:
        object_text = f"<{triple['o']}>"
    return (
        f"<{triple['s']}> <{triple['p']}> {object_text} ."
    ).encode("utf-8")


def evaluate(
    *,
    domain: str,
    instances: list[dict[str, Any]],
    subjects: list[str],
    by_subject: dict[str, list[dict[str, Any]]],
    rankings: list[list[int]],
    top_k: int,
    system: str,
    index_build_ms: float,
) -> list[dict[str, Any]]:
    subject_index = {subject: index for index, subject in enumerate(subjects)}
    rows: list[dict[str, Any]] = []
    for instance in instances:
        outcomes: list[dict[str, Any]] = []
        for seed in instance["subjects"]:
            start = time.perf_counter()
            seed_index = subject_index[seed]
            selected = [seed] + [
                subjects[index] for index in rankings[seed_index][:top_k]
            ]
            context = [
                triple for subject in selected for triple in by_subject[subject]
            ]
            elapsed_ms = (time.perf_counter() - start) * 1000
            ids = {triple_id(triple) for triple in context}
            objects = {triple["o"] for triple in context}
            witness_hits = [
                witness for witness in instance["goldWitness"] if witness in ids
            ]
            value_hits = [
                value for value in instance["goldValues"] if value in objects
            ]
            context_lines = sorted(ntriple_bytes(triple) for triple in context)
            # The supplied schema is shared contract state, not evidence
            # returned for an individual query. Count selected facts only.
            context_bytes = sum(map(len, context_lines))
            if context_lines:
                context_bytes += len(context_lines) - 1
            outcomes.append(
                {
                    "seed": seed,
                    "ballNodes": len(selected),
                    "contextTriples": len(ids),
                    "contextBytes": context_bytes,
                    "ms": elapsed_ms,
                    "witnessHits": witness_hits,
                    "valueHits": value_hits,
                }
            )
        worst = min(
            outcomes,
            key=lambda outcome: (
                len(outcome["witnessHits"]),
                len(outcome["valueHits"]),
                instance["subjects"].index(outcome["seed"]),
            ),
        )
        complete = all(
            len(outcome["witnessHits"]) == len(instance["goldWitness"])
            for outcome in outcomes
        )
        rows.append(
            {
                "instanceId": instance["id"],
                "domain": domain,
                "system": f"retrieval:{system}@{top_k}",
                "flagged": bool(instance["isConflict"] and complete),
                "values": worst["valueHits"],
                "witness": worst["witnessHits"],
                "costMs": round(worst["ms"], 4),
                "extra": {
                    "ballNodes": worst["ballNodes"],
                    "contextTriples": worst["contextTriples"],
                    "contextBytes": worst["contextBytes"],
                    "topK": top_k,
                    "policy": system,
                    "seededOn": worst["seed"],
                    "indexBuildMs": round(index_build_ms, 3),
                    "model": MODEL_ID,
                    "modelRevision": MODEL_REVISION,
                    "rrfK": RRF_K if system == "hybrid-rrf" else None,
                },
            }
        )
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("domain")
    parser.add_argument("--top-k", default="1,2,4,8,16,32,64,128,256,512")
    parser.add_argument(
        "--device",
        default=None,
        help="SentenceTransformer device (default: library auto-selection)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    top_k_values = [int(value) for value in args.top_k.split(",")]
    if not top_k_values or any(value < 1 for value in top_k_values):
        raise ValueError("--top-k must be a non-empty comma list of positive integers")
    domain_dir = PACKAGE_ROOT / "fixtures" / args.domain
    instances = json.loads(
        (domain_dir / "instances.json").read_text(encoding="utf-8")
    )
    triples = load_triples(domain_dir)
    grouped: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for triple in triples:
        grouped[triple["s"]].append(triple)
    subjects = sorted(grouped)
    documents = [serialize_record(subject, grouped[subject]) for subject in subjects]

    start = time.perf_counter()
    model = SentenceTransformer(
        MODEL_ID, revision=MODEL_REVISION, device=args.device
    )
    embeddings = model.encode(
        documents,
        batch_size=128,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    dense = dense_rankings(embeddings)
    dense_build_ms = (time.perf_counter() - start) * 1000

    start = time.perf_counter()
    bm25 = bm25_rankings(documents)
    hybrid = rrf_rankings(dense, bm25)
    hybrid_build_ms = dense_build_ms + (time.perf_counter() - start) * 1000

    rows: list[dict[str, Any]] = []
    for top_k in top_k_values:
        rows.extend(
            evaluate(
                domain=args.domain,
                instances=instances,
                subjects=subjects,
                by_subject=grouped,
                rankings=dense,
                top_k=top_k,
                system="dense-minilm",
                index_build_ms=dense_build_ms,
            )
        )
        rows.extend(
            evaluate(
                domain=args.domain,
                instances=instances,
                subjects=subjects,
                by_subject=grouped,
                rankings=hybrid,
                top_k=top_k,
                system="hybrid-rrf",
                index_build_ms=hybrid_build_ms,
            )
        )

    output_dir = PACKAGE_ROOT / "results" / "dense"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"dense.{args.domain}.jsonl"
    output.write_text(
        "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in rows),
        encoding="utf-8",
    )
    conflicts = [instance for instance in instances if instance["isConflict"]]
    print(
        f"{args.domain}: {len(subjects)} records, {len(conflicts)} conflicts, "
        f"dense index {dense_build_ms:.1f} ms"
    )
    for system in ("dense-minilm", "hybrid-rrf"):
        for top_k in top_k_values:
            selected = [
                row
                for row in rows
                if row["system"] == f"retrieval:{system}@{top_k}"
                and any(i["id"] == row["instanceId"] for i in conflicts)
            ]
            complete = sum(row["flagged"] for row in selected)
            mean_context = (
                sum(row["extra"]["contextTriples"] for row in selected)
                / len(selected)
                if selected
                else 0
            )
            print(
                f"{system:12s} top-k={top_k:2d}: "
                f"{complete}/{len(conflicts)} complete, "
                f"mean context {mean_context:.1f} triples"
            )
    print(f"wrote {len(rows)} rows to {output}")


if __name__ == "__main__":
    main()
