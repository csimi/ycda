import { useEffect, useRef, useState, useCallback } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { estimateTokenCount } from "tokenx";
import { distance } from "fastest-levenshtein";

const DEFAULT_MODEL_ID = "gemma-2-9b-it-q4f16_1-MLC";
const MOBILE_DEFAULT_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const MODEL_STORAGE_KEY = "modelId";

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgentData?.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent || "");
}

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

function needsCompaction(history, contextWindow) {
  const totalTokens = estimateHistoryTokens(history);
  const availableBudget = contextWindow - GENERATION_BUDGET;
  return totalTokens > availableBudget * COMPACTION_RATIO;
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
      { role: "user",      content: `Story so far — earlier events summarized:\n${summary}` },
      { role: "assistant", content: "Understood. I will continue from this point using the same tagged output format." },
      ...toKeep,
    ],
    compacted: true,
    summary,
    firstSurvivedOrigIdx,
  };
}

// mobile: "ok" — fits comfortably on a 1–2 year old flagship
//         "maybe" — borderline, may OOM on 8 GB devices
//         "no" — almost certainly won't run on phones
export const AVAILABLE_MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",    label: "Llama 3.2 1B",      size: "~0.8 GB", contextWindow: 4096, mobile: "ok"    },
  { id: "gemma-2-2b-it-q4f16_1-MLC",            label: "Gemma 2 2B",        size: "~1.9 GB", contextWindow: 4096, mobile: "maybe" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",    label: "Llama 3.2 3B",      size: "~1.8 GB", contextWindow: 4096, mobile: "maybe" },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC",    label: "Phi 3.5 Mini 3.8B", size: "~2.2 GB", contextWindow: 4096, mobile: "maybe" },
  { id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",      label: "Qwen 2.5 7B",       size: "~4.2 GB", contextWindow: 4096, mobile: "no", separator: true },
  { id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", label: "Mistral 7B",        size: "~4.2 GB", contextWindow: 4096, mobile: "no"    },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",    label: "Llama 3.1 8B",      size: "~4.5 GB", contextWindow: 4096, mobile: "no"    },
  { id: "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",  label: "Hermes 2 Pro 8B",   size: "~4.5 GB", contextWindow: 4096, mobile: "no"    },
  { id: "gemma-2-9b-it-q4f16_1-MLC",            label: "Gemma 2 9B",        size: "~5.5 GB", contextWindow: 4096, mobile: "no", recommended: true },
];

function getInitialModelId() {
  const stored = localStorage.getItem(MODEL_STORAGE_KEY);
  if (stored && AVAILABLE_MODELS.some((m) => m.id === stored)) return stored;
  return isMobileDevice() ? MOBILE_DEFAULT_MODEL_ID : DEFAULT_MODEL_ID;
}

export const STREAMING_ENTRY_ID = "__streaming__";
export const COMPACTING_ENTRY_ID = "__compacting__";

