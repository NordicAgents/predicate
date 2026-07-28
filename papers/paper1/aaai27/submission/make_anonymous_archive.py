#!/usr/bin/env python3
"""Build the deterministic anonymous AAAI-27 code/data review archive."""

from __future__ import annotations

import hashlib
import re
import subprocess
import zipfile
from pathlib import Path, PurePosixPath


REPO_ROOT = Path(__file__).resolve().parents[4]
SUBMISSION_DIR = Path(__file__).resolve().parent
OUTPUT = SUBMISSION_DIR / "upload_ready" / "04_code_data_anonymous.zip"
README_SOURCE = SUBMISSION_DIR / "code_archive_README.md"
PINNED_TIME = (2026, 7, 28, 12, 0, 0)

ROOT_FILES = (
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
)

PACKAGE_ROOTS = (
    "packages/predicate-agent",
    "packages/predicate-eval",
    "packages/predicate-mcp",
    "packages/predicate-reasoner",
)

RESULT_DIRS = {
    "curves",
    "cwi",
    "dense",
    "exact",
    "instances",
    "ondemand",
    "retrieval",
    "scale",
}

FIXTURE_DIRS = {
    "conflict-chain-m2",
    "conflict-chain-m3",
    "conflict-d05",
    "conflict-d20",
    "conflict-d50",
    "conflict-h3-nk1",
    "conflict-h3-nk3",
    "conflict-tausig",
    "conflict-xr-scale",
    "conflict-xr-small",
}

FOCUSED_TESTS = {
    "adaptive-key-witness.test.ts",
    "conflict-bench.test.ts",
    "conflict-xr.test.ts",
    "cwi.test.ts",
    "exact-baselines.test.ts",
    "instances.test.ts",
    "ondemand-witness.test.ts",
    "retrieval-policies.test.ts",
    "scale-ledger.test.ts",
}

EXTERNAL_FILES = {
    "papers/paper1/probes/dblp-scholar-topology-audit.mjs":
        "external_audit/dblp-scholar-topology-audit.mjs",
    "papers/paper1/probes/dblp-scholar-topology-audit-2026-07-27.json":
        "external_audit/dblp-scholar-topology-audit-2026-07-27.json",
}

TEXT_SUFFIXES = {
    ".cjs",
    ".js",
    ".json",
    ".jsonl",
    ".lock",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".toml",
    ".ts",
    ".ttl",
    ".txt",
    ".yaml",
    ".yml",
}

IDENTITY_PATTERNS = {
    "author first name": re.compile(rb"midhun", re.IGNORECASE),
    "author surname": re.compile(rb"xavier|jolly", re.IGNORECASE),
    "source repository": re.compile(rb"principled-bestofk", re.IGNORECASE),
    "personal path": re.compile(rb"/home/|\\\\Users\\\\", re.IGNORECASE),
    "site/account": re.compile(
        rb"CINECA|Leonardo|mxavier0|AIFAC|aerobase|industriagents|NordicAgents",
        re.IGNORECASE,
    ),
}

ANONYMOUS_REPLACEMENTS = {
    b"https://industriagents.com/predicate/":
        b"https://example.org/anonymous-predicate/",
    b"https://industriagents.com/predicate":
        b"https://example.org/anonymous-predicate",
}


def is_hidden(path: PurePosixPath) -> bool:
    return any(part.startswith(".") for part in path.parts)


