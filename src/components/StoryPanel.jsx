import { useEffect, useRef } from "react";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import StoryEntry from "./StoryEntry";

export default function StoryPanel({ entries, isDark, lastRunIds, playerName, onRemoveEntry }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        "&::-webkit-scrollbar": { width: 5 },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
          borderRadius: 4,
        },
      }}
    >
      {entries.map((entry) => {
        const isNew = lastRunIds?.has(entry.id) ?? false;
        return (
          <Box
            key={entry.id}
            sx={{
              position: "relative",
              borderRadius: 1,
              borderLeft: isNew
                ? `2px solid ${isDark ? "rgba(129,140,248,0.5)" : "rgba(99,102,241,0.4)"}`
                : "2px solid transparent",
              transition: "background-color 0.15s",
              "& .entry-remove": { opacity: 0 },
              "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)" },
              "&:hover .entry-remove": { opacity: 1 },
              "&:has(.entry-remove:hover)": {
                bgcolor: isDark ? "rgba(239,68,68,0.09)" : "rgba(239,68,68,0.06)",
              },
            }}
          >
            <StoryEntry entry={entry} isDark={isDark} isPlayer={!!playerName && entry.character === playerName} />
            <IconButton
              className="entry-remove"
              size="small"
              onClick={() => onRemoveEntry(entry.id)}
              sx={{
                position: "absolute",
                top: 4,
                right: 8,
                width: 20,
                height: 20,
                color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
                transition: "opacity 0.15s, color 0.15s",
                "&:hover": { color: "error.main" },
              }}
            >
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Box>
        );
      })}
      <div ref={bottomRef} />
    </Box>
  );
}
