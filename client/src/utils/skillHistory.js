import { SEASON_CALENDAR, SEASON_WEEKS } from "../constants/index.js";

/**
 * Utilitários para o histórico de skill de um jogador.
 *
 * Cada ponto do histórico tem `{ matchweek, season, skill }`, onde `matchweek`
 * é o slot de calendário 1-based (1..25: amigável, 18 jornadas, 6 rondas da Taça).
 * O eixo X do gráfico usa uma escala contínua de épocas:
 * `epoch = (season - 1) * SEASON_WEEKS + slot`.
 */

const SLOTS_PER_SEASON = SEASON_WEEKS;

/**
 * Converte `{ matchweek, season }` em um índice contínuo de semanas (1-based).
 *
 * @param {{ matchweek: number, season: number }} point
 * @returns {number}
 */
export function skillEpoch(point) {
  const slot = Math.max(1, Math.min(SLOTS_PER_SEASON, point.matchweek || 1));
  const season = Math.max(1, point.season || 1);
  return (season - 1) * SLOTS_PER_SEASON + slot;
}

/**
 * Rótulo curto de um slot de calendário: "J4" (liga), "T2" (Taça), "Pré" (amigável).
 *
 * @param {number} slot slot 1-based (1..SEASON_WEEKS)
 * @returns {string}
 */
function slotShortLabel(slot) {
  const entry = SEASON_CALENDAR[slot - 1];
  if (!entry) return `S${slot}`;
  if (entry.type === "league") return `J${entry.matchweek}`;
  if (entry.type === "friendly") return "Pré";
  return `T${entry.round}`;
}

/**
 * Rótulo curto para um ponto do histórico.
 *
 * @param {{ matchweek: number, season: number }} point
 * @param {number} currentSeason
 * @returns {string}
 */
export function skillLabel(point, currentSeason) {
  const short = slotShortLabel(point.matchweek || 1);
  if ((point.season || 1) !== currentSeason) {
    const year = 2026 + (point.season || 1) - 1;
    return `${year}·${short}`;
  }
  return short;
}

/**
 * Constrói os pontos do gráfico de skill.
 *
 * @param {Array<{ matchweek: number, season: number, skill: number }>} history
 * @param {number} currentSeason
 * @param {number} weeks
 * @returns {Array<{ x: number, y: number, label: string, skill: number }>}
 */
export function buildSkillChartPoints(history, currentSeason, weeks = SLOTS_PER_SEASON) {
  const points = (history || [])
    // Ponto sem skill ou sem slot não tem onde ser desenhado (`y` null dava
    // NaN no caminho do SVG) — é descartado, como antes.
    .filter((p) => p && p.skill != null && p.matchweek != null)
    .map((p) => ({
      epoch: skillEpoch(p),
      skill: Number(p.skill),
      label: skillLabel(p, currentSeason),
    }));

  // Deduplicate by epoch, keeping the last entry (most recent).
  const byEpoch = new Map();
  for (const p of points) {
    byEpoch.set(p.epoch, p);
  }
  const sorted = [...byEpoch.values()].sort((a, b) => a.epoch - b.epoch);

  // Keep only the last `weeks` epochs.
  const visible = sorted.slice(-weeks);

  return visible.map((p) => ({
    x: p.epoch,
    y: p.skill,
    label: p.label,
    skill: p.skill,
  }));
}
