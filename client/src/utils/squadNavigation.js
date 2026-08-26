/**
 * Navegação do plantel de equipas — contratos puros e testáveis.
 *
 * Contexto: `handleOpenTeamSquad` regista a abertura de um plantel no
 * histórico do browser (`{ teamSquad, teamId }`), para que o "Voltar" (botão
 * do TeamSquadView, botão do modal de historial ou back do browser) volte à
 * equipa anterior da cadeia (A → B → C) em vez de saltar níveis.
 *
 * Estes helpers concentram as DECISÕES de navegação, mantendo a lógica fora
 * do React (onde o `history` real e os efeitos vivem) e permitindo um
 * regression test em node puro (scripts/squadNavigationRegression.mjs).
 */

/**
 * Decide a acção do popstate dado o estado actual da UI.
 *
 * Regra chave: um entry `{ teamSquad }` só é legítimo se o utilizador ainda
 * estiver DENTRO do fluxo de plantel (tab "squad" + equipa seleccionada).
 * Se navegou para outro separador por outra via (sidebar, JOGAR, fim de
 * jogo...), o entry fica obsoleto em cima da pilha e o "Voltar" (botão do
 * modal de historial ou back do browser) não pode repor a equipa antiga.
 *
 * @param {{ state: object|null, activeTab: string, selectedTeam: object|null }} ctx
 * @returns {{ type: "restore", teamId: number|string } | { type: "exit" } | { type: "ignore" }}
 */
export function computePopStateAction({ state, activeTab, selectedTeam }) {
  const inSquad = activeTab === "squad" && !!selectedTeam;
  if (state?.teamSquad) {
    if (!inSquad) return { type: "ignore" };
    return { type: "restore", teamId: state.teamId };
  }
  if (inSquad) return { type: "exit" };
  return { type: "ignore" };
}

/**
 * Decide o que fazer quando o utilizador troca de separador a partir da UI
 * (sidebar, nav móvel, JOGAR...).
 *
 * Se estiver dentro do plantel de outra equipa, sai do modo plantel e, havendo
 * um entry `{ teamSquad }` no topo do histórico, anula-o (replaceState) —
 * senão o back seguinte (botão ou browser) voltaria a abrir essa equipa.
 *
 * @param {{ activeTab: string, historyState: object|null }} ctx
 * @returns {{ closeSquad: boolean, neutralizeHistory: boolean }}
 */
export function computeNavigateTabAction({ activeTab, historyState }) {
  if (activeTab !== "squad") {
    return { closeSquad: false, neutralizeHistory: false };
  }
  return {
    closeSquad: true,
    neutralizeHistory: !!historyState?.teamSquad,
  };
}

/**
 * Decide como registar a abertura de um plantel no histórico do browser.
 *
 * - A partir do plantel actual (cadeia A → B → C): empurra sempre, para o
 *   "Voltar" regressar à equipa anterior.
 * - A partir de outro separador: se houver um entry `{ teamSquad }` obsoleto
 *   no topo (ex.: um jogo começou a meio da visualização e a app mudou de
 *   tab via socket), substitui-o em vez de empilhar lixo — o back seguinte
 *   sai do plantel limpo em vez de voltar a uma equipa antiga.
 *
 * @param {{ activeTab: string, historyState: object|null, teamId: number|string }} ctx
 * @returns {{ useReplace: boolean, state: { teamSquad: boolean, teamId: number|string } }}
 */
export function computeOpenSquadHistoryAction({ activeTab, historyState, teamId }) {
  const useReplace = activeTab !== "squad" && !!historyState?.teamSquad;
  return {
    useReplace,
    state: { teamSquad: true, teamId },
  };
}
