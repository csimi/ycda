import { Box, Typography, LinearProgress, Chip, Tooltip } from "@mui/material";
import { characters } from "../data/characters";

function modeColor(isDark, darkVal, lightVal) {
  return isDark ? darkVal : lightVal;
}

function StatBar({ label, value, max, color }) {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, fontSize: "0.65rem" }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>
          {value}/{max}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={(value / max) * 100}
        sx={{
          height: 5,
          borderRadius: 2,
          bgcolor: "rgba(255,255,255,0.08)",
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 2 },
        }}
      />
    </Box>
  );
}

function StatChip({ label, value }) {
  return (
    <Tooltip title={label}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          bgcolor: "rgba(255,255,255,0.05)",
          borderRadius: 1,
          px: 0.5,
          py: 0.3,
          minWidth: 28,
        }}
      >
        <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", lineHeight: 1 }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function CharacterCard({ character, isDark }) {
  const { name, class: cls, avatar, isPlayer, stats } = character;

  return (
    <Box
      sx={{
        mb: 1.5,
        p: 1.2,
        borderRadius: 2,
        bgcolor: isPlayer
          ? "rgba(99,102,241,0.12)"
          : modeColor(isDark, "rgba(255,255,255,0.04)", "rgba(0,0,0,0.03)"),
        border: isPlayer
          ? "1px solid rgba(99,102,241,0.4)"
          : `1px solid ${modeColor(isDark, "rgba(255,255,255,0.07)", "rgba(0,0,0,0.08)")}`,
        position: "relative",
      }}
    >
      {isPlayer && (
        <Chip
          label="YOU"
          size="small"
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            height: 14,
            fontSize: "0.55rem",
            fontWeight: 700,
            bgcolor: "rgba(99,102,241,0.7)",
            color: "#fff",
            "& .MuiChip-label": { px: 0.8 },
          }}
        />
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: "1.6rem", lineHeight: 1 }}>{avatar}</Typography>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.8rem", lineHeight: 1.2 }}>
            {name}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>
            {cls}
          </Typography>
        </Box>
      </Box>

      <StatBar label="HP" value={stats.HP.value} max={stats.HP.max} color="#ef4444" />
      <StatBar label="MP" value={stats.MP.value} max={stats.MP.max} color="#60a5fa" />

      <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
        <StatChip label="STR" value={stats.STR} />
        <StatChip label="DEX" value={stats.DEX} />
        <StatChip label="INT" value={stats.INT} />
      </Box>
    </Box>
  );
}

const dispositionColor = {
  friendly: "#34d399",
  neutral: "#94a3b8",
  hostile: "#f87171",
};

function NpcCard({ npc, isDark, isNew }) {
  const { name, role, avatar, disposition, note } = npc;
  const color = dispositionColor[disposition];

  return (
    <Box
      sx={{
        mb: 1.2,
        p: 1,
        borderRadius: 2,
        bgcolor: isNew
          ? modeColor(isDark, "rgba(99,102,241,0.1)", "rgba(99,102,241,0.07)")
          : modeColor(isDark, "rgba(255,255,255,0.03)", "rgba(0,0,0,0.03)"),
        border: isNew
          ? `1px solid ${modeColor(isDark, "rgba(99,102,241,0.4)", "rgba(99,102,241,0.3)")}`
          : `1px solid ${modeColor(isDark, "rgba(255,255,255,0.06)", "rgba(0,0,0,0.08)")}`,
        position: "relative",
      }}
    >
      {isNew && (
        <Chip
          label="NEW"
          size="small"
          sx={{
            position: "absolute",
            top: 5,
            right: 5,
            height: 13,
            fontSize: "0.5rem",
            fontWeight: 700,
            bgcolor: "rgba(99,102,241,0.7)",
            color: "#fff",
            "& .MuiChip-label": { px: 0.7 },
          }}
        />
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 0.5 }}>
        <Typography sx={{ fontSize: "1.3rem", lineHeight: 1 }}>{avatar}</Typography>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", lineHeight: 1.2 }}>{name}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{role}</Typography>
        </Box>
        <Tooltip title={disposition}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: color,
              flexShrink: 0,
              boxShadow: `0 0 5px ${color}`,
            }}
          />
        </Tooltip>
      </Box>
      <Typography
        sx={{
          fontSize: "0.62rem",
          color: "rgba(148,163,184,0.7)",
          fontStyle: "italic",
          lineHeight: 1.4,
        }}
      >
        {note}
      </Typography>
    </Box>
  );
}

function SectionHeader({ label, isDark }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.2,
        borderBottom: `1px solid ${modeColor(isDark, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.08)")}`,
      }}
    >
      <Typography
        variant="overline"
        sx={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: 2, color: "text.secondary" }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function CharacterPanel({ isDark, npcs }) {
  const panelBg = modeColor(isDark, "#0f1117", "#f8f7f4");
  const panelBorder = modeColor(isDark, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.1)");

  // Any NPC whose id is not a plain integer is AI-generated (uses Date.now() + Math.random())
  const initialNpcIds = new Set(npcs.filter((n) => Number.isInteger(n.id)).map((n) => n.id));

  return (
    <Box
      sx={{
        width: 180,
        flexShrink: 0,
        height: "100%",
        bgcolor: panelBg,
        borderRight: `1px solid ${panelBorder}`,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <SectionHeader label="Party" isDark={isDark} />
      <Box sx={{ p: 1.2 }}>
        {characters.map((c) => (
          <CharacterCard key={c.id} character={c} isDark={isDark} />
        ))}
      </Box>

      <SectionHeader label="Characters" isDark={isDark} />
      <Box sx={{ p: 1.2 }}>
        {npcs.map((n) => (
          <NpcCard key={n.id} npc={n} isDark={isDark} isNew={!initialNpcIds.has(n.id)} />
        ))}
      </Box>
    </Box>
  );
}
