/**
 * Helpers para o gráfico de evolução da skill.
 *
 * O `matchweek` nos snapshots é POR ÉPOCA (1..14 em cada época). Para ordenar
 * e posicionar cronologicamente pontos de várias épocas é preciso um epoch
 * global: `(season - 1) * 14 + matchweek` — a mesma convenção de
 * `contractEpoch()` do servidor (gameConstants.ts).
 */

export const MATCHWEEKS_PER_SEASON = 14;

/**
 * Converte (season, matchweek) num índice global cronológico.
 * @param {number|undefined} season - época (1-based; omissa ⇒ 1)
 * @param {number|undefined} matchweek - jornada dentro da época (1..14)
 * @returns {number}
 */
export function skillEpoch(season, matchweek) {
  const s = Math.max(1, Number(season) || 1);
  const mw = Math.min(MATCHWEEKS_PER_SEASON, Math.max(1, Number(matchweek) || 1));
  return (s - 1) * MATCHWEEKS_PER_SEASON + mw;
}

/**
 * Ordena o histórico cronologicamente por epoch global e anexa os epochs
 * calculados. Pontos sem `season` são tratados como época 1 (dados antigos).
 * @param {Array<{matchweek?: number, season?: number, skill?: number}>} history
 * @returns {Array<{matchweek: number, season: number, skill: number, epoch: number}>}
 */
export function buildSkillChartPoints(history) {
  return (history || [])
    .filter((p) => p.skill != null && p.matchweek != null)
    .map((p) => ({
      matchweek: Number(p.matchweek),
      season: Math.max(1, Number(p.season) || 1),
      skill: Number(p.skill),
      epoch: skillEpoch(p.season, p.matchweek),
    }))
    .sort((a, b) => a.epoch - b.epoch);
}

/**
 * Rótulo de eixo X para um ponto. Com várias épocas mostra o ano civil
 * (2025 + época, convenção do servidor) para distinguir jornadas repetidas.
 * @param {{season?: number, matchweek?: number}} p
 * @param {boolean} multiSeason - se o histórico tem mais do que uma época
 * @returns {string}
 */
export function skillLabel(p, multiSeason) {
  if (multiSeason) {
    return `${2025 + Math.max(1, Number(p.season) || 1)}·J${p.matchweek}`;
  }
  return `J${p.matchweek}`;
}
