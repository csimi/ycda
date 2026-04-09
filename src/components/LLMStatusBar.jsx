import { Box, LinearProgress, Typography, Chip } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";

const STATUS_CONFIG = {
  loading:    { label: null,           color: null },
  ready:      { label: "AI ready",     color: "success" },
  generating: { label: "Generating…",  color: "info" },
  error:      { label: "AI error",     color: "error" },
};

export default function LLMStatusBar({ status, progress }) {
  if (status === "uninitialized") return null;

  const cfg = STATUS_CONFIG[status];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {status === "loading" && (
        <Box sx={{ width: 110 }}>
          <LinearProgress
            variant="determinate"
            value={Math.round(progress * 100)}
            sx={{ height: 4, borderRadius: 2 }}
          />
          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
            {Math.round(progress * 100)}% — downloading model
          </Typography>
        </Box>
      )}
      {status !== "loading" && cfg && (
        <Chip
          icon={<SmartToyIcon sx={{ fontSize: "0.75rem !important" }} />}
          label={cfg.label}
          color={cfg.color}
          size="small"
          sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.8 } }}
        />
      )}
    </Box>
  );
}
