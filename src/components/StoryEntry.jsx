import { Box, Typography, Tooltip } from "@mui/material";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import EditNoteIcon from "@mui/icons-material/EditNote";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import CompressIcon from "@mui/icons-material/Compress";
import MovieIcon from "@mui/icons-material/Movie";

const typeConfig = {
  story: {
    icon: <AutoStoriesIcon sx={{ fontSize: 14 }} />,
    label: "Narrator",
    dark: {
      bubbleBg: "transparent",
      textColor: "rgba(220,210,200,0.9)",
      labelColor: "rgba(180,160,120,0.8)",
      iconBg: "rgba(180,160,120,0.15)",
    },
    light: {
      bubbleBg: "transparent",
      textColor: "#5c4a2a",
      labelColor: "#9c7b3a",
      iconBg: "rgba(156,123,58,0.12)",
    },
    italic: true,
    border: "none",
    px: 3,
  },
  say: {
    icon: <RecordVoiceOverIcon sx={{ fontSize: 14 }} />,
    label: "Says",
    dark: {
      bubbleBg: "rgba(99,102,241,0.18)",
      textColor: "#e0e7ff",
      labelColor: "rgba(165,180,252,0.9)",
    },
    light: {
      bubbleBg: "rgba(99,102,241,0.1)",
      textColor: "#312e81",
      labelColor: "#4f46e5",
    },
    italic: false,
    border: { dark: "1px solid rgba(99,102,241,0.35)", light: "1px solid rgba(99,102,241,0.3)" },
    px: 1.5,
  },
  do: {
    icon: <DirectionsRunIcon sx={{ fontSize: 14 }} />,
    label: "Does",
    dark: {
      bubbleBg: "rgba(16,185,129,0.12)",
      textColor: "#d1fae5",
      labelColor: "rgba(110,231,183,0.9)",
    },
    light: {
      bubbleBg: "rgba(16,185,129,0.08)",
      textColor: "#064e3b",
      labelColor: "#059669",
    },
    italic: true,
    border: { dark: "1px solid rgba(16,185,129,0.3)", light: "1px solid rgba(16,185,129,0.35)" },
    px: 1.5,
  },
};

