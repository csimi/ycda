import { useEffect, useRef, useState, useCallback } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { estimateTokenCount } from "tokenx";
import { distance } from "fastest-levenshtein";

const MODEL_ID = "Llama-3.1-8B-Instruct-q4f16_1-MLC";

// Tokens reserved for the model's own output
const GENERATION_BUDGET = 384;
// Compact when history exceeds this fraction of available context
const COMPACTION_RATIO = 0.90;
// After compaction, fill history to only this fraction — leaves headroom so the
// next compaction doesn't trigger immediately on the following turn
const POST_COMPACT_RATIO = 0.65;
// Estimated token overhead for the synthetic summary exchange injected after compaction
const SUMMARY_OVERHEAD = 256;

// Per-message overhead: role header + framing tokens (rough estimate)
const MSG_OVERHEAD = 4;

function estimateHistoryTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokenCount(m.content ?? "") + MSG_OVERHEAD, 0);
}

async function compactHistory(history, engine, contextWindow) {
  const system = history[0];
  const messages = history.slice(1);

  const totalTokens = estimateHistoryTokens(history);
  const availableBudget = contextWindow - GENERATION_BUDGET;

  if (totalTokens <= availableBudget * COMPACTION_RATIO) return { history, compacted: false };

  console.debug(`[YCDA] Token usage ${totalTokens}/${contextWindow} — compacting…`);

  // Determine how many recent pairs fit in the post-compaction budget
  const systemTokens = estimateHistoryTokens([system]);
  const recentBudget = availableBudget * POST_COMPACT_RATIO - systemTokens - SUMMARY_OVERHEAD;

  const toKeep = [];
  let usedTokens = 0;
  // Walk backwards through pairs (assistant at odd index, user at even)
  for (let i = messages.length - 1; i >= 1; i -= 2) {
    const pair = [messages[i - 1], messages[i]];
    const pairTokens = estimateHistoryTokens(pair);
    if (usedTokens + pairTokens > recentBudget) break;
    toKeep.unshift(...pair);
    usedTokens += pairTokens;
  }

  // Always keep at least the last exchange
  if (toKeep.length === 0) toKeep.push(...messages.slice(-2));

  const toSummarize = messages.slice(0, messages.length - toKeep.length);
  if (toSummarize.length === 0) return { history, compacted: false };

  // Build a plain-text transcript of the messages to summarize
  const transcript = toSummarize.map((m) => {
    if (m.role === "user")      return `Player: ${m.content}`;
    if (m.role === "assistant") return `Narrator: ${m.content}`;
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

  // firstSurvivedOrigIdx: the original history index of the first kept message.
  // Used by the caller to rebase entryBatchesRef indices after compaction.
  const firstSurvivedOrigIdx = 1 + (messages.length - toKeep.length);

  return {
    history: [
      system,
      { role: "user",      content: `[Story so far — earlier events summarized]: ${summary}` },
      { role: "assistant", content: "[Understood. Continuing from this point.]" },
      ...toKeep,
    ],
    compacted: true,
    summary,
    firstSurvivedOrigIdx,
  };
}

export const AVAILABLE_MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",    label: "Llama 3.2 1B",      size: "~0.8 GB", contextWindow: 4096 },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",    label: "Llama 3.2 3B",      size: "~1.8 GB", contextWindow: 4096 },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC",    label: "Phi 3.5 Mini 3.8B", size: "~2.2 GB", contextWindow: 4096 },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",    label: "Llama 3.1 8B",      size: "~4.5 GB", contextWindow: 4096 },
  { id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",      label: "Qwen 2.5 7B",       size: "~4.2 GB", contextWindow: 4096 },
  { id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", label: "Mistral 7B",        size: "~4.2 GB", contextWindow: 4096 },
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

function closestRosterName(name, roster) {
  if (!roster.length) return name;
  const lower = name.toLowerCase();
  let best = null, bestDist = Infinity;
  for (const r of roster) {
    const d = distance(lower, r.toLowerCase());
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return bestDist <= 2 && bestDist < name.length / 2 ? best : name;
}

// Strip leading/trailing brackets that the model sometimes adds.
// Opening bracket is optional so "text]." is also cleaned.
function stripBrackets(s) {
  const m = s.match(/^\[?(.+)\][.,!?…]*$/);
  return m ? m[1].trim() : s.trim();
}

// When the model stuffs pipe-separated metadata into a SAY/DO name field,
// extract the actual character name (first segment) and the text (last segment).
// Falls back to the normal split when no pipes are present.
function extractNameAndText(rawName, afterBracket) {
  const parts = rawName.split("|").map((s) => s.trim());
  if (parts.length === 1) {
    // Normal case: name is clean, text comes after the closing bracket
    return { name: rawName.trim(), text: afterBracket?.trim() ?? "" };
  }
  // Pipe-stuffed case: first segment = name, last segment = text
  return { name: parts[0], text: parts[parts.length - 1] };
}

function parseNarratorResponse(text, roster = []) {
  const entries = [];
  const newChars = [];
  const lines = text.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const storyMatch = line.match(/^\[STORY\]\s*(.+)/i);
    if (storyMatch) {
      entries.push({ id: Date.now() + Math.random(), type: "story", text: storyMatch[1].trim(), _raw: line });
      continue;
    }

    // SAY/DO: text after ] is optional — the model sometimes stuffs pipe-separated
    // NEW_CHAR metadata into the name field, e.g. [SAY:Name|role|...|actual text]
    const sayMatch = line.match(/^\[SAY:([^\]]+)\](?:\s*(.+))?/i);
    if (sayMatch) {
      const { name: sayName, text: sayText } = extractNameAndText(sayMatch[1], sayMatch[2]);
      if (sayText) {
        entries.push({
          id: Date.now() + Math.random(),
          type: "say",
          character: closestRosterName(sayName, roster),
          text: stripBrackets(sayText.replace(/^"|"$/g, "")),
          _raw: line,
        });
        continue;
      }
    }

    const doMatch = line.match(/^\[DO:([^\]]+)\](?:\s*(.+))?/i);
    if (doMatch) {
      const { name: doName, text: doText } = extractNameAndText(doMatch[1], doMatch[2]);
      if (doText) {
        entries.push({
          id: Date.now() + Math.random(),
          type: "do",
          character: closestRosterName(doName, roster),
          text: stripBrackets(doText.replace(/^\*|\*$/g, "")),
          _raw: line,
        });
        continue;
      }
    }

    // [NEW_CHAR:name|role|gender|disposition|note]
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

    // Fallback: unrecognised line becomes a story entry.
    // Strip outer brackets the model sometimes uses for stage-direction style lines,
    // e.g. "[Bryn looks around nervously]" → "Bryn looks around nervously"
    if (line.length > 5) {
      const text = stripBrackets(line);
      entries.push({ id: Date.now() + Math.random(), type: "story", text, _raw: line });
    }
  }

  // Guarantee at least one entry so the placeholder is always replaced
  if (entries.length === 0) {
    entries.push({ id: Date.now(), type: "story", text: text.trim(), _raw: text.trim() });
  }

  return { entries, newChars };
}

