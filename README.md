# YCDA — You Can Do Anything

A text-based choose-your-own-adventure game powered by an in-browser AI Game Master. No server, no API key — the language model runs entirely on your GPU via WebGPU.

## Requirements

- A modern browser with **WebGPU support** (Chrome 113+, Edge 113+)
- A GPU with enough VRAM for your chosen model (see [Models](#models))
- Node.js 18+

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

The model is selected in-app via the AI status chip in the header. Weights are downloaded once and cached in the browser's Cache Storage API.

| Model | Size | Notes |
|---|---|---|
| Llama 3.2 1B | ~0.8 GB | Fastest, weakest instruction following |
| Llama 3.2 3B | ~1.8 GB | Good balance for low-end GPUs |
| Phi 3.5 Mini 3.8B | ~2.2 GB | Strong instruction following for its size |
| Llama 3.1 8B | ~4.5 GB | Default, recommended |
| Qwen 2.5 7B | ~4.2 GB | Strong instruction following |
| Mistral 7B | ~4.2 GB | Good general quality |

The 8B models require ~6 GB of available GPU memory. If generation stalls or the page crashes, switch to a smaller model.

## Adding stories

Create a JSON file in `stories/` following this schema:

```jsonc
{
  "id": "my-story",
  "title": "Story Title",
  "description": "One-paragraph blurb shown on the selection screen.",
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
    { "id": 1, "type": "story", "text": "The adventure begins..." }
  ]
}
```

The file appears on the story selection screen automatically on next dev server restart. Stories can also be loaded at runtime via the **Upload story** card (accepts `.json` files).

## How it works

- The AI Game Master responds using a structured tagged-line format (`[STORY]`, `[SAY:Name]`, `[DO:Name]`, `[KILL:Name]`, `[REVIVE:Name]`)
- New named characters introduced by the AI are automatically added to the character panel
- Conversation history is summarised by the model when it approaches the context limit (~4096 tokens), keeping the session going indefinitely
- All processing is client-side — nothing is sent to any server

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/)
- [Material UI v9](https://mui.com/)
- [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm)
