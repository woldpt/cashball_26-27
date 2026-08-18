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

/**
 * Projeção da classificação ao vivo: tabela persistida (teams) + resultados
 * da jornada em curso (marcadores derivados dos eventos, até liveMinute).
 *
 * Quando `applyLiveResults` é false, os dados persistidos já incluem a jornada
 * (servidor reenviou teamsData/teamForms) — devolve a tabela tal como está,
 * evitando contar a jornada duas vezes. A `form` combina o histórico anterior
 * (teamForms) com o resultado da jornada em curso quando projetado.
 *
 * @param {Object} props
 * @param {Array} props.teams
 * @param {Object|null} props.matchResults
 * @param {number} props.liveMinute
 * @param {Object} props.teamForms
 * @param {boolean} props.applyLiveResults
 */
export function computeVirtualStandings({
  teams,
  matchResults,
  liveMinute = 90,
  teamForms = {},
  applyLiveResults = false,
}) {
  const standings = new Map();
  teams.forEach((t) => {
    standings.set(String(t.id), {
      team: t,
      played: (t.wins || 0) + (t.draws || 0) + (t.losses || 0),
      wins: t.wins || 0,
      draws: t.draws || 0,
      losses: t.losses || 0,
      goalsFor: t.goals_for || 0,
      goalsAgainst: t.goals_against || 0,
      points: t.points || 0,
      form: teamForms[t.id] || "",
    });
  });

  if (applyLiveResults) {
    (matchResults?.results || []).forEach((r) => {
      const home = standings.get(String(r.homeTeamId));
      const away = standings.get(String(r.awayTeamId));
      if (!home || !away) return;
      const events = r.events || [];
      const homeGoals = events.filter(
        (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "home",
      ).length;
      const awayGoals = events.filter(
        (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "away",
      ).length;
      applyResult(home, homeGoals, awayGoals);
      applyResult(away, awayGoals, homeGoals);
      home.form += homeGoals > awayGoals ? "V" : homeGoals === awayGoals ? "E" : "D";
      away.form += awayGoals > homeGoals ? "V" : awayGoals === homeGoals ? "E" : "D";
    });
  }

  return [...standings.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      String(a.team.name || "").localeCompare(String(b.team.name || "")),
  );
}

function applyResult(row, goalsFor, goalsAgainst) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}
