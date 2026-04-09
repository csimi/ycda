import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import StoryEntry from "./StoryEntry";

export default function StoryPanel({ entries, isDark }) {
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
      {entries.map((entry) => (
        <StoryEntry key={entry.id} entry={entry} isDark={isDark} />
      ))}
      <div ref={bottomRef} />
    </Box>
  );
}
