import { useState } from "react";
import { Box, Chip, IconButton, Tooltip, Menu, MenuItem, ListItemText, ListItemIcon, Typography, Divider } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AVAILABLE_MODELS, isMobileDevice } from "../hooks/useLLM";

const IS_MOBILE = isMobileDevice();

const MOBILE_BADGE = {
  ok:    { color: "success.main", title: "Should run on mobile" },
  maybe: { color: "warning.main", title: "May not fit on mobile — could run out of memory" },
  no:    { color: "error.main",   title: "Unlikely to run on mobile devices" },
};

const STATUS_CONFIG = {
  loading:      { label: "Loading AI…",      color: "default" },
  ready:        { label: "AI ready",          color: "success" },
  generating:   { label: "Generating…",       color: "info" },
  initializing: { label: "Preparing story…",  color: "info" },
  cancelled:    { label: "AI load cancelled", color: "warning" },
  error:        { label: "AI error",           color: "error" },
};

export default function LLMStatusBar({ status, modelId, onSwitchModel, onCancelLoad, onRetryLoad }) {
  const [anchor, setAnchor] = useState(null);

  if (status === "uninitialized") return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  const canSwitch = status === "ready" || status === "cancelled" || status === "error";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
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
      {status === "loading" && onCancelLoad && (
        <Tooltip title="Cancel loading">
          <IconButton onClick={onCancelLoad} size="small" sx={{ p: 0.2, color: "text.secondary" }}>
            <CloseIcon sx={{ fontSize: "0.85rem" }} />
          </IconButton>
        </Tooltip>
      )}
      {status === "cancelled" && onRetryLoad && (
        <Tooltip title="Retry loading">
          <IconButton onClick={onRetryLoad} size="small" sx={{ p: 0.2, color: "text.secondary" }}>
            <RefreshIcon sx={{ fontSize: "0.9rem" }} />
          </IconButton>
        </Tooltip>
      )}
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 240, mt: 0.5 } } }}
      >
        {IS_MOBILE && (
          <Box sx={{ px: 1.5, py: 1, display: "flex", gap: 0.8, alignItems: "flex-start" }}>
            <WarningAmberIcon sx={{ fontSize: "0.95rem", color: "warning.main", mt: "1px" }} />
            <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", lineHeight: 1.3 }}>
              On mobile, only the smallest model is likely to run. Larger models may crash the tab.
            </Typography>
          </Box>
        )}
        {IS_MOBILE && <Divider sx={{ mb: 0.3 }} />}
        {AVAILABLE_MODELS.map((m) => {
          const badge = MOBILE_BADGE[m.mobile];
          return (
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
              {IS_MOBILE && badge && (
                <Tooltip title={badge.title} placement="left">
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: badge.color, ml: 1, flexShrink: 0 }} />
                </Tooltip>
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
