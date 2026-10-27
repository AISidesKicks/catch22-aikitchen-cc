# Models

Local GGUF weights live in `models/gguf/` and are gitignored. Only this
README and the `.gitkeep` placeholders are tracked. Sizes verified against
the Hugging Face file lists (oct 2026). `HF_TOKEN` from `.env` is used for
downloads only, never written here.

## Planned weights for the 22 matrix lab

| Key | File | Repo | Size | Role |
| --- | --- | --- | --- | --- |
| `tb` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-Q6_K.gguf` | [DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF](https://huggingface.co/DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | 6.48 GB | default demo model, 12 reasoning modes |
| `tb-max` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-MAX-Q6_K.gguf` | same repo | 6.77 GB | quant ladder row (MAX out tensor) |
| `tb-q8` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-Q8_0.gguf` | same repo | 8.39 GB | quant ladder anchor |
| `tb-iq4` | `LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-IQ4_XS.gguf` | same repo | 4.29 GB | quant ladder cheap end |
| `stock` | LiquidAI `LFM2.5-8B-A1B-GGUF` Q6_K/Q8_0 | [LiquidAI/LFM2.5-8B-A1B-GGUF](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF) | see repo | control run, no Brilliance tags |
| `mini` | `LFM2.5-2.6B-...-TBrilliance-NEO-Q8_0.gguf` | [DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF](https://huggingface.co/DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | see repo | stretch row, dense 2.6B sibling |

Quant ladder strategy: run the pilot matrix on Q6_K first (mid price,
card-suggested quality floor), then repeat the short pool on IQ4_XS and
Q8_0. The MAX variants are optional extra rows if the audience asks "what
is the MAX tag on the file anyway" - it is the BF16 output tensor trick
(see mds/turbo-brilliance.md).

Disc budget for the default set: about 21 GB for tb + tb-q8 + tb-iq4 +
stock. The BF16 file is 15.78 GB and stays a download-on-demand row.

License notes:

- DavidAU GGUF repos: Apache 2.0 declared on the card.
- LiquidAI checkpoints: `lfm1.0` license, terms differ from Apache; link
  the license page from the site, do not copy text.

Download targets go through `lab/models/download.py` (to be built, style
cloned from the doolally lab) with the file stem table above. Keep a
`.sha256` manifest next to each downloaded file under `scratch/`.