function buildBriefingPayload({ description, characters, npcs, extraContext }) {
  const lines = [];
  if (description) lines.push(`Story premise: ${description}`);
  if (characters?.length) {
    lines.push("\nParty:");
    for (const c of characters) {
      lines.push(`  ${c.name} (${c.class ?? c.role ?? "character"}${c.gender ? `, ${c.gender}` : ""})`);
    }
  }
  if (npcs?.length) {
    lines.push("\nNPCs:");
    for (const n of npcs) {
      lines.push(`  ${n.name} — ${n.role}${n.note ? `. ${n.note}` : ""}`);
    }
  }
  if (extraContext?.length) {
    lines.push("\nExtra context:");
    for (const { label, value } of extraContext) {
      lines.push(`  ${label}: ${value}`);
    }
  }
  return lines.join("\n");
}

export function useLLM() {
  const [status, setStatus] = useState("uninitialized");
  const [progress, setProgress] = useState(0);
  const [modelId, setModelId] = useState(MODEL_ID);
  const engineRef = useRef(null);
  const historyRef = useRef([]);
  const rosterRef = useRef([]);
  const statusRef = useRef("uninitialized");
  const cancelledRef = useRef(false);
  // Tracks which history assistant message each batch of AI entries came from.
  // Each item: { histIdx: number, items: Array<{ id, raw: string }> }
  const entryBatchesRef = useRef([]);
  const contextWindowRef = useRef(
    AVAILABLE_MODELS.find((m) => m.id === MODEL_ID)?.contextWindow ?? 4096
  );

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

    const { history: compacted, compacted: wasCompacted, summary, firstSurvivedOrigIdx } = await compactHistory(historyRef.current, engineRef.current, contextWindowRef.current);
    historyRef.current = compacted;
    if (wasCompacted) {
      onCompact?.(summary);
      // Rebase entryBatchesRef: drop batches that were summarized, shift survivors.
      // After compaction the kept messages start at index 3 (system + 2 synthetic summary messages).
      entryBatchesRef.current = entryBatchesRef.current
        .filter((b) => b.histIdx >= firstSurvivedOrigIdx)
        .map((b) => ({ ...b, histIdx: b.histIdx - firstSurvivedOrigIdx + 3 }));
    }

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
          repetition_penalty: 1.2,
          max_tokens: GENERATION_BUDGET,
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

        const assistantHistIdx = historyRef.current.length;
        historyRef.current.push({ role: "assistant", content: finalMessage });
        committed = true;
        const { entries, newChars } = parseNarratorResponse(finalMessage, rosterRef.current);
        // Record batch so pruneEntries can find and update this history message later.
        entryBatchesRef.current.push({
          histIdx: assistantHistIdx,
          items: entries.map((e) => ({ id: e.id, raw: e._raw ?? e.text })),
        });
        // Strip internal _raw field before handing entries to the app.
        const cleanEntries = entries.map(({ _raw, ...rest }) => rest);
        console.debug("[YCDA] Parsed entries →", cleanEntries);
        if (newChars.length > 0) console.debug("[YCDA] New characters →", newChars);
        onComplete(STREAMING_ENTRY_ID, cleanEntries, newChars);
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
    entryBatchesRef.current = [];
  }, []);

  const setRoster = useCallback((names) => {
    rosterRef.current = names;
  }, []);

  // Remove entry IDs from LLM history. If all entries of a turn are removed,
  // that user+assistant pair is spliced out entirely. Partial removals rebuild
  // the assistant message from the surviving raw lines.
  const pruneEntries = useCallback((removedIds) => {
    const removedSet = new Set(removedIds);
    const toRemoveHistIdxs = new Set();

    entryBatchesRef.current = entryBatchesRef.current
      .map((batch) => {
        const remaining = batch.items.filter((item) => !removedSet.has(item.id));
        if (remaining.length === batch.items.length) return batch; // unaffected

        if (remaining.length === 0) {
          toRemoveHistIdxs.add(batch.histIdx);
          return null; // mark for full removal
        }

        // Partial removal — rebuild assistant message from surviving lines
        historyRef.current[batch.histIdx].content = remaining.map((i) => i.raw).join("\n");
        return { ...batch, items: remaining };
      })
      .filter(Boolean);

    if (toRemoveHistIdxs.size === 0) return;

    // Splice user+assistant pairs highest-index-first to avoid index drift
    const sortedIdxs = [...toRemoveHistIdxs].sort((a, b) => b - a);
    for (const histIdx of sortedIdxs) {
      historyRef.current.splice(histIdx - 1, 2); // user at histIdx-1, assistant at histIdx
      // Shift all subsequent batch indices down by 2
      entryBatchesRef.current = entryBatchesRef.current.map((b) => ({
        ...b,
        histIdx: b.histIdx > histIdx ? b.histIdx - 2 : b.histIdx,
      }));
    }
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
      contextWindowRef.current = AVAILABLE_MODELS.find((m) => m.id === newModelId)?.contextWindow ?? 4096;
      setStatus("ready");
      statusRef.current = "ready";
    } catch (err) {
      console.error("web-llm model switch failed:", err);
      setStatus("error");
      statusRef.current = "error";
    }
  }, []);

  const pregenerateContext = useCallback(async ({ description, characters, npcs, extraContext }, callbacks) => {
    if (statusRef.current !== "ready") return;
    setStatus("initializing"); statusRef.current = "initializing";
    try {
      const result = await engineRef.current.chat.completions.create({
        messages: [
          { role: "system", content: "You are a narrator briefing assistant. Given a story premise, produce a compact narrator briefing of 200–250 tokens. Cover: atmosphere and tone, each named character's motivation, the central tension, and 2–3 key world facts. Plain prose only — no tags, no bullet points." },
          { role: "user", content: buildBriefingPayload({ description, characters, npcs, extraContext }) },
        ],
        temperature: 0.4, top_p: 0.9,
      });
      const briefing = result.choices[0].message.content.trim();
      console.debug("[YCDA] Narrator briefing →", briefing);
      callbacks.onDone(briefing);
    } catch (err) {
      callbacks.onError(err);
    } finally {
      setStatus("ready"); statusRef.current = "ready";
    }
  }, []);

  const appendToSystemPrompt = useCallback((extra) => {
    if (historyRef.current[0]?.role === "system") {
      historyRef.current[0].content += extra;
    }
  }, []);

  // Seed history with the story's static opening entries so the LLM treats them
  // as its own prior output and maintains continuity from turn one.
  const seedInitialEntries = useCallback((entries) => {
    if (!entries?.length) return;
    const lines = entries.map((e) => {
      if (e.type === "story" && !e.source) return `[STORY] ${e.text}`;
      if (e.type === "say")  return `[SAY:${e.character}] ${e.text}`;
      if (e.type === "do")   return `[DO:${e.character}] ${e.text}`;
      return null;
    }).filter(Boolean);
    if (!lines.length) return;
    historyRef.current.push(
      { role: "user",      content: "Begin the story." },
      { role: "assistant", content: lines.join("\n") }
    );
  }, []);

  const getSnapshot = useCallback(() => ({
    history:      historyRef.current,
    entryBatches: entryBatchesRef.current,
  }), []);

  const restoreSnapshot = useCallback(({ history, entryBatches }) => {
    historyRef.current      = history;
    entryBatchesRef.current = entryBatches;
  }, []);

  return { status, progress, modelId, generate, revertLast, setSystemPrompt, setRoster, switchModel, cancel, pruneEntries, pregenerateContext, appendToSystemPrompt, seedInitialEntries, getSnapshot, restoreSnapshot };
}
