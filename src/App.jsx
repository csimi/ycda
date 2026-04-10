import { useState, useMemo, useEffect, useRef } from "react";
import { Box, CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CharacterPanel from "./components/CharacterPanel";
import StoryPanel from "./components/StoryPanel";
import InputBar from "./components/InputBar";
import AppHeader from "./components/AppHeader";
import StorySelect from "./components/StorySelect";
import StorySetup from "./components/StorySetup";
import { buildSystemPrompt } from "./data/systemPrompt";
import { useLLM, STREAMING_ENTRY_ID } from "./hooks/useLLM";

function buildTheme(mode) {
  return createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            background: { default: "#13151f", paper: "#1a1d2e" },
            primary: { main: "#818cf8" },
            text: { primary: "#e2e8f0", secondary: "#94a3b8" },
          }
        : {
            background: { default: "#f5f4f0", paper: "#ffffff" },
            primary: { main: "#4f46e5" },
            text: { primary: "#1e1b2e", secondary: "#64748b" },
          }),
    },
    typography: {
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },
  });
}

function formatUserAction(inputMode, text, characterName) {
  if (inputMode === "say") return `${characterName} says: "${text}"`;
  if (inputMode === "do")  return `${characterName} does: ${text}`;
  return `Story beat: ${text}`;
}

