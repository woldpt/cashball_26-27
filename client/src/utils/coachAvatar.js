/**
 * Seed determinístico do avatar procedural (PlayerAvatar) de um coach.
 *
 * Convenção partilhada com GameLayout / UserSettingsPage / OtherSquadsTab:
 * - Seed partilhado (`sharedSeeds[name]`, difundido pelo servidor): todos os
 *   clientes renderizam `nome|seed` — a mesma cara para toda a gente.
 * - Fallback (sem seed partilhado): coach próprio `nome|avatarSeed`, outros
 *   coaches `coach|nome` (estável entre clientes, mas diferente da do dono).
 *
 * @param {string} name Nome do coach
 * @param {string|null} meName Nome do utilizador atual
 * @param {string} [avatarSeed] Seed próprio vindo do GameContext
 * @param {object} [sharedSeeds] Seeds partilhados vindos do GameContext
 * @returns {string} seed para `<PlayerAvatar seed={...} />`
 */
export function coachAvatarSeed(name, meName, avatarSeed = "", sharedSeeds = null) {
  if (!name) return "coach|?";
  const shared = sharedSeeds?.[name];
  if (shared) return `${name}|${shared}`;
  return name === meName ? `${name}|${avatarSeed}` : `coach|${name}`;
}
