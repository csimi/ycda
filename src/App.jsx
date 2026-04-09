import { useState, useMemo } from "react";
import { Box, CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CharacterPanel from "./components/CharacterPanel";
import StoryPanel from "./components/StoryPanel";
import InputBar from "./components/InputBar";
import AppHeader from "./components/AppHeader";
import StorySelect from "./components/StorySelect";
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
  const [activeStory, setActiveStory] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [entries, setEntries] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const { status, progress, modelId, generate, revertLast, setSystemPrompt, switchModel } = useLLM();

  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);
  const isDark = themeMode === "dark";
  const isGenerating = status === "generating";
  const isLLMReady   = status === "ready";

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setThemeMode(next);
    localStorage.setItem("theme", next);
  };

  const handleSelectStory = (story) => {
    setActiveStory(story);
    setCharacters(story.characters ?? []);
    setEntries(story.entries ?? []);
    setNpcs(story.npcs ?? []);
    setLastRun(null);
    setSystemPrompt(buildSystemPrompt(story.characters ?? [], story.npcs ?? []));
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
    const truly_new = newChars.filter((c) => !isVariant(c.name));
    if (truly_new.length) setNpcs((prev) => [...prev, ...truly_new]);
  };

  const markKilled = (killedNames) => {
    const killed = new Set(killedNames.map((n) => n.toLowerCase()));
    setCharacters((prev) => prev.map((c) => killed.has(c.name.toLowerCase()) ? { ...c, dead: true } : c));
    setNpcs((prev) => prev.map((n) => killed.has(n.name.toLowerCase()) ? { ...n, dead: true } : n));
  };

  const callGenerate = (userMessage) => {
    if (!isLLMReady) return;
    generate(userMessage, {
      onPlaceholder: (id) => setEntries((prev) => [...prev, { id, type: "story", text: "…" }]),
      onChunk: (id, partial) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, text: partial } : e))),
      onComplete: (id, parsedEntries, newChars, killedNames) => {
        setEntries((prev) => [...prev.filter((e) => e.id !== id), ...parsedEntries]);
        setLastRun({ userMessage, aiEntryIds: new Set(parsedEntries.map((e) => e.id)) });
        mergeNewChars(newChars);
        if (killedNames.length) markKilled(killedNames);
      },
      onError: () => setEntries((prev) => prev.filter((e) => e.id !== STREAMING_ENTRY_ID)),
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

  // Story selection screen
  if (!activeStory) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <StorySelect onPlay={handleSelectStory} isDark={isDark} onToggleTheme={toggleTheme} llmStatus={status} llmProgress={progress} llmModelId={modelId} onSwitchModel={switchModel} />
      </ThemeProvider>
    );
  }

  // Game screen
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default", overflow: "hidden" }}>
        <AppHeader isDark={isDark} onToggleTheme={toggleTheme} llmStatus={status} llmProgress={progress} llmModelId={modelId} onSwitchModel={switchModel} storyTitle={activeStory.title} onHome={() => setActiveStory(null)} />

        {/* Main layout */}
        <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
          <CharacterPanel isDark={isDark} npcs={npcs} characters={characters} />

          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default" }}>
            <StoryPanel entries={entries} isDark={isDark} onRemoveEntry={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))} />
            <InputBar
              onSubmit={handleSubmit}
              onContinue={() => {
                setEntries((prev) => [...prev, { id: Date.now(), type: "story", source: "continue", text: "Continue the story." }]);
                callGenerate("Continue the story.");
              }}
              onRerun={handleRerun}
              canRerun={!!lastRun && isLLMReady}
              isDark={isDark}
              disabled={isGenerating || status === "loading"}
            />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
