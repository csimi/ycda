import React, { useState } from "react";
import { Box, Chip, IconButton, Tooltip, Menu, MenuItem, ListItemText, ListItemIcon, Typography, Divider } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloudIcon from "@mui/icons-material/Cloud";
import MemoryIcon from "@mui/icons-material/Memory";
import { AVAILABLE_MODELS, isMobileDevice, CUSTOM_MODEL_ID, PROMPT_API_MODEL_ID, isPromptApiAvailable } from "../hooks/useLLM";
import CustomApiDialog from "./CustomApiDialog";

const IS_MOBILE = isMobileDevice();
const PROMPT_API_AVAILABLE = isPromptApiAvailable();

const MOBILE_BADGE = {
  ok:    { color: "success.main", title: "Should run on mobile" },
  maybe: { color: "warning.main", title: "May not fit on mobile — could run out of memory" },
  no:    { color: "error.main",   title: "Unlikely to run on mobile devices" },
};

const STATUS_CONFIG = {
  loading:      { color: "default" },
  ready:        { label: "AI ready",          color: "success" },
  generating:   { label: "Generating…",       color: "info" },
  initializing: { label: "Preparing story…",  color: "info" },  // label overridable via initializingLabel prop
  cancelled:    { label: "AI load cancelled", color: "warning" },
  error:        { label: "AI error",           color: "error" },
};

export default function LLMStatusBar({ status, loadingPhase, error, modelId, onSwitchModel, onCancelLoad, onRetryLoad, initializingLabel, customConfig, onSaveCustomConfig }) {
  const [anchor, setAnchor] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);

  if (status === "uninitialized") return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  const isCustom = modelId === CUSTOM_MODEL_ID;
  const isPromptApi = modelId === PROMPT_API_MODEL_ID;
  const label = status === "loading"
    ? (loadingPhase === "downloading" ? "Downloading model…" : "Loading AI…")
    : status === "initializing" && initializingLabel
    ? initializingLabel
    : status === "ready" && isCustom && customConfig?.model
    ? `Custom: ${customConfig.model}`
    : status === "ready" && isPromptApi
    ? "Chrome AI (Nano)"
    : cfg.label;

  const canSwitch = status === "ready" || status === "cancelled" || status === "error";

  const chip = (
    <Chip
      icon={<SmartToyIcon sx={{ fontSize: "0.75rem !important" }} />}
      label={label}
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
  );

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
      {status === "error" && error ? (
        <Tooltip
          title={
            <Box sx={{ maxWidth: 320 }}>
              <Box sx={{ fontWeight: 600, mb: 0.4 }}>Failed to load model</Box>
              <Box sx={{ fontSize: "0.72rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{error}</Box>
            </Box>
          }
          arrow
          placement="bottom-end"
        >
          {chip}
        </Tooltip>
      ) : chip}
      {status === "loading" && onCancelLoad && (
        <Tooltip title="Cancel loading">
          <IconButton onClick={onCancelLoad} size="small" sx={{ p: 0.2, color: "text.secondary" }}>
            <CloseIcon sx={{ fontSize: "0.85rem" }} />
          </IconButton>
        </Tooltip>
      )}
      {(status === "cancelled" || status === "error") && onRetryLoad && (
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
            <React.Fragment key={m.id}>
            {m.separator && <Divider sx={{ my: 0.3 }} />}
            <MenuItem
              selected={m.id === modelId}
              onClick={() => { onSwitchModel(m.id); setAnchor(null); }}
              dense
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {m.id === modelId && <CheckIcon sx={{ fontSize: "0.9rem" }} />}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    {m.label}
                    {m.recommended && (
                      <Chip label="recommended" size="small" color="info" variant="outlined" sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.6 } }} />
                    )}
                  </Box>
                }
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
            </React.Fragment>
          );
        })}
        <Divider sx={{ my: 0.3 }} />
        <MenuItem
          selected={isPromptApi}
          disabled={!PROMPT_API_AVAILABLE}
          onClick={() => { onSwitchModel(PROMPT_API_MODEL_ID); setAnchor(null); }}
          dense
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            {isPromptApi ? <CheckIcon sx={{ fontSize: "0.9rem" }} /> : <MemoryIcon sx={{ fontSize: "0.9rem" }} />}
          </ListItemIcon>
          <ListItemText
            primary="Chrome built-in AI"
            secondary={PROMPT_API_AVAILABLE
              ? "Gemini Nano · ~3.25B params"
              : "Needs Chrome — enable at chrome://flags/#prompt-api-for-gemini-nano"}
            primaryTypographyProps={{ fontSize: "0.82rem" }}
            secondaryTypographyProps={{ fontSize: "0.7rem" }}
          />
        </MenuItem>
        <Divider sx={{ my: 0.3 }} />
        <MenuItem
          selected={isCustom}
          onClick={() => { setAnchor(null); setConfigOpen(true); }}
          dense
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            {isCustom ? <CheckIcon sx={{ fontSize: "0.9rem" }} /> : <CloudIcon sx={{ fontSize: "0.9rem" }} />}
          </ListItemIcon>
          <ListItemText
            primary="Custom API…"
            secondary={isCustom && customConfig?.model ? customConfig.model : "OpenAI-compatible endpoint"}
            primaryTypographyProps={{ fontSize: "0.82rem" }}
            secondaryTypographyProps={{ fontSize: "0.7rem" }}
          />
        </MenuItem>
      </Menu>
      <CustomApiDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        customConfig={customConfig}
        onSave={onSaveCustomConfig}
        onSwitchModel={onSwitchModel}
      />
    </Box>
  );
}
