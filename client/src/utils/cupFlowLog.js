/**
 * Marcador temporal único das transições da Taça (F0 do plano de estabilização).
 * Zero deps, zero estado: só prefixa o passo com hora ISO + minutos desde o
 * arranque da página, para cruzar cliente↔servidor nos logs da próxima ronda.
 * Logs se o nível existir (import é barato; o volume decide-se no filtro).
 *
 * @param {string} step nome do passo (ex. "cupDrawStart recebido").
 * @param {Object} [details] dados úteis (round, liveMinute, flags).
 * @returns {void}
 */
const t0 =
	typeof performance !== "undefined" && performance.timeOrigin
		? performance.timeOrigin
		: Date.now();

export function cupFlowLog(step, details) {
	try {
		const elapsed = Math.round(Date.now() - t0);
		if (details && typeof details === "object") {
			console.warn(`[CUPFLOW +${elapsed}ms] ${step}`, details);
		} else {
			console.warn(`[CUPFLOW +${elapsed}ms] ${step}`);
		}
	} catch {
		// Logging nunca parte o jogo.
	}
}