function App() {
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("theme") ?? "light");
  const [pregenerationEnabled, setPregenerationEnabled] = useState(() => localStorage.getItem("pregen") !== "false");
  const [activeStory, setActiveStory] = useState(null);
  const [pendingStory, setPendingStory] = useState(null);
  const [uploadedStories, setUploadedStories] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [entries, setEntries] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const { status, progress, modelId, generate, revertLast, setSystemPrompt, setRoster, switchModel, cancel, pruneEntries, pregenerateContext, appendToSystemPrompt, seedInitialEntries } = useLLM();
  const pendingPostInitRef = useRef(null);

  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);
  const isDark = themeMode === "dark";
  const isGenerating = status === "generating";
  const isLLMReady   = status === "ready";

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setThemeMode(next);
    localStorage.setItem("theme", next);
  };

  const togglePregeneration = () => {
    const next = !pregenerationEnabled;
    setPregenerationEnabled(next);
    localStorage.setItem("pregen", String(next));
  };

  // Run deferred post-init (pregen + seed) once the engine finishes loading.
  useEffect(() => {
    if (status === "ready" && pendingPostInitRef.current) {
      const fn = pendingPostInitRef.current;
      pendingPostInitRef.current = null;
      fn();
    }
  }, [status]);

  const handleSelectStory = (story, setupAnswers = {}) => {
    const oldPlayerName = story.characters?.find((c) => c.isPlayer)?.name;

    // Apply setup answers to the player character
    const chars = (story.characters ?? []).map((c) =>
      c.isPlayer ? { ...c, ...setupAnswers } : c
    );
    const newPlayerName = chars.find((c) => c.isPlayer)?.name ?? oldPlayerName;

    // Interpolate ${field} placeholders in entry text using setup answers
    const interpolate = (text) =>
      text?.replace(/\$\{(\w+)\}/g, (_, key) => setupAnswers[key] ?? `\${${key}}`);

    const initialEntries = (story.entries ?? []).map((e) => ({
      ...e,
      text: interpolate(e.text),
      ...(e.character === oldPlayerName ? { character: newPlayerName } : {}),
    }));

    // Non-character setup fields become extra context in the system prompt
    const CHARACTER_FIELDS = new Set(["name", "gender", "class", "avatar", "disposition"]);
    const extraContext = (story.setup ?? [])
      .filter((q) => !CHARACTER_FIELDS.has(q.field) && setupAnswers[q.field]?.trim())
      .map((q) => ({ label: q.label, value: setupAnswers[q.field] }));

    const initialNpcs = story.npcs ?? [];
    setActiveStory(story);
    setPendingStory(null);
    setCharacters(chars);
    setEntries(initialEntries);
    setNpcs(initialNpcs);
    setLastRun(null);
    setSystemPrompt(buildSystemPrompt(chars, initialNpcs, extraContext));
    setRoster([...chars.map((c) => c.name), ...initialNpcs.map((n) => n.name)]);

    const runPostInit = async () => {
      if (pregenerationEnabled) {
        await pregenerateContext(
          { description: story.description ?? "", characters: chars, npcs: initialNpcs, extraContext },
          {
            onDone: (briefing) => appendToSystemPrompt(`\n\nSTORY CONTEXT:\n${briefing}`),
            onError: (err) => console.warn("[YCDA] Pre-gen failed, continuing without briefing:", err),
          }
        );
      }
      seedInitialEntries(initialEntries);
    };

    if (status === "ready") {
      runPostInit();
    } else {
      pendingPostInitRef.current = runPostInit;
    }
  };

  const handlePlayStory = (story) => {
    if (story.setup?.length) {
      setPendingStory(story);
    } else {
      handleSelectStory(story);
    }
  };

  const playerCharacter = characters.find((c) => c.isPlayer);

  const mergeNewChars = (newChars) => {
    if (!newChars.length) return;
    // Deduplicate against the full roster: party + existing npcs
    const rosterNames = [
      ...characters.map((c) => c.name.toLowerCase()),
      ...npcs.map((n) => n.name.toLowerCase()),
    ];
    const isVariant = (newName) => {
      const lower = newName.toLowerCase();
      // Reject exact matches and prefix overlaps in either direction
      // e.g. "Forest Guardian" blocks "Forest Guardian's Reflection" and vice-versa
      return rosterNames.some(
        (existing) => lower === existing || lower.startsWith(existing + "'") || lower.startsWith(existing + " ") || existing.startsWith(lower + "'") || existing.startsWith(lower + " ")
      );
    };
    const ABSTRACT_ROLE_PREFIXES = [
      "manifestation", "projection", "echo", "spirit", "reflection",
      "embodiment", "essence", "aspect", "avatar of", "presence of",
      "extension of", "personification",
    ];
    const isAbstractChar = (c) => {
      // Names like "Headmistress's burning aura" contain a possessive mid-phrase
      if (/'s\s+\w/i.test(c.name)) return true;
      const roleLower = (c.role || "").toLowerCase();
      return ABSTRACT_ROLE_PREFIXES.some((p) => roleLower.startsWith(p));
    };
    const truly_new = newChars.filter((c) => !isVariant(c.name) && !isAbstractChar(c));
    if (truly_new.length) {
      setNpcs((prev) => {
        const updated = [...prev, ...truly_new];
        setRoster([...characters.map((c) => c.name), ...updated.map((n) => n.name)]);
        return updated;
      });
    }
  };

  const callGenerate = (userMessage) => {
    if (!isLLMReady) return;
    generate(userMessage, {
      onPlaceholder: (id) => setEntries((prev) => [...prev, { id, type: "story", text: "…" }]),
      onChunk: (id, partial) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, text: partial } : e))),
      onComplete: (id, parsedEntries, newChars) => {
        setEntries((prev) => [...prev.filter((e) => e.id !== id), ...parsedEntries]);
        setLastRun({ userMessage, aiEntryIds: new Set(parsedEntries.map((e) => e.id)) });
        mergeNewChars(newChars);
      },
      onError: () => setEntries((prev) => prev.filter((e) => e.id !== STREAMING_ENTRY_ID)),
      onCompact: (summary) => setEntries((prev) => [...prev, { id: Date.now() + Math.random(), type: "story", source: "compact", text: summary }]),
    });
  };

  const handleSubmit = (inputMode, text) => {
    const newEntry = {
      id: Date.now(),
      type: inputMode,
      text,
      ...(inputMode !== "story" ? { character: playerCharacter?.name } : { source: "user" }),
    };
    setEntries((prev) => [...prev, newEntry]);
    callGenerate(formatUserAction(inputMode, text, playerCharacter?.name));
  };

  const handleRerun = () => {
    if (!lastRun || !isLLMReady) return;
    setEntries((prev) => prev.filter((e) => !lastRun.aiEntryIds.has(e.id)));
    setLastRun(null);
    revertLast();
    callGenerate(lastRun.userMessage);
  };

  const handleRemoveLast = () => {
    setEntries((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      pruneEntries([last.id]);
      return prev.slice(0, -1);
    });
  };

  // Story selection screen
  if (!activeStory && !pendingStory) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <StorySelect onPlay={handlePlayStory} isDark={isDark} onToggleTheme={toggleTheme} llmStatus={status} llmProgress={progress} llmModelId={modelId} onSwitchModel={switchModel} pregenerationEnabled={pregenerationEnabled} onTogglePregeneration={togglePregeneration} uploadedStories={uploadedStories} onUploadStory={(story) => setUploadedStories((prev) => { const exists = prev.some((s) => s.id === story.id); return exists ? prev.map((s) => s.id === story.id ? story : s) : [...prev, story]; })} />
      </ThemeProvider>
    );
  }

  // Story setup screen (pre-game questions)
  if (!activeStory && pendingStory) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <StorySetup
          story={pendingStory}
          onStart={(answers) => handleSelectStory(pendingStory, answers)}
          onBack={() => setPendingStory(null)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          llmStatus={status}
          llmProgress={progress}
          llmModelId={modelId}
          onSwitchModel={switchModel}
          pregenerationEnabled={pregenerationEnabled}
          onTogglePregeneration={togglePregeneration}
        />
      </ThemeProvider>
    );
  }

  // Game screen
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default", overflow: "hidden" }}>
        <AppHeader isDark={isDark} onToggleTheme={toggleTheme} llmStatus={status} llmProgress={progress} llmModelId={modelId} onSwitchModel={switchModel} storyTitle={activeStory.title} onHome={() => setActiveStory(null)} pregenerationEnabled={pregenerationEnabled} onTogglePregeneration={togglePregeneration} />

        {/* Main layout */}
        <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
          <CharacterPanel isDark={isDark} npcs={npcs} characters={characters} />

          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default" }}>
            <StoryPanel entries={entries} isDark={isDark} lastRunIds={lastRun?.aiEntryIds ?? null} playerName={playerCharacter?.name} onRemoveEntry={(id) => { pruneEntries([id]); setEntries((prev) => prev.filter((e) => e.id !== id)); }} />
            <InputBar
              onSubmit={handleSubmit}
              onContinue={() => {
                setEntries((prev) => [...prev, { id: Date.now(), type: "story", source: "continue", text: "Continue the story." }]);
                callGenerate("Continue the story.");
              }}
              onRerun={handleRerun}
              onRemoveLast={handleRemoveLast}
              onCancel={cancel}
              canRerun={!!lastRun && isLLMReady}
              canRemoveLast={entries.length > 0}
              isDark={isDark}
              disabled={isGenerating || status === "loading" || status === "initializing"}
              isGenerating={isGenerating}
            />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
