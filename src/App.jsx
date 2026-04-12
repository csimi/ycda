import { useState, useMemo, useEffect, useRef } from "react";
import { Box, CssBaseline, useMediaQuery } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CharacterPanel from "./components/CharacterPanel";
import StoryPanel from "./components/StoryPanel";
import InputBar from "./components/InputBar";
import AppHeader from "./components/AppHeader";
import StorySelect from "./components/StorySelect";
import StorySetup from "./components/StorySetup";
import { buildSystemPrompt } from "./data/systemPrompt";
import { useLLM, STREAMING_ENTRY_ID } from "./hooks/useLLM";
import { useSaves } from "./hooks/useSaves";
import SavesDialog from "./components/SavesDialog";

const SERIF_STACK = "'Georgia', 'Cambria', 'Times New Roman', serif";
const SANS_STACK  = "'Inter', 'Segoe UI', sans-serif";

function buildTheme(mode, fontSerif, fontScale) {
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
      fontFamily: fontSerif ? SERIF_STACK : SANS_STACK,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { fontSize: `${16 * fontScale}px` },
        },
      },
    },
  });
}

function formatUserAction(inputMode, text, characterName) {
  if (inputMode === "say") return `${characterName} says: "${text}"`;
  if (inputMode === "do")  return `${characterName}: ${text}`;
  return `[Scene detail from the player] ${text}`;
}

