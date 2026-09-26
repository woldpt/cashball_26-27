/**
 * Classificação das mensagens de `joinError` vindas do servidor.
 *
 * Uma só fonte para a decisão "limpar sessão / re-tentar / largar a sala":
 * o `App` (via `useJoinSession`) e o teste de regressão consomem daqui.
 *
 * Frágil de propósito (fase 2: o servidor deve enviar códigos em vez de
 * frases — nessa altura estas funções passam a comparar códigos).
 */

/**
 * Erros de autenticação: só uma credencial inválida termina a sessão.
 * Um erro de rede, rate-limit ou carregamento da sala nunca pode
 * desmontar o jogo.
 *
 * @param {string} msg mensagem do servidor
 * @returns {boolean}
 */
export function isAuthError(msg) {
	const lowered = (msg || "").toLowerCase();
	return (
		lowered.includes("palavra-passe") ||
		lowered.includes("credenciais") ||
		lowered.includes("sessão inválida") ||
		lowered.includes("sessão expirada")
	);
}

/**
 * Erro transitório de verificação (o servidor não conseguiu confirmar a
 * sessão, sem a declarar inválida): nunca apaga a credencial — o retry
 * automático recupera sozinho.
 *
 * @param {string} msg mensagem do servidor
 * @returns {boolean}
 */
export function isTransientError(msg) {
	const lowered = (msg || "").toLowerCase();
	return lowered.includes("temporariamente indisponível");
}

/**
 * A conta continua válida; apenas esta sala deixou de ser uma opção.
 *
 * @param {string} msg mensagem do servidor
 * @returns {boolean}
 */
export function isRoomUnavailable(msg) {
	const lowered = (msg || "").toLowerCase();
	return (
		lowered.includes("sala não encontrada") ||
		lowered.includes("a sala já não existe") ||
		lowered.includes("foste expulso desta sala")
	);
}
