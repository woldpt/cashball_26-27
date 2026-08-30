/**
 * Seed determinístico do avatar procedural (PlayerAvatar) de um coach.
 *
 * Convenção partilhada com GameLayout / UserSettingsPage / TeamSquadView:
 * - Coach próprio: `nome|avatarSeed` (face muda quando o utilizador regenera
 *   o seed nas Definições, em todos os locais).
 * - Outros coaches: `coach|nome` (mesmo prefixo da TeamSquadView; estável em
 *   todos os clientes porque não depende de seeds que só o dono conhece).
 *
 * @param {string} name Nome do coach
 * @param {string|null} meName Nome do utilizador atual
 * @param {string} [avatarSeed] Seed próprio vindo do GameContext
 * @returns {string} seed para `<PlayerAvatar seed={...} />`
 */
export function coachAvatarSeed(name, meName, avatarSeed = "") {
  if (!name) return "coach|?";
  return name === meName ? `${name}|${avatarSeed}` : `coach|${name}`;
}
