import { Box, Typography, Chip, Tooltip, IconButton } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";

function modeColor(isDark, darkVal, lightVal) {
  return isDark ? darkVal : lightVal;
}

function GenderPill({ gender, isDark }) {
  if (!gender) return null;
  return (
    <Chip
      label={gender}
      size="small"
      sx={{
        height: 16,
        fontSize: "0.6rem",
        fontWeight: 600,
        bgcolor: modeColor(isDark, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.07)"),
        color: "text.secondary",
        border: `1px solid ${modeColor(isDark, "rgba(255,255,255,0.1)", "rgba(0,0,0,0.1)")}`,
        "& .MuiChip-label": { px: 0.8 },
      }}
    />
  );
}

function DeadChip() {
  return (
    <Chip
      label="💀 Dead"
      size="small"
      sx={{
        height: 15,
        fontSize: "0.58rem",
        fontWeight: 700,
        bgcolor: "rgba(239,68,68,0.15)",
        color: "#f87171",
        border: "1px solid rgba(239,68,68,0.35)",
        "& .MuiChip-label": { px: 0.8 },
      }}
    />
  );
}

function CharacterCard({ character, isDark, onRevive }) {
  const { name, class: cls, avatar, gender, isPlayer, dead } = character;

  return (
    <Box
      sx={{
        mb: 1.5,
        p: 1.2,
        borderRadius: 2,
        opacity: dead ? 0.55 : 1,
        bgcolor: dead
          ? modeColor(isDark, "rgba(255,255,255,0.02)", "rgba(0,0,0,0.02)")
          : isPlayer
          ? "rgba(99,102,241,0.12)"
          : modeColor(isDark, "rgba(255,255,255,0.04)", "rgba(0,0,0,0.03)"),
        border: dead
          ? `1px solid rgba(239,68,68,0.25)`
          : isPlayer
          ? "1px solid rgba(99,102,241,0.4)"
          : `1px solid ${modeColor(isDark, "rgba(255,255,255,0.07)", "rgba(0,0,0,0.08)")}`,
        position: "relative",
      }}
    >
      {isPlayer && !dead && (
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

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
        <Typography sx={{ fontSize: "1.6rem", lineHeight: 1, filter: dead ? "grayscale(1)" : "none" }}>
          {avatar}
        </Typography>
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: "0.8rem",
              lineHeight: 1.2,
              textDecoration: dead ? "line-through" : "none",
              color: dead ? "text.secondary" : "text.primary",
            }}
          >
            {name}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>
            {cls}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
        <GenderPill gender={gender} isDark={isDark} />
        {dead && <DeadChip />}
        {dead && (
          <Tooltip title="Revive">
            <IconButton size="small" onClick={() => onRevive(name)} sx={{ ml: "auto", p: 0.3, color: "#f87171", "&:hover": { color: "#34d399" } }}>
              <FavoriteIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

const dispositionColor = {
  friendly: "#34d399",
  neutral:  "#94a3b8",
  hostile:  "#f87171",
};

function NpcCard({ npc, isDark, isNew, onRevive }) {
  const { name, role, avatar, gender, disposition, note, dead } = npc;
  const color = dead ? "#6b7280" : dispositionColor[disposition];

  return (
    <Box
      sx={{
        mb: 1.2,
        p: 1,
        borderRadius: 2,
        opacity: dead ? 0.55 : 1,
        bgcolor: dead
          ? modeColor(isDark, "rgba(255,255,255,0.02)", "rgba(0,0,0,0.02)")
          : isNew
          ? modeColor(isDark, "rgba(99,102,241,0.1)", "rgba(99,102,241,0.07)")
          : modeColor(isDark, "rgba(255,255,255,0.03)", "rgba(0,0,0,0.03)"),
        border: dead
          ? `1px solid rgba(239,68,68,0.25)`
          : isNew
          ? `1px solid ${modeColor(isDark, "rgba(99,102,241,0.4)", "rgba(99,102,241,0.3)")}`
          : `1px solid ${modeColor(isDark, "rgba(255,255,255,0.06)", "rgba(0,0,0,0.08)")}`,
        position: "relative",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 0.5 }}>
        <Typography sx={{ fontSize: "1.3rem", lineHeight: 1, filter: dead ? "grayscale(1)" : "none" }}>
          {avatar}
        </Typography>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "0.75rem",
              lineHeight: 1.2,
              textDecoration: dead ? "line-through" : "none",
              color: dead ? "text.secondary" : "text.primary",
            }}
          >
            {name}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{role}</Typography>
        </Box>
        <Tooltip title={dead ? "dead" : disposition}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: color,
              flexShrink: 0,
              boxShadow: dead ? "none" : `0 0 5px ${color}`,
            }}
          />
        </Tooltip>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center", mb: note ? 0.5 : 0 }}>
        <GenderPill gender={gender} isDark={isDark} />
        {dead && <DeadChip />}
        {dead && (
          <Tooltip title="Revive">
            <IconButton size="small" onClick={() => onRevive(name)} sx={{ ml: "auto", p: 0.3, color: "#f87171", "&:hover": { color: "#34d399" } }}>
              <FavoriteIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {note && (
        <Typography
          sx={{ fontSize: "0.62rem", color: "rgba(148,163,184,0.7)", fontStyle: "italic", lineHeight: 1.4 }}
        >
          {note}
        </Typography>
      )}
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

export default function CharacterPanel({ isDark, npcs, characters, onRevive }) {
  const panelBg = modeColor(isDark, "#0f1117", "#f8f7f4");
  const panelBorder = modeColor(isDark, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.1)");
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
          <CharacterCard key={c.id} character={c} isDark={isDark} onRevive={onRevive} />
        ))}
      </Box>

      <SectionHeader label="Characters" isDark={isDark} />
      <Box sx={{ p: 1.2 }}>
        {npcs.map((n) => (
          <NpcCard key={n.id} npc={n} isDark={isDark} isNew={!initialNpcIds.has(n.id)} onRevive={onRevive} />
        ))}
      </Box>
    </Box>
  );
}
