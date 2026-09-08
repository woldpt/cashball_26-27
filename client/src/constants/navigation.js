/**
 * navigation.js — fonte única dos grupos de navegação do shell do jogo.
 *
 * A sidebar desktop e o bottom-nav mobile partilham a mesma taxonomia
 * (Clube / Gestão / Competição / Transferências). Antes, cada superfície
 * repetia os seus arrays inline — o destaque mobile de "Gestão" só acendia
 * para Finanças+Plantel e o de "Competição" excluía a Taça, porque as listas
 * de `isChildActive` estavam dessincronizadas dos fly-ups.
 *
 * Ordem canónica dentro dos grupos: Scout → Mercado → Leilões (prospetar →
 * comprar → licitar) e Classificações antes de Calendário.
 *
 * @typedef {object} NavTab
 * @property {string} key Identificador da tab (ver `navigateTab`).
 * @property {string} label Rótulo desktop.
 * @property {string} shortLabel Rótulo curto (fly-ups mobile).
 * @property {string} icon Ícone `material-symbols-outlined`.
 * @property {boolean} [cupBracket] Se deve pedir `requestCupBracket` ao navegar.
 *
 * @typedef {object} NavGroup
 * @property {string} id Identificador do grupo (`mobileSubMenu` no mobile).
 * @property {string} label Rótulo da secção desktop.
 * @property {NavTab[]} tabs Tabs do grupo.
 */

/** @type {NavGroup[]} Grupos de navegação na ordem de apresentação. */
export const NAV_GROUPS = [
  {
    id: "clube",
    label: "Clube",
    tabs: [{ key: "club", label: "Clube", shortLabel: "Clube", icon: "groups_3" }],
  },
  {
    id: "gestao",
    label: "Gestão",
    tabs: [
      { key: "finances", label: "Finanças", shortLabel: "Finanças", icon: "payments" },
      { key: "stadium", label: "Estádio", shortLabel: "Estádio", icon: "stadium" },
      { key: "players", label: "Plantel", shortLabel: "Plantel", icon: "group" },
      { key: "training", label: "Treino", shortLabel: "Treino", icon: "fitness_center" },
    ],
  },
  {
    id: "competicao",
    label: "Competição",
    tabs: [
      { key: "standings", label: "Classificações", shortLabel: "Classif.", icon: "leaderboard" },
      { key: "calendario", label: "Calendário", shortLabel: "Calendário", icon: "calendar_month" },
      { key: "bracket", label: "Taça", shortLabel: "Taça", icon: "emoji_events", cupBracket: true },
    ],
  },
  {
    id: "transferencias",
    label: "Transferências",
    tabs: [
      { key: "scout", label: "Scout", shortLabel: "Scout", icon: "search" },
      { key: "market", label: "Mercado", shortLabel: "Mercado", icon: "swap_horiz" },
      { key: "leiloes", label: "Leilões", shortLabel: "Leilões", icon: "gavel" },
    ],
  },
];

/**
 * Tabs de um grupo (para os fly-ups mobile).
 *
 * @param {string} groupId Identificador do grupo.
 * @returns {NavTab[]} Tabs do grupo (vazio se desconhecido).
 */
export function getGroupTabs(groupId) {
  return NAV_GROUPS.find((g) => g.id === groupId)?.tabs ?? [];
}

/**
 * Chaves de tab de um grupo (para destaques `isChildActive`).
 *
 * @param {string} groupId Identificador do grupo.
 * @returns {string[]} Chaves das tabs do grupo (vazio se desconhecido).
 */
export function getGroupTabKeys(groupId) {
  return NAV_GROUPS.find((g) => g.id === groupId)?.tabs.map((t) => t.key) ?? [];
}

/**
 * Grupo a que pertence uma tab.
 *
 * @param {string} tabKey Chave da tab.
 * @returns {string|null} Identificador do grupo ou `null`.
 */
export function getTabGroupId(tabKey) {
  return NAV_GROUPS.find((g) => g.tabs.some((t) => t.key === tabKey))?.id ?? null;
}
