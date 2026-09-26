// Round-robin fixture generator — mirrors server/game/engine.ts exactly.
// seedIds: ordered list of team IDs (from game.fixtureSeeds[division]).
// matchweek: 1-based matchweek number.
/**
 * @param {any} seedIds
 * @param {any} matchweek
 * @returns {{ homeTeamId: number, awayTeamId: number }[]}
 */
export function generateLeagueFixtures(seedIds, matchweek) {
  if (!Array.isArray(seedIds)) return [];
  const cleanIds = seedIds.filter((id) => Number.isInteger(id));
  const n = cleanIds.length;
  const mw = Math.floor(Number(matchweek));
  if (n < 2 || !Number.isFinite(mw)) return [];
  const totalRounds = n - 1;
  const totalMatchweeks = totalRounds * 2;
  const normMw = ((mw - 1) % totalMatchweeks + totalMatchweeks) % totalMatchweeks + 1;
  const isSecondLeg = normMw > totalRounds;
  const round = isSecondLeg ? normMw - totalRounds - 1 : normMw - 1;
  const indexById = new Map(cleanIds.map((id, i) => [id, i]));
  const rotating = cleanIds.slice(1);
  const rotated = rotating.map((_, i) => rotating[(i + round) % rotating.length]);
  const allIds = [cleanIds[0], ...rotated];
  const fixtures = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const a = allIds[i];
    const b = allIds[n - 1 - i];
    // Padrão C/F alternado: cada equipa tem alternância perfeita
    const teamIndexInSeed = indexById.get(a) ?? 0;
    const isSecondLegMatchweek = isSecondLeg ? 1 : 0;
    const aIsHome = (teamIndexInSeed + round + isSecondLegMatchweek) % 2 === 0;
    if (aIsHome) {
      fixtures.push({ homeTeamId: a, awayTeamId: b });
    } else {
      fixtures.push({ homeTeamId: b, awayTeamId: a });
    }
  }
  return fixtures;
}
