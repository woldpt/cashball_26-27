/* ── standingsRank — classificação e tendência de posições ────────────────
 *
 * Comparador idêntico ao servidor (getStandingsRows): pontos → diferença de
 * golos → golos marcados → nome. Usado na tabela de classificação e no
 * painel de classificação virtual para calcular as posições atuais e as da
 * jornada anterior (para as setinhas de subida/descida).
 */

/** Ordena duas linhas de classificação (objetos estilo "team" com pontos,
 *  goals_for, goals_against, name). */
export function compareStandingsRows(a, b) {
  return (
    (b.points || 0) - (a.points || 0) ||
    (b.goals_for || 0) -
      (b.goals_against || 0) -
      ((a.goals_for || 0) - (a.goals_against || 0)) ||
    (b.goals_for || 0) - (a.goals_for || 0) ||
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

/** Devolve a lista ordenada por classificação (sem mutar o input). */
export function rankStandings(teams) {
  return [...teams].sort(compareStandingsRows);
}

/**
 * Mapa de tendência (subida/descida) entre duas tabelas de classificação.
 *
 * @param {Array} currentTeams - tabela atual (objetos "team")
 * @param {Array} prevTeams - tabela da jornada anterior (objetos "team")
 * @returns {Map<string, { cur: number, prev: number|null, movement: number }>}
 */
export function buildStandingsMovement(currentTeams, prevTeams) {
  const cur = rankStandings(currentTeams);
  const prev = rankStandings(prevTeams);
  const map = new Map();
  cur.forEach((t, i) => {
    const prevIdx = prev.findIndex((p) => String(p.id) === String(t.id));
    map.set(String(t.id), {
      cur: i + 1,
      prev: prevIdx >= 0 ? prevIdx + 1 : null,
      movement: prevIdx >= 0 ? prevIdx - i : 0,
    });
  });
  return map;
}
