# YCDA — You Can Do Anything

Text-based CYOA game powered by an in-browser LLM (web-llm). React + Vite + Material UI frontend. No backend — everything runs client-side.

## Stack

- **Vite + React 19** — `npm run dev` to start, `npm run build` to build
- **Material UI v9** (`@mui/material`, `@emotion/react/styled`, `@mui/icons-material`)
- **`@mlc-ai/web-llm`** — runs LLMs in-browser via WebGPU. Default model: `Llama-3.1-8B-Instruct-q4f16_1-MLC` (~4.5 GB). Model weights download once and are cached in the browser's Cache API.
- **`tokenx`** — token estimation for context management
- **`fastest-levenshtein`** — fuzzy character name matching in SAY/DO tags
- `optimizeDeps: { exclude: ["@mlc-ai/web-llm"] }` in `vite.config.js` is required — web-llm uses internal dynamic imports that Vite's pre-bundler would mangle.

## Project layout

```
stories/                    # Story JSON files (auto-loaded via import.meta.glob)
  ember-compass.json
  isekai-reborn.json

src/
  App.jsx                   # Root: theme, story selection state, all game state
  main.jsx
  index.css

  components/
    AppHeader.jsx           # Top bar: logo, story title, home button, LLM status, save, pregen toggle, theme toggle
    StorySelect.jsx         # Story library screen shown before game starts; upload + saves sections
    StorySetup.jsx          # Pre-game character customization form (shown when story.setup is defined)
    SavesDialog.jsx         # Save / load dialog (used from both StorySelect and in-game)
    CharacterPanel.jsx      # Left sidebar: party + NPC cards
    StoryPanel.jsx          # Scrollable story feed
    StoryEntry.jsx          # Renders a single entry (story / say / do / player note / continue / compact)
    InputBar.jsx            # Bottom bar: Continue, Re-run, Remove Last, Cancel, mode toggle, text input
    LLMStatusBar.jsx        # Model status chip + model switcher dropdown (embedded in AppHeader)

  data/
    systemPrompt.js         # buildSystemPrompt(characters, npcs, extraContext?) → string
    stories.js              # import.meta.glob loader for stories/*.json
    characters.js           # Static fallback character/NPC data (not used at runtime)
    story.js                # Static fallback initial entries (not used at runtime)

  hooks/
    useLLM.js               # Engine lifecycle, streaming, history, compaction, parser
    useSaves.js             # React hook: saves state, saveGame, deleteSave (wraps useIndexedDB)
    useIndexedDB.js         # Low-level IndexedDB wrapper: listSaves, saveGame, deleteSave
```

## Story JSON schema

Stored in `stories/*.json`. Any file dropped there appears on the selection screen automatically. Users can also upload `.json` files at runtime via the Upload card.

```jsonc
{
  "id": "unique-id",
  "title": "Story Title",
  "description": "One-paragraph blurb shown on selection card.",

  // Optional: predefined scenario cards shown in the InputBar tray. Each fires a generation prompt.
  "scenarios": [
    { "id": "s1", "label": "Short label", "icon": "⚔️", "prompt": "Full prompt sent to the LLM." }
  ],

  // Optional: if present, a setup form is shown before the game starts.
  "setup": [
    { "field": "name",       "label": "Your character's name" },
    { "field": "background", "label": "Your background",      "multiline": true }
    // field matches a character property OR becomes extra context in the system prompt
  ],

  "characters": [
    {
      "id": 1,
      "name": "Aelindra",
      "class": "Ranger",
      "avatar": "🧝",        // emoji
      "gender": "Female",    // optional, shown as pill
      "isPlayer": true       // exactly one character must be true
    }
  ],
  "npcs": [
    {
      "id": 101,
      "name": "Mira",
      "role": "Innkeeper",
      "avatar": "👩",
      "gender": "Female",          // optional
      "disposition": "friendly",   // friendly | neutral | hostile
      "note": "One-sentence note."
    }
  ],
  "entries": [
    // ${field} placeholders are interpolated from setup answers at story start
    { "id": 1, "type": "story", "text": "Welcome, ${name}..." },
    { "id": 3, "type": "say", "character": "Aelindra", "text": "Dialogue..." },
    { "id": 5, "type": "do",  "character": "Aelindra", "text": "Action..." }
  ]
}
```

`setup` fields that match character properties (`name`, `gender`, `class`, `avatar`, `disposition`) are merged into the player character object. All other fields are appended to the system prompt as a `PLAYER BACKGROUND` block.

## Entry types

| `type`    | `source`      | Rendered as |
|-----------|--------------|-------------|
| `story`   | *(absent)*   | Serif italic narrator text |
| `story`   | `"user"`     | Amber dashed "Player note" card |
| `story`   | `"continue"` | Slim horizontal divider with `▶ continue` label |
| `story`   | `"compact"`  | Dimmed summary card inserted after context compaction |
| `say`     | —            | Indigo speech bubble, left-aligned |
| `do`      | —            | Green action bubble, left-aligned, italic |

