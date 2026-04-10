import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, List, ListItem, ListItemText,
  Typography, Box, Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";

export default function SavesDialog({ open, onClose, mode, saves, onSaveNow, onLoad, onDelete, isDark, storyTitle }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmLoad, setConfirmLoad]     = useState(null);

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const handleLoad = (save) => {
    if (mode === "save") {
      setConfirmLoad(save);
    } else {
      onLoad(save);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", fontWeight: 700, pr: 1 }}>
        Saved Games
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {mode === "save" && (
          <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => { onSaveNow(); }}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Save current game{storyTitle ? ` — ${storyTitle}` : ""}
            </Button>
          </Box>
        )}

        {saves.length === 0 ? (
          <Box sx={{ px: 3, py: 4, textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
              No saved games yet.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {saves.map((save, i) => (
              <ListItem
                key={save.id}
                divider={i < saves.length - 1}
                sx={{ px: 3, py: 1.5, alignItems: "flex-start", gap: 1 }}
                secondaryAction={
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleLoad(save)}
                      sx={{ textTransform: "none", fontSize: "0.75rem" }}
                    >
                      Load
                    </Button>
                    <Tooltip title="Delete save">
                      <IconButton size="small" onClick={() => handleDelete(save.id)} sx={{ color: "text.secondary" }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.9rem" }}>
                        {save.storyTitle}
                      </Typography>
                      <Typography sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                        {new Date(save.savedAt).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    save.previewText ? (
                      <Typography
                        component="span"
                        sx={{ color: "text.secondary", fontSize: "0.78rem", fontStyle: "italic", display: "block", mt: 0.3 }}
                      >
                        {save.previewText.length >= 150 ? save.previewText + "…" : save.previewText}
                      </Typography>
                    ) : null
                  }
                  sx={{ pr: 12 }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      {/* Confirm delete */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete save?</DialogTitle>
        <DialogContent>
          <Typography>This save will be permanently removed.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}
            sx={{ textTransform: "none" }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm load while in-game */}
      <Dialog open={!!confirmLoad} onClose={() => setConfirmLoad(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Load this save?</DialogTitle>
        <DialogContent>
          <Typography>Your current game progress will be lost.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmLoad(null)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => { onLoad(confirmLoad); setConfirmLoad(null); }}
            sx={{ textTransform: "none" }}
          >
            Load
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
