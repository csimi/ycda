import { useState, useMemo } from "react";
import { Box, Typography, CssBaseline, IconButton, Tooltip } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import CharacterPanel from "./components/CharacterPanel";
import StoryPanel from "./components/StoryPanel";
import InputBar from "./components/InputBar";
import { initialEntries } from "./data/story";
import { characters } from "./data/characters";

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

function App() {
  const [entries, setEntries] = useState(initialEntries);
  const [mode, setMode] = useState(() => localStorage.getItem("theme") ?? "light");

  const theme = useMemo(() => buildTheme(mode), [mode]);

  const toggleMode = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    localStorage.setItem("theme", next);
  };

  const handleSubmit = (mode, text) => {
    const newEntry = {
      id: Date.now(),
      type: mode,
      text,
      ...(mode !== "story" ? { character: playerCharacter.name } : {}),
    };
    setEntries((prev) => [...prev, newEntry]);
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

          <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton onClick={toggleMode} size="small" sx={{ color: "text.secondary" }}>
              {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Main layout */}
        <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
          <CharacterPanel isDark={isDark} />

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
            <InputBar onSubmit={handleSubmit} isDark={isDark} />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
