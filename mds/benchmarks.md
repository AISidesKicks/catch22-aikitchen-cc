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

## Open questions for later runs

- Stock LiquidAI control run (profile `stock` in compose): how much does
  the Brilliance tune add when no tag is present? Needs the second
  server profile, one GPU, so runs swap servers.
- Quant ladder rows (tb-iq4, tb-q8, tb-max): same pool, same modes,
  different quants. That is the strongest "pick your pocket" story.
- 2.6B X12 sibling: the card claims true 12+12 there, which would make
  instruct mode a real contrast on the small model.

## Reproduce

    docker compose -f docker/compose.yaml up -d llama-tb phoenix lab
    npm run worker -- run --pool datasets/catch22-mode-topics.jsonl \
      --provider llama --family reasoning --maxTokens 3072
    node src/status.js                # read only progress
    npm run gui                       # rebuild gui/data.json
    open http://127.0.0.1:3030        # live matrix