export default function StoryEntry({ entry, isDark, isPlayer }) {
  const cfg = typeConfig[entry.type];
  const colors = isDark ? cfg.dark : cfg.light;
  const border = typeof cfg.border === "object" ? (isDark ? cfg.border.dark : cfg.border.light) : cfg.border;

  if (entry.type === "story" && entry.source === "compact") {
    const color = isDark ? "rgba(251,191,36,0.35)" : "rgba(180,130,20,0.45)";
    const lineColor = isDark ? "rgba(251,191,36,0.12)" : "rgba(180,130,20,0.15)";
    const inner = (
      <Box sx={{ px: 3, py: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flexGrow: 1, height: "1px", bgcolor: lineColor }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, color, cursor: entry.text ? "help" : "default" }}>
          <CompressIcon sx={{ fontSize: 11 }} />
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color, whiteSpace: "nowrap" }}>
            context compacted
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1, height: "1px", bgcolor: lineColor }} />
      </Box>
    );
    return entry.text
      ? <Tooltip title={entry.text} placement="top" arrow><span>{inner}</span></Tooltip>
      : inner;
  }

  if (entry.type === "story" && entry.source === "scenario") {
    const color = isDark ? "rgba(168,85,247,0.6)" : "rgba(126,34,206,0.55)";
    const lineColor = isDark ? "rgba(168,85,247,0.15)" : "rgba(126,34,206,0.12)";
    return (
      <Box sx={{ px: 3, py: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flexGrow: 1, height: "1px", bgcolor: lineColor }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color }}>
          <MovieIcon sx={{ fontSize: 11 }} />
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color, whiteSpace: "nowrap" }}>
            {entry.text}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1, height: "1px", bgcolor: lineColor }} />
      </Box>
    );
  }

  if (entry.type === "story" && entry.source === "continue") {
    const color = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
    return (
      <Box sx={{ px: 3, py: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flexGrow: 1, height: "1px", bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)" }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, color }}>
          <SkipNextIcon sx={{ fontSize: 11 }} />
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color, whiteSpace: "nowrap" }}>
            continue
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1, height: "1px", bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)" }} />
      </Box>
    );
  }

  if (entry.type === "story" && entry.source === "user") {
    const accentColor = isDark ? "rgba(251,191,36,0.7)" : "rgba(180,130,20,0.7)";
    const textColor   = isDark ? "rgba(251,191,36,0.85)" : "#7c5a0a";
    const bgColor     = isDark ? "rgba(251,191,36,0.06)" : "rgba(251,191,36,0.08)";
    const borderColor = isDark ? "rgba(251,191,36,0.3)" : "rgba(180,130,20,0.3)";
    return (
      <Box
        sx={{
          mx: 3,
          my: 0.5,
          px: 1.5,
          py: 0.8,
          display: "flex",
          gap: 1.2,
          alignItems: "flex-start",
          bgcolor: bgColor,
          border: `1px dashed ${borderColor}`,
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            mt: 0.2,
            width: 22,
            height: 22,
            borderRadius: "50%",
            bgcolor: isDark ? "rgba(251,191,36,0.12)" : "rgba(180,130,20,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: accentColor,
          }}
        >
          <EditNoteIcon sx={{ fontSize: 13 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.62rem", color: accentColor, fontWeight: 600, mb: 0.2 }}>
            Player note
          </Typography>
          <Typography
            sx={{
              color: textColor,
              fontSize: "0.88rem",
              lineHeight: 1.6,
            }}
          >
            {entry.text}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (entry.type === "story") {
    return (
      <Box sx={{ px: cfg.px, py: 0.8, display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Box
          sx={{
            mt: 0.3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            bgcolor: colors.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: colors.labelColor,
          }}
        >
          {cfg.icon}
        </Box>
        <Typography
          sx={{
            color: colors.textColor,
            fontStyle: "italic",
            fontSize: "0.95rem",
            lineHeight: 1.75,
            fontFamily: "'Georgia', serif",
          }}
        >
          {entry.text}
        </Typography>
      </Box>
    );
  }

  const playerSay = {
    dark:  { bubbleBg: "rgba(251,191,36,0.15)", textColor: "#fef3c7", labelColor: "rgba(251,191,36,0.9)", border: "1px solid rgba(251,191,36,0.4)" },
    light: { bubbleBg: "rgba(251,191,36,0.18)", textColor: "#78350f", labelColor: "#b45309",             border: "1px solid rgba(180,130,20,0.45)" },
  };
  const playerDo = {
    dark:  { bubbleBg: "rgba(251,191,36,0.09)", textColor: "#fde68a", labelColor: "rgba(251,191,36,0.8)", border: "1px solid rgba(251,191,36,0.28)" },
    light: { bubbleBg: "rgba(251,191,36,0.10)", textColor: "#92400e", labelColor: "#b45309",              border: "1px solid rgba(180,130,20,0.3)" },
  };

  const activeColors = isPlayer
    ? (entry.type === "say" ? (isDark ? playerSay.dark : playerSay.light) : (isDark ? playerDo.dark : playerDo.light))
    : colors;
  const activeBorder = isPlayer ? activeColors.border : border;
  const activeBubbleBg = activeColors.bubbleBg;

  return (
    <Box sx={{ px: 3, py: 0.8, display: "flex", justifyContent: "flex-start" }}>
      <Box sx={{ maxWidth: "75%" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.4 }}>
          <Box sx={{ color: activeColors.labelColor, display: "flex", alignItems: "center" }}>{cfg.icon}</Box>
          <Typography sx={{ fontSize: "0.7rem", color: activeColors.labelColor, fontWeight: 600 }}>
            {entry.character} · {cfg.label}
          </Typography>
        </Box>
        <Box
          sx={{
            bgcolor: activeBubbleBg,
            border: activeBorder,
            borderRadius: entry.type === "say" ? "16px 16px 16px 4px" : "12px",
            px: cfg.px,
            py: 1,
          }}
        >
          <Typography
            sx={{
              color: activeColors.textColor,
              fontSize: "0.9rem",
              lineHeight: 1.6,
              fontStyle: cfg.italic ? "italic" : "normal",
            }}
          >
            {entry.type === "say" ? `"${entry.text}"` : `* ${entry.text} *`}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
