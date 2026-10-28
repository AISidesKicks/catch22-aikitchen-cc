# Models

Local GGUF weights live in `models/gguf/` and are gitignored. Only this
README and the `.gitkeep` placeholders are tracked. Sizes verified against
the Hugging Face file lists (oct 2026). `HF_TOKEN` from `.env` is used for
downloads only, never written here.

## Downloaded weights (all verified via lab/models/download.py + .sha256)

| Key | File | Repo | Bytes | Role |
| --- | --- | --- | --- | --- |
| `tb` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-Q6_K.gguf` | [DavidAU 8B X12](https://huggingface.co/DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | 6,959,819,456 | default demo model, 12 reasoning modes |
| `tb-iq4` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-IQ4_XS.gguf` | same repo | 4,588,333,760 | quant ladder cheap end |
| `tb-q8` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-Q8_0.gguf` | same repo | 9,010,227,904 | quant ladder anchor |
| `stock` | `LFM2.5-8B-A1B-Q6_K.gguf` | [LiquidAI/LFM2.5-8B-A1B-GGUF](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF) | 6,959,787,232 | control run, no Brilliance tags, same quant as tb |
| `mini` | `LFM2.5-2.6B-Q3.8-TBrilliance-NEO-Q8_0.gguf` | [DavidAU 2.6B X12](https://huggingface.co/DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | 2,874,813,152 | sibling with claimed true 12+12 instruct |
| `tb-max` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-MAX-Q6_K.gguf` | [DavidAU 8B X12](https://huggingface.co/DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | 7,269,067,456 | MAX output tensor contrast; measured: no win over plain (mds/benchmarks.md) |

Note the stock and tb Q6_K files are near identical sizes (both Q6_K of
the same 8.3B base) which makes the control comparison clean. The tb Q8_0
file is 9.01 GB - bigger than the stock Q8 listed earlier (8.39 GB on the
repo tree was an older estimate; the downloaded file is authoritative).

## Planned but not downloaded

| Key | File | Role |
| --- | --- | --- |
| `mini-iq4` | 2.6B NEO-IQ4_XS | small model quant row |

## Server profiles

| Container | Profile | Model | Port |
| --- | --- | --- | --- |
| ctch-llama-tb | default | tb Q6_K | 8081 |
| ctch-llama-tb-iq4 | iq4 | tb IQ4_XS | 8081 |
| ctch-llama-tb-q8 | q8 | tb Q8_0 | 8081 |
| ctch-llama-stock | stock | stock Q6_K | 8082 |
| ctch-llama-mini | mini | mini Q8_0 | 8081 |

One RTX 4070: run one llama server at a time (the campaign script does the
swapping). Ports 8082 for stock so a CPU offload side by side stays
possible on bigger machines.

License notes:

- DavidAU GGUF repos: Apache 2.0 declared on the card.
- LiquidAI checkpoints: `lfm1.0` license, terms differ from Apache; link
  the license page from the site, do not copy text.

Download targets go through `lab/models/download.py` with the key table
above; sha256 manifests land in `models/gguf/.sha256` next to the files.
