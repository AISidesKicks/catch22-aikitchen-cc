# catch22 benchmarks - what the runs actually showed

All numbers below are live runs of
`LFM2.5-8B-A1B-Q3.8-TBrilliance-NEO-Q6_K.gguf` (6.48 GB quant, 1B active
params) on one RTX 4070 through llama.cpp (server-cuda image), fresh chat
per cell, worker defaults: temp 0.2, topK 80, rep pen 1.05. Nothing here is
a leaderboard; it is mode contrast on identical hardware, which is the
whole point of the demo.

## Honest framing first

- Modes are **prompt behavior priming** fine tuned into the model, not
  search algorithms. Deeptree is roleplay of a tree of thought, not real
  branching search. Say it on every comparison.
- The stock LiquidAI model already scores IFEval 91.84, MATH500 88.76,
  AIME25 42.53 (per its model card). Our demo shows what the mode grammar
  adds over a tuned reasoning model, not over a dumb baseline.
- Quant gates mode power (DavidAU: Q8 is 1.5 to 2x Q6, Q6 is 2x+ over
  Q4/IQ4). Every claim here names Q6_K. Lower quants will differ.

## Pilot run (run-222573de, 27 oct 2026)

4 rows x 12 reasoning modes = 48 cells, all committed. Three refill passes
(2048, then 3072, then 4096 token caps) because structural modes do not
finish open ended tasks.

### Math row (bench-math-gcd, gcd of 24 and 60, expected 12)

| mode | tokens | latency | answer shape |
| --- | --- | --- | --- |
| low | 95 | 443 ms | \boxed{12} |
| medium | 91 | 407 ms | 12 |
| medium-low | 332 | 1460 ms | factorization walk |
| ultra | 471 | 2003 ms | \boxed{12} |
| high | 636 | 2715 ms | two methods |
| deeptree | 554 | 2312 ms | 12 |
| einstein | 591 | 2539 ms | factor + 12 |
| socrates | 685 | 2923 ms | premise check first |
| spoon | 562 | 2356 ms | final answer 12 + brief |
| omni | 627 | 2700 ms | 12 |
| hyper | 211 | 907 ms | 12 |
| logic | 913 | 3809 ms | axioms first |

12 of 12 correct. The effort ladder is visible in tokens: the three
"quick" tiers (low, medium, medium-low) land under 340 tokens; thorough
tiers run 400 to 900.

### IFEval row (bench-ifeval-banana, exactly three times)

12 of 12 cells obeyed the count. Tokens per mode ranged 125 (omni) to
446 (socrates). Great demo beat: socrates checks premises even for
trivial work.

### Speed

Short answers: about 0.6 to 1.9 s per cell. Long chains: about 240
tokens per second decode. The doolally lab measured the same family on
the same card, numbers agree.

### Chain truncation findings (the honest ones)

- Structural modes (deeptree, spoon, omni, ultra, and often high and
  hyper) hit every cap we tried on open ended tasks (churn tree,
  pinocchio, MECE): 2048, then 3072, then 4096 tokens, still going.
- The low tag throttles style on easy tasks but not budget on hard ones:
  pinocchio in low mode ran to cap like ultra did.
- GUI rule: cells with tokens >= 3070 render "chain truncated" instead
  of pretending the mode is exhausted.

## Instruct family (8B X12) - live verdict

The 2.6B card claims 12 reasoning + 12 instruct modes; the 8B card text
is garbled there. Live probes resolved it for the 8B:

- `{REASON:ihelp}`: the model itself reports its help file has no
  instruct modes.
- `{REASON:low}` vs `{REASON:ilow}` A/B: ilow produced a LONGER chain
  (170 vs 67 completion tokens) with no skip thinking behavior.
- Verdict: on the 8B, the instruct family is not a separate mode set.
  The matrix still walks instruct cells (tags sent, data collected), but
  the site labels them "live verified: not a separate mode on this
  model". The 22 cell count on the site covers the mode NAMES; the
  honest live contrast is reasoning vs reasoning.

## Short run (run-5ef5d628, 27 oct 2026)

21 rows x 12 reasoning modes = 252 cells, all committed, zero permanent
failures. One refill pass at 4096 tokens. Real findings:

