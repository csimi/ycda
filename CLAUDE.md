# YCDA — You Can Do Anything

Text-based CYOA game powered by an in-browser LLM (web-llm). React + Vite + Material UI frontend. No backend — everything runs client-side.

## Stack

- **Vite + React 19** — `npm run dev` to start, `npm run build` to build
- **Material UI v9** (`@mui/material`, `@emotion/react/styled`, `@mui/icons-material`)
- **`@mlc-ai/web-llm`** — runs `Llama-3.2-3B-Instruct-q4f16_1-MLC` in-browser via WebGPU. Model weights (~1.8 GB) download once and are cached in the browser's Cache API.
- `optimizeDeps: { exclude: ["@mlc-ai/web-llm"] }` in `vite.config.js` is required — web-llm uses internal dynamic imports that Vite's pre-bundler would mangle.

## Project layout

```
stories/                    # Story JSON files (auto-loaded via import.meta.glob)
  ember-compass.json

src/
  App.jsx                   # Root: theme, story selection state, all game state
  main.jsx
  index.css

  components/
    StorySelect.jsx         # Story library screen shown before game starts
    CharacterPanel.jsx      # Left sidebar: party + NPC cards
    StoryPanel.jsx          # Scrollable story feed
    StoryEntry.jsx          # Renders a single entry (story / say / do / player note / continue)
    InputBar.jsx            # Bottom bar: Continue, Re-run, mode toggle, text input
    LLMStatusBar.jsx        # Header chip: loading progress / ready / generating / error

  data/
    systemPrompt.js         # buildSystemPrompt(characters, npcs) → string
    stories.js              # import.meta.glob loader for stories/*.json
    characters.js           # Static fallback character/NPC data (not used at runtime)
    story.js                # Static fallback initial entries (not used at runtime)

  hooks/
    useLLM.js               # Engine lifecycle, streaming, history, parser
```

## Story JSON schema

Stored in `stories/*.json`. Any file dropped there appears on the selection screen automatically.

```jsonc
{
  "id": "unique-id",
  "title": "Story Title",
  "description": "One-paragraph blurb shown on selection card.",
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
    { "id": 1, "type": "story", "text": "Narration..." },
    { "id": 3, "type": "say", "character": "Aelindra", "text": "Dialogue..." },
    { "id": 5, "type": "do",  "character": "Aelindra", "text": "Action..." }
  ]
}
```

## Entry types

| `type`    | `source`     | Rendered as |
|-----------|-------------|-------------|
| `story`   | *(absent)*  | Serif italic narrator text |
| `story`   | `"user"`    | Amber dashed "Player note" card |
| `story`   | `"continue"`| Slim horizontal divider with `▶ continue` label |
| `say`     | —           | Indigo speech bubble, left-aligned |
| `do`      | —           | Green action bubble, left-aligned, italic |

## LLM output format

The AI Game Master must respond using only these tagged lines:

```
[STORY] narration text
[SAY:CharName] dialogue without quotes
[DO:CharName] action without asterisks
[NEW_CHAR:name|role|gender|disposition|note]
[KILL:CharName]
```

- `[NEW_CHAR]` — use sparingly, only for named recurring characters. Parser deduplicates against the full roster (party + NPCs) using exact and prefix matching to block variants like "Forest Guardian's Reflection" when "Forest Guardian" already exists.
- `[KILL]` — marks `dead: true` on the matching character or NPC. Dead cards show strikethrough name, greyscale avatar, red border, `💀 Dead` chip, dimmed opacity.

## App state (App.jsx)

```
activeStory     — selected story object | null (null = show StorySelect)
characters      — party array, stateful (supports dead: true)
npcs            — NPC array, stateful (grows when AI introduces new chars)
entries         — story feed array
lastRun         — { userMessage, aiEntryIds: Set } | null  (for Re-run)
themeMode       — "light" | "dark", persisted to localStorage key "theme"
```

`characters` and `npcs` are initialized from the selected story on `handleSelectStory`. They are lifted to state (not read directly from `activeStory`) so kills and new NPC additions can be applied reactively.

## useLLM hook

```js
const { status, progress, generate, revertLast, setSystemPrompt } = useLLM();
```

- **status**: `"uninitialized"` → `"loading"` → `"ready"` ↔ `"generating"` | `"error"`
- **`setSystemPrompt(str)`** — seeds `historyRef` with `[{ role: "system", content }]`. Called after story selection.
- **`generate(userMessage, callbacks)`** — appends user turn to history, streams response, calls:
  - `onPlaceholder(id)` — add `…` entry
  - `onChunk(id, partial)` — update placeholder text in place
  - `onComplete(id, entries, newChars, killedNames)` — replace placeholder, apply side-effects
  - `onError(err)` — remove placeholder
- **`revertLast()`** — pops the last user+assistant pair from history (used by Re-run).
- **`parseGMResponse(text)`** — splits on `\n`, matches tags, returns `{ entries, newChars, killedNames }`. Unrecognised lines fall back to `type: "story"`. Always returns ≥1 entry.

All debug output uses `console.debug` with the `[YCDA]` prefix: prompt, raw response, parsed entries, new characters, kills.

## InputBar actions

- **Continue** — adds a `source: "continue"` divider entry, calls `generate("Continue the story.")`
- **Re-run** — removes `lastRun.aiEntryIds` entries, calls `revertLast()`, re-calls `generate` with the same prompt. Disabled until at least one AI response exists.
- **Say / Do / Story** mode toggle — controls how the user's text is formatted before being sent to the LLM and how the entry is displayed.

## Adding a new story

1. Create `stories/your-story.json` following the schema above.
2. It appears on the selection screen automatically on next dev server restart (or build).

## Known constraints

- LLM runs on the main thread (not a Worker). The UI may stutter during heavy generation on low-end GPUs.
- Context window is 4096 tokens. Long sessions will eventually hit the limit; no sliding-window trimming is implemented yet.
- The model is hardcoded in `useLLM.js` (`MODEL_ID` constant). Changing it requires a code edit.