## LLM output format

The AI Game Master must respond using only these tagged lines:

```
[STORY] narration text
[SAY:CharName] dialogue without quotes
[DO:CharName] action without asterisks
[NEW_CHAR:name|role|gender|disposition|note]
```

- `[NEW_CHAR]` — use sparingly, only for named recurring characters. Parser deduplicates against the full roster (party + NPCs) using exact and prefix matching to block variants. Character names in SAY/DO are fuzzy-matched against the roster via Levenshtein distance (tolerance ≤ 2).
- `[KILL]` tag has been removed. Character death is handled narratively.
- Refusal detection (`isRefusal`) triggers a retry loop: if the model outputs no valid tags or uses refusal phrases, `generate` retries the same prompt silently.

## App state (App.jsx)

```
activeStory          — selected story object | null (null = show StorySelect)
pendingStory         — story awaiting setup answers | null (shows StorySetup screen)
uploadedStories      — user-uploaded stories (session-only, remembered across story plays)
characters           — party array, stateful
npcs                 — NPC array, stateful (grows when AI introduces new chars)
entries              — story feed array
lastRun              — { userMessage, aiEntryIds: Set } | null  (for Re-run)
themeMode            — "light" | "dark", persisted to localStorage key "theme"
pregenerationEnabled — bool, persisted to localStorage key "pregen"
savesDialogOpen      — bool
savesDialogMode      — "save" | "load"
```

Screen flow: **StorySelect** → *(if story.setup)* **StorySetup** → **Game**

`characters` and `npcs` are initialized from the selected story on `handleSelectStory`, with setup answers merged in. They are lifted to state so kills and new NPC additions can be applied reactively.

## useLLM hook

```js
const {
  status, progress, modelId, error,
  generate, revertLast, cancel,
  cancelLoad, retryLoad,
  setSystemPrompt, appendToSystemPrompt, seedInitialEntries,
  setRoster, switchModel,
  pruneEntries,
  pregenerateContext,
  getSnapshot, restoreSnapshot,
} = useLLM();
```

- **status**: `"uninitialized"` → `"loading"` → `"ready"` ↔ `"generating"` | `"initializing"` | `"cancelled"` | `"error"`
  - `"initializing"` — narrator briefing pre-generation in progress
  - `"cancelled"` — user aborted model loading via `cancelLoad`; engine has been unloaded
- **modelId** — the currently loaded model ID string
- **error** — string message from the most recent failed `loadModel` attempt, or `null`. Cleared at the start of each new load.
- **`setSystemPrompt(str)`** — seeds `historyRef` with `[{ role: "system", content }]` and resets `entryBatchesRef`.
- **`appendToSystemPrompt(str)`** — appends text to the existing system message (used by narrator briefing).
- **`seedInitialEntries(entries)`** — injects the story's opening entries as an initial user+assistant pair in history so the LLM treats them as its own prior output.
- **`generate(userMessage, callbacks)`** — compacts history if needed, appends user turn, streams response, retries on refusal. Callbacks:
  - `onPlaceholder(id)` — add `…` entry
  - `onChunk(id, partial)` — update placeholder text in place
  - `onComplete(id, entries, newChars)` — replace placeholder, apply side-effects
  - `onError(err)` — remove placeholder
  - `onCompact(summary)` — called when context compaction runs; app adds a `"compact"` entry
- **`revertLast()`** — pops the last user+assistant pair from history (used by Re-run).
- **`cancel()`** — signals the current generation to stop after the stream drains.
- **`cancelLoad()`** — aborts an in-flight model load. Bumps the internal load token, sets status to `"cancelled"`, then calls `engine.unload()`. web-llm wires its `reloadController` AbortSignal into all `fetchWithCache` calls, so `unload()` actually aborts the in-progress weight downloads (not just hides them from the UI).
- **`retryLoad()`** — re-runs `loadModel` for the current `modelId`. Used from the `"cancelled"` and `"error"` states. New load attempts queue behind any in-flight one via `loadChainRef` so two reloads never run on the same engine concurrently.
- **`setRoster(names)`** — updates the name list used for fuzzy SAY/DO matching.
- **`switchModel(newModelId)`** — persists the choice to localStorage and delegates to `loadModel`. Allowed from `"ready"`, `"cancelled"`, and `"error"` states.
- **`pruneEntries(removedIds)`** — removes entry IDs from the feed and from LLM history. Full turn removal splices the user+assistant pair; partial removal rebuilds the assistant message from surviving lines.
- **`pregenerateContext({ description, characters, npcs, extraContext }, { onDone, onError })`** — runs a separate LLM call to produce a narrator briefing, then calls `onDone(briefing)` so the app can `appendToSystemPrompt` it.
- **`getSnapshot()`** → `{ history, entryBatches }` — serializable snapshot for saving.
- **`restoreSnapshot({ history, entryBatches })`** — restores a saved snapshot.

### Context compaction

