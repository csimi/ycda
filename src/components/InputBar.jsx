import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";

const actionTypes = [
  {
    value: "say",
    label: "Say",
    icon: <RecordVoiceOverIcon sx={{ fontSize: 16 }} />,
    color: "#818cf8",
    activeBg: "rgba(99,102,241,0.15)",
    activeBorder: "rgba(99,102,241,0.6)",
    placeholder: 'What do you say? e.g. "We should split up and search the area."',
  },
  {
    value: "do",
    label: "Do",
    icon: <DirectionsRunIcon sx={{ fontSize: 16 }} />,
    color: "#10b981",
    activeBg: "rgba(16,185,129,0.15)",
    activeBorder: "rgba(16,185,129,0.5)",
    placeholder: "What do you do? e.g. Slowly approach the figure, hand on sword hilt.",
  },
  {
    value: "story",
    label: "Story",
    icon: <AutoStoriesIcon sx={{ fontSize: 16 }} />,
    color: "#d97706",
    activeBg: "rgba(217,119,6,0.12)",
    activeBorder: "rgba(217,119,6,0.5)",
    placeholder: "Add a story beat or narration note...",
  },
];

export default function InputBar({ onSubmit, isDark }) {
  const [mode, setMode] = useState("say");
  const [text, setText] = useState("");

  const activeType = actionTypes.find((t) => t.value === mode);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(mode, trimmed);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  const bgColor = isDark ? "#0f1117" : "#ffffff";
  const toggleBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
  const toggleHover = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const inputBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const inputBorderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)";
  const inputHoverBorder = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)";
  const placeholderColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const disabledBg = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const disabledColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";

  return (
    <Box
      sx={{
        borderTop: `1px solid ${borderColor}`,
        bgcolor: bgColor,
        px: 2.5,
        py: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, whiteSpace: "nowrap" }}>
          I will:
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, val) => val && setMode(val)}
          size="small"
          sx={{ gap: 0.5 }}
        >
          {actionTypes.map((type) => (
            <ToggleButton
              key={type.value}
              value={type.value}
              sx={{
                px: 1.5,
                py: 0.4,
                borderRadius: "8px !important",
                border: `1px solid ${toggleBorder} !important`,
                color: "text.secondary",
                fontSize: "0.75rem",
                fontWeight: 600,
                gap: 0.5,
                textTransform: "none",
                transition: "all 0.15s ease",
                "&.Mui-selected": {
                  color: type.color,
                  bgcolor: type.activeBg,
                  borderColor: `${type.activeBorder} !important`,
                },
                "&:hover": { bgcolor: toggleHover },
              }}
            >
              {type.icon}
              {type.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={activeType.placeholder}
          variant="outlined"
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: inputBg,
              borderRadius: 2,
              fontSize: "0.9rem",
              color: "text.primary",
              "& fieldset": { borderColor: inputBorderColor },
              "&:hover fieldset": { borderColor: inputHoverBorder },
              "&.Mui-focused fieldset": { borderColor: activeType.color },
            },
            "& .MuiInputBase-input::placeholder": { color: placeholderColor, opacity: 1 },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!text.trim()}
          sx={{
            bgcolor: activeType.color,
            color: "#fff",
            fontWeight: 700,
            borderRadius: 2,
            px: 2.5,
            py: 1,
            minWidth: 80,
            flexShrink: 0,
            textTransform: "none",
            fontSize: "0.85rem",
            "&:hover": { bgcolor: activeType.color, filter: "brightness(1.1)" },
            "&.Mui-disabled": { bgcolor: disabledBg, color: disabledColor },
          }}
        >
          {activeType.label}
        </Button>
      </Box>
    </Box>
  );
}
