/* ── Match module shared constants ─────────────────────────────────────── */

import {
  POSITION_ACCENT_HEX,
  POSITION_BADGE_BG_CLASS,
  POSITION_BADGE_BORDER_CLASS,
  POSITION_BADGE_TEXT_CLASS,
  POSITION_BAR_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  POSITION_GLOW_CLASS,
} from "../../constants/index.js";

/* Position sort order */
export const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };

/* Full PT labels for position badges — used in `title=` tooltips. */
export const POSITION_FULL_LABELS = {
  GR: "Guarda-redes",
  DEF: "Defesa",
  MED: "Médio",
  ATA: "Avançado",
};

/** Sort players by position (GR→DEF→MED→ATA), then by skill descending. */
export function sortPlayersByPos(arr = []) {
  return [...arr].sort(
    (a, b) =>
      (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
      (b.skill ?? 0) - (a.skill ?? 0),
  );
}

/* Visual styles per position — derivados da fonte única em constants/index.js */
export const POS_STYLES = {
  GR: { bar: POSITION_BAR_CLASS.GR, glow: POSITION_GLOW_CLASS.GR, bgGrad: POSITION_BG_GRADIENT_CLASS.GR, badgeBg: POSITION_BADGE_BG_CLASS.GR, badgeText: POSITION_BADGE_TEXT_CLASS.GR, badgeBorder: POSITION_BADGE_BORDER_CLASS.GR, accent: POSITION_ACCENT_HEX.GR },
  DEF: { bar: POSITION_BAR_CLASS.DEF, glow: POSITION_GLOW_CLASS.DEF, bgGrad: POSITION_BG_GRADIENT_CLASS.DEF, badgeBg: POSITION_BADGE_BG_CLASS.DEF, badgeText: POSITION_BADGE_TEXT_CLASS.DEF, badgeBorder: POSITION_BADGE_BORDER_CLASS.DEF, accent: POSITION_ACCENT_HEX.DEF },
  MED: { bar: POSITION_BAR_CLASS.MED, glow: POSITION_GLOW_CLASS.MED, bgGrad: POSITION_BG_GRADIENT_CLASS.MED, badgeBg: POSITION_BADGE_BG_CLASS.MED, badgeText: POSITION_BADGE_TEXT_CLASS.MED, badgeBorder: POSITION_BADGE_BORDER_CLASS.MED, accent: POSITION_ACCENT_HEX.MED },
  ATA: { bar: POSITION_BAR_CLASS.ATA, glow: POSITION_GLOW_CLASS.ATA, bgGrad: POSITION_BG_GRADIENT_CLASS.ATA, badgeBg: POSITION_BADGE_BG_CLASS.ATA, badgeText: POSITION_BADGE_TEXT_CLASS.ATA, badgeBorder: POSITION_BADGE_BORDER_CLASS.ATA, accent: POSITION_ACCENT_HEX.ATA },
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
  "weather", "betting",
];

/* Icon + color mapping for match events. Replaces the inline `getEventIcon`
 * ternary chain in EventCard.jsx. The `icon` field references a MatchIcon
 * name; the `color` field is a Tailwind text-* class applied to the SVG. */
export const MATCH_EVENT_ICONS = {
  goal:            { icon: "goal",          color: "text-emerald-400" },
  penalty_goal:    { icon: "penalty-goal",  color: "text-emerald-400" },
  own_goal:        { icon: "own-goal",      color: "text-rose-400" },
  penalty_miss:    { icon: "penalty-miss",  color: "text-amber-400" },
  yellow:          { icon: "yellow-card",   color: "text-yellow-400" },
  red:             { icon: "red-card",      color: "text-red-400" },
  injury:          { icon: "injury",        color: "text-rose-400" },
  substitution:    { icon: "swap",          color: "text-cyan-400" },
  phase_start:     { icon: "phase-start",   color: "text-on-surface-variant" },
  weather:         { icon: null,            color: "text-sky-400" },
  betting:         { icon: null,            color: "text-amber-400" },
};

/** Resolve icon + color for an event, falling back gracefully. */
export function getEventIconStyle(type) {
  return MATCH_EVENT_ICONS[type] || null;
}

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
