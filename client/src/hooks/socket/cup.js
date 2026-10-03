import { socket } from "../../socket.js";
import { cupFlowLog } from "../../utils/cupFlowLog.js";

/**
 * Listeners de Taça e prolongamento.
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerCupListeners(handlers, refs, ctx) {
	socket.on("cupDrawStart", (data) => {
		if (!ctx.inRoom()) return;
		cupFlowLog("cupDrawStart recebido", {
			round: data?.round,
			isPlayingMatch: !!refs.isPlayingMatchRef.current,
			humanInCup: data?.humanInCup,
		});
		// Guarda sempre os dados do sorteio. O servidor emite o sorteio logo
		// após o fim do jogo anterior, enquanto o cliente ainda está a
		// terminar o replay (isPlayingMatch=true) — em vez de descartar o
		// sorteio, fica pendente e o GameContext abre o popup assim que o
		// jogo termina.
		handlers.setCupDraw(data);
		// O sorteio já está gravado na BD neste ponto: o resumo pedido
		// antes (via seasonState) pode ter chegado antes do sorteio e
		// ficado com opponent=null (falso «eliminado»). Refetch para
		// trazer o adversário real — vale também com replay a correr.
		const myTeamId = refs.meRef.current?.teamId;
		if (myTeamId != null)
			socket.emit("requestNextMatchSummary", { teamId: myTeamId });
		if (refs.isPlayingMatchRef.current) {
			refs.pendingCupDrawRef.current = true;
			cupFlowLog("sorteio pendente (replay a correr)", {
				round: data?.round,
			});
			return;
		}
		cupFlowLog("sorteio a abrir popup", { round: data?.round });
		refs.isCupDrawRef.current = true;
		// Close any open auction modal to avoid overlap with the draw animation
		handlers.setSelectedAuctionPlayer(null);
		handlers.setAuctionBid("");
		handlers.setMyAuctionBid(null);
		handlers.setAuctionResult(null);
		handlers.setCupDrawRevealIdx(0);
		handlers.setShowCupDrawPopup(true);
	});
	socket.on("cupHalfTimeResults", (data) => {
		if (!ctx.inRoom()) return;
		try {
			console.warn("[HALFTIME] cupHalfTimeResults received", data);
			handlers.setIsMatchActionPending(false);
			handlers.setMatchAction(null);
			handlers.setIsLiveSimulation(false);
			// Treat the cup halftime exactly like a league halftime:
			// reuse matchResults state so the live tab renders events and score.
			const fixtures = data.fixtures || [];
			handlers.setMatchResults({
				matchweek: data.season,
				results: fixtures.map((fx) => ({
					homeTeamId: fx.homeTeam?.id,
					awayTeamId: fx.awayTeam?.id,
					finalHomeGoals: fx.homeGoals,
					finalAwayGoals: fx.awayGoals,
				events: fx.events || [],
				homeLineup: fx.homeLineup || [],
				awayLineup: fx.awayLineup || [],
				_t1: fx._t1 || null,
				_t2: fx._t2 || null,
				attendance: fx.attendance || null,
				homePossession: fx.homePossession ?? fx._homePossession ?? 50,
				awayPossession: fx.awayPossession ?? fx._awayPossession ?? 50,
			})),
		});
			handlers.setLiveMinute(45);
			handlers.setActiveTab("live");
			// Preservar subsMade/subbedOut do 1.º tempo — substituições a meio
			// da 1.ª parte contam para o limite de 3 no intervalo.
			handlers.setConfirmedSubs([]);
			handlers.setSwapSource(null);
			handlers.setSwapTarget(null);
			handlers.setShowHalftimePanel(true);
			handlers.setIsPlayingMatch(true);
			handlers.setIsCupMatch(true);
			handlers.setCupPreMatch(false);
			handlers.setCurrentCupRound(data.round ?? null);
			handlers.setCupExtraTimeBadge(false);
		} catch (err) {
			console.error("Error handling cupHalfTimeResults:", err, "data:", data);
		}
	});
	socket.on("cupETHalfTime", (data) => {
		// Gate before extra time — server waits for coaches in drawn fixtures
		// to ready up; observers auto-ready below.
		try {
			handlers.setIsMatchActionPending(false);
			handlers.setIsLiveSimulation(false);
			// Pausa como o intervalo normal (isPlayingMatch true): o relógio
			// fica congelado pelo painel aberto (ver guarda no Match clock).
			handlers.setIsPlayingMatch(true);
			const fixtures = data.fixtures || [];
			handlers.setMatchResults({
				matchweek: data.season,
				results: fixtures.map((fx) => ({
					homeTeamId: fx.homeTeam?.id,
					awayTeamId: fx.awayTeam?.id,
					finalHomeGoals: fx.homeGoals,
					finalAwayGoals: fx.awayGoals,
				events: fx.events || [],
				homeLineup: fx.homeLineup || [],
				awayLineup: fx.awayLineup || [],
				_t1: fx._t1 || null,
				_t2: fx._t2 || null,
				attendance: fx.attendance || null,
				homePossession: fx.homePossession ?? fx._homePossession ?? 50,
				awayPossession: fx.awayPossession ?? fx._awayPossession ?? 50,
			})),
		});
			handlers.setLiveMinute(90);
			// Preservar subsMade/subbedOut — ET continua a contar para o limite de 3.
			handlers.setConfirmedSubs([]);
			handlers.setSwapSource(null);
			handlers.setSwapTarget(null);
			handlers.setShowHalftimePanel(true);
			handlers.setIsCupMatch(true);
			handlers.setCupPreMatch(false);
			handlers.setCurrentCupRound(data.round ?? null);
			handlers.setCupExtraTimeBadge(false);

			// Sem auto-ready: o Pronto é consentimento por fase e só quem tem jogo
			// empatado o dá (o servidor não espera pelos observadores). Carregar
			// por eles fabricava confirmações que ninguém deu.
		} catch (err) {
			console.error("Error handling cupETHalfTime:", err, "data:", data);
		}
	});
	socket.on("cupExtraTimeStart", (data) => {
		// Cup match went to extra time — show animation to all connected coaches, including observers.
		// Guard against multiple ET fixtures in the same round resetting the clock/display.
		const alreadyInET = refs.isCupExtraTimeRef.current;
		handlers.setShowHalftimePanel(false);
		// Quem não tem equipa num jogo empatado segue o ET como espectador
		// (relógio de gala, sem badge de decisão): o guarda do matchMinuteUpdate
		// deixa os minutos 91–120 avançar com isCupExtraTime=true e a sidebar
		// «Outros jogos» atualiza em direto; aos 120' o ack cupExtraTimeDone
		// resolve o gate de animação sem o timeout integral.
		const myId = refs.meRef.current?.teamId;
		const etTeamIds =
			data?.drawnTeamIds?.length > 0
				? data.drawnTeamIds
				: data
					? [data.homeTeamId, data.awayTeamId]
					: [];
		const isSpectator =
			myId == null || !etTeamIds.some((id) => id == myId);
		handlers.setIsCupExtraTime(true);
		handlers.setCupExtraTimeBadge(true);
		if (!alreadyInET) {
			handlers.setLiveMinute(90);
			handlers.setIsPlayingMatch(true);
			handlers.setIsLiveSimulation(true);
			// O timer dos 90' pode já ter marcado espera de resultados antes
			// deste evento chegar — o ET está a decorrer, não há espera.
			handlers.setWaitingForResults(false);
			handlers.setResultsWaitTimedOut(false);
		}
		cupFlowLog("cupExtraTimeStart", {
			isSpectator,
			alreadyInET,
			drawnTeamIds: etTeamIds,
		});
		if (isSpectator) return;
		if (data) {
			handlers.setMatchResults((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					results: (prev.results || []).map((r) =>
						r.homeTeamId === data.homeTeamId &&
						r.awayTeamId === data.awayTeamId
							? {
									...r,
									finalHomeGoals: data.homeGoals,
									finalAwayGoals: data.awayGoals,
								}
							: r,
					),
				};
			});
		}
	});
	socket.on("extraTimeEnded", (data) => {
		// ET is over, prepare for penalties or declare winner
		// Update the score if needed
		if (data) {
			handlers.setMatchResults((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					results: (prev.results || []).map((r) =>
						r.homeTeamId === data.homeTeamId &&
						r.awayTeamId === data.awayTeamId
							? {
									...r,
									finalHomeGoals: data.homeGoals,
									finalAwayGoals: data.awayGoals,
								}
							: r,
					),
				};
			});
		}
	});
	socket.on("extraTimeHalfTime", (data) => {
		// Indicate extra time half-time in the live tab — no ready gate needed
		handlers.setCupExtraTimeBadge(true);
		// Update the score for the displayed fixture if we have it
		if (data && data.fixture) {
			handlers.setMatchResults((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					results: (prev.results || []).map((r) => {
						if (
							r.homeTeamId === data.fixture.homeTeamId &&
							r.awayTeamId === data.fixture.awayTeamId
						) {
							return {
								...r,
								finalHomeGoals: data.fixture.homeGoals,
								finalAwayGoals: data.fixture.awayGoals,
								events: [...(r.events || []), ...(data.events || [])],
							};
						}
						return r;
					}),
				};
			});
		}
	});
	socket.on("extraTimeSecondHalfStart", (data) => {
		// Second period of extra time — update scores and keep clock running
		if (data && data.fixture) {
			handlers.setMatchResults((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					results: (prev.results || []).map((r) =>
						r.homeTeamId === data.fixture.homeTeamId &&
						r.awayTeamId === data.fixture.awayTeamId
							? {
									...r,
									finalHomeGoals: data.fixture.homeGoals,
									finalAwayGoals: data.fixture.awayGoals,
								}
							: r,
					),
				};
			});
		}
	});
	socket.on("cupBracketData", (data) => handlers.setCupBracketData(data));
	socket.on("cupRoundResults", (data) => {
		cupFlowLog("cupRoundResults recebido", {
			round: data?.round,
			isPlayingMatch: !!refs.isPlayingMatchRef.current,
			liveMinute: refs.liveMinuteRef?.current,
			pendingPenalty: !!refs.matchActionRef?.current,
		});
		refs.isCupDrawRef.current = false;
		handlers.setCurrentCupRound(data.round ?? null);
		socket.emit("requestCupBracket");

		handlers.setCupRoundResults(data);
		handlers.setWaitingForResults(false);
		handlers.setResultsWaitTimedOut(false);
		// Don't navigate away yet — if a penalty shootout popup is open, wait for it to close first.
		handlers.setPendingCupRoundResults(data);
		// matchweek doesn't increment after cup rounds, so the useEffect in App.jsx
		// won't fire — refresh calendar manually.
		socket.emit("requestCalendar");
		// Reset intencional de jornada (11 limpo + Equilibrado): movido para o
		// dreno em GameContext (F5) — aqui chegava a meio do replay e competia
		// com a edição do briefing da ronda seguinte.
	});
	socket.on("cupSecondHalfStart", (data) => {
		handlers.setIsMatchActionPending(false);
		// Nao dispensar o painel de intervalo aqui: o matchSegmentStart(46)
		// fa-lo ja com a simulacao ligada. Nao sobrescrever o matchResults
		// do intervalo (traz equipas e posse); so preencher se o cliente
		// perdeu a 1.a parte (prev null).
		handlers.setMatchResults((prev) => {
			if (prev) return prev;
			return {
			matchweek: data.season,
			results: data.results.map((r) => ({
				homeTeamId: r.homeTeamId,
				awayTeamId: r.awayTeamId,
				finalHomeGoals: r.finalHomeGoals,
				finalAwayGoals: r.finalAwayGoals,
				events: r.events || [],
				attendance: r.attendance || null,
				homeLineup: r.homeLineup || [],
				awayLineup: r.awayLineup || [],
				_t1: r._t1 || null,
				_t2: r._t2 || null,
			})),
			};
		});
		handlers.setLiveMinute(45);
		handlers.setIsPlayingMatch(true);
		handlers.setIsCupMatch(true);
		handlers.setCurrentCupRound(data.round ?? null);
	});
	socket.on("cupPenaltyShootout", (data) => {
		cupFlowLog("penáltis a abrir", {
			round: data?.round,
			homeTeamId: data?.homeTeamId,
			awayTeamId: data?.awayTeamId,
			kicks: data?.kicks?.length,
		});
		handlers.setCupPenaltyPopup(data);
		handlers.setCupPenaltyKickIdx(0);
	});
	return () => {
		socket.off("cupDrawStart");
		socket.off("cupPreMatch");
		socket.off("cupHalfTimeResults");
		socket.off("cupETHalfTime");
		socket.off("cupExtraTimeStart");
		socket.off("extraTimeSecondHalfStart");
		socket.off("extraTimeHalfTime");
		socket.off("extraTimeEnded");
		socket.off("cupBracketData");
		socket.off("cupRoundResults");
		socket.off("cupSecondHalfStart");
		socket.off("cupPenaltyShootout");
	};
}
