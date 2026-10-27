"""Build the manifest for the canonical catch22 prompt pool.

    pixi run python lab/datasets/build_manifest.py

Checks every row of datasets/catch22-mode-topics.jsonl:
- parses as one JSON object per line
- has the required keys with sane values
- source_id exists in datasets/SOURCES.json
- every reasoning mode_hint is a known matrix mode
- no HF tokens or secret-looking strings leaked into rows

Writes datasets/.manifest.json with row counts per family, per source and
the sha256 of the pool file. The manifest is tracked, the db is not.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
POOL = REPO_ROOT / "datasets" / "catch22-mode-topics.jsonl"
SOURCES = REPO_ROOT / "datasets" / "SOURCES.json"
MANIFEST = REPO_ROOT / "datasets" / ".manifest.json"

REQUIRED_KEYS = {"id", "family", "mode_hint", "prompt", "expected", "source_id", "license_note"}
FAMILIES = {"paradox", "benchmark", "card", "topic"}
MODES = {
    "omni", "deeptree", "hyper", "socrates", "logic",
    "einstein", "spoon", "ultra", "high", "medium", "medium-low", "low",
}

# Never allowed inside dataset files: token shaped secrets.
SECRET_RE = re.compile(r"hf_[A-Za-z0-9]{20,}")


def main() -> int:
    rows = []
    seen_ids = set()
    for lineno, line in enumerate(POOL.read_text().splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        missing = REQUIRED_KEYS - set(row)
        if missing:
            print(f"FAIL line {lineno}: missing keys {sorted(missing)}")
            return 1
        if row["id"] in seen_ids:
            print(f"FAIL line {lineno}: duplicate id {row['id']}")
            return 1
        seen_ids.add(row["id"])
        if row["family"] not in FAMILIES:
            print(f"FAIL line {lineno}: family {row['family']!r} not in {sorted(FAMILIES)}")
            return 1
        if row["mode_hint"] not in MODES:
            print(f"FAIL line {lineno}: unknown mode_hint {row['mode_hint']!r}")
            return 1
        if len(row["prompt"].strip()) < 10:
            print(f"FAIL line {lineno}: prompt too short")
            return 1
        rows.append(row)

    sources = json.loads(SOURCES.read_text())
    for row in rows:
        if row["source_id"] not in sources:
            print(f"FAIL {row['id']}: unknown source_id {row['source_id']!r}")
            return 1

    for path in (POOL, SOURCES):
        if SECRET_RE.search(path.read_text()):
            print(f"FAIL {path.name}: looks like a secret token is present")
            return 1

    manifest = {
        "pool": POOL.name,
        "sha256": hashlib.sha256(POOL.read_bytes()).hexdigest(),
        "rows": len(rows),
        "by_family": dict(Counter(r["family"] for r in rows)),
        "by_source": dict(Counter(r["source_id"] for r in rows)),
        "expected_rows": sum(1 for r in rows if r["expected"] is not None),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    print(f"OK manifest: {manifest['rows']} rows, families {manifest['by_family']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
