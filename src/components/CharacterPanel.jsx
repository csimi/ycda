import { Box, Typography, Chip } from "@mui/material";

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

function CharacterCard({ character, isDark }) {
  const { name, class: cls, avatar, gender, isPlayer } = character;

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

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
        <Typography sx={{ fontSize: "1.6rem", lineHeight: 1 }}>
          {avatar}
        </Typography>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, fontSize: "0.8rem", lineHeight: 1.2 }}
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
      </Box>
    </Box>
  );
}

function NpcCard({ npc, isDark, isNew }) {
  const { name, role, avatar, gender, note } = npc;

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
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 0.5 }}>
        <Typography sx={{ fontSize: "1.3rem", lineHeight: 1 }}>
          {avatar}
        </Typography>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", lineHeight: 1.2 }}>
            {name}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{role}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center", mb: note ? 0.5 : 0 }}>
        <GenderPill gender={gender} isDark={isDark} />
      </Box>
      {note && (
        <Typography
          sx={{ fontSize: "0.62rem", color: modeColor(isDark, "rgba(148,163,184,0.7)", "rgba(60,60,80,0.75)"), fontStyle: "italic", lineHeight: 1.4 }}
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

export default function CharacterPanel({ isDark, npcs, characters, isMobile = false, open = true, onClose }) {
  const panelBg = modeColor(isDark, "#0f1117", "#f8f7f4");
  const panelBorder = modeColor(isDark, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.1)");
  const initialNpcIds = new Set(npcs.filter((n) => Number.isInteger(n.id)).map((n) => n.id));

  if (isMobile && !open) return null;

  return (
    <>
      {isMobile && (
        <Box
          onClick={onClose}
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.5)",
            zIndex: 1200,
          }}
        />
      )}
      <Box
        sx={{
          width: isMobile ? "min(320px, 85vw)" : 360,
          flexShrink: 0,
          height: "100%",
          bgcolor: panelBg,
          borderRight: `1px solid ${panelBorder}`,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          ...(isMobile && {
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 1201,
            boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
          }),
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
    </>
  );
}
