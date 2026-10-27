# Demo dataset notes

Shortlist of prompt sets for walking the ~22 mode matrix. The style is
cloned from the [doolally datasets.md](https://github.com/AISidesKicks/doolally-trollino-rodeo/blob/master/mds/datasets.md)
("source, size, license, caveat" per row), retargeted from classifier labels
to reasoning/instruct demo cells.

## Prompt source families

### 1. DavidAU card examples (expected vs actual)

- Source: the model cards themselves
  ([8B X12](https://huggingface.co/DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF)
  and the [2.6B X12](https://huggingface.co/DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF)
  sibling, same mode grammar).
- Shape: one example prompt + one "expected output" per mode, 12 modes.
  Expect outputs were generated live by their Q8 MAX version.
- License: card text, quoting for educational comment is fine. Credit the
  source repo per row.
- Use: the only source with a **reference answer**. Demo each card prompt
  in its intended mode and let the audience judge how close we land.
- Caveat: prompts are "future of remote work", "reduce churn 20 percent",
  "EV charging market MECE" style business topics. Good<Long> prose vibes,
  weak hard-verifiability. Pair with source 2.

### 2. Benchmark picks (hard verification)

- Source shortlist, all public on Hugging Face:
  - [MATH500](https://huggingface.co/datasets/HuggingFaceH4/MATH500) - 500
    contest problems, numeric-verifiable answers. Match to logic/ultra.
  - [IFEval](https://huggingface.co/datasets/google/IFEval) - verifiable
    instruction following (formats, counts,Forbidden rules). Match to
    hyper/medium-low (does "low" still follow all constraints?).
  - [GSM8K](https://huggingface.co/datasets/openai/gsm8k) grade school math -
    fast sanity math for the effort ladder (low vs ultra).
  - [TruthfulQA](https://huggingface.co/datasets/truthfulqa/truthfulqa) -
    hallucination bait pairs for omni/spoon contrast.
- License check per row before committing into datasets/; keep a
  datasets/SOURCES.json with repo, split, row id and license per pick.
- Use: 2 or 3 rows per mode class is enough for v1. We are not running a
  leaderboard, we are showing mode *shape* on verifiable tasks.
- Caveat: our model is 8B at Q6/Q8 - do not promise state of the art
  scores, show the deltas between modes on identical hardware.

### 3. Catch 22 paradox set (the on-brand flavor)

Hand curated, no external source. Roughly 8 growing rows:

- the mission exemption Catch-22 itself (Doc Daneeka rule),
- golden rule (the deeper salinger v Heller question of the novel title),
- pinocchio "this sentence is false" self reference,
- grandfather paradox (time travel),
- the two generals / impossible consensus setup,
- a no-win employee policy (approval requires disapproval),
- contradictory instruction compliance ("answer in exactly 3 words:
  describe quantum tunneling in detail"),
- a false premise question ("why is the moon made of cheddar?") to see
  which modes sniff the trap.

- License: ours, MIT like the repo.
- Use: run **every row through all mode cells**. Paradox prompts maximize
  inter-mode contrast (socrates interrogates the premise, logic rebuilds
  it, why it is false, low mode falls for it fastest - that is the demo).
- Caveat: no ground truth "score", judgement is qualitative. Mark the
  column "mode behavior notes" honestly as notes, not accuracy.

### 4. Topic sets for multi cell runs (stretch)

- Shape: 4 topic categories with one rich golden prompt each, similar to
  the doolally 4 class design: technical, business, creative, everyday.
- Sources: doolally pool leftovers (Yahoo Answers topics) for the everyday
  class; hand written for the rest in v1.
- Use: one "short run" = 4 topics x the 12 reasoning modes. One "long run"
  adds instruct cells and the 2.6B model for a density claim.

## Canonical build plan

- `datasets/catch22-mode-topics.jsonl` (canonical, tracked) + `.manifest.json`
  (stats, tracked) + `SOURCES.json` (provenance and licenses, tracked).
- Rows keyed by: id, family (card/benchmark/paradox/topic), mode_hint,
  prompt, expected (nullable), source_id, license_note.
- Play modes: pilot (card set, 12 rows), short (paradox 8 + benchmark picks
  24ish rows), long (all families x all cells).
- Same rules as doolally: no first-N bias (SHA-256 order key), the pool is
  tracked so the lab runs without a rebuild, csv views stay local.
- HF_TOKEN from .env used for downloads only, never written to outputs.

## Bootstrap sample

For the first smoke test, `datasets/bootstrap.jsonl` with 4 rows: one card
example (deeptree), one paradox (pinocchio), one benchmark pick (MATH500
easy row), one IFEval row. One model, one quant, all 12 reasoning cells -
if that plays clean on youtube-style attention spans, scale the pool.
