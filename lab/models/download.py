"""Download the planned GGUF weights for the catch22 matrix lab.

Weights live in models/gguf/ (gitignored). Which keys to fetch:

    pixi run python lab/models/download.py --key tb       # default
    pixi run python lab/models/download.py --key tb-q8
    pixi run python lab/models/download.py --all

HF_TOKEN is read from .env when present and is only used in the request
headers. A .sha256 manifest row per file lands in the models/gguf dir so
runs can verify what they loaded.
"""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GGUF_DIR = REPO_ROOT / "models" / "gguf"

# key -> (repo, file)
WEIGHTS = {
    "tb": (
        "DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF",
        "LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-Q6_K.gguf",
    ),
    "tb-max": (
        "DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF",
        "LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-MAX-Q6_K.gguf",
    ),
    "tb-iq4": (
        "DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF",
        "LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-IQ4_XS.gguf",
    ),
    "tb-q8": (
        "DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF",
        "LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-Q8_0.gguf",
    ),
    "mini": (
        "DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF",
        "LFM2.5-2.6B-Q3.8-TBrilliance-NEO-Q8_0.gguf",
    ),
}

DEFAULT_KEYS = ["tb"]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hf_token() -> str | None:
    """Read HF_TOKEN from .env in the repo root. Never printed."""
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("HF_TOKEN="):
                value = line.split("=", 1)[1].strip()
                return value or None
    return os.environ.get("HF_TOKEN") or None


def download(key: str) -> Path:
    from huggingface_hub import hf_hub_download

    repo, filename = WEIGHTS[key]
    if os.environ.get("HF_TOKEN"):
        token = os.environ["HF_TOKEN"]
    else:
        token = hf_token()
    GGUF_DIR.mkdir(parents=True, exist_ok=True)
    target = GGUF_DIR / filename
    if target.exists():
        print(f"[{key}] already present: {filename}")
    else:
        print(f"[{key}] downloading {repo} :: {filename}")
        hf_hub_download(
            repo_id=repo,
            filename=filename,
            local_dir=GGUF_DIR,
            token=token,
        )
    print(f"[{key}] hashing {filename} ...")
    digest = sha256_file(target)
    manifest = GGUF_DIR / ".sha256"
    lines = manifest.read_text().splitlines() if manifest.exists() else []
    lines = [
        line
        for line in lines
        if "  " in line and line.split("  ")[1] != filename
    ]
    lines.append(f"{digest}  {filename}")
    manifest.write_text("\n".join(lines) + "\n")
    print(f"[{key}] sha256 {digest[:12]}... -> {manifest.name}")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--key", action="append", choices=sorted(WEIGHTS), help="weight key to fetch"
    )
    parser.add_argument("--all", action="store_true", help="fetch every key")
    args = parser.parse_args()
    keys = sorted(WEIGHTS) if args.all else (args.key or DEFAULT_KEYS)
    for key in keys:
        download(key)


if __name__ == "__main__":
    main()
