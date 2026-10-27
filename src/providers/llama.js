// llama.cpp provider: OpenAI compatible endpoint, mode tag travels in the
// prompt text. Fresh chat per cell, no conversation state.

const THINK_RE = /<think>([\s\S]*?)<\/think>/i;

export function splitThinking(text) {
  const match = text.match(THINK_RE);
  if (!match) return { thinking: null, answer: text.trim() };
  const thinking = match[1].trim();
  const answer = text.slice(match.index + match[0].length).trim();
  return { thinking, answer };
}

export async function generate(
  {
    baseUrl = "http://127.0.0.1:8081",
    model = "ctch-tb",
    temperature = 0.2,
    topK = 80,
    repetitionPenalty = 1.05,
    maxTokens = 4096,
    timeoutMs = 600_000,
  },
  prompt
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        top_k: topK,
        repetition_penalty: repetitionPenalty,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      throw new Error(`llama.cpp HTTP ${res.status}`);
    }
    const data = await res.json();
    const choice = data.choices?.[0] ?? {};
    const raw = choice.message?.content ?? "";
    const usage = data.usage ?? {};
    const { thinking, answer } = splitThinking(raw);
    return {
      raw,
      thinking,
      answer,
      tokens: usage.completion_tokens ?? null,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
