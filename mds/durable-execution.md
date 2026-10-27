# Durable execution - research links

Why this page exists: the catch22 lab walks a ~22 cell matrix per prompt
row. Each cell is a fresh chat against the llama.cpp server, a raw reply
plus timing, and the GUI should show the matrix fill in and recover when
the worker is killed mid run. This list is cloned from
[doolally's mds/durable-execution.md](https://github.com/AISidesKicks/doolally-trollino-rodeo/blob/master/mds/durable-execution.md)
with catch22-specific notes appended.

## The core idea

- Commit intent before doing work. If the process dies, reopen the store
  and continue.
- A checkpoint is not a frozen JavaScript stack. On restart the worker
  reruns the cell from its last committed checkpoint.
- Side effects are the hard part. A model call can finish and lose the
  result, which is why replay policy and idempotency keys matter.
- The host still has to supervise and restart the process. Opening SQLite
  again does not restart anything by itself.

## Primary references (Pi Durable)

### alejandro-ao/pi-durable-demo

https://github.com/alejandro-ao/pi-durable-demo

The inspiration for both labs: Node.js 24+, SQLite, llama.cpp, restart
recovery, with `chat-resume.mjs` as the pattern to copy.

### earendil-works/pi - packages/durable

https://github.com/earendil-works/pi/tree/main/packages/durable

- `Harness.open()` over SQLite or JSONL storage; `harness.resume()` picks
  up unfinished runs.
- Tools declare `replay: "safe"` to rerun after a crash.
- `settings.restartLimit` (default 5) parks crashing tasks instead of
  spinning forever.
- `watch()` streams committed state, which maps well to a matrix GUI
  that fills in live.
- Design spec:
  https://github.com/earendil-works/pi/blob/main/packages/durable/docs/spec.md

### vercel-labs/durable-harness

https://github.com/vercel-labs/durable-harness

Adapters that make existing coding agents durable. Comparison material for
replay versus kill-the-process demos.

## SQLite-first / small engines

- https://github.com/danfry1/reflow-ts - SQLite only, checkpointed steps,
  lease expiry.
- https://github.com/RaycarlLei/tool-journal - execution journal with
  intent-before-execution and lease fencing, Node 24, zero runtime deps.
- https://github.com/ahmedrowaihi/iterativeflow - backend agnostic durable
  workflows with outbox commits.
- https://github.com/nimeshnayaju/workerflow - Cloudflare DO based.

## Larger frameworks (vocabulary reference)

- https://github.com/dbos-inc/dbos-transact-ts
- https://github.com/restatedev/examples
- https://github.com/temporalio/samples-typescript
- https://github.com/inngest/inngest
- https://github.com/hatchet-dev/hatchet
- https://github.com/triggerdotdev/trigger.dev
- https://github.com/mastra-ai/mastra

## What to steal for catch22

1. **Intent record first.** Write the (row id, mode family, mode tag) cell
   key to SQLite before the HTTP call.
2. **Cell = unit of commit.** One cell committed before the next starts,
   mirroring doolally's batch commit.
3. **Replay policy.** Model calls are retryable; nothing else in this lab
   has side effects, which keeps replay trivial.
4. **Restart limit.** Park a row after repeated cell crashes and show it
   in the GUI instead of looping.
5. **Single owner per SQLite file.** PID/lock guard while the worker runs.
6. **Recovery visible.** Show recovered cells greyed, then live continue.
7. **Kill script.** SIGKILL at a cell boundary, restart, assert zero lost
   and zero duplicated cells.
8. **Traces.** One span per committed cell with row, mode, token and
   latency attributes (OTLP to Phoenix, no extra npm dependency).

## Catch22 specific replay notes

- Cell key is `(run_id, row_id, family, tag)`. Fresh chat per cell means
  no conversation state to replay, only the reply payload to persist.
- Kill window sits at the same place as doolally: the pause between cells.
  A kill mid HTTP call either resolves as an incomplete attempt row or the
  cell reruns; both are safe because cells are idempotent.
- The optional second llama-server (stock model profile) doubles the
  matrix without changing the durability model: same rows, model column
  added to the cell key.

## Demo script to reproduce

1. Start the worker on the pilot pool.
2. Let it finish 10 to 20 cells.
3. `kill -9` the worker.
4. Restart it.
5. The GUI shows the recovered cells and continues from the last commit.
6. Compare the final SQLite state with the matrix plan: every planned cell
   has exactly one reply row.
