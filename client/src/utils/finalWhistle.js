/**
 * Decide se o árbitro deve apitar: devolve os dados do apito final do MEU
 * jogo (liga, taça ou amigável) ou `null` se ainda não há resultado final.
 *
 * Espelha as chaves e os formatos do humor pós-jogo (incluindo a guarda
 * `mom` na liga). Na taça sem `winnerId` ainda há prolongamento ou
 * penáltis — o apito espera, devolve `null`.
 *
 * Puro (sem som nem estado): o GameContext trata de apitar uma vez por
 * chave, mostrar o selo e limpá-lo.
 *
 * @param {Object} args
 * @param {Object|null} args.matchResults Resultados da liga (ou null).
 * @param {Object|null} args.cupRoundResults Resultados da taça/amigável (ou null).
 * @param {number|string|null|undefined} args.myTeamId Equipa do utilizador.
 * @param {number} args.season Época corrente.
 * @returns {{ key: string, competition: "league" | "cup", outcome: "win" | "loss" | "draw", myGoals: number, oppGoals: number } | null}
 */
export function computeFinalWhistle({ matchResults, cupRoundResults, myTeamId, season }) {
  if (myTeamId == null) return null;
  const findMine = (results) =>
    (results || []).find(
      (r) =>
        Number(r.homeTeamId) === Number(myTeamId) ||
        Number(r.awayTeamId) === Number(myTeamId),
    );
  // Liga: só os resultados finais trazem `mom`.
  const league = findMine(matchResults?.results);
  if (league && league.mom != null) {
    const isHome = Number(league.homeTeamId) === Number(myTeamId);
    const myGoals = isHome
      ? (league.homeGoals ?? league.finalHomeGoals ?? 0)
      : (league.awayGoals ?? league.finalAwayGoals ?? 0);
    const oppGoals = isHome
      ? (league.awayGoals ?? league.finalAwayGoals ?? 0)
      : (league.homeGoals ?? league.finalHomeGoals ?? 0);
    return {
      key: `league:${season}:${matchResults.matchweek}`,
      competition: "league",
      outcome: myGoals > oppGoals ? "win" : myGoals < oppGoals ? "loss" : "draw",
      myGoals,
      oppGoals,
    };
  }
  // Taça (ronda 0 = amigável de pré-época, decide pelos golos).
  const cup = findMine(cupRoundResults?.results);
  if (!cup) return null;
  const isFriendly = Number(cupRoundResults.round) === 0;
  const isHome = Number(cup.homeTeamId) === Number(myTeamId);
  const myGoals = isHome ? (cup.homeGoals ?? 0) : (cup.awayGoals ?? 0);
  const oppGoals = isHome ? (cup.awayGoals ?? 0) : (cup.homeGoals ?? 0);
  if (!isFriendly && cup.winnerId == null) return null;
  return {
    key: isFriendly
      ? `friendly:${cupRoundResults.season}:1`
      : `cup:${cupRoundResults.season}:${cupRoundResults.round}`,
    competition: "cup",
    outcome: isFriendly
      ? (myGoals > oppGoals ? "win" : myGoals < oppGoals ? "loss" : "draw")
      : (Number(cup.winnerId) === Number(myTeamId) ? "win" : "loss"),
    myGoals,
    oppGoals,
  };
}
