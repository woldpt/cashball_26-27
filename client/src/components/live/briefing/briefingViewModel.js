/**
 * briefingViewModel — derivação pura dos dados do briefing pré-jogo.
 *
 * Centraliza aqui TODA a lógica que o `MatchBriefing.jsx` fazia inline
 * (diferença de pontos, parsing de odds + probabilidades implícitas,
 * último confronto, ordem casa/fora, atmosfera do estádio). O resultado é
 * memoizável com `useMemo` e testável em Node sem render
 * (`scripts/briefingViewModelRegression.mjs`).
 *
 * Contrato de entrada (servidor — ver `server/matchSummaryHelpers.ts`):
 * - summary: `{ venue, isCup, matchweek, cupRound, cupRoundName, roundFixtures, headline, stakes,
 *   difficulty: { score, label }, team: {...}, opponent: {...}|null,
 *   odds: { home, draw, away }, referee: { name }|null,
 *   weatherForecast: { condition, emoji }|null, stadium: {...}|null }`
 * - teamInfo: snapshot da equipa do utilizador (GameContext) ou null.
 */

import { getMoraleLabel, getMoraleColor } from "../../../utils/morale.js";
import { WEATHER_LABELS } from "../../match/matchConstants.js";
import { orderedPair } from "./orderedPair.js";

/**
 * Normaliza uma odd (string "2.10" do servidor ou número) para número.
 * @param {unknown} raw
 * @returns {number|null} odd válida (> 1) ou null
 */
function parseOdd(raw) {
  const n = typeof raw === "number" ? raw : Number.parseFloat(raw);
  return Number.isFinite(n) && n > 1 ? n : null;
}

/**
 * Deriva a vista do último confronto a partir dos dados normalizados.
 * @param {Object|null|undefined} lc
 * @returns {Object|null}
 */
function buildLastConfrontation(lc) {
  if (!lc) return null;
  const label =
    lc.result === "V" ? "Vitória" : lc.result === "D" ? "Derrota" : "Empate";
  const comp =
    lc.competition === "cup"
      ? (lc.cupRoundName ?? "Taça")
      : `Liga · J${lc.matchweek}`;
  let score = `${lc.goalsFor}–${lc.goalsAgainst}`;
  if (lc.penalties)
    score += ` (g.p. ${lc.penalties.goalsFor}–${lc.penalties.goalsAgainst})`;
  else if (lc.extraTime) score += " (pro.)";
  return {
    result: lc.result,
    label,
    comp,
    score,
    venue: lc.venue ?? null,
    season: lc.season ?? null,
  };
}

/**
 * Deriva odds + probabilidades implícitas + favorito.
 * @param {{ home?: unknown, draw?: unknown, away?: unknown }|null|undefined} odds
 * @param {string} homeName
 * @param {string} awayName
 * @returns {{ list: Array<Object>, favoriteKey: string|null }}
 */
function buildOdds(odds, homeName, awayName) {
  const defs = [
    { key: "home", label: homeName },
    { key: "draw", label: "Empate" },
    { key: "away", label: awayName },
  ];
  const values = defs.map((d) => parseOdd(odds?.[d.key]));
  const invSum = values.reduce((acc, n) => acc + (n ? 1 / n : 0), 0);
  let favoriteKey = null;
  let best = Infinity;
  values.forEach((n, i) => {
    if (n != null && n < best) {
      best = n;
      favoriteKey = defs[i].key;
    }
  });
  const list = defs.map((d, i) => ({
    key: d.key,
    label: d.label,
    display: values[i] != null ? String(odds[d.key]) : "—",
    prob:
      values[i] != null && invSum > 0
        ? Math.round((1 / values[i] / invSum) * 100)
        : null,
    isFavorite: favoriteKey != null && defs[i].key === favoriteKey,
  }));
  return { list, favoriteKey };
}

/**
 * Chave de atmosfera do estádio a partir da ocupação.
 * @param {number} fill ocupação 0–100
 * @returns {"volcano"|"loud"|"mild"|"morgue"}
 */
export function getAtmosphereKey(fill) {
  if (fill >= 90) return "volcano";
  if (fill >= 70) return "loud";
  if (fill >= 40) return "mild";
  return "morgue";
}

/**
 * Constrói o view-model do briefing. Devolve null sem resumo.
 * Sem adversário (ex.: eliminado da Taça), devolve o modelo parcial com
 * `hasOpponent: false` — o herói/estádio continuam a renderizar.
 *
 * @param {Object|null|undefined} s nextMatchSummary do servidor
 * @param {Object|null|undefined} teamInfo snapshot da equipa (GameContext)
 * @returns {Object|null}
 */