### Mode token ladder across all 21 rows

Average completion tokens per mode, all rows:

| mode | avg tokens | range | avg ms |
| --- | --- | --- | --- |
| medium-low | 977 | 141 to 4007 | 4070 |
| low | 987 | 100 to 3254 | 4103 |
| socrates | 1069 | 340 to 1954 | 4460 |
| medium | 1117 | 136 to 4096 | 4642 |
| logic | 1262 | 210 to 3067 | 5251 |
| high | 1512 | 171 to 4096 | 6295 |
| einstein | 1548 | 167 to 4096 | 6486 |
| hyper | 1851 | 190 to 4096 | 7808 |
| ultra | 2046 | 215 to 4096 | 8556 |
| spoon | 2531 | 212 to 4096 | 10670 |
| deeptree | 2536 | 169 to 4096 | 10734 |
| omni | 2632 | 169 to 4096 | 11223 |

The demo story in one table: quick tiers cluster near 1000 tokens, the
panel/tree modes (spoon, deeptree, omni) sit 2.5x above them and are the
slowest, ultra is the priciest "focused" tier. This ordering is what a
visitor picks their pocket from.

### Correctness

- Math rows: 24 of 24 cells correct across all modes. This includes the
  best demo beat of the whole lab: the dataset author wrote a wrong
  expected value for the train speed row (96 km/h) and all 12 modes
  answered 480/7 = 68.57 - the model caught the dataset, not the other
  way around. The dataset row is fixed now.
- IFEval rows: 24 of 24 constraint compliant (exact 3 bananas, no comma
  sentence). The stock 91.84 IFEval score holds live across modes.
- 62 of 252 cells hit the 3072 cap on the first pass; after one 4096
  refill, 29 recovered and 33 remained truncated (deeptree, spoon, omni
  on open ended tasks). Cells at cap render "chain truncated" in the GUI.


## Instruct family full walk (run-5e04ff01, 27 oct 2026)

21 rows x 12 instruct modes = 252 cells, all committed (one 4096 refill,
28 cells structurally unbounded, same pattern as reasoning). Verdict:

- Instruct tags do NOT reliably skip thinking on the 8B. Side by side
  average tokens per mode land within noise of the reasoning run:
  low 987 vs 783, socrates 1069 vs 984, high 1512 vs 1662 (instruct
  LONGER), ultra 2046 vs 2130, deeptree 2536 vs 2231, omni 2632 vs 2228.
- The card's "instruct = fast, thinking skipped" story does not transfer
  from the 2.6B sibling to this 8B tune. On the site: instruct cells on
  the 8B are labeled live verified as not a separate mode, and the 22
  count is explained as mode NAMES; the honest live contrast is
  reasoning tiers, effort ladder and structure.
- Constraint following stays perfect in instruct cells too: banana and
  no comma rows 24 of 24.

## Next steps campaign (28 oct 2026): control, quant ladder, mini

Three more live datasets on the same hardware, plus the two no-tag
control runs:

### Control triangle (21 rows, no tag in the prompt)

| run | what | total tokens | note |
| --- | --- | --- | --- |
| run-e54e73ea | stock LiquidAI model, no tag | 22,179 | the plain base |
| run-10d2392e | TB tune, no tag | 30,133 | the tune alone is chattier |
| run-5ef5d628 | TB tune, 12 tags | 12 mode averages | tags add structure on top |

Findings:

- The tune itself changes behavior with no tag at all: tb-off ran
  LONGER chains than stock on several rows (card-deeptree 3072 vs 1933,
  topic-creative 3072 vs 636, card-omni-remote 3072 vs 898) and hit the
  cap 5 times. The Brilliance fine tune is already "reasoning flavored"
  before any tag is sent.
- Tagged modes add structured verbosity on top of that
  (tb-modes-avg per row mostly above both controls).
- Correctness on the verifiable rows is equal across the triangle:
  stock and tb both answer 12 / 3/4 / 68.57 / banana x3 / no comma /
  correct moon refusal. The tune does not fix math; it shapes process.
- Best demo beat survives: both models independently computed the
  480/7 = 68.57 km/h answer that the dataset author got wrong.

### Quant ladder (same 10 rows x 12 modes on each quant)

