/**
 * Emparelha os eventos do resumo semanal do mercado de treinadores
 * (`coachMarketReport`) em cartões de transição para o feed do modal.
 *
 * Garantias do servidor (coachDismissalHelpers.ts — o array é gravado por
 * ordem e limpo a cada reporte):
 *  - Despedimento NPC → seguido de imediato pela contratação do substituto
 *    NO MESMO clube (`hireNpcManager` no mesmo fluxo) → par por `teamName`.
 *  - Despedimento humano → seguido pela assinatura do PRÓPRIO treinador
 *    noutro clube (`autoAssignDismissedCoach`); o clube de origem fica órfão
 *    na semana → par por `coachName`.
 *  - Despromoção (fim de época) → só despedimento, sem substituto nunca.
 *
 * @param {Array<{type: "dismissal"|"hiring", coachName: string, teamName: string, division: number, reason?: string, detail?: string, isHuman: boolean, colorPrimary?: string, colorSecondary?: string, coachPhoto?: string}|null|undefined>} events
 * @returns {Array<{dismissal?: object, replacement?: object, nextClub?: object, hiring?: object}>}
 *   Cartões por ordem de ocorrência. Despedimento vira cartão com sequências
 *   opcionais (`replacement` = novo treinador do mesmo clube, `nextClub` =
 *   assinatura do próprio noutro clube); contratações sem despedimento
 *   associado ficam standalone (`hiring`).
 */
export function pairCoachMarketEvents(events) {
	if (!Array.isArray(events)) return [];

	const used = new Set();
	const cards = [];

	for (const event of events) {
		if (!event || used.has(event)) continue;
		used.add(event);

		if (event.type !== "dismissal") {
			cards.push({ hiring: event });
			continue;
		}

		// Substituto: contratação no mesmo clube (ainda não consumida).
		const replacement = events.find(
			(e) =>
				e && !used.has(e) && e.type === "hiring" && e.teamName === event.teamName,
		);
		if (replacement) used.add(replacement);

		// O próprio treinador assinou noutro clube no mesmo reporte.
		const nextClub = events.find(
			(e) =>
				e && !used.has(e) && e.type === "hiring" && e.coachName === event.coachName,
		);
		if (nextClub) used.add(nextClub);

		cards.push({ dismissal: event, replacement, nextClub });
	}

	return cards;
}
