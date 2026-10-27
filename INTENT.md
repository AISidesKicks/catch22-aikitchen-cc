# Catch 22 - Turbo Brilliance reasoning modes lab - project intent

## What we are building

An educational, watchable lab that runs the **same prompt set** through every
Turbo Brilliance reasoning/instruct mode of one small local model, using
llama.cpp only. The visitor then picks the right mode for their own pocket and
task.

The point is not to hunt for the smartest mode. The point is to show:

- what each of the ~22 mode variants actually does to the same answer,
- where the differences are real (structure, depth, length, speed) and where
  they are just wording,
- that all of it is prompt activated, so any roberta app that can send text
  can use it with zero patches,
- what the trade-off is between model size, quant level and mode strength,
  so people can choose what fits their hardware and wallet.

The project is named after https://en.wikipedia.org/wiki/Catch-22, which has
mutually contradictory rules. Reasoning vs instruct modes often feel the same
way: you want an instant answer, but you also want the thinking behind it.

Measured notes will land in [mds/benchmarks.md](mds/benchmarks.md) once the
first real run exists. Family research lives in
[mds/turbo-brilliance.md](mds/turbo-brilliance.md).

## The 22 matrix

One model: [LiquidAI LFM2.5-8B-A1B](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B)
in the DavidAU Turbo Brilliance tune. Two families, activated in prompt:

| Family | Tag syntax | Cells |
| --- | --- | --- |
| Reasoning | `{REASON:omni}` | 12 |
| Instruct | `{REASON:iomni}` | 12 |

Modes in both families: omni, deeptree, hyper, socrates, logic, einstein,
spoon, ultra, high, medium, medium-low, low. Two specials: `{REASON:off}`
(baseline, no enhancements) and `{REASON:help}` (the built in meta menu).
Defaults when no tag is present: high for reasoning, medium for instruct.

Each demo row records: the prompt, the raw output, token usage, wall time and
a one line human note on what this mode changed. Results render into the
static site at docs/ for https://catch22.aikitchen.cc.

## Models

