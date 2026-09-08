/**
 * Sequenciador central dos modais pós-jogo.
 *
 * Os modais pós-jogo são alimentados por estados independentes (cada um
 * preenchido por um evento socket/efeito próprio). Sem ordenação, vários
 * ficam `true` ao mesmo tempo e aparecem sobrepostos. Este módulo é a única
 * fonte de verdade da ORDEM em que devem surgir: devolve, em cada render,
 * quais podem estar visíveis — os de menor prioridade só revelam depois de o
 * utilizador fechar o atual (os respetivos dados ficam guardados e surgem a
 * seguir). Os `onClose`/acks de cada modal mantêm-se intactos.
 *
 * Prioridade:
 *   1. seasonEnd        — fim de época (terminal; recarrega a página ao fechar)
 *   2. cupPenaltyPopup  — grandes penalidades (penalties sempre primeiro)
 *   3. postMatchMood    — humor do jogo do utilizador
 *   4. cup upset        — auto-sequenciado dentro do CupUpsetModal (espera o mood)
 *   5. boardWarning / dismissalModal / jobOfferModal — avisos e renovações, por último
 *
 * Nota: o CupUpsetModal gere a própria exibição contra o mood (só mostra sem
 * mood), por isso aqui apenas o bloqueamos nas fases terminal/penalties.
 *
 * @param {{
 *   seasonEndModal: object|null,
 *   cupPenaltyPopup: object|null,
 *   postMatchMood: object|null,
 *   boardWarning: object|null,
 *   dismissalModal: object|null,
 *   jobOfferModal: object|null,
 * }} inputs Estados brutos dos modais (tal como vêm do contexto).
 * @returns {{
 *   showMood: boolean,
 *   showCupRoundResults: boolean,
 *   showBoardWarning: boolean,
 *   showDismissal: boolean,
 *   showJobOffer: boolean,
 * }}
 */
export function computePostMatchFlow({
  seasonEndModal,
  cupPenaltyPopup,
  postMatchMood,
  boardWarning,
  dismissalModal,
  jobOfferModal,
}) {
  // Fases que mandam parar tudo o resto enquanto durar:
  // fim de época (terminal) e grandes penalidades (sempre primeiro).
  const terminal = !!seasonEndModal;
  const penalties = !!cupPenaltyPopup;
  const revealed = !terminal && !penalties;

  const hasMood = !!postMatchMood;

  // Humor do jogo do utilizador — aparece assim que a fase terminal/penalties
  // acaba (se ainda houver resultados por mostrar da sua ronda).
  const showMood = revealed && hasMood;

  // Surpresas da Taça: recebem os dados da ronda apenas fora das fases
  // terminal/penalties e depois de o mood fechar (o CupUpsetModal, por si,
  // já espera o mood; ao ocultar aqui também evitamos montar em excesso).
  const showCupRoundResults = revealed && !hasMood;

  // Avisos / despedimento / proposta (renovações) surgem só depois do mood e
  // das fases terminais. Entre si, mostram-se um de cada vez (o que tem maior
  // prioridade presente); os restantes esperam o fecho do anterior.
  const avisosUnblocked = revealed && !hasMood;
  const hasBoardWarning = !!boardWarning;
  const hasDismissal = !!dismissalModal;
  const hasJobOffer = !!jobOfferModal;

  const showBoardWarning = avisosUnblocked && hasBoardWarning;
  const showDismissal =
    avisosUnblocked && !hasBoardWarning && hasDismissal;
  const showJobOffer =
    avisosUnblocked &&
    !hasBoardWarning &&
    !hasDismissal &&
    hasJobOffer;

  return {
    showMood,
    showCupRoundResults,
    showBoardWarning,
    showDismissal,
    showJobOffer,
  };
}
