"""Dataset integrity tests, run inside the ctch pixi env:

    pixi run python -m unittest discover -s tests -v

or

    pixi run python -m unittest tests.test_dataset
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POOL = ROOT / "datasets" / "catch22-mode-topics.jsonl"
MANIFEST = ROOT / "datasets" / ".manifest.json"
SOURCES = ROOT / "datasets" / "SOURCES.json"

FAMILIES = {"paradox", "benchmark", "card", "topic"}
MODES = {
    "omni", "deeptree", "hyper", "socrates", "logic",
    "einstein", "spoon", "ultra", "high", "medium", "medium-low", "low",
}

SECRET_RE = re.compile(r"hf_[A-Za-z0-9]{20,}")


class DatasetTest(unittest.TestCase):
    def setUp(self):
        self.rows = [json.loads(l) for l in POOL.read_text().splitlines() if l.strip()]
        self.manifest = json.loads(MANIFEST.read_text())
        self.sources = json.loads(SOURCES.read_text())

    def test_manifest_matches_pool(self):
        import hashlib
        digest = hashlib.sha256(POOL.read_bytes()).hexdigest()
        self.assertEqual(self.manifest["sha256"], digest, "regenerate with lab/datasets/build_manifest.py")
        self.assertEqual(self.manifest["rows"], len(self.rows))

    def test_rows_have_required_keys(self):
        for row in self.rows:
            for key in ("id", "family", "mode_hint", "prompt", "expected", "source_id", "license_note"):
                self.assertIn(key, row, f"{row.get('id')}: missing {key}")

    def test_no_duplicate_ids(self):
        ids = [r["id"] for r in self.rows]
        self.assertEqual(len(ids), len(set(ids)))

    def test_families_and_modes_valid(self):
        for row in self.rows:
            self.assertIn(row["family"], FAMILIES)
            self.assertIn(row["mode_hint"], MODES)

    def test_sources_cover_all_rows(self):
        for row in self.rows:
            self.assertIn(row["source_id"], self.sources)

    def test_no_secrets_in_dataset_files(self):
        for path in (POOL, SOURCES, MANIFEST):
            self.assertIsNone(SECRET_RE.search(path.read_text()), f"secret-looking token in {path.name}")

    def test_paradox_set_grows_per_plan(self):
        paradox = [r for r in self.rows if r["family"] == "paradox"]
        self.assertGreaterEqual(len(paradox), 8, "paradox set planned for at least 8 rows")


if __name__ == "__main__":
    unittest.main()
