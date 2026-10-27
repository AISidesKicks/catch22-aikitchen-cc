// Mock provider: no model, no docker, no GPU. Runs the full queue and
// recovery flow offline. Deterministic, tiny latency, no thinking block.

export async function generate({ latencyMs = 20 } = {}, prompt) {
  const started = Date.now();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await delay(latencyMs);
  const mode = prompt.match(/\{REASON:([a-z-]+)\}/i)?.[1] ?? "none";
  return {
    raw: `[mock:${mode}] ${prompt.slice(0, 40)}...`,
    thinking: null,
    answer: `mock reply for mode ${mode}`,
    tokens: 8,
    latencyMs: Date.now() - started,
  };
}
