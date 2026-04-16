import { TICKER_TEAM_COLORS } from "../constants/index.js";

export function normalizeTeamId(teamId) {
  if (teamId === null || teamId === undefined) return null;
  const raw = String(teamId).trim();
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isNaN(numeric) ? raw : numeric;
}

export function isSameTeamId(left, right) {
  const normalizedLeft = normalizeTeamId(left);
  const normalizedRight = normalizeTeamId(right);
  if (normalizedLeft === null || normalizedRight === null) return false;
  return normalizedLeft === normalizedRight;
}

export function getTeamColor(teamId) {
  return teamId
    ? TICKER_TEAM_COLORS[teamId % TICKER_TEAM_COLORS.length]
    : "#ef4444";
}
