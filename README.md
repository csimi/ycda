# YCDA — You Can Do Anything

A text-based choose-your-own-adventure game powered by an in-browser AI Game Master. No server, no API key — the language model runs entirely on your GPU via WebGPU.

**[Play it on GitHub Pages →](https://csimi.github.io/ycda/)**

## Requirements

- A modern browser with **WebGPU support** (Chrome 113+, Edge 113+ on desktop; Chrome 121+ on Android)
- A GPU with enough VRAM for your chosen model (see [Models](#models))
- Node.js 18+

Mobile is supported on a best-effort basis: see [Mobile](#mobile).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The first time you load a story the model weights will download (cached in the browser after that).

## Build

```bash
npm run build       # outputs to dist/
npm run preview     # serves the build locally
```

## Models

The model is selected in-app via the AI status chip in the header. Weights are downloaded once and cached in the browser's Cache Storage API. While a model is downloading you can press the ✕ next to the chip to **cancel the load**; if a load fails, hover the red error chip for the exact reason from web-llm and press ↻ to retry.

| Model | Size | Mobile | Notes |
|---|---|---|---|
| **Llama 3.2 1B** | ~0.8 GB | ✅ | Fastest, weakest instruction following — **default on mobile** |
| Llama 3.2 3B | ~1.8 GB | ⚠️ | Good balance for low-end GPUs; borderline on 8 GB phones |
| Phi 3.5 Mini 3.8B | ~2.2 GB | ⚠️ | Strong instruction following for its size |
| Llama 3.1 8B | ~4.5 GB | ❌ | Solid general quality |
| **Hermes 2 Pro 8B** | ~4.5 GB | ❌ | **Default on desktop** — best tag-format adherence |
| Qwen 2.5 7B | ~4.2 GB | ❌ | Strong instruction following |
| Mistral 7B | ~4.2 GB | ❌ | Good general quality |
| Gemma 2 9B | ~5.5 GB | ❌ | Largest option, needs more VRAM |

The 8B models require ~6 GB of available GPU memory. If generation stalls or the page crashes, switch to a smaller model.

## Mobile

On a detected mobile device the app defaults to **Llama 3.2 1B** instead of Hermes 2 Pro 8B, and the model picker shows a warning header plus a green/amber/red dot next to each row reflecting how likely it is to run on phones. Realistically, only the 1B is a safe bet on a 1–2 year old Android flagship; 3B and Phi 3.5 Mini are borderline and may OOM on 8 GB devices; everything else is desktop-only. iOS Safari does not yet support WebGPU.

## Adding stories

Create a JSON file in `stories/` following this schema:

```jsonc
{
  "id": "my-story",
  "title": "Story Title",
  "description": "One-paragraph blurb shown on the selection screen.",

  // Optional: quick-action buttons shown in the input bar during play
  "scenarios": [
    { "id": "s1", "label": "Short label", "icon": "⚔️", "prompt": "Full prompt sent to the LLM when this card is tapped." }
  ],

  // Optional: show a character setup form before starting
  "setup": [
    { "field": "name",       "label": "Your character's name" },
    { "field": "background", "label": "Your background", "multiline": true }
  ],

  "characters": [
    {
      "id": 1,
      "name": "Aelindra",
      "class": "Ranger",
      "avatar": "🧝",
      "gender": "Female",
      "isPlayer": true       // exactly one character must be true
    }
  ],
  "npcs": [
    {
      "id": 101,
      "name": "Mira",
      "role": "Innkeeper",
      "avatar": "👩",
      "gender": "Female",
      "disposition": "friendly",   // friendly | neutral | hostile
      "note": "One-sentence description."
    }
  ],
  "entries": [
    // ${field} placeholders are replaced with setup answers at story start
    { "id": 1, "type": "story", "text": "Welcome, ${name}. The adventure begins..." }
  ]
}
```

The file appears on the story selection screen automatically on next dev server restart. Stories can also be loaded at runtime via the **Upload story** card (accepts `.json` files).

## Controls

| Action | How |
|--------|-----|
| **Scenario cards** | Quick-action buttons defined by the story — click to fire a preset prompt |
| **Continue** | Let the AI advance the story without player input |
| **Re-run** | Discard the last AI response and generate a new one |
| **Remove Last** | Delete the last entry from the feed and LLM history |
| **Cancel** | Stop the current generation mid-stream |
| **Say / Do / Story** | Toggle input mode before typing |
| **Explore** | Toggle explore mode — the AI lingers in the current scene (atmosphere, detail, reactions) instead of advancing the plot |
| **Save / Load** | Click the save icon (💾) in the header |
| **Switch model** | Click the model chip in the header |
| **Narrator briefing (✨)** | Toggle pre-generation of a narrator briefing at story start |

## How it works

- The AI Game Master responds using a structured tagged-line format: `[STORY]`, `[SAY:Name]`, `[DO:Name]`, `[NEW_CHAR:name|role|gender|disposition|note]`
- New named characters introduced by the AI are automatically added to the character panel
- Character names in AI output are fuzzy-matched against the known roster to tolerate minor typos
- Conversation history is automatically compacted (summarised by the model) when it approaches the 4096-token context limit, keeping sessions going indefinitely
- Saves are stored in the browser's IndexedDB — no account or server needed
- The **narrator briefing** feature (✨) runs a second LLM call before the story starts to give the model a private summary of the premise, characters, and tone
- All processing is client-side — nothing is sent to any server

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/)
- [Material UI v9](https://mui.com/)
- [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm)
- [tokenx](https://github.com/nicolo-ribaudo/tokenx) — token estimation
- [fastest-levenshtein](https://github.com/nicolo-ribaudo/fastest-levenshtein) — fuzzy character name matching