| Role | Model | Size |
| --- | --- | --- |
| Demo model | [LiquidAI/LFM2.5-8B-A1B-GGUF](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF) direct | q6/q8, around 7 to 9 GB |
| Turbo Brilliance tune | [DavidAU/LFM2.5-8B-A1B-...Turbo-Brilliance-Power-X12-NEO-MAX-GGUF](https://huggingface.co/DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | same quants, modes fine tuned in |
| Smaller sibling (stretch) | [DavidAU/LFM2.5-2.6B-...Turbo-Brilliance-Power-X12-NEO-MAX-GGUF](https://huggingface.co/DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | dense 2.6B, q6/q8 |

The Turbo Brilliance fine tune adds the `{REASON:...}`
grammar, which lets us demo jump-mode selection without touching app code.
Comparison with the stock LiquidAI model shows what the system adds on top.

Variant targets across the family (2.6B X12, 8B-A1B X12, 24B-A2B 50X,
27B 50X MTP) are documented in [mds/turbo-brilliance.md](mds/turbo-brilliance.md)
so the site can contrast the whole ladder, while v1 runs on the 8B only.

## Demo flow (semi-show mode)

The demo is meant to be watched, not just benchmarked.

1. **Golden prompt** per topic dataset row, sent to the llama.cpp server
   with the mode tag in the prompt, nothing else configured.
2. **One tag per chat.** Fresh context per cell, no cross mode pollution.
3. **Show the output.** Render `...` thinking separately from the final
   answer so people see the shape of each mode.
4. **Repeat across the matrix.** Same prompt, next tag, until the 22-ish
   rows are recorded for that topic.
5. **Batch runner.** The node worker plays the whole matrix on a topic
   while the visitor watches cells fill in.
6. **Sample sizes.** pilot 22 cells on one topic, short run across a handful
   of topics, long run across the full dataset if requested.

## Dataset plan

Three prompt sources, curated small, in datasets/:

1. **DavidAU card examples.** The model card ships one example prompt per
   mode. Re-running those gives an expected vs actual check for free.
2. **Benchmark picks.** A tiny curated sample from MATH500, IFEval style
   instruction following and a research-synthesis question, matched to the
   mode classes (logic, hyper, spoon, ultra).
3. **Catch 22 paradox set.** Our on-brand flavor set: the mission exemption
   rule, golden rule, self reference and no-win dilemmas. The same prompt
   through all modes shows the biggest inter mode contrast.

Design notes in [mds/demo-datasets.md](mds/demo-datasets.md) (cloned style
from the doolally datasets.md).

## Architecture

Same family shape as the doolally-trollino lab, retargeted:

```
browser GUI (built into gui/)
        |
        v
Node 24 worker  --  durable runner  --  SQLite (runs, cells, attempts, batches)
        |
        +--> llama.cpp server (Turbo Brilliance 8B)
        +--> optional second llama.cpp server (stock LFM2.5-8B-A1B)
        |
        +--> Arize Phoenix (one span per committed batch)

Python flow (pixi ctch)  --  dataset building and manifest checks
```

- **Node 24** is required for built-in `node:sqlite`.
- **Durable runner** commits a cell result before the next one starts,
  and resumes from the first uncommitted cell after a restart
  (inspired by Pi Durable, see [mds/durable-execution.md](mds/durable-execution.md)).
- **GUI** is plain HTML, CSS and JS, no framework. Build output goes to
  gui/, never docs/. The site copy of results stays static in docs/.
- **Docker** runs the models, Phoenix and the lab service. All resources
  use the `ctch-` prefix.
- **Phoenix** shows one span per committed cell at http://127.0.0.1:6006.

## Repository layout

| Path | Role | State |
| --- | --- | --- |
| `docs/` | static GitHub Pages site only (HTML pages and images) | project page, catch 22 art, `CNAME` fixed |
| `gui/` | build output directory for the GUI, gitignored | placeholder |
| `src/` | node 24 worker, server, providers, gui source | empty, next |
| `lab/` | hands-on plan and experiments | empty, dataset builder lands here |
| `mds/` | deep dives and reference lists | turbo-brilliance.md, demo-datasets.md, durable-execution.md |
| `datasets/` | curated short-topic datasets | empty, mode topic sets land here |
| `models/` | local gguf weights, gitignored except README and placeholders | placeholder |
| `docker/` | container definitions, `ctch-` prefix | empty |
| `tests/` | python dataset tests and node worker tests | empty |
| `scratch/` | logs and crash artifacts, gitignored except `.gitkeep` | ready |

## Plan and status

- [x] Pixi environment `ctch` with Python 3.12, Node 24, huggingface_hub, pyarrow.
- [x] Verify `pixi info` reports the ctch workspace.
- [x] Research the Turbo Brilliance family: [mds/turbo-brilliance.md](mds/turbo-brilliance.md).
- [x] Confirm llama.cpp works with the model unmodified (proven in the doolally lab, server 0.7.0-dev build 11870).
- [x] Clone and expand doolally research notes for this lab.
- [ ] Dataset: mode topic sets committed with manifest and sources.
- [ ] Node durable worker that walks the 22 matrix in play modes.
- [ ] llama.cpp docker services, `ctch-` prefix, plus optional stock-model profile.
- [ ] GUI: live matrix filling, per cell timing, raw `...` vs answer split.
- [ ] Written results in mds/benchmarks.md after the first real run.
- [ ] Static results page in docs/.

## Infrastructure

Docker, all resources prefixed `ctch-`, port plan mirroring doolally:

- `ctch-llama-tb`: Turbo Brilliance 8B on port 8081
- `ctch-llama-stock`: optional stock LFM2.5-8B-A1B on port 8082, profile `stock`
- `ctch-phoenix`: Arize Phoenix on port 6006, OTLP on 4317
- `ctch-lab`: node 24 server and worker on port 3030
- network `ctch-net`, volumes `ctch-lab-data` and `ctch-phoenix-data`

Node packages install locally with `npx`/`npm`, never global.

## Inspirations

- [doolally-trollino-rodeo](https://github.com/AISidesKicks/doolally-trollino-rodeo)
  - same org, same stack, previous project: dataset design, durable runner,
    gui and lesson notes cloned and adapted here.
- [DavidAU Turbo Brilliance collection](https://huggingface.co/collections/DavidAU/turbo-brilliance-ai-constructs-50x-reasoning-instruct)
  - the model family under the demo.
- [alejandro-ao/pi-durable-demo](https://github.com/alejandro-ao/pi-durable-demo)
  and [earendil-works/pi durable](https://github.com/earendil-works/pi/tree/main/packages/durable)
  - crash recovery design, via mds/durable-execution.md.

## Limitations to keep visible

- DavidAU calls Turbo Brilliance a BETA V1.0 system. Modes are behavioral
  prompt priming fine tuned into the model, not real search algorithms.
  Differences between modes are output structure and effort, not oracle
  guarantees. Say it on the site, plainly.
- Quant level and model size strongly change mode power, so claims must
  name the quant used in the run.
- DavidAU helps development on buy-me-a-coffee; the models are Apache 2.0
  but the system is his design - credit it, do not imply ownership.
