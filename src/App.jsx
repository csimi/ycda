import { useState, useMemo } from "react";
import { Box, Typography, CssBaseline, IconButton, Tooltip } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import CharacterPanel from "./components/CharacterPanel";
import StoryPanel from "./components/StoryPanel";
import InputBar from "./components/InputBar";
import LLMStatusBar from "./components/LLMStatusBar";
import { initialEntries } from "./data/story";
import { characters, npcs as initialNpcs } from "./data/characters";
import { useLLM, STREAMING_ENTRY_ID } from "./hooks/useLLM";

const playerCharacter = characters.find((c) => c.isPlayer);

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
  const [entries, setEntries] = useState(initialEntries);
  const [npcs, setNpcs] = useState(initialNpcs);
  const [lastRun, setLastRun] = useState(null); // { userMessage, aiEntryIds: Set }
  const [mode, setMode] = useState(() => localStorage.getItem("theme") ?? "light");
  const { status, progress, generate, revertLast } = useLLM();

  const theme = useMemo(() => buildTheme(mode), [mode]);

  const isGenerating = status === "generating";
  const isLLMReady   = status === "ready";

  const toggleMode = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    localStorage.setItem("theme", next);
  };

  const mergeNewChars = (newChars) => {
    if (!newChars.length) return;
    setNpcs((prev) => {
      const existing = new Set(prev.map((n) => n.name.toLowerCase()));
      const truly_new = newChars.filter((c) => !existing.has(c.name.toLowerCase()));
      return truly_new.length ? [...prev, ...truly_new] : prev;
    });
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
    });
  };

  const handleSubmit = (inputMode, text) => {
    const newEntry = {
      id: Date.now(),
      type: inputMode,
      text,
      ...(inputMode !== "story" ? { character: playerCharacter.name } : { source: "user" }),
    };
    setEntries((prev) => [...prev, newEntry]);
    callGenerate(formatUserAction(inputMode, text, playerCharacter.name));
  };

  const handleRerun = () => {
    if (!lastRun || !isLLMReady) return;
    setEntries((prev) => prev.filter((e) => !lastRun.aiEntryIds.has(e.id)));
    setLastRun(null);
    revertLast();
    callGenerate(lastRun.userMessage);
  };

  const isDark = mode === "dark";
  const headerBg = isDark ? "#0a0c14" : "#ffffff";
  const headerBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          bgcolor: "background.default",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 1.2,
            bgcolor: headerBg,
            borderBottom: `1px solid ${headerBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: "1.1rem", mr: 0.5 }}>📖</Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, fontSize: "1rem", letterSpacing: 1, color: "primary.main" }}
          >
            YCDA
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
            · You Can Do Anything
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <LLMStatusBar status={status} progress={progress} />

          <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton onClick={toggleMode} size="small" sx={{ color: "text.secondary" }}>
              {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Main layout */}
        <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
          <CharacterPanel isDark={isDark} npcs={npcs} />

          {/* Right: story + input */}
          <Box
            sx={{
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              bgcolor: "background.default",
            }}
          >
            <StoryPanel entries={entries} isDark={isDark} />
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
