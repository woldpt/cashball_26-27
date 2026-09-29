import { socket } from "../../socket.js";

/**
 * Listeners de Direção e convites (despedimento, orçamento, propostas).
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerCoachListeners(handlers, refs, ctx) {
	socket.on("coachDismissed", ({ reason, teamName, detail }) => {
		if (!ctx.inRoom()) return;
		// Coach despedido fica na sala SEM equipa: o servidor nunca emite
		// teamAssigned para ele, e o timeout de segurança do join tratava a
		// ausência como falha — reenviando o joinGame 5× e a acabar em
		// "Sem resposta do servidor". O join terminou; o timer morre aqui.
		if (refs.joinTimerRef?.current) {
			clearTimeout(refs.joinTimerRef.current);
			refs.joinTimerRef.current = null;
		}
		handlers.setJobOfferModal(null);
		refs.pendingDismissalRef.current = { reason, teamName, detail };
	});

	socket.on("boardBudgetWarning", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setBoardWarning(data);
	});

	socket.on("coachMarketReport", (report) => {
		if (!ctx.inRoom()) return;
		if (!report || !Array.isArray(report.events) || report.events.length === 0)
			return;
		handlers.setCoachMarketReport(report);
	});

	socket.on("jobOffer", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setJobOfferModal(data);
	});

	return () => {
		socket.off("coachDismissed");
		socket.off("boardBudgetWarning");
		socket.off("coachMarketReport");
		socket.off("jobOffer");
	};
}
