import { useEffect, useRef, useState, useCallback } from "react";
import * as webllm from "@mlc-ai/web-llm";

const MODEL_ID = "Llama-3.1-8B-Instruct-q4f16_1-MLC";
const MAX_HISTORY_PAIRS = 8; // trigger compaction after 8 user/assistant pairs
const KEEP_RECENT_PAIRS = 4; // always preserve the last 4 pairs verbatim

async function compactHistory(history, engine) {
  const system = history[0];
  const messages = history.slice(1);
  if (messages.length <= MAX_HISTORY_PAIRS * 2) return { history, compacted: false };

  const toSummarize = messages.slice(0, messages.length - KEEP_RECENT_PAIRS * 2);
  const toKeep     = messages.slice(messages.length - KEEP_RECENT_PAIRS * 2);

  // Build a plain-text transcript of the messages to summarize
  const transcript = toSummarize.map((m) => {
    if (m.role === "user")      return `Player: ${m.content}`;
    if (m.role === "assistant") return `GM: ${m.content}`;
    return "";
  }).filter(Boolean).join("\n\n");

  console.debug("[YCDA] Compacting context — requesting summary…");
  const result = await engine.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a precise story summarizer. Summarize the following game transcript into 4–6 sentences. Preserve: character locations, key decisions, NPC dispositions, and any plot-critical facts. Be specific. Output plain prose only — no tags, no bullet points.",
      },
      { role: "user", content: transcript },
    ],
    temperature: 0.2,
    top_p: 0.9,
  });

  const summary = result.choices[0].message.content.trim();
  console.debug("[YCDA] Context summary →", summary);

  return {
    history: [
      system,
      { role: "user",      content: `[Story so far — earlier events summarized]: ${summary}` },
      { role: "assistant", content: "[Understood. Continuing from this point.]" },
      ...toKeep,
    ],
    compacted: true,
    summary,
  };
}

export const AVAILABLE_MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",   label: "Llama 3.2 1B",    size: "~0.8 GB" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",   label: "Llama 3.2 3B",    size: "~1.8 GB" },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC",   label: "Phi 3.5 Mini 3.8B", size: "~2.2 GB" },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",   label: "Llama 3.1 8B",    size: "~4.5 GB" },
  { id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",     label: "Qwen 2.5 7B",     size: "~4.2 GB" },
  { id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", label: "Mistral 7B",     size: "~4.2 GB" },
];
export const STREAMING_ENTRY_ID = "__streaming__";

const REFUSAL_RE = [
  /\bI (can't|cannot|won't|will not|am unable to|must decline|refuse to)\b/i,
  /\bI('m| am) (sorry|afraid)\b/i,
  /\bas an? (AI|language model|assistant)\b/i,
  /\bI'?m not able\b/i,
  /\bI apologize\b/i,
];

function isRefusal(text) {
  // No valid tags at all → not following the format → treat as refusal
  if (!/^\[(STORY|SAY:|DO:|NEW_CHAR:|KILL:)/m.test(text)) return true;
  return REFUSAL_RE.some((re) => re.test(text));
}

const VALID_DISPOSITIONS = new Set(["friendly", "neutral", "hostile"]);

function parseGMResponse(text) {
  const entries = [];
  const newChars = [];
  const killedNames = [];
  const revivedNames = [];
  const dispositionChanges = [];
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
      const [rawName, role, gender, disposition, ...noteParts] = parts;
      // Strip any role/job suffix the model appended to the name (e.g. "Brynhild, Barkeeper")
      const name = rawName.split(/[,\-–]/)[0].trim();
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

    // [REVIVE:CharName]
    const reviveMatch = line.match(/^\[REVIVE:([^\]]+)\]/i);
    if (reviveMatch) {
      revivedNames.push(reviveMatch[1].trim());
      continue;
    }

    // [DISPOSITION:CharName|friendly|neutral|hostile]
    const dispMatch = line.match(/^\[DISPOSITION:([^\]|]+)\|([^\]]+)\]/i);
    if (dispMatch) {
      const disp = dispMatch[2].trim().toLowerCase();
      if (VALID_DISPOSITIONS.has(disp)) {
        dispositionChanges.push({ name: dispMatch[1].trim(), disposition: disp });
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

  return { entries, newChars, killedNames, revivedNames, dispositionChanges };
}

export function useLLM() {
  const [status, setStatus] = useState("uninitialized");
  const [progress, setProgress] = useState(0);
  const [modelId, setModelId] = useState(MODEL_ID);
  const engineRef = useRef(null);
  const historyRef = useRef([]);
  const statusRef = useRef("uninitialized");
  const cancelledRef = useRef(false);

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

    const { onPlaceholder, onChunk, onComplete, onError, onCompact } = callbacks;

    const { history: compacted, compacted: wasCompacted, summary } = await compactHistory(historyRef.current, engineRef.current);
    historyRef.current = compacted;
    if (wasCompacted) onCompact?.(summary);

    historyRef.current.push({ role: "user", content: userMessage });
    console.debug("[YCDA] Prompt →", userMessage);
    onPlaceholder(STREAMING_ENTRY_ID);

    setStatus("generating");
    statusRef.current = "generating";

    cancelledRef.current = false;
    let committed = false;

    try {
      let attempt = 0;

      while (!cancelledRef.current) {
        attempt++;
        let accumulated = "";

        const completion = await engineRef.current.chat.completions.create({
          stream: true,
          messages: historyRef.current,
          stream_options: { include_usage: true },
        });

        for await (const chunk of completion) {
          if (cancelledRef.current) continue; // drain silently — don't break mid-stream
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            onChunk(STREAMING_ENTRY_ID, accumulated);
          }
        }

        if (cancelledRef.current) break; // stream fully drained, safe to exit now

        const finalMessage = await engineRef.current.getMessage();
        console.debug(`[YCDA] Raw response (attempt ${attempt}) →\n` + finalMessage);

        if (isRefusal(finalMessage)) {
          console.debug(`[YCDA] Refusal detected — retrying (attempt ${attempt})…`);
          onChunk(STREAMING_ENTRY_ID, "…");
          continue;
        }

        historyRef.current.push({ role: "assistant", content: finalMessage });
        committed = true;
        const { entries, newChars, killedNames, revivedNames, dispositionChanges } = parseGMResponse(finalMessage);
        console.debug("[YCDA] Parsed entries →", entries);
        if (newChars.length > 0)          console.debug("[YCDA] New characters →", newChars);
        if (killedNames.length > 0)       console.debug("[YCDA] Killed →", killedNames);
        if (revivedNames.length > 0)      console.debug("[YCDA] Revived →", revivedNames);
        if (dispositionChanges.length > 0) console.debug("[YCDA] Disposition changes →", dispositionChanges);
        onComplete(STREAMING_ENTRY_ID, entries, newChars, killedNames, revivedNames, dispositionChanges);
        return;
      }

      onError(new Error("cancelled"));
    } catch (err) {
      console.error("web-llm generation error:", err);
      onError(err);
    } finally {
      // If we never committed an assistant reply, the user message is dangling — remove it
      if (!committed && historyRef.current.at(-1)?.role === "user") {
        historyRef.current.pop();
      }
      cancelledRef.current = false;
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

  const cancel = useCallback(() => {
    cancelledRef.current = true;
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

  return { status, progress, modelId, generate, revertLast, setSystemPrompt, switchModel, cancel };
}
