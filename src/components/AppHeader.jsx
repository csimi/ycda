import { useState } from "react";
import {
  Box, Typography, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LLMStatusBar from "./LLMStatusBar";

export default function AppHeader({ isDark, onToggleTheme, llmStatus, llmProgress, llmModelId, onSwitchModel, storyTitle, onHome }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          px: 3,
          py: 1.2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexShrink: 0,
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
          bgcolor: isDark ? "#0a0c14" : "#ffffff",
          position: "relative",
        }}
      >
        {llmStatus === "loading" && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            }}
          >
            <Box
              sx={{
                height: "100%",
                width: `${Math.round(llmProgress * 100)}%`,
                bgcolor: "primary.main",
                transition: "width 0.3s ease",
              }}
            />
          </Box>
        )}
        <Typography sx={{ fontSize: "1.1rem", mr: 0.5 }}>📖</Typography>
        <Typography
          variant="h6"
          onClick={onHome ? () => setConfirmOpen(true) : undefined}
          sx={{
            fontWeight: 800,
            fontSize: "1rem",
            letterSpacing: 1,
            color: "primary.main",
            cursor: onHome ? "pointer" : "default",
            "&:hover": onHome ? { opacity: 0.75 } : {},
            transition: "opacity 0.15s",
          }}
        >
          YCDA
        </Typography>
        {storyTitle && (
          <Typography variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
            · {storyTitle}
          </Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <LLMStatusBar status={llmStatus} modelId={llmModelId} onSwitchModel={onSwitchModel} />
        <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          <IconButton onClick={onToggleTheme} size="small" sx={{ color: "text.secondary" }}>
            {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Leave this story?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your current progress will be lost. Return to the story selection screen?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: "none" }}>
            Stay
          </Button>
          <Button
            variant="contained"
            onClick={() => { setConfirmOpen(false); onHome(); }}
            sx={{ textTransform: "none" }}
          >
            Leave story
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
