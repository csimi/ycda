import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, FormControlLabel, Checkbox } from "@mui/material";
import { CUSTOM_MODEL_ID } from "../hooks/useLLM";

const DEFAULT_CONTEXT = 8192;

const DOCKER_PRESET = {
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
  model: "gemma4:26b",
  // Matches Ollama's default for <24 GiB VRAM — safest assumption. Users with
  // more VRAM can raise both this field and OLLAMA_CONTEXT_LENGTH in
  // docker-compose.yml together. Mismatch here silently truncates prompts.
  contextWindow: 4096,
  disableThinking: true,
};

export default function CustomApiDialog({ open, onClose, customConfig, onSave, onSwitchModel }) {
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [contextWindow, setContextWindow] = useState(String(DEFAULT_CONTEXT));
  const [disableThinking, setDisableThinking] = useState(false);

  // Repopulate fields from saved config each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setBaseURL(customConfig?.baseURL ?? "");
    setApiKey(customConfig?.apiKey ?? "");
    setModel(customConfig?.model ?? "");
    setContextWindow(String(customConfig?.contextWindow ?? DEFAULT_CONTEXT));
    setDisableThinking(!!customConfig?.disableThinking);
  }, [open, customConfig]);

  const parsedContext = Math.floor(Number(contextWindow));
  const valid = baseURL.trim() && apiKey && model.trim() && parsedContext > 0;

  const handleUseDocker = () => {
    setBaseURL(DOCKER_PRESET.baseURL);
    setApiKey(DOCKER_PRESET.apiKey);
    setModel(DOCKER_PRESET.model);
    setContextWindow(String(DOCKER_PRESET.contextWindow));
    setDisableThinking(DOCKER_PRESET.disableThinking);
  };

  const handleSave = () => {
    if (!valid) return;
    onSave({
      baseURL: baseURL.trim(),
      apiKey,
      model: model.trim(),
      contextWindow: parsedContext,
      disableThinking,
    });
    onSwitchModel(CUSTOM_MODEL_ID);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Custom OpenAI-compatible API</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Base URL"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder="https://api.openai.com/v1"
            helperText="Chat Completions endpoint base (e.g. https://api.openai.com/v1, http://localhost:1234/v1)"
            size="small"
            fullWidth
            autoComplete="off"
          />
          <TextField
            label="API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            helperText="Stored in your browser's localStorage. Never sent anywhere except the base URL above."
            size="small"
            fullWidth
            autoComplete="off"
          />
          <TextField
            label="Model name"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            helperText="Model identifier as accepted by your endpoint (e.g. gpt-4o-mini, llama-3.1-70b)."
            size="small"
            fullWidth
            autoComplete="off"
          />
          <TextField
            label="Context size"
            value={contextWindow}
            onChange={(e) => setContextWindow(e.target.value)}
            type="number"
            helperText="Model's context length in tokens. Sizes the rolling prompt window and when compaction fires."
            size="small"
            fullWidth
            inputProps={{ min: 1 }}
          />
          <FormControlLabel
            control={<Checkbox checked={disableThinking} onChange={(e) => setDisableThinking(e.target.checked)} size="small" />}
            label={
              <Box>
                <Typography variant="body2">Disable reasoning tokens</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Sends <code>reasoning_effort: "none"</code>. Required for reasoning models on Ollama (e.g. gemma4) — otherwise the token budget is spent on thinking before any narrative is emitted. Leave off if your provider rejects the field.
                </Typography>
              </Box>
            }
            sx={{ alignItems: "flex-start", m: 0 }}
          />
          <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
            OpenAI, Claude (api.anthropic.com/v1/), LM Studio, and Ollama all accept direct browser calls; the adapter sends the Anthropic browser-access header automatically. Your API key lives in this browser's localStorage only — don't use this option on a shared machine.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleUseDocker}>Use Docker setup</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!valid}>
          Save &amp; use
        </Button>
      </DialogActions>
    </Dialog>
  );
}
