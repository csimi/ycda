# YCDA — You Can Do Anything

A text-based choose-your-own-adventure game powered by an in-browser AI Game Master. No server, no API key — the language model runs entirely on your GPU via WebGPU.

**[Play it on GitHub Pages →](https://csimi.github.io/ycda/)**

## Requirements

- A modern browser with **WebGPU support** (Chrome 113+, Edge 113+, Safari 18+)
- A GPU with enough VRAM for your chosen model (see [Models](#models))
- Node.js 18+

WebGPU is now available on all major platforms — desktop (Chrome, Edge, Safari), Android (Chrome 121+), and iOS/iPadOS (Safari 18+). See [Mobile](#mobile) for device-specific notes.

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
| Gemma 2 2B | ~1.9 GB | ⚠️ | Small but capable |
| Llama 3.2 3B | ~1.8 GB | ⚠️ | Good balance for low-end GPUs; borderline on 8 GB phones |
| Phi 3.5 Mini 3.8B | ~2.2 GB | ⚠️ | Strong instruction following for its size |
| Qwen 2.5 7B | ~4.2 GB | ❌ | Strong instruction following |
| Mistral 7B | ~4.2 GB | ❌ | Good general quality |
| Llama 3.1 8B | ~4.5 GB | ❌ | Solid general quality |
| Hermes 2 Pro 8B | ~4.5 GB | ❌ | Good tag-format adherence |
| Hermes 3 8B | ~4.5 GB | ❌ | Roleplay-focused fine-tune |
| Qwen 3 8B | ~4.7 GB | ❌ | Strong reasoning and instruction following |
| **Gemma 2 9B** | ~5.5 GB | ❌ | **default on desktop** — largest option, needs more VRAM |

The 8B models require ~6 GB of available GPU memory. If generation stalls or the page crashes, switch to a smaller model.

## Mobile

On a detected mobile device the app defaults to **Llama 3.2 1B** instead of Gemma 2 9B, and the model picker shows a warning header plus a green/amber/red dot next to each row reflecting how likely it is to run on phones. Realistically, only the 1B is a safe bet on a recent flagship (Android or iPhone); 3B and Phi 3.5 Mini are borderline and may OOM on 8 GB devices; everything else is desktop-only. Safari 18+ on iOS/iPadOS supports WebGPU, so iPhones and iPads can run the game natively.

## Adding stories

Create a JSON file in `stories/` following this schema:

```jsonc
{
  "id": "my-story",
  "title": "Story Title",
  "description": "One-paragraph blurb shown on the selection screen.",

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
      "isPlayer": true,      // exactly one character must be true
      "description": "..."   // optional; shown in the sidebar and injected into the system prompt as permanent (AI cannot overwrite it)
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
  ],

  // Optional: quick-action buttons shown in the input bar during play
  "scenarios": [
    { "id": "s1", "label": "Short label", "icon": "⚔️", "prompt": "Full prompt sent to the LLM when this card is tapped." }
  ]
}
```

The file appears on the story selection screen automatically on next dev server restart. Stories can also be loaded at runtime via the **Upload story** card (accepts `.json` files).

## Controls

| Action | How |
|--------|-----|
| **Continue** | Let the AI advance the story without player input |
| **Re-run** | Discard the last AI response and generate a new one |
| **Remove Last** | Delete the last entry from the feed and LLM history |
| **Cancel** | Stop the current generation mid-stream |
| **Say / Do / Story** | Toggle input mode before typing |
| **Explore** | Toggle explore mode — the AI lingers in the current scene (atmosphere, detail, reactions) instead of advancing the plot |
| **Scenario cards** | Quick-action buttons defined by the story — click to fire a preset prompt |
| **Save / Load** | Click the save icon (💾) in the header |
| **Switch model** | Click the model chip in the header |
| **Difficulty (E / M / H)** | Shift the balance of power between the player and the world — see [Difficulty](#difficulty) |
| **Narrator briefing (✨)** | Toggle pre-generation of a narrator briefing at story start |

## Difficulty

A three-way selector in the header swaps the Game Master's PRIME DIRECTIVE:

- **Easy** *(default)* — **Player agency.** Your declared actions always succeed; NPCs, scenes, and plot threads bend to serve wherever you go. You're the hero.
- **Medium** — **NPC agency.** NPCs have their own goals and may refuse, deflect, negotiate, or resist when your action cuts against their disposition or note. You still drive the story, but must earn cooperation through leverage, persistence, or persuasion.
- **Hard** — **A living world.** You are one person in a world full of people, not its protagonist. Other characters pursue their own agendas and routinely ignore or oppose you; events unfold on their own timeline whether you engage or not. Your actions may fail, be interrupted, or simply not matter.

You can change difficulty mid-story — it rebuilds the system prompt in place on the next turn without resetting history. The setting is persisted per-browser.

## How it works

- The AI Game Master responds using a structured tagged-line format: `[STORY]`, `[SAY:Name]`, `[DO:Name]`, `[NEW_CHAR:name|role|gender|note]`
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
