import { SEASON_CALENDAR } from "../constants/index.js";

/**
 * Etiqueta humana de um slot 1-based do calendário (relógio único):
 * "Jornada N" na liga, nome da ronda na Taça, "Pré-época" no amigável.
 *
 * @param {number} slot slot 1-based (1..20)
 * @returns {string}
 */
export function slotLabel(slot) {
  const entry = SEASON_CALENDAR[Math.max(1, slot || 1) - 1];
  if (!entry) return `Semana ${slot}`;
  if (entry.type === "league") return `Jornada ${entry.matchweek}`;
  if (entry.type === "friendly") return "Pré-época";
  return entry.roundName;
}
