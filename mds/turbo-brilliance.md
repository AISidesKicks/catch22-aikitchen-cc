# Turbo Brilliance deep dive - the family, the variants, the modes

How to read this: the goal of the site is to **contrast the variants**, not
just demo one. This note maps the whole family so we know what we can claim
to an audience with each model they could download themselves. The stub line
before this rewrite said "research it up to 50x", so this is that research,
up to 50x.

## What Turbo Brilliance actually is

DavidAU (David Belton) takes open weight base models (LiquidAI LFM2.5,
Qwen 3.8, Gemma, Mistral, Nemotron and so on) and fine tunes a **prompt
activated mode grammar** into them:

- `{REASON:omni}` runs the task in reasoning mode `omni`
- `{REASON:iomni}` runs the same mode in instruct mode (fast, thinking skipped)
- `{REASON:off}` restores stock behavior
- `{REASON:help}` asks the model itself to print the menu and recommend modes

Under the hood this is behavioral prompt priming baked in at fine tune time:
"hundreds to thousands of tokens" of structured instructions get expanded
before generation starts. It is fast (milliseconds), it needs no app support
beyond sending text, and it is **not** a real search algorithm on top of the
model. Tree of thought output in `deeptree` is roleplay of the method, not
actual branching search. Keep that honest caveat in every comparison.

The self reported goal: cut regens and token waste, "50x reasoning /
instruct", one shot or two shot quality as the standard.

## The released family (as of Oct 2026)

