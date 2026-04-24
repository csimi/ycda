// Thin adapter exposing the web-llm engine subset that useLLM.js uses, backed
// by a plain OpenAI-compatible Chat Completions endpoint. The shape matches
// web-llm so engineRef.current can be swapped in with no changes to callers.

export function createOpenAIEngine({ baseURL, apiKey, model, disableThinking }) {
  // Normalize so `new URL("chat/completions", base)` appends as a sibling path
  // instead of replacing the last segment. "http://host/v1" → "http://host/v1/".
  const base = baseURL.endsWith("/") ? baseURL : baseURL + "/";
  let lastMessage = "";
  let currentAbort = null;

  async function createCompletion(params) {
    const abort = new AbortController();
    currentAbort = abort;

    const body = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      top_p: params.top_p ?? 0.9,
      stream: !!params.stream,
    };
    if (params.max_tokens) body.max_tokens = params.max_tokens;
    // Ollama (and some other OpenAI-compat endpoints) emit `delta.reasoning`
    // chunks for reasoning-capable models and burn the token budget on them
    // before any `delta.content` appears. YCDA wants tagged narrative output,
    // so reasoning is always noise — suppress it when the user opts in.
    if (disableThinking) body.reasoning_effort = "none";

    const endpoint = new URL("chat/completions", base);
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };
    // Anthropic's direct-from-browser opt-in. Only sent when the base URL is
    // Anthropic's — other providers (Ollama in particular) reject unknown
    // headers at the CORS preflight step.
    if (endpoint.hostname === "api.anthropic.com") {
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: abort.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`OpenAI API ${response.status}: ${text || response.statusText}`);
    }

    if (!params.stream) {
      const json = await response.json();
      lastMessage = json.choices?.[0]?.message?.content ?? "";
      return json;
    }

    lastMessage = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;

    return {
      [Symbol.asyncIterator]() {
        return {
          next: async () => {
            while (!streamDone) {
              const nl = buffer.indexOf("\n");
              if (nl === -1) {
                const chunk = await reader.read();
                if (chunk.done) { streamDone = true; break; }
                buffer += decoder.decode(chunk.value, { stream: true });
                continue;
              }
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") { streamDone = true; break; }
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) lastMessage += delta;
                return { value: parsed, done: false };
              } catch {
                // Ignore malformed SSE chunks; some providers emit heartbeats.
              }
            }
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  return {
    chat: { completions: { create: createCompletion } },
    getMessage: async () => lastMessage,
    interruptGenerate: () => { currentAbort?.abort(); },
    unload: async () => { currentAbort?.abort(); },
    setInitProgressCallback: () => {},
    reload: async () => {},
    isCustom: true,
  };
}
