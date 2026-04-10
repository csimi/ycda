import { useRef } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { builtinStories } from "../data/stories";
import AppHeader from "./AppHeader";

function StoryCard({ story, onPlay, isDark }) {
  const player = story.characters?.find((c) => c.isPlayer);
  const partyNames = story.characters?.map((c) => c.name).join(", ") ?? "";

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
        bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
        borderRadius: 3,
        transition: "border-color 0.15s, box-shadow 0.15s",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: isDark
            ? "0 0 0 1px rgba(129,140,248,0.4)"
            : "0 0 0 1px rgba(79,70,229,0.3)",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem", mb: 0.5 }}>
          {story.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", fontSize: "0.82rem", lineHeight: 1.6, mb: 1.5 }}
        >
          {story.description}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.68rem", fontStyle: "italic" }}
        >
          Party: {partyNames}
          {player ? ` · You play as ${player.name}` : ""}
        </Typography>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          variant="contained"
          size="small"
          endIcon={<PlayArrowIcon />}
          onClick={() => onPlay(story)}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
        >
          Play
        </Button>
      </CardActions>
    </Card>
  );
}

function UploadCard({ onUpload, isDark }) {
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const story = JSON.parse(ev.target.result);
        onUpload(story);
      } catch {
        alert("Invalid JSON file. Please upload a valid YCDA story file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: `1px dashed ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
        bgcolor: "transparent",
        borderRadius: 3,
        cursor: "pointer",
        transition: "border-color 0.15s",
        "&:hover": { borderColor: "primary.main" },
      }}
      onClick={() => inputRef.current?.click()}
    >
      <CardContent
        sx={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, py: 4 }}
      >
        <UploadFileIcon sx={{ fontSize: 36, color: "text.secondary", opacity: 0.5 }} />
        <Typography sx={{ fontWeight: 600, fontSize: "0.9rem" }}>Upload story</Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "0.75rem", textAlign: "center" }}>
          Load a local <code>.json</code> story file
        </Typography>
      </CardContent>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </Card>
  );
}

export default function StorySelect({ onPlay, isDark, onToggleTheme, llmStatus, llmProgress, llmModelId, onSwitchModel, pregenerationEnabled, onTogglePregeneration }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppHeader isDark={isDark} onToggleTheme={onToggleTheme} llmStatus={llmStatus} llmProgress={llmProgress} llmModelId={llmModelId} onSwitchModel={onSwitchModel} pregenerationEnabled={pregenerationEnabled} onTogglePregeneration={onTogglePregeneration} />

      {/* Hero */}
      <Box sx={{ px: 4, pt: 6, pb: 3, maxWidth: 760, mx: "auto", width: "100%", textAlign: "center" }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5, fontFamily: "'Georgia', serif" }}>
          You Can Do Anything
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "1rem", lineHeight: 1.7 }}>
          Pick a story to begin, or upload your own adventure file.
        </Typography>
      </Box>

      {/* Story grid */}
      <Box sx={{ px: 4, pb: 6, maxWidth: 900, mx: "auto", width: "100%" }}>
        <Grid container spacing={2.5}>
          {builtinStories.map((story) => (
            <Grid item xs={12} sm={6} md={4} key={story.id}>
              <StoryCard story={story} onPlay={onPlay} isDark={isDark} />
            </Grid>
          ))}
          <Grid item xs={12} sm={6} md={4}>
            <UploadCard onUpload={onPlay} isDark={isDark} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
