# catch22-aikitchen-cc

An educational lab for picking reasoning modes and effort levels on small
local models. Same prompt, every Turbo Brilliance mode, one model on one
GPU - then the reader picks what fits their pocket.

Named after the Catch 22 paradox: you want an instant answer, but you also
want the thinking behind it.

## The 22 matrix

One model: LiquidAI LFM2.5-8B-A1B in the DavidAU Turbo Brilliance X12
tune. Two families, activated with plain text in the prompt:

| family | tag syntax | cells |
| --- | --- | --- |
| reasoning | `{REASON:omni}` | 12 |
| instruct | `{REASON:iomni}` | 12 |

Modes: omni, deeptree, hyper, socrates, logic, einstein, spoon, ultra,
high, medium, medium-low, low. Plus `{REASON:off}` (baseline) and
`{REASON:help}` (the built in menu).

Honest framing: the modes are prompt behavior priming fine tuned into the
model at training time, not search algorithms. The lab measures what they
change on identical hardware, and says plainly where they do nothing.

## What the lab measured (live, not card claimed)

- the full 21 row x 12 reasoning mode matrix plus the instruct family
- the effort ladder in tokens (low 987 avg to omni 2632 avg per row)
- quant ladder on the same rows: IQ4 rambles, Q8 disciplines, plain Q6
  balances; the MAX variant bought nothing
- what the fine tune changes with no tag at all (the tune is reasoning
  flavored before any tag is sent)
- instruct reality on both the 8B (inert) and the 2.6B sibling (real but
  partial)

Numbers live in [mds/benchmarks.md](mds/benchmarks.md), family research in
[mds/turbo-brilliance.md](mds/turbo-brilliance.md).

## Quickstart

Requirements: docker with GPU, node 24, pixi (python side).

    pixi shell ctch                      # env check: pixi info | grep Name
    docker compose -f docker/compose.yaml up -d llama-tb phoenix lab
    npm run worker -- run --provider llama \
      --pool datasets/catch22-mode-topics.jsonl \
      --family reasoning --maxTokens 3072
    open http://127.0.0.1:3030           # watch the matrix fill in live
    open http://127.0.0.1:6006           # Phoenix, one span per cell

Weights land in `models/gguf/` via `lab/models/download.py` (about 32 GB
for the full set; see [models/README.md](models/README.md)). The SQLite
db is `scratch/lab.db`, gitignored, durable across kills.

## The static site

`docs/` is the GitHub Pages site for catch22.aikitchen.cc:

- [docs/index.html](docs/index.html) - project page
- [docs/modes.html](docs/modes.html) - the pick your reasoning mode guide
- [docs/results.html](docs/results.html) - generated from the lab SQLite
  (`npm run gui:docs`)

The live GUI sources are `src/gui/`, built into `gui/` (gitignored) and
served by the `ctch-lab` docker service on port 3030.

## Repo layout

| path | role |
| --- | --- |
| `src/` | node 24 worker, server, providers, trace exporter, gui source |
| `datasets/` | curated prompt pools with manifest and sources |
| `lab/` | dataset builder, model downloader, run scripts, analysis |
| `docker/` | llama.cpp, phoenix, gui services, all ctch- prefixed |
| `mds/` | deep dives: family research, datasets, durable execution, benchmarks |
| `models/` | local weights, gitignored except README |
| `tests/` | python dataset tests and node worker tests |

## Credits

- Model and system design: DavidAU (David Belton), Turbo Brilliance
  collection. Buy him a coffee if you get value from it; the weights are
  Apache 2.0, the design credit is his.
- Base model: LiquidAI LFM2.5-8B-A1B (lfm1.0 license).
- Lab design cloned with thanks from the doolally-trollino-rodeo lab.

License: MIT, see [LICENSE](LICENSE).
