import { useEffect, useRef, useState, useCallback } from "react";
import * as webllm from "@mlc-ai/web-llm";

const MODEL_ID = "Llama-3.1-8B-Instruct-q4f16_1-MLC";

export const AVAILABLE_MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",   label: "Llama 3.2 1B",    size: "~0.8 GB" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",   label: "Llama 3.2 3B",    size: "~1.8 GB" },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC",   label: "Phi 3.5 Mini 3.8B", size: "~2.2 GB" },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",   label: "Llama 3.1 8B",    size: "~4.5 GB" },
  { id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",     label: "Qwen 2.5 7B",     size: "~4.2 GB" },
  { id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", label: "Mistral 7B",     size: "~4.2 GB" },
];
export const STREAMING_ENTRY_ID = "__streaming__";

const VALID_DISPOSITIONS = new Set(["friendly", "neutral", "hostile"]);

function parseGMResponse(text) {
  const entries = [];
  const newChars = [];
  const killedNames = [];
  const lines = text.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const storyMatch = line.match(/^\[STORY\]\s*(.+)/i);
    if (storyMatch) {
      entries.push({ id: Date.now() + Math.random(), type: "story", text: storyMatch[1].trim() });
      continue;
    }

    const sayMatch = line.match(/^\[SAY:([^\]]+)\]\s*(.+)/i);
    if (sayMatch) {
      entries.push({
        id: Date.now() + Math.random(),
        type: "say",
        character: sayMatch[1].trim(),
        text: sayMatch[2].replace(/^"|"$/g, "").trim(),
      });
      continue;
    }

    const doMatch = line.match(/^\[DO:([^\]]+)\]\s*(.+)/i);
    if (doMatch) {
      entries.push({
        id: Date.now() + Math.random(),
        type: "do",
        character: doMatch[1].trim(),
        text: doMatch[2].replace(/^\*|\*$/g, "").trim(),
      });
      continue;
    }

    // [NEW_CHAR:name|role|disposition|note]
    const newCharMatch = line.match(/^\[NEW_CHAR:([^\]]+)\]/i);
    if (newCharMatch) {
      const parts = newCharMatch[1].split("|").map((s) => s.trim());
      const [name, role, gender, disposition, ...noteParts] = parts;
      if (name && role) {
        newChars.push({
          id: Date.now() + Math.random(),
          name,
          role: role || "Unknown",
          avatar: "🧑",
          gender: gender || "",
          disposition: VALID_DISPOSITIONS.has(disposition) ? disposition : "neutral",
          note: noteParts.join("|") || "",
        });
      }
      continue;
    }

    // [KILL:CharName]
    const killMatch = line.match(/^\[KILL:([^\]]+)\]/i);
    if (killMatch) {
      killedNames.push(killMatch[1].trim());
      continue;
    }

    // Fallback: unrecognised line becomes a story entry
    if (line.length > 5) {
      entries.push({ id: Date.now() + Math.random(), type: "story", text: line });
    }
  }

  // Guarantee at least one entry so the placeholder is always replaced
  if (entries.length === 0) {
    entries.push({ id: Date.now(), type: "story", text: text.trim() });
  }

  return { entries, newChars, killedNames };
}

export function useLLM() {
  const [status, setStatus] = useState("uninitialized");
  const [progress, setProgress] = useState(0);
  const [modelId, setModelId] = useState(MODEL_ID);
  const engineRef = useRef(null);
  const historyRef = useRef([]);
  // Keep a ref to status so the generate callback always sees current value
  const statusRef = useRef("uninitialized");

  useEffect(() => {
    const engine = new webllm.MLCEngine();
    engineRef.current = engine;

    engine.setInitProgressCallback((report) => {
      setProgress(report.progress ?? 0);
    });

    setStatus("loading");
    statusRef.current = "loading";

    engine
      .reload(MODEL_ID, { temperature: 0.9, top_p: 0.95 })
      .then(() => {
        setStatus("ready");
        statusRef.current = "ready";
      })
      .catch((err) => {
        console.error("web-llm engine init failed:", err);
        setStatus("error");
        statusRef.current = "error";
      });
  }, []);

  const generate = useCallback(async (userMessage, callbacks) => {
    if (statusRef.current !== "ready") return;

    const { onPlaceholder, onChunk, onComplete, onError } = callbacks;

    historyRef.current.push({ role: "user", content: userMessage });
    console.debug("[YCDA] Prompt →", userMessage);
    onPlaceholder(STREAMING_ENTRY_ID);

    setStatus("generating");
    statusRef.current = "generating";

    try {
      let accumulated = "";

      const completion = await engineRef.current.chat.completions.create({
        stream: true,
        messages: historyRef.current,
        stream_options: { include_usage: true },
      });

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onChunk(STREAMING_ENTRY_ID, accumulated);
        }
      }

      const finalMessage = await engineRef.current.getMessage();
      historyRef.current.push({ role: "assistant", content: finalMessage });

      console.debug("[YCDA] Raw response →\n" + finalMessage);
      const { entries, newChars, killedNames } = parseGMResponse(finalMessage);
      console.debug("[YCDA] Parsed entries →", entries);
      if (newChars.length > 0)    console.debug("[YCDA] New characters →", newChars);
      if (killedNames.length > 0) console.debug("[YCDA] Killed →", killedNames);
      onComplete(STREAMING_ENTRY_ID, entries, newChars, killedNames);
    } catch (err) {
      console.error("web-llm generation error:", err);
      onError(err);
    } finally {
      setStatus("ready");
      statusRef.current = "ready";
    }
  }, []);

  const revertLast = useCallback(() => {
    if (historyRef.current.at(-1)?.role === "assistant") historyRef.current.pop();
    if (historyRef.current.at(-1)?.role === "user")      historyRef.current.pop();
  }, []);

  const setSystemPrompt = useCallback((prompt) => {
    historyRef.current = [{ role: "system", content: prompt }];
  }, []);

  const switchModel = useCallback(async (newModelId) => {
    if (statusRef.current !== "ready") return;
    setStatus("loading");
    statusRef.current = "loading";
    setProgress(0);
    try {
      await engineRef.current.reload(newModelId, { temperature: 0.9, top_p: 0.95 });
      setModelId(newModelId);
      setStatus("ready");
      statusRef.current = "ready";
    } catch (err) {
      console.error("web-llm model switch failed:", err);
      setStatus("error");
      statusRef.current = "error";
    }
  }, []);

  return { status, progress, modelId, generate, revertLast, setSystemPrompt, switchModel };
}
