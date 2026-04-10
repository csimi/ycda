import { useState } from "react";
import { Chip, Menu, MenuItem, ListItemText, Typography, ListItemIcon } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CheckIcon from "@mui/icons-material/Check";
import { AVAILABLE_MODELS } from "../hooks/useLLM";

const STATUS_CONFIG = {
  loading:      { label: "Loading AI…",      color: "default" },
  ready:        { label: "AI ready",          color: "success" },
  generating:   { label: "Generating…",       color: "info" },
  initializing: { label: "Preparing story…",  color: "info" },
  error:        { label: "AI error",           color: "error" },
};

export default function LLMStatusBar({ status, modelId, onSwitchModel }) {
  const [anchor, setAnchor] = useState(null);

  if (status === "uninitialized") return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  const canSwitch = status === "ready";

  return (
    <>
      <Chip
        icon={<SmartToyIcon sx={{ fontSize: "0.75rem !important" }} />}
        label={cfg.label}
        color={cfg.color}
        size="small"
        onClick={canSwitch ? (e) => setAnchor(e.currentTarget) : undefined}
        sx={{
          height: 20,
          fontSize: "0.65rem",
          "& .MuiChip-label": { px: 0.8 },
          cursor: canSwitch ? "pointer" : "default",
        }}
      />
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}
      >
        {AVAILABLE_MODELS.map((m) => (
          <MenuItem
            key={m.id}
            selected={m.id === modelId}
            onClick={() => { onSwitchModel(m.id); setAnchor(null); }}
            dense
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {m.id === modelId && <CheckIcon sx={{ fontSize: "0.9rem" }} />}
            </ListItemIcon>
            <ListItemText
              primary={m.label}
              secondary={m.size}
              primaryTypographyProps={{ fontSize: "0.82rem" }}
              secondaryTypographyProps={{ fontSize: "0.7rem" }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
