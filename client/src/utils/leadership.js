/* Liderança e capitão — ESPELHA `leadershipOf`/`pickCaptain` de
 * server/game/matchCalculations.ts e as constantes `captain*` de
 * MATCH_TUNING (server/gameConstants.ts). O servidor é a verdade; isto serve
 * só para mostrar na Tática. Mudou lá → mudar aqui. */
const FULL_EXPERIENCE_GAMES = 60;
const STATUS_MARGIN = 4;
const LOW_MORALE = 15;
const HIGH_MORALE = 35;
const MORALE_NEUTRAL = 25;

/**
 * Liderança de um jogador, 1–5 braçadeiras.
 * @param {{age?: number, career_games?: number, skill?: number, morale?: number}} p
 * @param {number} xiAvgSkill - Qualidade média do onze.
 * @returns {number}
 */
export function leadershipOf(p, xiAvgSkill) {
  const age = p.age ?? 0;
  const ageScore = age <= 20 ? 0 : age <= 23 ? 0.5 : age <= 26 ? 1 : age <= 28 ? 1.5 : age <= 33 ? 2 : 1.5;
  const experience = 1.5 * Math.min((p.career_games ?? 0) / FULL_EXPERIENCE_GAMES, 1);
  const skill = p.skill ?? 0;
  const status = skill >= xiAvgSkill + STATUS_MARGIN ? 1 : skill >= xiAvgSkill ? 0.5 : 0;
  const morale = p.morale ?? MORALE_NEUTRAL;
  const mood = morale < LOW_MORALE ? -1 : morale > HIGH_MORALE ? 0.5 : 0;
  return Math.max(1, Math.min(5, Math.round(ageScore + experience + status + mood)));
}

/**
 * Onze ordenado por liderança (empate → mais jogos → menor id) e o capitão em
 * campo: o escolhido se for titular, senão o primeiro da lista.
 * @param {Array<{id: number, name: string, age?: number, career_games?: number, skill?: number, morale?: number}>} starters
 * @param {number} [chosenId]
 * @returns {{captain: {id: number, name: string, lead: number, auto: boolean} | null, ranked: Array<{id: number, name: string, lead: number}>}}
 */
export function rankCaptains(starters, chosenId) {
  const avg = starters.length ? starters.reduce((n, p) => n + (p.skill ?? 0), 0) / starters.length : 0;
  const ranked = starters
    .map((p) => ({ id: p.id, name: p.name, lead: leadershipOf(p, avg), games: p.career_games ?? 0 }))
    .sort((a, b) => b.lead - a.lead || b.games - a.games || a.id - b.id)
    .map(({ id, name, lead }) => ({ id, name, lead }));
  const chosen = ranked.find((r) => r.id === chosenId);
  const pick = chosen ?? ranked[0];
  return { captain: pick ? { ...pick, auto: !chosen } : null, ranked };
}