function App() {
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("theme") ?? "light");
  const [pregenerationEnabled, setPregenerationEnabled] = useState(() => localStorage.getItem("pregen") !== "false");
  const [exploreMode, setExploreMode] = useState(() => localStorage.getItem("explore") === "true");
  const [fontSerif, setFontSerif] = useState(() => localStorage.getItem("fontSerif") !== "false");
  const [fontScale, setFontScale] = useState(() => {
    const v = parseFloat(localStorage.getItem("fontScale"));
    return Number.isFinite(v) ? v : 1;
  });
  const [activeStory, setActiveStory] = useState(null);
  const [pendingStory, setPendingStory] = useState(null);
  const [uploadedStories, setUploadedStories] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [entries, setEntries] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const { status, progress, modelId, error: llmError, generate, revertLast, setSystemPrompt, setRoster, switchModel, cancel, cancelLoad, retryLoad, pruneEntries, pregenerateContext, appendToSystemPrompt, seedInitialEntries, getSnapshot, restoreSnapshot } = useLLM();
  const { saves, saveGame, deleteSave } = useSaves();
  const [savesDialogOpen, setSavesDialogOpen] = useState(false);
  const [savesDialogMode, setSavesDialogMode] = useState("load");
  const pendingPostInitRef = useRef(null);

  const theme = useMemo(() => buildTheme(themeMode, fontSerif, fontScale), [themeMode, fontSerif, fontScale]);
  const isDark = themeMode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const toggleExploreMode = () => {
    const next = !exploreMode;
    setExploreMode(next);
    localStorage.setItem("explore", String(next));
  };

  const toggleFontSerif = () => {
    const next = !fontSerif;
    setFontSerif(next);
    localStorage.setItem("fontSerif", String(next));
  };

  const adjustFontScale = (delta) => {
    const next = Math.min(1.6, Math.max(0.8, Math.round((fontScale + delta) * 100) / 100));
    setFontScale(next);
    localStorage.setItem("fontScale", String(next));
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

  const wrapWithExplorePrompt = (msg) => {
    if (!exploreMode) return msg;
    return `${msg}\n\n[EXPLORE MODE] Stay in the current moment. Do not skip time, change location, or introduce new conflicts. Focus on deepening the current interaction: character dialogue, reactions, atmosphere, and sensory detail. Characters should still speak and act naturally.`;
  };

  const callGenerate = (userMessage) => {
    if (!isLLMReady) return;
    generate(wrapWithExplorePrompt(userMessage), {
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

  const handleSaveGame = async () => {
    if (!activeStory) return;
    const snapshot = getSnapshot();
    await saveGame({
      storyId:    activeStory.id,
      storyTitle: activeStory.title,
      snapshot:   { entries, characters, npcs, llmHistory: snapshot.history, entryBatches: snapshot.entryBatches },
    });
  };

  const handleLoadGame = (save) => {
    const { characters: chars, npcs: savedNpcs, entries: savedEntries, llmHistory, entryBatches } = save.snapshot;
    restoreSnapshot({ history: llmHistory, entryBatches });
    setRoster([...chars.map((c) => c.name), ...savedNpcs.map((n) => n.name)]);
    setActiveStory({ id: save.storyId, title: save.storyTitle });
    setCharacters(chars);
    setNpcs(savedNpcs);
    setEntries(savedEntries);
    setLastRun(null);
    setPendingStory(null);
    setSavesDialogOpen(false);
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

  const savesDialog = (
    <SavesDialog
      open={savesDialogOpen}
      onClose={() => setSavesDialogOpen(false)}
      mode={savesDialogMode}
      saves={saves}
      onSaveNow={handleSaveGame}
      onLoad={handleLoadGame}
      onDelete={deleteSave}
      isDark={isDark}
      storyTitle={activeStory?.title}
    />
  );

  // Story selection screen
  if (!activeStory && !pendingStory) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <StorySelect
          onPlay={handlePlayStory}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          llmStatus={status}
          llmProgress={progress}
          llmModelId={modelId}
          llmError={llmError}
          onSwitchModel={switchModel}
          onCancelLoad={cancelLoad}
          onRetryLoad={retryLoad}
          pregenerationEnabled={pregenerationEnabled}
          onTogglePregeneration={togglePregeneration}
          uploadedStories={uploadedStories}
          onUploadStory={(story) => setUploadedStories((prev) => { const exists = prev.some((s) => s.id === story.id); return exists ? prev.map((s) => s.id === story.id ? story : s) : [...prev, story]; })}
          saves={saves}
          onLoadSave={handleLoadGame}
          onDeleteSave={deleteSave}
          onOpenSavesDialog={() => { setSavesDialogMode("load"); setSavesDialogOpen(true); }}
          isMobile={isMobile}
          fontSerif={fontSerif}
          onToggleFontSerif={toggleFontSerif}
          fontScale={fontScale}
          onIncreaseFontSize={() => adjustFontScale(0.1)}
          onDecreaseFontSize={() => adjustFontScale(-0.1)}
        />
        {savesDialog}
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
          llmError={llmError}
          onSwitchModel={switchModel}
          onCancelLoad={cancelLoad}
          onRetryLoad={retryLoad}
          pregenerationEnabled={pregenerationEnabled}
          onTogglePregeneration={togglePregeneration}
          isMobile={isMobile}
          fontSerif={fontSerif}
          onToggleFontSerif={toggleFontSerif}
          fontScale={fontScale}
          onIncreaseFontSize={() => adjustFontScale(0.1)}
          onDecreaseFontSize={() => adjustFontScale(-0.1)}
        />
        {savesDialog}
      </ThemeProvider>
    );
  }

  // Game screen
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default", overflow: "hidden" }}>
        <AppHeader
          isDark={isDark}
          onToggleTheme={toggleTheme}
          llmStatus={status}
          llmProgress={progress}
          llmModelId={modelId}
          llmError={llmError}
          onSwitchModel={switchModel}
          onCancelLoad={cancelLoad}
          onRetryLoad={retryLoad}
          storyTitle={activeStory.title}
          onHome={() => setActiveStory(null)}
          pregenerationEnabled={pregenerationEnabled}
          onTogglePregeneration={togglePregeneration}
          onOpenSaves={() => { setSavesDialogMode("save"); setSavesDialogOpen(true); }}
          isMobile={isMobile}
          fontSerif={fontSerif}
          onToggleFontSerif={toggleFontSerif}
          fontScale={fontScale}
          onIncreaseFontSize={() => adjustFontScale(0.1)}
          onDecreaseFontSize={() => adjustFontScale(-0.1)}
        />

        {/* Main layout */}
        <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden", position: "relative" }}>
          <CharacterPanel isDark={isDark} npcs={npcs} characters={characters} isMobile={isMobile} open={!isMobile || sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {isMobile && (
            <Box
              onClick={() => setSidebarOpen((v) => !v)}
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                color: "text.secondary",
                cursor: "pointer",
                zIndex: 1,
                transition: "background-color 0.15s",
                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" },
              }}
            >
              {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </Box>
          )}

          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default", pl: isMobile ? "22px" : 0 }}>
            <StoryPanel entries={entries} isDark={isDark} lastRunIds={lastRun?.aiEntryIds ?? null} playerName={playerCharacter?.name} onRemoveEntry={(id) => { pruneEntries([id]); setEntries((prev) => prev.filter((e) => e.id !== id)); }} />
            <InputBar
              onSubmit={handleSubmit}
              onContinue={() => {
                setEntries((prev) => [...prev, { id: Date.now(), type: "story", source: "continue", text: exploreMode ? "Explore the scene." : "Continue the story." }]);
                callGenerate(
                  exploreMode
                    ? "Elaborate on the current scene — add character dialogue, reactions, atmosphere, or environmental details. Do not advance the plot or introduce new events."
                    : "Continue the scene with a new development — an action, revelation, or NPC reaction. Do not repeat or summarize recent beats."
                );
              }}
              onRerun={handleRerun}
              onRemoveLast={handleRemoveLast}
              onCancel={cancel}
              onScenario={(scenario) => {
                setEntries((prev) => [...prev, { id: Date.now(), type: "story", source: "scenario", text: scenario.label }]);
                callGenerate(scenario.prompt);
              }}
              canRerun={!!lastRun && isLLMReady}
              canRemoveLast={entries.length > 0}
              scenarios={activeStory?.scenarios ?? []}
              isDark={isDark}
              disabled={status !== "ready"}
              isGenerating={isGenerating}
              exploreMode={exploreMode}
              onToggleExploreMode={toggleExploreMode}
              isMobile={isMobile}
            />
          </Box>
        </Box>
      </Box>
      {savesDialog}
    </ThemeProvider>
  );
}

export default App;
