// Round-robin fixture generator (mirrors server engine.ts).
// When myTeamId is provided, applies a swap-correction so that team's
// home/away assignment alternates throughout the season (never two
// consecutive home or away games in the league).
export function generateLeagueFixtures(teamsInDivision, matchweek, myTeamId) {
  const sorted = [...teamsInDivision].sort((a, b) => a.id - b.id);
  const n = sorted.length;
  if (n < 2) return [];
  const totalRounds = n - 1;
  const totalMatchweeks = totalRounds * 2;
  const normMw = ((matchweek - 1) % totalMatchweeks) + 1;
  const isSecondLeg = normMw > totalRounds;
  const round = isSecondLeg ? normMw - totalRounds - 1 : normMw - 1;
  const rotating = sorted.slice(1);
  const rotated = rotating.map(
    (_, i) => rotating[(i + round) % rotating.length],
  );
  const allTeams = [sorted[0], ...rotated];
  const fixtures = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    let home = allTeams[i];
    let away = allTeams[n - 1 - i];
    if (isSecondLeg) [home, away] = [away, home];
    fixtures.push({ homeTeamId: home.id, awayTeamId: away.id });
  }

  if (myTeamId) {
    const swapMap = {};
    let prevCorrectedHome = null;
    for (let r = 0; r < totalRounds; r++) {
      const rot = rotating.map((_, i) => rotating[(i + r) % rotating.length]);
      const all = [sorted[0], ...rot];
      let rawIsHome = null;
      for (let i = 0; i < Math.floor(n / 2); i++) {
        if (all[i].id === myTeamId) {
          rawIsHome = true;
          break;
        }
        if (all[n - 1 - i].id === myTeamId) {
          rawIsHome = false;
          break;
        }
      }
      if (rawIsHome === null) continue;
      const needsSwap =
        prevCorrectedHome !== null && rawIsHome === prevCorrectedHome;
      swapMap[r] = needsSwap;
      prevCorrectedHome = needsSwap ? !rawIsHome : rawIsHome;
    }
    if (swapMap[round]) {
      const idx = fixtures.findIndex(
        (f) => f.homeTeamId === myTeamId || f.awayTeamId === myTeamId,
      );
      if (idx >= 0) {
        const f = fixtures[idx];
        [f.homeTeamId, f.awayTeamId] = [f.awayTeamId, f.homeTeamId];
      }
    }
  }

  return fixtures;
}