Average tokens per mode, capped cell counts (of 10 rows each):

| mode | q6 tok | iq4 tok | q8 tok | capped q6/iq4/q8 |
| --- | --- | --- | --- | --- |
| deeptree | 1532 | 2267 | 956 | 3/7/1 |
| einstein | 1172 | 931 | 1042 | 1/1/2 |
| high | 745 | 989 | 1106 | 0/1/0 |
| hyper | 1198 | 1564 | 1243 | 0/1/0 |
| logic | 801 | 896 | 780 | 0/1/0 |
| low | 696 | 632 | 556 | 1/1/0 |
| medium | 581 | 794 | 784 | 0/1/0 |
| medium-low | 514 | 866 | 846 | 0/1/1 |
| omni | 2158 | 1944 | 1573 | 2/3/2 |
| socrates | 943 | 885 | 1015 | 0/0/1 |
| spoon | 1754 | 1707 | 1494 | 3/4/4 |
| ultra | 1235 | 1634 | 1173 | 1/2/1 |

Reading: quant does not just shift quality, it shifts discipline.

- IQ4_XS (4.27 GB): cheapest disk, but structural modes ramble and
  truncate most (deeptree capped 7 of 10). The "quant gates mode power"
  card rule shows up as lost chain control.
- Q8_0 (8.62... file is 9.01 GB): the most disciplined - deeptree
  finishes at 956 average where q6 needs 1532 and iq4 cannot finish.
- Q6_K: leanest on the quick tiers (medium-low 514), middle discipline.
- Latency does not follow size: the 2.6B dense mini is SLOWER per cell
  than the 8B sparse (1B active) sibling on structural modes. Parameter
  count does not buy speed; active params do.

### MAX variant A/B (run-5d16ed4a, 28 oct 2026)

The MAX tag keeps the output tensor at BF16. Card claimed extra mode
strength; our lab measured none at Q6_K:

- Same 10 rows x 12 modes: total tokens 12,948 (MAX) vs 13,330 (plain),
  within noise; per mode deltas swing both ways.
- Truncated cells: 17 (MAX) vs 11 (plain) - no discipline win, small
  sample, no loss either.
- Latency: MAX is slower per cell (bigger file, more VRAM).
- Verdict for the audience: at this size, download the plain file. The
  MAX variant is card claimed, not lab verified, on our matrix.

## Mini 2.6B instruct ladder (run-f46398fe, full 21 rows)

The 2.6B card claims a true 12+12 instruct system, and live data
supports partial differentiation: the effort tiers are leaner than the
8B (medium 561 vs 1286, spoon 718 vs 2566, ultra 966 vs 2130), while
hyper, einstein and deeptree ramble even harder at this scale (capped 6
to 8 of 21). Thinking is still visible in most cells, so instruct does
not cleanly skip thinking here either; it saves tokens on the focused
tiers. Verdict for the site: mini instruct = real but partial; a good
"smaller model, less control" contrast.

### Worker lessons for the log

- The worker CLI now requires --provider explicitly; the campaign
  accidentally produced three mock runs (tokens=8 everywhere) before
  this guard. Purged from the db, kept as a lesson here.
- Stock serves on 8082; the campaign passes --baseUrl per phase.

## Open questions for later runs

- All local control variants are measured now:
  - stock no tag (run-e54e73ea) = the plain base,
  - TB tune no tag (run-10d2392e) = the tune alone is chattier than
    stock (30,133 vs 22,179 total tokens),
  - stock with tag text (run-stock-tagtext, 21 plain + 21 tag text
    cells) = the base model is **inert to the grammar**: about 2 percent
    token delta, per row noise in both directions. The grammar only
    exists in the fine tune. Tune reacts, stock ignores.
- 24B-A2B 50X and 27B 50X MTP rows need more VRAM or a second machine.

## Reproduce

    docker compose -f docker/compose.yaml up -d llama-tb phoenix lab
    npm run worker -- run --pool datasets/catch22-mode-topics.jsonl \
      --provider llama --family reasoning --maxTokens 3072
    node src/status.js                # read only progress
    npm run gui                       # rebuild gui/data.json
    open http://127.0.0.1:3030        # live matrix
