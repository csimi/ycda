import { useState } from "react";
import { Box, Typography, TextField, Button } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AppHeader from "./AppHeader";

export default function StorySetup({
  story,
  onStart,
  onBack,
  isDark,
  onToggleTheme,
  llmStatus,
  llmProgress,
  llmModelId,
  onSwitchModel,
  pregenerationEnabled,
  onTogglePregeneration,
  isMobile,
  fontSerif,
  onToggleFontSerif,
  fontScale,
  onIncreaseFontSize,
  onDecreaseFontSize,
}) {
  const player = story.characters?.find((c) => c.isPlayer);

  const [values, setValues] = useState(() =>
    Object.fromEntries(story.setup.map((q) => [q.field, player?.[q.field] ?? q.default ?? ""]))
  );

  const allFilled = story.setup.every((q) => values[q.field]?.trim());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (allFilled) onStart(values);
  };

  return (
    <Box sx={{ height: "100%", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <AppHeader
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        llmStatus={llmStatus}
        llmProgress={llmProgress}
        llmModelId={llmModelId}
        onSwitchModel={onSwitchModel}
        pregenerationEnabled={pregenerationEnabled}
        onTogglePregeneration={onTogglePregeneration}
        isMobile={isMobile}
        fontSerif={fontSerif}
        onToggleFontSerif={onToggleFontSerif}
        fontScale={fontScale}
        onIncreaseFontSize={onIncreaseFontSize}
        onDecreaseFontSize={onDecreaseFontSize}
      />

      <Box sx={{ flexGrow: 1, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 3 }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            maxWidth: 440,
            width: "100%",
            bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
            borderRadius: 3,
            p: 4,
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, mb: 0.5 }}
          >
            {story.title}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", mb: 3 }}>
            Tell us about your character before you begin.
          </Typography>

          {story.setup.map((q) => (
            <TextField
              key={q.field}
              label={q.label}
              value={values[q.field]}
              onChange={(e) => setValues((prev) => ({ ...prev, [q.field]: e.target.value }))}
              fullWidth
              size="small"
              multiline={!!q.multiline}
              minRows={q.multiline ? 2 : undefined}
              sx={{ mb: 2 }}
              autoFocus={q === story.setup[0]}
            />
          ))}

          <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
            <Button
              onClick={onBack}
              startIcon={<ArrowBackIcon />}
              sx={{ textTransform: "none" }}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="contained"
              endIcon={<PlayArrowIcon />}
              disabled={!allFilled}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
            >
              Start Adventure
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
