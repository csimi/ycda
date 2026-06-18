// Thin adapter exposing the web-llm engine subset that useLLM.js uses, backed
// by Chrome's built-in Prompt API (the global `LanguageModel`, a.k.a. Gemini
// Nano). Runs fully on-device with no download managed by us — Chrome ships and
// caches the weights. The shape matches web-llm so engineRef.current can be
// swapped in with no changes to callers.

// `typeof` on an undeclared global is safe and returns "undefined".
export function isPromptApiAvailable() {
  return typeof LanguageModel !== "undefined";
}

// Split the OpenAI-style message list into a single system string (the Prompt
// API takes the system message via `initialPrompts`) and the remaining
// user/assistant turns, which are passed as the prompt input.
function splitMessages(messages) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  return { system, rest };
}

export function createPromptApiEngine() {
  let lastMessage = "";
  let progressCb = null;
  let genAbort = null;  // aborts an in-flight generation
  let loadAbort = null; // aborts an in-flight model download / warm-up
  let contextWindow = null; // session.inputQuota discovered at load, in tokens

  async function makeSession(system, signal, temperature) {
    const opts = {};
    if (system) opts.initialPrompts = [{ role: "system", content: system }];
    // The Prompt API only accepts temperature when topK is also set, and vice
    // versa. Provide a small topK alongside any caller-supplied temperature.
    if (temperature != null) {
      opts.temperature = temperature;
      opts.topK = 8;
    }
    if (signal) opts.signal = signal;
    return await LanguageModel.create(opts);
  }

  async function createCompletion(params) {
    if (!isPromptApiAvailable()) {
      throw new Error("Chrome built-in AI (Prompt API) is not available in this browser.");
    }
    const { system, rest } = splitMessages(params.messages);
    genAbort = new AbortController();
    const session = await makeSession(system, genAbort.signal, params.temperature);

    if (!params.stream) {
      try {
        const text = await session.prompt(rest, { signal: genAbort.signal });
        lastMessage = text;
        return { choices: [{ message: { content: text } }] };
      } finally {
        session.destroy();
      }
    }

    lastMessage = "";
    const stream = session.promptStreaming(rest, { signal: genAbort.signal });
    return {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const chunk of stream) {
            // The Prompt API streams deltas (the new text only), matching the
            // chunk shape useLLM.js expects from web-llm.
            lastMessage += chunk;
            yield { choices: [{ delta: { content: chunk } }] };
          }
        } finally {
          session.destroy();
        }
      },
    };
  }

  return {
    chat: { completions: { create: createCompletion } },
    getMessage: async () => lastMessage,
    interruptGenerate: () => { genAbort?.abort(); },
    unload: async () => { genAbort?.abort(); loadAbort?.abort(); },
    setInitProgressCallback: (cb) => { progressCb = cb; },
    // "Loading" for the Prompt API means: warm up a throwaway session so Chrome
    // fetches the weights if needed, tracking progress via the monitor.
    //
    // Chrome requires transient user activation (a click) to START a Gemini Nano
    // download. `LanguageModel.create()` must therefore be the FIRST async call
    // here — any preceding `await` (e.g. an availability() pre-check) spends the
    // gesture and Chrome rejects create() with "Requires a user gesture…". This
    // is why reload() is only ever invoked from a click-driven model switch.
    reload: async () => {
      if (!isPromptApiAvailable()) {
        throw new Error("Chrome built-in AI is not available. Use Chrome with the Prompt API enabled (chrome://flags).");
      }
      progressCb?.({ progress: 0, text: "fetch" });
      loadAbort = new AbortController();
      let session;
      try {
        session = await LanguageModel.create({
          signal: loadAbort.signal,
          monitor(monitorInstance) {
            monitorInstance.addEventListener("downloadprogress", (event) => {
              progressCb?.({ progress: event.loaded ?? 0, text: "fetch" });
            });
          },
        });
      } catch (err) {
        // Surface the model-unavailable case with a clearer message; rethrow the rest.
        if (/unavailable|not.*support|NotSupported/i.test(err?.message || err?.name || "")) {
          throw new Error("Chrome built-in AI model is unavailable on this device.");
        }
        throw err;
      }
      // The real per-session input budget, measured in Gemini Nano's own tokens.
      if (typeof session.inputQuota === "number" && session.inputQuota > 0) {
        contextWindow = session.inputQuota;
      }
      session.destroy();
      progressCb?.({ progress: 1, text: "" });
    },
    getContextWindow: () => contextWindow,
    isPromptApi: true,
  };
}