const REFUSAL_RE = [
  /\bI (can't|cannot|won't|will not|am unable to|must decline|refuse to)\b/i,
  /\bI('m| am) (sorry|afraid)\b/i,
  /\bas an? (AI|language model|assistant)\b/i,
  /\bI'?m not able\b/i,
  /\bI apologize\b/i,
];

function isRefusal(text) {
  // No valid tags at all → not following the format → treat as refusal
  if (!/^\[(STORY|SAY:|DO:|NEW_CHAR:)/m.test(text)) return true;
  // Any single line over 600 chars → model is rambling
  if (text.split("\n").some((l) => l.length > 600)) return true;
  // Only check refusal phrases on lines that are NOT inside a valid tag,
  // so in-story dialogue like "I'm sorry, I cannot allow that" is not flagged.
  const untaggedLines = text.split("\n")
    .filter((l) => l.trim() && !/^\[(STORY|SAY:|DO:|NEW_CHAR:)/i.test(l.trim()));
  return untaggedLines.some((line) => REFUSAL_RE.some((re) => re.test(line)));
}


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
  // Split on newlines, then split again on tag boundaries so that multiple
  // tags on the same line (e.g. "[SAY:X] hi [STORY] text") are each parsed.
  const TAG_SPLIT = /(?=\[(?:STORY|SAY:|DO:|NEW_CHAR:))/i;
  const lines = text.split("\n").flatMap((l) => l.split(TAG_SPLIT));

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

    // [NEW_CHAR:name|role|gender|note]
    const newCharMatch = line.match(/^\[NEW_CHAR:([^\]]+)\]/i);
    if (newCharMatch) {
      const parts = newCharMatch[1].split("|").map((s) => s.trim());
      const [rawName, role, gender, ...noteParts] = parts;
      // Strip any role/job suffix the model appended to the name (e.g. "Robin, Barkeeper")
      const name = rawName.split(/[,\-–]/)[0].trim();
      if (name && role) {
        newChars.push({
          id: Date.now() + Math.random(),
          name,
          role: role || "Unknown",
          avatar: "🧑",
          gender: gender || "",
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
  const [loadingPhase, setLoadingPhase] = useState("downloading"); // "downloading" | "loading"
  const [modelId, setModelId] = useState(getInitialModelId);
  const [error, setError] = useState(null);
  const engineRef = useRef(null);
  const workerRef = useRef(null);
  const historyRef = useRef([]);
  const rosterRef = useRef([]);
  const statusRef = useRef("uninitialized");
  const cancelledRef = useRef(false);
  // Monotonic token for load operations. Bumped on cancel/supersede so stale
  // reload promises know to bail out instead of committing their result.
  const loadTokenRef = useRef(0);
  // Serialises concurrent load attempts on the same engine — web-llm's reload
  // is not safe to call while a previous reload is still in flight.
  const loadChainRef = useRef(Promise.resolve());
  // Tracks which history assistant message each batch of AI entries came from.
  // Each item: { histIdx: number, items: Array<{ id, raw: string }> }
  const entryBatchesRef = useRef([]);
  const compactStackRef = useRef([]);
  const contextWindowRef = useRef(
    AVAILABLE_MODELS.find((m) => m.id === modelId)?.contextWindow ?? 4096
  );

  const loadModel = useCallback((id) => {
    const myToken = ++loadTokenRef.current;
    const run = loadChainRef.current.catch(() => {}).then(async () => {
      if (myToken !== loadTokenRef.current) return; // cancelled before start
      if (!engineRef.current) return;
      setStatus("loading");
      statusRef.current = "loading";
      setProgress(0);
      setLoadingPhase("downloading");
      setError(null);
      // Re-register progress callback for this load, gated to myToken, so
      // stale progress from a previous cancelled load never reaches the UI.
      engineRef.current.setInitProgressCallback((report) => {
        if (myToken !== loadTokenRef.current) return;
        setProgress(report.progress ?? 0);
        const text = report.text ?? "";
        setLoadingPhase(text.toLowerCase().includes("fetch") ? "downloading" : "loading");
      });
      try {
        await engineRef.current.reload(id, { temperature: 0.7, top_p: 0.9 });
        if (myToken !== loadTokenRef.current) return;
        setModelId(id);
        contextWindowRef.current = AVAILABLE_MODELS.find((m) => m.id === id)?.contextWindow ?? 4096;
        setStatus("ready");
        statusRef.current = "ready";
      } catch (err) {
        if (myToken !== loadTokenRef.current) return;
        console.error("web-llm engine init failed:", err);
        setError(err?.message || String(err) || "Unknown error");
        setStatus("error");
        statusRef.current = "error";
      }
    });
    loadChainRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    // Guard against StrictMode double-mount creating a second worker before
    // the first teardown finishes.
    if (engineRef.current) return;

    const worker = new Worker(
      new URL("../workers/llmWorker.js", import.meta.url),
      { type: "module" }
    );
    const engine = new webllm.WebWorkerMLCEngine(worker);
    workerRef.current = worker;
    engineRef.current = engine;

    loadModel(modelId);

    return () => {
      // Bump the token so any in-flight load bails out, then wait for the
      // chain to drain before unloading — unloading mid-reload can leave
      // WebGPU resources pinned. Then terminate the worker thread.
      loadTokenRef.current++;
      const w = workerRef.current;
      const e = engineRef.current;
      if (engineRef.current === engine) engineRef.current = null;
      if (workerRef.current === worker) workerRef.current = null;
      loadChainRef.current.finally(() => {
        e?.unload?.().catch(() => {}).finally(() => {
          w?.terminate();
        });
      });
    };
  }, []);

  const cancelLoad = useCallback(() => {
    if (statusRef.current !== "loading") return;
    // Bump the token so the in-flight reload's success branch bails out, then
    // call unload() — web-llm wires its AbortController to unload(), which
    // aborts the fetchWithCache calls inside reloadInternal and causes the
    // reload promise to reject. The catch branch in loadModel sees the stale
    // token and stays silent.
    loadTokenRef.current++;
    setStatus("cancelled");
    statusRef.current = "cancelled";
    // Fire unload() to abort in-flight downloads. The reload() promise will
    // reject, run1 will settle (stale-token branch), and retryLoad/switchModel
    // can then start. During GPU init the worker may not process unload()
    // until init completes — that delay is unavoidable.
    engineRef.current?.unload?.().catch(() => {});
  }, []);

  const retryLoad = useCallback(() => {
    loadModel(modelId);
  }, [modelId, loadModel]);

  const generate = useCallback(async (userMessage, callbacks) => {
    if (statusRef.current !== "ready") return;

    const { onPlaceholder, onChunk, onComplete, onError, onCompact, onCompacting } = callbacks;

    setStatus("generating");
    statusRef.current = "generating";

    if (needsCompaction(historyRef.current, contextWindowRef.current)) onCompacting?.();
    const { history: compacted, compacted: wasCompacted, summary, firstSurvivedOrigIdx } = await compactHistory(historyRef.current, engineRef.current, contextWindowRef.current);
    if (wasCompacted) {
      compactStackRef.current.push({
        history: historyRef.current,
        entryBatches: entryBatchesRef.current,
      });
      historyRef.current = compacted;
      onCompact?.(summary);
      // Rebase entryBatchesRef: drop batches that were summarized, shift survivors.
      // After compaction the kept messages start at index 3 (system + 2 synthetic summary messages).
      entryBatchesRef.current = entryBatchesRef.current
        .filter((b) => b.histIdx >= firstSurvivedOrigIdx)
        .map((b) => ({ ...b, histIdx: b.histIdx - firstSurvivedOrigIdx + 3 }));
    } else {
      historyRef.current = compacted;
      // Clean up compacting entry if compaction didn't end up running
      onCompact?.(null);
    }

    historyRef.current.push({ role: "user", content: userMessage });
    console.debug("[YCDA] Prompt →", userMessage);
    onPlaceholder(STREAMING_ENTRY_ID);

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
          repetition_penalty: 1.1,
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
    compactStackRef.current = [];
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

  const undoCompaction = useCallback(() => {
    const snapshot = compactStackRef.current.pop();
    if (!snapshot) return false;
    historyRef.current = snapshot.history;
    entryBatchesRef.current = snapshot.entryBatches;
    return true;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    engineRef.current?.interruptGenerate?.();
  }, []);

  const switchModel = useCallback((newModelId) => {
    if (statusRef.current !== "ready" && statusRef.current !== "cancelled" && statusRef.current !== "error") return;
    localStorage.setItem(MODEL_STORAGE_KEY, newModelId);
    return loadModel(newModelId);
  }, [loadModel]);

  const pregenerateContext = useCallback(async ({ description, characters, npcs, extraContext }, callbacks) => {
    if (statusRef.current !== "ready") return;
    setStatus("initializing"); statusRef.current = "initializing";
    try {
      const result = await engineRef.current.chat.completions.create({
        messages: [
          { role: "system", content: "You are a narrator briefing assistant. Produce a compact narrator briefing of 200–250 tokens. The main Narrator already knows the character names, classes, roles, and NPC notes — do NOT restate them. Focus only on: atmosphere and sensory tone, each named character's inner motivation (one line each), the central dramatic tension, and 2–3 world facts not obvious from the premise. Plain prose only — no tags, no bullet points, no character roster." },
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
    compactStackRef.current = [];
  }, []);

  return { status, progress, loadingPhase, modelId, error, generate, revertLast, setSystemPrompt, setRoster, switchModel, cancel, cancelLoad, retryLoad, pruneEntries, undoCompaction, pregenerateContext, appendToSystemPrompt, seedInitialEntries, getSnapshot, restoreSnapshot };
}
