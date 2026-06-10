/* ── Match module shared constants ─────────────────────────────────────── */

/* Position sort order */
export const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };

/** Sort players by position (GR→DEF→MED→ATA), then by skill descending. */
export function sortPlayersByPos(arr = []) {
  return [...arr].sort(
    (a, b) =>
      (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
      (b.skill ?? 0) - (a.skill ?? 0),
  );
}

/* Visual styles per position — card gradients, badges, accents */
export const POS_STYLES = {
  GR: { bar: "from-amber-300 via-amber-400 to-amber-600", glow: "hover:border-amber-400/70 hover:shadow-amber-400/30", bgGrad: "from-amber-500/8", badgeBg: "bg-amber-400/20", badgeText: "text-amber-400", badgeBorder: "border-amber-400/30", accent: "#eab308" },
  DEF: { bar: "from-blue-300 via-blue-400 to-blue-600", glow: "hover:border-blue-400/70 hover:shadow-blue-400/30", bgGrad: "from-blue-500/8", badgeBg: "bg-blue-400/20", badgeText: "text-blue-400", badgeBorder: "border-blue-400/30", accent: "#3b82f6" },
  MED: { bar: "from-emerald-300 via-emerald-400 to-emerald-600", glow: "hover:border-emerald-400/70 hover:shadow-emerald-400/30", bgGrad: "from-emerald-500/8", badgeBg: "bg-emerald-400/20", badgeText: "text-emerald-400", badgeBorder: "border-emerald-400/30", accent: "#10b981" },
  ATA: { bar: "from-rose-300 via-rose-400 to-rose-600", glow: "hover:border-rose-400/70 hover:shadow-rose-400/30", bgGrad: "from-rose-500/8", badgeBg: "bg-rose-400/20", badgeText: "text-rose-400", badgeBorder: "border-rose-400/30", accent: "#f43f5e" },
};

/** Get visual style object for a position. Falls back to MED. */
export function getPosStyle(pos) {
  return POS_STYLES[pos] || POS_STYLES.MED;
}

/* Pitch marker colors: Tailwind bg+text classes per position */
export const PITCH_POS_COLORS = {
  GR: "bg-amber-500 text-zinc-950",
  DEF: "bg-blue-400 text-zinc-950",
  MED: "bg-emerald-400 text-zinc-950",
  ATA: "bg-rose-400 text-white",
  default: "bg-zinc-500 text-white",
};

/** Build position rows for PitchFormation from a starter array. */
export function buildPositionRows(starters) {
  const rows = { ATA: [], MED: [], DEF: [], GR: [] };
  for (const p of starters) {
    const pos = p.position;
    if (rows[pos]) rows[pos].push(p);
  }
  return rows;
}

/* Event types to display in the match chronology */
export const MATCH_EVENT_TYPES = [
  "goal", "penalty_goal", "own_goal", "penalty_miss",
  "yellow", "red", "injury", "substitution", "phase_start",
];

/** Filter and sort events up to a given minute. */
export function filterMatchEvents(events, liveMinute) {
  // Durante a pausa de introdução (5s) o servidor já enviou eventos com
  // minute = liveMinute + 1 (weather, phase_start). Incluímo-los para que
  // a pausa não fique vazia. Os minutos de pausa são startMin - 1:
  // 0 (início 1ª parte), 45 (início 2ª parte), 90 (início prolongamento).
  const PAUSE_MINUTES = new Set([0, 45, 90]);
  const maxMinute = PAUSE_MINUTES.has(liveMinute) ? liveMinute + 1 : liveMinute;
  return events
    .filter((e) => e.minute <= maxMinute && MATCH_EVENT_TYPES.includes(e.type))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}