Source: [Turbo Brilliance collection](https://huggingface.co/collections/DavidAU/turbo-brilliance-ai-constructs-50x-reasoning-instruct).
All Apache 2.0 GGUF except where noted; the cards are long, mode tables inside.

| Model | Arch | Size | Modes | Extra tech | Context max |
| --- | --- | --- | --- | --- | --- |
| [LFM2.5-2.6B X12](https://huggingface.co/DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | dense | 2.69B | 12 reasoning + 12 instruct | help system | 131k |
| [LFM2.5-8B-A1B X12](https://huggingface.co/DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF) | sparse MOE 32e/4a, 1B active | 8.3B | 12 reasoning (+instruct) | help system | 131k |
| [LFM2.5-24B-A2B 50X](https://huggingface.co/DavidAU/LFM2.5-24B-A2B-Turbo-Brilliance-50X-NEO-MAX-Imatrix-GGUF) | sparse MOE 64e/4a, 2B active | 24B | 27 reasoning ("LFM does not support instruct 27 modes, NOR x high modes") | 15 AI constructs, help | 131k |
| [Qwen3.8-27B 50X MTP](https://huggingface.co/DavidAU/Qwen3.8-27B-Turbo-Brilliance-50X-Reasoning-Instruct-NEO-MAX-MTP-GGUF) | dense (MTP quants) | 27B | 27 reasoning + 27 instruct + 9 xhigh + 8 combined xhigh | 15 AI constructs, 3 level help, tool calling hardened | 266k |
| [Qwen3.8-27B Jumbo Fusion IQ-747-900 50X MTP](https://huggingface.co/DavidAU/Qwen3.8-27B-Jumbo-Fusion-IQ-747-900-Turbo-Brilliance-50X-Reasoning-Instruct-NEO-MAX-MTP-GGUF) | dense fusion/merge | 27B | same as 27B | fusion of Qwen3.8 checkpoints | 266k |
| [Qwen3.8-Flash-Next 50x GSQ-RCO](https://huggingface.co/DavidAU/Qwen3.8-Flash-Next-Turbo-Brilliance-50x-Reasoning-Instruct-GSQ-RCO-GGUF) | dense 177B | 177B | 50x core | GSQ-RCO quants | large |
| [Qwen3.8-Flash-Next Abliterated variant](https://huggingface.co/DavidAU/Qwen3.8-Flash-Next-Abliterated-Uncensored-Turbo-Brilliance-50x-Reasoning-Instruct-GSQ-RCO-GGUF) | dense 177B, uncensored | 177B | 50x core | same, abliterated | large |
| [Nemotron 3.5 Bolt 74B-A9B 50x](https://huggingface.co/DavidAU/NVIDIA-Nemotron-3.5-Bolt-Turbo-Brilliance-50x-74B-A9B-24GB-GGUF) | sparse MOE | 74B (9B active) | 50x core | sized for one 24 GB GPU | large |

Work in progress at the time of writing: Qwen3.8-27B and 40B "Ultimate
Heretic" uncensored tunes and a 31B looping transformer. Also related: the
9B super tune [The Defiant Fable](https://huggingface.co/DavidAU/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF)
carries a few of the constructs (spoon, einstein) and is the proof that the
system "comes alive" at 9B.

## The two generations: X12 vs 50X

| Axis | Generation 1: X12 (our model) | Generation 2: 50X |
| --- | --- | --- |
| Mode count | 12 | 27 (Qwen adds 27 instruct + 9 xhigh) |
| Core reasoning set | omni, deeptree, hyper, socrates, logic, einstein, spoon | same, all kept |
| Effort ladder | ultra, high, medium, medium-low, low | same + xultra + Qwen native xhigh/medium/low |
| Personas / "supers" | none | holodeck, prompt, pkd, musk, curie, neo, stark, matlock, house, vader, joker, quinn, joe, 007, brainstorm, business, coder, comedy, story, teacher |
| AI Constructs | none | 15 constructs, each 2000 to 4000+ engineered persona tokens, 5 "super" ones |
| xhigh combos | none | xomni, xdeeptree, xhyper, xsocrates, xlogic, xeinstein, xspoon, xhelp |
| Help menu | `{REASON:help}` one level | `{REASON:help}` / `ihelp` / `xhelp` three levels |
| Status | BETA V1.0, "tier 1 of five tiers" | hardened, tools/agents tested, "tier 1" of the newer line |
| Where | LFM2.5 family | Qwen 3.8 family + LFM 24B |

The 27 mode list as the LFM 24B help menu prints it: omni, deeptree, hyper,
socrates, logic, einstein, spoon, xultra, ultra, high, medium, low,
holodeck, prompt, pkd, musk, joker, vader, quinn, joe, neo, curie,
brainstorm, comedy, business, story, teacher, 007, coder, stark, matlock,
house, plus off and help.

### The 12 X12 modes in detail (our demo matrix)

| Mode | One line | Best matched use case |
| --- | --- | --- |
| omni | multi dimension holistic pass | strategy, multi variable problems |
| deeptree | recursive tree of thought decomposition | root cause, planning |
| hyper | MECE breakdown | segmentation, audits, exhaustive coverage |
| socrates | probe assumptions by question | critical thinking, interview prep |
| logic | first principles axioms | debugging, verification, policy |
| einstein | 20 perspective agents brainstorm, "show the work of all agents" for detail | ideation, novelty |
| spoon | 5 expert panel research, "show the work of all panelists" for detail | research synthesis |
| ultra | absolute perfection chase | high stakes, final deliverables |
| high | thorough but balanced | professional default (its the reasoning default) |
| medium | efficient and structured | quick pro answers (instruct default) |
| medium-low | speed first | warm ups, drafts |
| low | minimal tokens | instant factual answers |

## Quant system in the family names

- **NEO Imatrix**: importance matrix quant, the standard release quant.
- **MAX**: the output tensor (10 to 20 percent of weights) stays BF16 full
  precision, plus MTP tensors at Q8 on MTP models. Strongest option.
- **MTP**: multi-token prediction weights shipped for speculative style
  speedups where the runtime supports it.
- **GSQ-RCO**: brutally compressed but re tuned quants (see
  [ISTA-DASLab example](https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF)),
  aimed at near full precision feel at small sizes.

Practical rule across all cards: **quant level gates mode power**. Q8 gives
1.5 to 2x the strength of Q6, Q6 gives 2x+ over Q4/IQ4. Personas and
constructs suffer first at low quants. For our 8B-A1B demo: IQ4_XS around
5 GB, Q4_K_M 5.5 GB, Q6_K 7 GB, Q8_0 9 GB, BF16 17 GB.

## Sampler settings per card

- LFM2.5 X12 (8B): temp 0.2 to 1, topK 64 to 80, minp 0.05, topp 0.95,
  rep pen 1 (off) in DavidAU runs, 1.05 in LiquidAI stock docs.
- LFM2.5 24B 50X: temp 0.5 to 0.7, rep pen 1 to 1.05, same topK set.
- Qwen3.8 27B: temp 0.5 to 1, tools at temp 0.6 to 0.7.
- Context: minimum 24k everywhere, 32k+ for the 50X models, 64k to 128k
  for multi turn. "No caching" suggested on the X12 beta cards.
- New chat per mode switch, and one regen to clear app-side caches.

## Execution notes (llama.cpp first)

- All family cards document unmodified llama.cpp usage end to end:
  `llama serve -hf <repo>:<quant>`, OpenAI compatible endpoint, tags travel
  inside normal prompt text. Verified in practice by the previous lab
  (llama.cpp server 0.7.0-dev build 11870, RTX 4070, LFM2.5-8B-A1B).
- LM Studio, Jan, Ollama, vLLM, SGLang, Docker Model Runner all listed on
  the same cards, so the demo claims survive any runtime the visitor has.
- MTP quants: speculative decoding needs the runtime to support it
  (llama.cpp uses DSpark sidecars with `-hfd`; plain MTP tensor use in the
  27B MAX quants is card claimed, verify at run time before promising it).
- The `n_expert_used` slice (4 of 32, 4 of 64) is model metadata driven;
  some apps let you crank experts up, DavidAU suggests higher expert counts
  lift quality in some modes.

## What we can honestly claim with our 22 matrix demo

1. Prompt grammar works the same in CLI chat, plain HTTP and the OpenAI
   API. Zero patches, any stack. Demo every cell over the same endpoint.
2. X12 vs 50X is a clean "generation" contrast: 12 structural modes vs
   27 modes + constructs + xhigh combos + 256k context. Our 8B X12 run is
   the affordable baseline; a 24B-A2B 50X or 27B 50X run later shows what
   more parameters buy.
3. Instruct vs reasoning per mode name shows the latency/depth teeth of
   the system: same tag prefix `i`, ~filtered thinking, faster.
4. Quant ladder on the same hardware gives the strongest "pick your
   pocket" message: IQ4 vs Q6 vs Q8 at the same modes.
5. stock LFM2.5-8B-A1B as a control shows exactly what the Brilliance
   fine tune adds over the base SOTA model.

## Open questions for the lab

- Does `medium-low` exist as its own token sequence on the 8B X12 (the
  card lists it, the help menu should confirm live)?
- Are instruct variants (`i` prefix) walked for all 12 on the 8B, or only
  the 5 generalist ones? The 2.6B card says 12+12, the 8B card text is
  garbled there. `{REASON:help}` live run resolves this.
- LFM arch vs Qwen arch on xhigh support matters only when we jump sizes;
  noted above, leave xhigh out of v1.

## Sources

- https://huggingface.co/DavidAU/LFM2.5-8B-A1B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF
- https://huggingface.co/DavidAU/LFM2.5-2.6B-Qwen3.8-Turbo-Brilliance-Power-X12-NEO-MAX-GGUF
- https://huggingface.co/DavidAU/LFM2.5-24B-A2B-Turbo-Brilliance-50X-NEO-MAX-Imatrix-GGUF
- https://huggingface.co/DavidAU/Qwen3.8-27B-Turbo-Brilliance-50X-Reasoning-Instruct-NEO-MAX-MTP-GGUF
- https://huggingface.co/collections/DavidAU/turbo-brilliance-ai-constructs-50x-reasoning-instruct
- https://docs.liquid.ai/lfm/inference/llama-cpp (LiquidAI llama.cpp guide)
- https://doolally.trollino.rodeo/ (previous lab: same model family, same llama.cpp runtime)
