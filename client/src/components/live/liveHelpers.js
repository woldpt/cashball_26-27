/* ── Live view shared helpers ─────────────────────────────────────────────
 *
 * Constantes e funções partilhadas entre o LiveMatchHero e o LiveFixtureRow
 * para manter a consistência visual da vista ao vivo.
 */

/** Cor do flash de golo (momentâneo) em todas as vistas ao vivo. */
export const FLASH_COLOR = "#ff4444";

/** Mapa único de ícones para eventos de partida (emoji, tamanho fixo). */
export function matchEventIcon(type) {
  switch (type) {
    case "goal":
    case "penalty_goal":
    case "var_goal_pending":
      return "⚽";
    case "own_goal":
      return "⚽🔙";
    case "var_disallowed":
      return "🚩";
    case "yellow":
      return "🟨";
    case "red":
      return "🟥";
    case "injury":
      return "🚑";
    case "substitution":
    case "halftime_sub":
      return "🔁";
    default:
      return "";
  }
}

/** True para tipos de evento que contam como golo no placar. */
export function isGoalType(type) {
  return type === "goal" || type === "penalty_goal" || type === "var_goal_pending";
}

/** Extrai [home, draw, away] das odds de um texto de evento de apostas. */
export function parseOdds(text) {
  if (!text) return null;
  const nums =
    text
      .replace(/^\[(?:\d+'|HT)\]\s*\S*\s*/, "")
      .match(/\d+\.\d{2}/g) || [];
  return nums.length >= 3 ? [nums[0], nums[1], nums[2]] : null;
}

/** Flash boolean de uma equipa com base no goalFlashRef e no timestamp. */
export function isFlashing(flashRef, homeId, awayId, side, now = Date.now()) {
  const ts = flashRef?.[`${homeId}_${awayId}_${side}`];
  return !!ts && now - ts < 1500;
}
