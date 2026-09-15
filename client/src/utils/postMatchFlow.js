/**
 * Sequenciador central dos modais pós-jogo.
 *
 * Os modais pós-jogo são alimentados por estados independentes (cada um
 * preenchido por um evento socket/efeito próprio). Sem ordenação, vários
 * ficam `true` ao mesmo tempo e aparecem sobrepostos. Este módulo é a única
 * fonte de verdade da ORDEM em que devem surgir: devolve, em cada render,
 * quais podem estar visíveis — um passo só "ocupa o ecrã" se todos os de
 * maior prioridade estiverem inativos; os restantes aguardam o fecho do atual
 * (os respetivos dados ficam guardados e revelam a seguir). Os `onClose`/acks
 * de cada modal mantêm-se intactos.
 *
 * Ordem de revelação:
 *   1. cupPenaltyPopup — grandes penalidades (sempre primeiro)
 *   2. dismissalModal — despedimento
 *   3. seasonEndModal — fim de época, POR ÚLTIMO (só quando nada mais pendente)
 *
 * O humor pós-jogo, os avisos da direção e os convites de clubes deixaram
 * de ser modais: são linhas da caixa de entrada (Jornal) — ver `useInbox`.
 * Os parâmetros correspondentes continuam aceites (chamadas antigas), mas
 * são ignorados.
 *
 * O Aguardar Coaches (espera multiplayer) NÃO faz parte da fila: é suprimido
 * enquanto houver algum passo pendente (`showWaiting` false) e revela quando
 * a fila drena — os dados ficam guardados, só ordena. Ao intervalo a fila
 * está sempre vazia (humor/avisos só nascem em resultados finais), por isso
 * a espera do intervalo nunca é afetada.
 *
 * (As surpresas da Taça deixaram de ser modal: são notícia persistente
 * `cup_upset` com tira própria no Jornal.)
 *
 * @param {{
 *   seasonEndModal: object|null,
 *   cupPenaltyPopup: object|null,
 *   dismissalModal: object|null,
 *   waitingWantsShow?: boolean,
 * }} inputs Estados brutos dos modais.
 * @returns {{
 *   showDismissal: boolean,
 *   showSeasonEnd: boolean,
 *   showWaiting: boolean,
 * }}
 */
export function computePostMatchFlow({
  seasonEndModal,
  cupPenaltyPopup,
  dismissalModal,
  waitingWantsShow = false,
}) {
  const penalties = !!cupPenaltyPopup;
  const dismiss = !!dismissalModal;
  const seasonEnd = !!seasonEndModal;

  // Um passo mostra-se só quando os anteriores já não estão ativos.
  const afterPenalties = !penalties;

  const showDismissal = afterPenalties && dismiss;
  const afterDismiss = afterPenalties && !dismiss;

  // Fim de época é sempre o ÚLTIMO: só revela quando o resto já foi.
  const showSeasonEnd = afterDismiss && seasonEnd;

  // A espera multiplayer só ocupa o ecrã com a fila drenada.
  const queueBusy = penalties || dismiss || seasonEnd;
  const showWaiting = !!waitingWantsShow && !queueBusy;

  return {
    showDismissal,
    showSeasonEnd,
    showWaiting,
  };
}

/**
 * Diz se há fila pós-jogo ativa (algum passo pendente). Para portões fora
 * do GameOverlays (ex.: a espera pré-jogo na TacticsView) sem duplicar
 * a lógica da fila.
 *
 * @param {{
 *   seasonEndModal: object|null,
 *   cupPenaltyPopup: object|null,
 *   dismissalModal: object|null,
 * }} inputs Estados brutos dos modais.
 * @returns {boolean}
 */
export function isPostMatchQueueActive({
  seasonEndModal,
  cupPenaltyPopup,
  dismissalModal,
}) {
  return !!(seasonEndModal || cupPenaltyPopup || dismissalModal);
}
