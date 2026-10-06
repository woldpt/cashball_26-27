/**
 * Previsão determinística de um jogo — espelho de `getWeatherForFixture`
 * (`server/game/matchCalculations.ts`). Mudar lá = mudar aqui
 * (`npm run test:weather` compara os dois).
 * @param {number} season
 * @param {number} matchweek
 * @param {number} teamAId
 * @param {number} teamBId
 * @returns {string} condição (`sol`, `chuva`, `vento`, `chuva_forte`, `frio`, `nevoeiro`, `neve`)
 */
export function weatherForFixture(season, matchweek, teamAId, teamBId) {
  let h = ((season ?? 1) * 1000 + (matchweek ?? 1) * 31 + (teamAId ?? 0) + (teamBId ?? 0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  const roll = (h >>> 0) / 0x100000000;
  if (roll < 0.35) return "sol";
  if (roll < 0.65) return "chuva";
  if (roll < 0.8) return "vento";
  if (roll < 0.88) return "chuva_forte";
  if (roll < 0.95) return "frio";
  if (roll < 0.98) return "nevoeiro";
  return "neve";
}
