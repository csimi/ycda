import { useState } from "react";
import {
  Box, Typography, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  Menu, MenuItem, ListItemIcon, ListItemText, Divider,
  ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import SaveIcon from "@mui/icons-material/Save";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import TextFormatIcon from "@mui/icons-material/TextFormat";
import MenuIcon from "@mui/icons-material/Menu";
import LLMStatusBar from "./LLMStatusBar";

const DIFFICULTY_LABELS = {
  easy:   { short: "E", name: "Easy",   blurb: "You're the hero — the world bends around your choices." },
  medium: { short: "M", name: "Medium", blurb: "NPCs push back. You must earn cooperation through leverage, persistence, or persuasion." },
  hard:   { short: "H", name: "Hard",   blurb: "You're just another person in a living world. Events unfold with or without you." },
};

export default function AppHeader({ isDark, onToggleTheme, llmStatus, llmProgress, llmLoadingPhase, llmModelId, llmError, onSwitchModel, onCancelLoad, onRetryLoad, llmInitializingLabel, customConfig, onSaveCustomConfig, storyTitle, onHome, difficulty, onDifficultyChange, onOpenSaves, isMobile, fontSerif, onToggleFontSerif, fontScale, onIncreaseFontSize, onDecreaseFontSize }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const closeMenu = () => setMenuAnchor(null);

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
        <LLMStatusBar status={llmStatus} loadingPhase={llmLoadingPhase} error={llmError} modelId={llmModelId} onSwitchModel={onSwitchModel} onCancelLoad={onCancelLoad} onRetryLoad={onRetryLoad} initializingLabel={llmInitializingLabel} customConfig={customConfig} onSaveCustomConfig={onSaveCustomConfig} />
        {isMobile ? (
          <>
            <Tooltip title="Options">
              <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} size="small" sx={{ color: "text.secondary" }}>
                <MenuIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={menuAnchor}
              open={!!menuAnchor}
              onClose={closeMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{ paper: { sx: { maxWidth: "min(320px, calc(100vw - 24px))" } } }}
            >
              {onDifficultyChange && (
                <>
                  {["easy", "medium", "hard"].map((key) => (
                    <MenuItem
                      key={key}
                      onClick={() => { onDifficultyChange(key); closeMenu(); }}
                      selected={difficulty === key}
                      sx={{ whiteSpace: "normal", alignItems: "flex-start" }}
                    >
                      <ListItemIcon sx={{ mt: 0.5 }}>
                        {difficulty === key ? <CheckIcon fontSize="small" color="primary" /> : <Box sx={{ width: 20 }} />}
                      </ListItemIcon>
                      <ListItemText
                        primary={`Difficulty: ${DIFFICULTY_LABELS[key].name}`}
                        secondary={DIFFICULTY_LABELS[key].blurb}
                        slotProps={{ secondary: { sx: { fontSize: "0.72rem", whiteSpace: "normal" } } }}
                      />
                    </MenuItem>
                  ))}
                  <Divider />
                </>
              )}
              {onOpenSaves && (
                <MenuItem onClick={() => { onOpenSaves(); closeMenu(); }}>
                  <ListItemIcon><SaveIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Saved games</ListItemText>
                </MenuItem>
              )}
              <Divider />
              {onToggleFontSerif && (
                <MenuItem onClick={() => { onToggleFontSerif(); closeMenu(); }}>
                  <ListItemIcon><TextFormatIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Font: {fontSerif ? "serif" : "sans-serif"}</ListItemText>
                </MenuItem>
              )}
              {onDecreaseFontSize && (
                <MenuItem onClick={() => { onDecreaseFontSize(); }} disabled={(fontScale ?? 1) <= 0.8}>
                  <ListItemIcon><TextDecreaseIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Decrease text ({Math.round((fontScale ?? 1) * 100)}%)</ListItemText>
                </MenuItem>
              )}
              {onIncreaseFontSize && (
                <MenuItem onClick={() => { onIncreaseFontSize(); }} disabled={(fontScale ?? 1) >= 1.6}>
                  <ListItemIcon><TextIncreaseIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Increase text ({Math.round((fontScale ?? 1) * 100)}%)</ListItemText>
                </MenuItem>
              )}
              <Divider />
              <MenuItem onClick={() => { onToggleTheme(); closeMenu(); }}>
                <ListItemIcon>{isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}</ListItemIcon>
                <ListItemText>{isDark ? "Light mode" : "Dark mode"}</ListItemText>
              </MenuItem>
            </Menu>
          </>
        ) : (
          <>
            {onDifficultyChange && (
              <Tooltip
                arrow
                placement="bottom-end"
                title={
                  <Box>
                    <Box sx={{ fontWeight: 600, mb: 0.3 }}>Difficulty: {DIFFICULTY_LABELS[difficulty ?? "easy"].name}</Box>
                    <Box sx={{ fontSize: "0.75rem", opacity: 0.85 }}>{DIFFICULTY_LABELS[difficulty ?? "easy"].blurb}</Box>
                  </Box>
                }
              >
                <ToggleButtonGroup
                  value={difficulty ?? "easy"}
                  exclusive
                  onChange={(_, next) => { if (next) onDifficultyChange(next); }}
                  size="small"
                  sx={{ mr: 0.5, "& .MuiToggleButton-root": { px: 1, py: 0.2, minWidth: 28, fontWeight: 700, fontSize: "0.75rem", lineHeight: 1, border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.18)"}` } }}
                >
                  {["easy", "medium", "hard"].map((key) => (
                    <ToggleButton key={key} value={key} aria-label={`Difficulty: ${DIFFICULTY_LABELS[key].name}`}>
                      {DIFFICULTY_LABELS[key].short}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Tooltip>
            )}
            {onOpenSaves && (
              <Tooltip title="Saved games">
                <IconButton onClick={onOpenSaves} size="small" sx={{ color: "text.secondary" }}>
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onToggleFontSerif && (
              <Tooltip title={`Font: ${fontSerif ? "serif" : "sans-serif"} (click to switch)`}>
                <IconButton onClick={onToggleFontSerif} size="small" sx={{ color: "text.secondary", width: 30, height: 30, fontWeight: 700, fontSize: "0.95rem" }}>
                  A
                </IconButton>
              </Tooltip>
            )}
            {onDecreaseFontSize && (
              <Tooltip title={`Decrease font size (${Math.round((fontScale ?? 1) * 100)}%)`}>
                <span>
                  <IconButton onClick={onDecreaseFontSize} size="small" sx={{ color: "text.secondary" }} disabled={(fontScale ?? 1) <= 0.8}>
                    <TextDecreaseIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {onIncreaseFontSize && (
              <Tooltip title={`Increase font size (${Math.round((fontScale ?? 1) * 100)}%)`}>
                <span>
                  <IconButton onClick={onIncreaseFontSize} size="small" sx={{ color: "text.secondary" }} disabled={(fontScale ?? 1) >= 1.6}>
                    <TextIncreaseIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
              <IconButton onClick={onToggleTheme} size="small" sx={{ color: "text.secondary" }}>
                {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </>
        )}
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
