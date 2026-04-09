import { useEffect, useRef, useState, useCallback } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { buildSystemPrompt } from "../data/systemPrompt";

const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
export const STREAMING_ENTRY_ID = "__streaming__";

const VALID_DISPOSITIONS = new Set(["friendly", "neutral", "hostile"]);

function parseGMResponse(text) {
  const entries = [];
  const newChars = [];
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
      const [name, role, disposition, ...noteParts] = parts;
      if (name && role) {
        newChars.push({
          id: Date.now() + Math.random(),
          name,
          role: role || "Unknown",
          avatar: "🧑",
          disposition: VALID_DISPOSITIONS.has(disposition) ? disposition : "neutral",
          note: noteParts.join("|") || "",
        });
      }
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

  return { entries, newChars };
}

export function useLLM() {
  const [status, setStatus] = useState("uninitialized");
  const [progress, setProgress] = useState(0);
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
        historyRef.current = [{ role: "system", content: buildSystemPrompt() }];
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
      const { entries, newChars } = parseGMResponse(finalMessage);
      console.debug("[YCDA] Parsed entries →", entries);
      if (newChars.length > 0) console.debug("[YCDA] New characters →", newChars);
      onComplete(STREAMING_ENTRY_ID, entries, newChars);
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

  return { status, progress, generate, revertLast };
}
