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
 *   2. postMatchMood  — humor do jogo do utilizador
 *   3. boardWarning / dismissalModal / jobOfferModal — avisos e renovações
 *   4. seasonEndModal — fim de época, POR ÚLTIMO (só quando nada mais pendente)
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
 *   postMatchMood: object|null,
 *   boardWarning: object|null,
 *   dismissalModal: object|null,
 *   jobOfferModal: object|null,
 *   waitingWantsShow?: boolean,
 * }} inputs Estados brutos dos modais + se há uma surpresa da Taça da ronda
 *   atual ainda por celebrar/consumir.
 * @returns {{
 *   showMood: boolean,
 *   showBoardWarning: boolean,
 *   showDismissal: boolean,
 *   showJobOffer: boolean,
 *   showSeasonEnd: boolean,
 *   showWaiting: boolean,
 * }}
 */
export function computePostMatchFlow({
  seasonEndModal,
  cupPenaltyPopup,
  postMatchMood,
  boardWarning,
  dismissalModal,
  jobOfferModal,
  waitingWantsShow = false,
}) {
  const penalties = !!cupPenaltyPopup;
  const mood = !!postMatchMood;
  const board = !!boardWarning;
  const dismiss = !!dismissalModal;
  const job = !!jobOfferModal;
  const seasonEnd = !!seasonEndModal;

  // Um passo mostra-se só quando os anteriores já não estão ativos.
  const afterPenalties = !penalties;

  const showMood = afterPenalties && mood;
  const afterMood = afterPenalties && !mood;

  const showBoardWarning = afterMood && board;
  const afterBoard = afterMood && !board;

  const showDismissal = afterBoard && dismiss;
  const afterDismiss = afterBoard && !dismiss;

  const showJobOffer = afterDismiss && job;
  const afterJob = afterDismiss && !job;

  // Fim de época é sempre o ÚLTIMO: só revela quando mood e avisos
  // já foram resolvidos.
  const showSeasonEnd = afterJob && seasonEnd;

  // A espera multiplayer só ocupa o ecrã com a fila drenada.
  const queueBusy =
    penalties || mood || board || dismiss || job || seasonEnd;
  const showWaiting = !!waitingWantsShow && !queueBusy;

  return {
    showMood,
    showBoardWarning,
    showDismissal,
    showJobOffer,
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
 *   postMatchMood: object|null,
 *   boardWarning: object|null,
 *   dismissalModal: object|null,
 *   jobOfferModal: object|null,
 * }} inputs Estados brutos dos modais.
 * @returns {boolean}
 */
export function isPostMatchQueueActive({
  seasonEndModal,
  cupPenaltyPopup,
  postMatchMood,
  boardWarning,
  dismissalModal,
  jobOfferModal,
}) {
  return !!(
    seasonEndModal ||
    cupPenaltyPopup ||
    postMatchMood ||
    boardWarning ||
    dismissalModal ||
    jobOfferModal
  );
}