def include_package_file(relative: PurePosixPath) -> bool:
    if is_hidden(relative):
        return False
    if any(part in {"dist", "node_modules", "__pycache__"} for part in relative.parts):
        return False
    if relative.suffix in {".log", ".pdf", ".zip", ".pyc", ".map"}:
        return False
    if relative.name.endswith(".bundle.mjs"):
        return False

    parts = relative.parts
    package_name = parts[1] if len(parts) > 1 else ""
    package_relative = parts[2:]
    if package_name != "predicate-eval":
        return (
            relative.name in {"package.json", "tsconfig.json", "vitest.config.ts"}
            or (package_relative and package_relative[0] == "src")
            or (
                package_name == "predicate-mcp"
                and len(package_relative) > 1
                and package_relative[:2] == ("tests", "fixtures")
            )
        )
    if relative.name in {"package.json", "tsconfig.json", "vitest.config.ts"}:
        return True
    if not package_relative:
        return False
    if package_relative[0] not in {"dense", "fixtures", "results", "src", "tests"}:
        return False
    if package_relative[0] == "tests":
        return len(package_relative) == 2 and relative.name in FOCUSED_TESTS
    if package_relative[0] == "fixtures":
        return len(package_relative) > 1 and package_relative[1] in FIXTURE_DIRS
    if package_relative[:2] == ("src", "reader") or package_relative[0] == "scripts":
        return False
    if "baselines" in parts or "raw" in parts:
        return False
    if "results" in parts:
        index = parts.index("results")
        return index + 1 < len(parts) and parts[index + 1] in RESULT_DIRS
    return relative.suffix in TEXT_SUFFIXES


def anonymize(data: bytes) -> bytes:
    for original, replacement in ANONYMOUS_REPLACEMENTS.items():
        data = data.replace(original, replacement)
    return data


def collect_files() -> dict[str, bytes]:
    payload: dict[str, bytes] = {"README.md": anonymize(README_SOURCE.read_bytes())}

    for name in ROOT_FILES:
        payload[name] = anonymize((REPO_ROOT / name).read_bytes())

    for root_name in PACKAGE_ROOTS:
        root = REPO_ROOT / root_name
        for source in sorted(path for path in root.rglob("*") if path.is_file()):
            relative = PurePosixPath(source.relative_to(REPO_ROOT).as_posix())
            if include_package_file(relative):
                payload[relative.as_posix()] = anonymize(source.read_bytes())

    for source_name, member_name in EXTERNAL_FILES.items():
        payload[member_name] = anonymize((REPO_ROOT / source_name).read_bytes())

    return payload


def validate(payload: dict[str, bytes]) -> None:
    if not payload:
        raise RuntimeError("archive payload is empty")

    for member_name, data in payload.items():
        member = PurePosixPath(member_name)
        if member.is_absolute() or ".." in member.parts or is_hidden(member):
            raise RuntimeError(f"unsafe or hidden ZIP member: {member_name}")
        for label, pattern in IDENTITY_PATTERNS.items():
            if pattern.search(member_name.encode()) or pattern.search(data):
                raise RuntimeError(f"{label} detected in {member_name}")


def manifest_for(payload: dict[str, bytes]) -> bytes:
    lines = []
    for member_name in sorted(payload):
        digest = hashlib.sha256(payload[member_name]).hexdigest()
        lines.append(f"{digest}  {member_name}\n")
    return "".join(lines).encode()


def write_archive(payload: dict[str, bytes]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    complete_payload = dict(payload)
    complete_payload["MANIFEST.sha256"] = manifest_for(payload)

    with zipfile.ZipFile(
        OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as archive:
        for member_name in sorted(complete_payload):
            info = zipfile.ZipInfo(member_name, PINNED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            archive.writestr(info, complete_payload[member_name], compresslevel=9)


def verify_archive(expected: dict[str, bytes]) -> None:
    with zipfile.ZipFile(OUTPUT) as archive:
        members = archive.namelist()
        if len(members) != len(set(members)):
            raise RuntimeError("duplicate ZIP member")
        if set(members) != set(expected) | {"MANIFEST.sha256"}:
            raise RuntimeError("ZIP member set differs from the validated payload")
        for info in archive.infolist():
            if info.is_dir() or (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise RuntimeError(f"directory or symlink member: {info.filename}")
            if archive.read(info.filename) != (
                manifest_for(expected)
                if info.filename == "MANIFEST.sha256"
                else expected[info.filename]
            ):
                raise RuntimeError(f"payload mismatch: {info.filename}")

    subprocess.run(["unzip", "-tqq", str(OUTPUT)], check=True)


def main() -> None:
    payload = collect_files()
    validate(payload)
    write_archive(payload)
    verify_archive(payload)
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)}")
    print(f"members: {len(payload) + 1}")
    print(f"bytes: {OUTPUT.stat().st_size}")
    print(f"sha256: {digest}")


if __name__ == "__main__":
    main()