export function buildBriefingViewModel(s, teamInfo) {
  if (!s) return null;
  const opp = s.opponent ?? null;
  const hasOpponent = !!opp;
  const myTeam = s.team ?? {};
  const isHome = s.venue === "Casa";
  const myName = teamInfo?.name ?? myTeam.name ?? "A minha equipa";

  const myPts = teamInfo?.points ?? myTeam.points ?? 0;
  const oppPts = opp?.points ?? 0;
  const myGF = teamInfo?.goals_for ?? 0;
  const myGA = teamInfo?.goals_against ?? 0;
  const myMorale = teamInfo?.morale ?? 50;
  const oppMorale = opp?.morale ?? 50;
  const myAvg = teamInfo?.avgSkill ?? myTeam.avgSkill ?? null;
  const oppAvg = opp?.avgSkill ?? null;

  const myId = myTeam.id ?? teamInfo?.id ?? null;
  const mySlotTeam =
    hasOpponent || Object.keys(myTeam).length > 0 || teamInfo
      ? { ...teamInfo, ...myTeam, id: myId }
      : null;

  const homeName = isHome ? (myTeam.name ?? "Casa") : (opp?.name ?? "Visitado");
  const awayName = isHome
    ? (opp?.name ?? "Visitante")
    : (myTeam.name ?? "Visitante");

  return {
    hasOpponent,
    isHome,
    isCup: !!s.isCup,
    cupRound: s.cupRound ?? null,
    spyGames: Array.isArray(s.roundFixtures) ? s.roundFixtures : [],
    venue: s.venue ?? null,
    competition: s.isCup
      ? (s.cupRoundName ?? "Taça")
      : `Jornada ${s.matchweek}`,
    headline: s.headline ?? "Tudo em aberto nesta jornada.",
    stakes: s.stakes ?? null,
    difficulty: {
      score: s.difficulty?.score ?? 50,
      label: s.difficulty?.label ?? "Equilibrado",
    },
    myName,
    ptsDiff: myPts - oppPts,
    compare: {
      position: orderedPair(
        isHome,
        myTeam.position ? `${myTeam.position}º` : "—",
        opp?.position ? `${opp.position}º` : "—",
      ),
      points: orderedPair(isHome, myPts, oppPts),
      goals: orderedPair(
        isHome,
        `${myGF}:${myGA}`,
        `${opp?.goalsFor ?? 0}:${opp?.goalsAgainst ?? 0}`,
      ),
      morale: orderedPair(
        isHome,
        { value: myMorale, label: getMoraleLabel(myMorale), color: getMoraleColor(myMorale) },
        { value: oppMorale, label: getMoraleLabel(oppMorale), color: getMoraleColor(oppMorale) },
      ),
      quality: orderedPair(isHome, myAvg, oppAvg),
    },
    form: {
      mine: { name: myName, last5: myTeam.last5 ?? "", team: mySlotTeam },
      theirs: { name: opp?.name ?? "—", last5: opp?.last5 ?? "", team: opp },
    },
    record: {
      mine: {
        v: teamInfo?.wins ?? myTeam.wins ?? 0,
        e: teamInfo?.draws ?? myTeam.draws ?? 0,
        d: teamInfo?.losses ?? myTeam.losses ?? 0,
      },
      theirs: { v: opp?.wins ?? 0, e: opp?.draws ?? 0, d: opp?.losses ?? 0 },
    },
    lastConfrontation: buildLastConfrontation(opp?.lastConfrontation),
    odds: buildOdds(s.odds, homeName, awayName),
    referee: s.referee?.name ? { name: s.referee.name } : null,
    weather: s.weatherForecast
      ? {
          emoji: s.weatherForecast.emoji ?? "🌤️",
          label:
            WEATHER_LABELS[s.weatherForecast.condition] ??
            s.weatherForecast.condition ??
            "—",
        }
      : null,
    slots: hasOpponent
      ? orderedPair(
          isHome,
          { id: myId, team: mySlotTeam, name: myName, isMine: true },
          { id: opp.id ?? null, team: opp, name: opp.name, isMine: false },
        )
      : [],
    stadium: s.stadium
      ? (() => {
          const att = s.stadium.expectedAttendance ?? 0;
          const cap = s.stadium.capacity ?? 10000;
          const fill =
            s.stadium.occupancyPct ??
            (cap > 0 ? Math.round((att / cap) * 100) : 0);
          const reasons = Array.isArray(s.stadium.reasons)
            ? s.stadium.reasons.slice(0, 2)
            : [];
          return {
            att,
            cap,
            fill,
            revenue: s.stadium.revenue ?? 0,
            reasons,
            atmosphereKey: getAtmosphereKey(fill),
          };
        })()
      : null,
    threats: Array.isArray(opp?.threats) ? opp.threats : [],
    formation: opp?.probableFormation ?? null,
    opponentColor: opp?.color_primary ?? null,
  };
}