When the estimated token count of `historyRef` exceeds 90 % of the model's context window, `compactHistory` is called before the next generation:
1. A summary of the oldest messages is requested from the LLM (temperature 0.2).
2. The history is rebuilt as: `[system, synthetic-user-summary, synthetic-assistant-ack, ...recent pairs]`.
3. `entryBatchesRef` indices are rebased accordingly.
4. `onCompact(summary)` fires so the app can insert a `"compact"` divider entry.

### Available models

Defined in `AVAILABLE_MODELS` (exported from `useLLM.js`). Each entry has a `mobile` flag — `"ok"` (fits comfortably on a 1–2 year old flagship), `"maybe"` (borderline, may OOM on 8 GB devices), `"no"` (almost certainly won't run on phones).

| Label | Model ID | Size | Context | Mobile |
|-------|----------|------|---------|--------|
| **Llama 3.2 1B** *(default on mobile)* | `Llama-3.2-1B-Instruct-q4f16_1-MLC` | ~0.8 GB | 4096 | ok |
| Llama 3.2 3B | `Llama-3.2-3B-Instruct-q4f16_1-MLC` | ~1.8 GB | 4096 | maybe |
| Phi 3.5 Mini 3.8B | `Phi-3.5-mini-instruct-q4f16_1-MLC` | ~2.2 GB | 4096 | maybe |
| Llama 3.1 8B | `Llama-3.1-8B-Instruct-q4f16_1-MLC` | ~4.5 GB | 4096 | no |
| **Hermes 2 Pro 8B** *(default on desktop)* | `Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC` | ~4.5 GB | 4096 | no |
| Qwen 2.5 7B | `Qwen2.5-7B-Instruct-q4f16_1-MLC` | ~4.2 GB | 4096 | no |
| Mistral 7B | `Mistral-7B-Instruct-v0.3-q4f16_1-MLC` | ~4.2 GB | 4096 | no |
| Gemma 2 9B | `gemma-2-9b-it-q4f16_1-MLC` | ~5.5 GB | 4096 | no |

`isMobileDevice()` (UA-based, also exported from `useLLM.js`) is used by `getInitialModelId` to pick the mobile default when no `modelId` is in localStorage.

## Save / load system

Saves are persisted in IndexedDB (`ycda-saves` database, `saves` object store).

Each save record: `{ id, storyId, storyTitle, savedAt, previewText, snapshot }` where `snapshot = { entries, characters, npcs, llmHistory, entryBatches }`.

- **`useSaves`** hook exposes `{ saves, saveGame, deleteSave }`.
- **`SavesDialog`** handles both "save" mode (in-game, shows "Save current game" button) and "load" mode (from StorySelect). Loading while in-game shows a confirm dialog.
- The StorySelect screen shows up to 3 recent saves with inline Load/Delete actions; "View all" opens `SavesDialog`.

## InputBar actions

- **Continue** — adds a `source: "continue"` divider entry, calls `generate("Continue the story.")`
- **Re-run** — removes `lastRun.aiEntryIds` entries, calls `revertLast()`, re-calls `generate` with the same prompt. Disabled until at least one AI response exists.
- **Remove Last** — removes the last entry from the feed and calls `pruneEntries` to sync LLM history.
- **Cancel** — sets `cancelledRef` in the hook; generation stops after the current stream drains.
- **Say / Do / Story** mode toggle — controls how the user's text is formatted before being sent to the LLM and how the entry is displayed.

## AppHeader controls

- **YCDA logo** — clicking while in-game opens a "Leave story?" confirm dialog; returns to StorySelect.
- **LLMStatusBar chip** — shows loading progress bar / model name / generating spinner / cancelled / error; click opens model switcher (allowed from `ready`/`cancelled`/`error`). A ✕ button appears next to the chip while loading and triggers `cancelLoad`. A ↻ button appears in the `cancelled` and `error` states and triggers `retryLoad`. In the `error` state the chip is wrapped in a tooltip showing the exact failure message from web-llm. On detected mobile devices, the model menu shows a warning header and each row is annotated with a green/amber/red dot reflecting its `mobile` flag.
- **Save icon** — opens `SavesDialog` in "save" mode (in-game only).
- **AutoAwesome (✨) icon** — toggles narrator briefing (pre-generation). Stored in localStorage key `"pregen"`.
- **Theme toggle** — light/dark, stored in localStorage key `"theme"`.

## Adding a new story

1. Create `stories/your-story.json` following the schema above.
2. It appears on the selection screen automatically on next dev server restart (or build).
3. Alternatively, users can upload a story JSON at runtime via the Upload card on the selection screen.

## Known constraints

- LLM runs on the main thread (not a Worker). The UI may stutter during heavy generation on low-end GPUs.
- Context window is 4096 tokens for all available models. Compaction kicks in at 90% usage.
- All debug output uses `console.debug` with the `[YCDA]` prefix: prompt, raw response, parsed entries, new characters, compaction summaries.
