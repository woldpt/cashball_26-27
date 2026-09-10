import { useEffect } from "react";
import { socket, queueEmit, flushOutbox } from "../socket.js";
import { loadTacticSnapshot } from "../utils/uiSnapshot.js";
import { isSameTeamId } from "../utils/teamHelpers.js";
import { seasonToYear } from "../utils/formatters.js";
import { playGoalSound, playVarSound } from "../utils/audio.js";
import {
  MAX_MATCH_SUBS,
  POSITION_SHORT_LABELS,
  POSITION_TEXT_CLASS,
} from "../constants/index.js";

/**
 * Colegas da mesma posição no próprio plantel (sem o próprio jogador),
 * ordenados por skill descendente — contexto mínimo para avaliar o negócio.
 *
 * @param {object} refs refs partilhados (usa `mySquadRef`)
 * @param {string} position posição do jogador em negociação
 * @param {number} playerId id do jogador em negociação (excluído da lista)
 * @returns {Array<{id: number, name: string, skill: number, wage: number}>}
 */
function buildPositionPeers(refs, position, playerId) {
	const squad = Array.isArray(refs.mySquadRef?.current)
		? refs.mySquadRef.current
		: [];
	return squad
		.filter((p) => p.position === position && Number(p.id) !== Number(playerId))
		.map((p) => ({
			id: p.id,
			name: p.name,
			skill: Number(p.skill ?? 0),
			wage: Number(p.wage ?? 0),
		}))
		.sort((a, b) => b.skill - a.skill);
}

function buildPlayerStats({
	position,
	skill,
	wage,
	requestedWage,
	contractEndMatchweek,
	contractEndSeason,
}) {
	const stats = [];
	if (position) {
		stats.push({
			label: "Pos",
			value: POSITION_SHORT_LABELS[position] ?? position,
			className: POSITION_TEXT_CLASS[position] ?? "",
		});
	}
	if (skill) stats.push({ label: "Skill", value: String(skill) });
	if (typeof wage === "number" && wage > 0) {
		stats.push({ label: "Salário", value: `€${wage.toLocaleString("pt-PT")}/sem` });
	}
	if (typeof requestedWage === "number" && requestedWage > 0) {
		stats.push({
			label: "Pedido",
			value: `€${requestedWage.toLocaleString("pt-PT")}/sem`,
		});
	}
	if (contractEndMatchweek && contractEndSeason) {
		stats.push({
			label: "Contrato",
			value: `${seasonToYear(contractEndSeason)}, Jornada ${contractEndMatchweek}`,
		});
	}
	return stats;
}

function hasSeenWelcome(coachName, roomCode) {
	try {
		return (
			window.localStorage.getItem(
				`cashball_welcome:${coachName}:${roomCode}`,
			) === "1"
		);
	} catch {
		return false;
	}
}

function hasSeenWelcomeThisSession(coachName, roomCode) {
	try {
		return (
			window.sessionStorage.getItem(
				`cashball_welcome_session:${coachName}:${roomCode}`,
			) === "1"
		);
	} catch {
		return false;
	}
}

/**
 * Registers all socket.io listeners for the game.
 *
 * @param {Object} handlers - All state setters and callbacks needed by the listeners.
 * @param {Object} refs - All refs needed by the listeners.
 */
export function useSocketListeners(handlers, refs) {
	useEffect(() => {
		// Guarda de sala: rejeita eventos de jogo quando não há sala activa.
		// Evita que broadcasts da sala anterior contaminem o estado após "Sair".
		const inRoom = () => !!refs.roomCodeRef?.current;

		socket.on("calendarData", (data) => {
			if (!inRoom()) return;
			handlers.setCalendarData(data);
		});
		socket.on("teamsData", (data) => {
			if (!inRoom()) return;
			// Snapshot da tabela atual antes do refresh — base para as setinhas
			// de subida/descida na classificação.
			handlers.setPrevStandings(refs.teamsRef.current || []);
			handlers.setTeams(data);
		});
		socket.on("teamForms", (data) => {
			if (!inRoom()) return;
			handlers.setTeamForms(data || {});
		});
		socket.on("playerListUpdate", (data) => {
			if (!inRoom()) return;
			// Suporta formato novo { players, roomCreator } e legado (array)
			if (Array.isArray(data)) {
				handlers.setPlayers(data);
			} else if (data && Array.isArray(data.players)) {
				handlers.setPlayers(data.players);
				if (typeof data.roomCreator === "string") {
					handlers.setRoomCreator(data.roomCreator);
				}
			}
		});
		socket.on("mySquad", (data) => {
			if (!inRoom()) return;
			handlers.setMySquad(data);
		});
		socket.on("marketUpdate", (data) => {
			if (!inRoom()) return;
			handlers.setMarketPairs(data);
		});
		socket.on("transferHistory", (data) => {
			if (!inRoom()) return;
			handlers.setTransferHistory(Array.isArray(data) ? data : []);
		});
		socket.on("transferCompleted", (rec) => {
			if (!inRoom()) return;
			if (!rec || !rec.player_name) return;
			handlers.setTransferHistory((prev) => {
				const list = Array.isArray(prev) ? prev : [];
				const next = [rec, ...list];
				return next.slice(0, 40);
			});
		});
		socket.on("globalNews", (data) => {
			if (!inRoom()) return;
			handlers.setGlobalNews(
				data && Array.isArray(data.news) && Array.isArray(data.results)
					? data
					: { news: [], results: [] },
			);
		});
		// Broadcast do servidor (fim de jornada, Taça, fim de época, transferências)
		// → refetch imediato do Jornal Global.
		socket.on("globalNewsUpdated", () => {
			if (!inRoom()) return;
			socket.emit("getGlobalNews");
		});
		socket.on("auctionStarted", (auctionData) => {
			// Add to activeAuctions list (used by AuctionsPage and toast)
			handlers.setActiveAuctions((prev) => {
				const exists = prev.find((a) => a.playerId === auctionData.playerId);
				if (exists) return prev;
				return [
					...prev,
					{
						...auctionData,
						currentHighBid: auctionData.currentHighBid ?? 0,
						currentHighBidTeamId: auctionData.currentHighBidTeamId ?? null,
					},
				];
			});
			// Legacy: keep selectedAuctionPlayer for any remaining compatibility
			if (
				refs.isPlayingMatchRef.current ||
				refs.showHalftimePanelRef?.current ||
				!!refs.matchActionRef?.current ||
				refs.isCupDrawRef.current
			) {
				return;
			}
			const myTeamId = refs.meRef.current?.teamId;
			const myTeamBudget =
				refs.teamsRef.current.find((t) => t.id == myTeamId)?.budget ?? 0;
			if (auctionData.startingPrice > myTeamBudget) return;
			handlers.setSelectedAuctionPlayer(auctionData);
			handlers.setIsAuctionExpanded(false);
			handlers.setAuctionBid("");
			handlers.setMyAuctionBid(null);
			handlers.setAuctionResult(null);
		});
		socket.on(
			"auctionBidPlaced",
			({ playerId, currentHighBid, currentHighBidTeamId, bidHistory }) => {
				handlers.setActiveAuctions((prev) =>
					prev.map((a) =>
						a.playerId === playerId
							? {
									...a,
									currentHighBid,
									currentHighBidTeamId,
									auction_bid_history: bidHistory || a.auction_bid_history,
								}
							: a,
					),
				);
			},
		);
		socket.on("auctionBidConfirmed", ({ playerId, bidAmount }) => {
			handlers.setSelectedAuctionPlayer((prev) => {
				if (prev && prev.playerId === playerId) {
					handlers.setMyAuctionBid(bidAmount);
				}
				return prev;
			});
		});
		socket.on("auctionClosed", (result) => {
				// Mark auction with result in activeAuctions; removal happens when matchweek advances
			handlers.setActiveAuctions((prev) =>
				prev.map((a) =>
					a.playerId === result.playerId ? { ...a, result, closed: true } : a,
				),
			);
			// Legacy cleanup
			handlers.setSelectedAuctionPlayer((prev) => {
				if (prev && prev.playerId === result.playerId) {
					handlers.setAuctionResult(result);
					setTimeout(() => {
						handlers.setSelectedAuctionPlayer(null);
						handlers.setIsAuctionExpanded(false);
						handlers.setAuctionBid("");
						handlers.setMyAuctionBid(null);
						handlers.setAuctionResult(null);
					}, 5000);
					return prev;
				}
				return prev?.playerId === result.playerId ? null : prev;
			});
		});
		socket.on("auctionPaused", ({ playerId }) => {
			handlers.setActiveAuctions((prev) =>
				prev.map((a) => (a.playerId === playerId ? { ...a, paused: true } : a)),
			);
		});
		socket.on(
			"auctionResumed",
			({ playerId, endsAt, currentHighBid, currentHighBidTeamId }) => {
				handlers.setActiveAuctions((prev) =>
					prev.map((a) =>
						a.playerId === playerId
							? {
									...a,
									paused: false,
									endsAt,
									currentHighBid,
									currentHighBidTeamId,
								}
							: a,
					),
				);
			},
		);
		socket.on("topScorers", (data) => {
			if (!inRoom()) return;
			handlers.setTopScorers(data);
		});
		socket.on("seasonEnd", (data) => {
			if (!inRoom()) return;
			// Show the season-end awards modal
			handlers.setSeasonEndModal(data);
			if (data.year) handlers.setSeasonYear(data.year);
			if (data.newSeason) handlers.setSeason(data.newSeason);
			handlers.setAllMatchResults({});
			handlers.setMatchweekCount(0);
			handlers.setMatchResults(null);
			handlers.setCalendarData(null);
			});
		socket.on("teamSquadData", ({ teamId, squad }) => {
			if (
				refs.selectedTeamRef.current &&
				refs.selectedTeamRef.current.id === teamId
			) {
				handlers.setSelectedTeamSquad(squad || []);
				handlers.setSelectedTeamLoading(false);
			}
		});
		socket.on("nextMatchSummary", (data) => {
			if (!inRoom()) return;
			handlers.setNextMatchSummary(data);
			handlers.setNextMatchSummaryLoading(false);
		});
		socket.on("cupDrawStart", (data) => {
			if (!inRoom()) return;
			// Guarda sempre os dados do sorteio. O servidor emite o sorteio logo
			// após o fim do jogo anterior, enquanto o cliente ainda está a
			// terminar o replay (isPlayingMatch=true) — em vez de descartar o
			// sorteio, fica pendente e o GameContext abre o popup assim que o
			// jogo termina.
			handlers.setCupDraw(data);
			if (refs.isPlayingMatchRef.current) {
				refs.pendingCupDrawRef.current = true;
				return;
			}
			refs.isCupDrawRef.current = true;
			// Close any open auction modal to avoid overlap with the draw animation
			handlers.setSelectedAuctionPlayer(null);
			handlers.setAuctionBid("");
			handlers.setMyAuctionBid(null);
			handlers.setAuctionResult(null);
			handlers.setCupDrawRevealIdx(0);
			handlers.setShowCupDrawPopup(true);
		});
		socket.on("cupPreMatch", (data) => {
			if (!inRoom()) return;
			// Safety net: dismiss any lingering cup draw popup before the match starts
			handlers.setShowCupDrawPopup(false);
			handlers.setMatchResults({ matchweek: data.season, results: [] });
			handlers.setShowHalftimePanel(true);
			handlers.setIsPlayingMatch(false);
			handlers.setLiveMinute(0);
			handlers.setSubsMade(0);
			handlers.setSubbedOut([]);
			handlers.setConfirmedSubs([]);
			handlers.setSwapSource(null);
			handlers.setSwapTarget(null);
			handlers.setIsCupMatch(true);
			handlers.setCupPreMatch(true);
			handlers.setCurrentCupRound(data.round ?? null);
			handlers.setCupExtraTimeBadge(false);
			handlers.setCupActiveTeamIds(data.cupTeamIds || []);
			handlers.setActiveTab("live");
		});
		socket.on("cupHalfTimeResults", (data) => {
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

				// Se o utilizador não está em nenhuma fixture desta ronda (eliminado),
				// auto-ready para não bloquear o servidor que espera por todos.
				const myId = refs.meRef.current?.teamId;
				const userInMatch =
					myId != null &&
					fixtures.some(
						(fx) => fx.homeTeam?.id == myId || fx.awayTeam?.id == myId,
					);
				if (!userInMatch) {
					queueEmit("setReady", true);
				}
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
				handlers.setIsPlayingMatch(false);
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

				const myId = refs.meRef.current?.teamId;
				// Only coaches whose team is in a DRAWN fixture must confirm tactics
				// before extra time. Observers (no team in a drawn fixture) auto-ready
				// so they never block the gate — including coaches whose team already
				// won its tie this round.
				const myDrawnFixture =
					myId != null &&
					fixtures.some(
						(fx) =>
							(fx.homeTeam?.id == myId || fx.awayTeam?.id == myId) &&
							fx.homeGoals === fx.awayGoals,
					);
				if (!myDrawnFixture) {
					queueEmit("setReady", true);
				}
			} catch (err) {
				console.error("Error handling cupETHalfTime:", err, "data:", data);
			}
		});
		socket.on("cupExtraTimeStart", (data) => {
			// Cup match went to extra time — show animation to all connected coaches, including observers.
			// Guard against multiple ET fixtures in the same round resetting the clock/display.
			const alreadyInET = refs.isCupExtraTimeRef.current;
			handlers.setShowHalftimePanel(false);
			handlers.setIsCupExtraTime(true);
			handlers.setCupExtraTimeBadge(true);
			if (!alreadyInET) {
				handlers.setLiveMinute(90);
				handlers.setIsPlayingMatch(true);
				handlers.setIsLiveSimulation(true);
			}
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
			refs.isCupDrawRef.current = false;
			handlers.setCurrentCupRound(data.round ?? null);
			socket.emit("requestCupBracket");
	
			handlers.setCupRoundResults(data);
			// Don't navigate away yet — if a penalty shootout popup is open, wait for it to close first.
			handlers.setPendingCupRoundResults(data);
			// matchweek doesn't increment after cup rounds, so the useEffect in App.jsx
			// won't fire — refresh calendar manually.
			socket.emit("requestCalendar");
			// Reset intencional de jornada (igual à liga): 11 limpo + Neutro.
			handlers.setTactic((prev) => {
				const allExcluded = Object.fromEntries(
					(refs.mySquadRef.current || []).map((p) => [p.id, "Excluído"]),
				);
				const next = { ...prev, positions: allExcluded, style: "Balanced" };
				queueEmit("setTactic", next);
				return next;
			});
		});
		socket.on("cupSecondHalfStart", (data) => {
			handlers.setIsMatchActionPending(false);
			// Identical to matchResults but marks this as a cup second half animation.
			handlers.setMatchResults({
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
			});
			handlers.setShowHalftimePanel(false);
			handlers.setLiveMinute(45);
			handlers.setIsPlayingMatch(true);
			handlers.setIsCupMatch(true);
			handlers.setCurrentCupRound(data.round ?? null);
		});
		socket.on("cupPenaltyShootout", (data) => {
			handlers.setCupPenaltyPopup(data);
			handlers.setCupPenaltyKickIdx(0);
		});
		socket.on("palmaresData", (data) => {
			handlers.setPalmares(data);
			handlers.setPalmaresTeamId(data.teamId);
		});
		socket.on("clubHistoryData", (data) => {
			handlers.setClubHistory(data);
			handlers.setClubHistoryTeamId(data.teamId);
		});
		socket.on("clubNewsData", (data) => {
			handlers.setClubNews(data.news || []);
		});
		socket.on(
			"clubNewsUpdated",
			({ teamId }) => {
				// Use meRef (not me) to avoid stale closure — this listener is registered once with [] deps
				const currentMe = refs.meRef.current;
				if (currentMe?.teamId === teamId) {
					socket.emit("requestClubNews", { teamId });
				}
			},
		);
		socket.on("playerHistoryData", (data) =>
			handlers.setPlayerHistoryModal(data),
		);
		socket.on("playerSearchResults", (data) => {
			handlers.setPlayerSearchLoading(false);
			handlers.setPlayerSearchData({
				results: data?.results || [],
				total: data?.total || 0,
				truncated: !!data?.truncated,
			});
		});
		socket.on("financeData", (data) => handlers.setFinanceData(data));
		socket.on("stadiumBuilt", ({ teamId }) => {
				// Re-pedir financeData se somos o clube em questão
			const currentMe = refs.meRef.current;
			if (currentMe?.teamId && Number(currentMe.teamId) === Number(teamId)) {
				socket.emit("requestFinanceData", { teamId: currentMe.teamId });
			}
		});
		socket.on("systemMessage", (msg) => {
			const text = typeof msg === "string" ? msg : msg.text;
			if (text) handlers.addToast(text);
		});
		socket.on(
			"renewContractCounterOffer",
			({
				playerId,
				playerName,
				position,
				skill,
				wage,
				demandedWage,
				agent,
			}) => {
				if (!inRoom()) return;
				handlers.setGameDialog({
					mode: "confirm",
					title: `Contra-proposta — ${playerName}`,
					description: `🤨 ${agent || "O agente"} diz que a tua oferta é "um insulto à profissão". ${playerName} exige €${demandedWage.toLocaleString("pt-PT")}/sem. Aceitas ou vai brilhar no leilão?`,
					stats: buildPlayerStats({
						position,
						skill,
						wage,
						requestedWage: demandedWage,
					}),
					peerPositionLabel: POSITION_SHORT_LABELS[position] ?? position,
					positionPeers: buildPositionPeers(refs, position, playerId),
					confirmLabel: "Aceitar",
					cancelLabel: "Leilão",
					onConfirm: () =>
						queueEmit("acceptCounterOffer", { playerId, accepted: true }),
					onCancel: () =>
						queueEmit("acceptCounterOffer", { playerId, accepted: false }),
				});
			},
		);
		socket.on(
			"contractRequest",
			({
				playerId,
				playerName,
				position,
				skill,
				wage,
				requestedWage,
				agent,
				contractEndMatchweek,
				contractEndSeason,
				isRenegotiation,
			}) => {
				if (!inRoom()) return;
				const endText =
					contractEndMatchweek && contractEndSeason
						? ` Contrato até ${seasonToYear(contractEndSeason)}, Jornada ${contractEndMatchweek}.`
						: "";
				const headline = isRenegotiation
					? `📈 ${agent} viu o teu plantel no Excel: ${playerName} vale muito mais do que recebe. Exige €${requestedWage.toLocaleString("pt-PT")}/sem ou ameaça "conversas com outros clubes".${endText}`
					: `📞 ${agent} ligou em pânico: ${playerName} anda a olhar para vitrinas de troféus que não são as tuas! Exige €${requestedWage.toLocaleString("pt-PT")}/sem.${endText}`;
				handlers.queueContractDialog({
					mode: "confirm",
					playerId,
					title: `Agente do Jogador — ${playerName}`,
					description: headline,
					stats: buildPlayerStats({
						position,
						skill,
						wage,
						requestedWage,
						contractEndMatchweek,
						contractEndSeason,
					}),
					peerPositionLabel: POSITION_SHORT_LABELS[position] ?? position,
					positionPeers: buildPositionPeers(refs, position, playerId),
					confirmLabel: "Aceitar",
					cancelLabel: "Leilão",
					cancelDanger: true,
					onConfirm: () =>
						queueEmit("renewContract", {
							playerId,
							offeredWage: requestedWage,
						}),
					onCancel: () =>
						queueEmit("declineContractRequest", { playerId }),
				});
			},
		);
		socket.on("transferProposalResult", ({ ok, message }) => {
			if (!ok) handlers.addToast(message);
			if (ok) handlers.setTransferProposalModal(null);
		});
		socket.on("playerSigned", (data) => {
			handlers.setSigningCelebration(data);
		});
		socket.on("teamAssigned", (data) => {
			const currentMe = refs.meRef.current;
			// Só precisamos do name — o joinGame já foi emitido por este socket.
			// O roomCode pode ainda não estar atualizado no ref porque o React
			// não processou a atualização do handleJoinSuccess (mesmo event loop).
			if (!currentMe?.name) return;
			handlers.setMe((prev) =>
				prev ? { ...prev, teamId: data.teamId } : prev,
			);
			// Merge das versões de avatar dos coaches da sala (exibição em listas/chat)
			if (data.coachAvatars && typeof data.coachAvatars === "object") {
				handlers.setCoachAvatars((prev) => ({
					...prev,
					...data.coachAvatars,
				}));
			}
			const pendingDismissal = refs.pendingDismissalRef.current;
			if (pendingDismissal) {
				refs.pendingDismissalRef.current = null;
				handlers.setDismissalModal({ ...pendingDismissal, newTeam: data });
				return;
			}
			if (data.isNew) {
				if (!hasSeenWelcome(currentMe.name, currentMe.roomCode)) {
					handlers.setWelcomeModal(data);
				}
			} else {
				if (!hasSeenWelcomeThisSession(currentMe.name, currentMe.roomCode)) {
					handlers.setWelcomeModal(data);
				}
			}
			// O socket já está ligado no servidor: esvaziar a fila offline.
			// (O gameState também faz flush — o primeiro a chegar vence, o
				// segundo é no-op porque a fila já está vazia.)
			flushOutbox();
		});
		socket.on("gameState", (data) => {
			if (!inRoom()) return;
			if (data.allMatchResults)
				handlers.setAllMatchResults(data.allMatchResults);
			if (data.matchweek) handlers.setMatchweekCount(data.matchweek - 1);
			if (data.season) handlers.setSeason(data.season);
			if (data.year) handlers.setSeasonYear(data.year);
			if (typeof data.calendarIndex === "number")
				handlers.setCalendarIndex(data.calendarIndex);
			if (data.tactic) {
				handlers.setTactic((prev) => ({
					...prev,
					...data.tactic,
					positions: data.tactic.positions || prev.positions || {},
				}));
				// Tab morta a MEIO de jogo + servidor sem a tática (restart perdeu
				// a memória): repõe o snapshot local e reenvia-o. No lobby o
				// servidor limpa de propósito — aí o snapshot NÃO se aplica.
				const serverEmpty =
					!data.tactic.positions ||
					Object.keys(data.tactic.positions).length === 0;
				const midMatch =
					data.matchState === "halftime" ||
					data.matchState === "running_first_half" ||
					data.matchState === "playing_second_half";
				if (serverEmpty && midMatch) {
					const me = refs.meRef.current;
					const snap = loadTacticSnapshot(me?.name, me?.roomCode);
					if (snap) {
						const restored = {
							formation: snap.formation,
							style: snap.style,
							positions: snap.positions,
						};
						handlers.setTactic((prev) => ({ ...prev, ...restored }));
						queueEmit("setTactic", restored);
					}
				}
			}
			if (Array.isArray(data.lockedCoaches)) {
				handlers.setLockedCoaches(data.lockedCoaches);
			}
			if (typeof data.roomCreator === "string") {
				handlers.setRoomCreator(data.roomCreator);
			}
			// Hidratar leilões ativos em join/reconnect — o evento one-shot
			// auctionStarted só chega a quem está ligado no momento do broadcast.
			if (Array.isArray(data.activeAuctions)) {
				handlers.setActiveAuctions(data.activeAuctions);
			}
			// Pedir o histórico de transferências da época no (re)join — o server
			// responde com transferHistory (one-shot, não vai em gameState).
			socket.emit("getTransferHistory");
			// Jornal Global: pedir o agregado da época no (re)join.
			socket.emit("getGlobalNews");
			// Restore match-in-progress state on reconnect
			if (data.matchState === "halftime" && data.lastHalfTimePayload) {
				handlers.setMatchResults(data.lastHalfTimePayload);
				handlers.setIsPlayingMatch(true);
				handlers.setShowHalftimePanel(true);
				handlers.setActiveTab("live");
				handlers.setLiveMinute(45); // ensure replay effect enters halftime path on reconnect
			} else if (
				data.matchState === "running_first_half" ||
				data.matchState === "playing_second_half"
			) {
				// Match is computing server-side but client has no match data.
				// Keep UI unlocked; halfTimeResults/matchResults will arrive shortly.
				// Exception: if matchReplay was already received for this half, don't
				// reset isPlayingMatch — the replay is already running correctly.
				if (!refs.matchReplayActiveRef.current) {
					handlers.setIsPlayingMatch(false);
					handlers.setShowHalftimePanel(false);
					handlers.setMatchAction(null);
					handlers.setIsMatchActionPending(false);
				}
			} else {
				// Reset match-in-progress flags on (re)join so the sidebar is never
				// stuck hidden after a disconnect/reconnect between matches.
				handlers.setIsPlayingMatch(false);
				handlers.setShowHalftimePanel(false);
				handlers.setMatchAction(null);
				handlers.setIsMatchActionPending(false);
			}
			// O join já está ligado no servidor: esvaziar a fila offline
			// (tática, pronto, resoluções) + repor intenções sticky.
			flushOutbox();
		});

		socket.on("seasonState", (data) => {
			if (!inRoom()) return;
			// Broadcast pós-jogo (liga E taça): mantém matchweekCount/calendarIndex
			// em sincronia e força o refetch do nextMatchSummary na tab de tática —
			// sem isto, após uma ronda de taça o briefing podia ficar stale.
			if (data.matchweek) handlers.setMatchweekCount(data.matchweek - 1);
			if (typeof data.calendarIndex === "number")
				handlers.setCalendarIndex(data.calendarIndex);
			if (data.season) handlers.setSeason(data.season);
			if (data.year) handlers.setSeasonYear(data.year);
		});

		socket.on("tacticFamiliarity", (data) => {
			handlers.setTacticFamiliarity(data);
		});

		socket.on("allTacticFamiliarity", (entries) => {
			// Converter array [{formation, style, score, stars, bonus}]
			// para map { "4-3-3|OFENSIVO": { score, stars, bonus }, ... }
			// Normalizar estilo para uppercase PT independentemente do valor guardado na DB
			const styleToUpper = (s) => {
				const m = {
					Defensive: "DEFENSIVO",
					Balanced: "EQUILIBRADO",
					Offensive: "OFENSIVO",
				};
				return m[s] || (s || "").toUpperCase();
			};
			const map = {};
			(entries || []).forEach((e) => {
				map[`${e.formation}|${styleToUpper(e.style)}`] = {
					...e,
					style: styleToUpper(e.style),
				};
			});
			handlers.setAllTacticFamiliarity(map);
		});

		socket.on("roomLocked", ({ coaches }) => {
			if (!inRoom()) return;
			handlers.setLockedCoaches(coaches || []);
		});

		socket.on("awaitingCoaches", (offline) => {
			if (!inRoom()) return;
			handlers.setAwaitingCoaches(offline || []);
		});

		socket.on("matchReplay", (data) => {
			if (!inRoom()) return;
			// Reconnected mid-match: fast-forward to current minute without animation
			refs.matchReplayActiveRef.current = true;
			handlers.setLiveMinute(data.minute);
			handlers.setIsPlayingMatch(true);
			handlers.setIsLiveSimulation(false);
			handlers.setShowHalftimePanel(false);
			handlers.setMatchAction(null);
			handlers.setIsMatchActionPending(false);
			handlers.setActiveTab("live");
			if (data.isCup) {
				handlers.setIsCupMatch(true);
			} else {
				handlers.setIsCupMatch(false);
			}
			handlers.setCurrentCupRound(data.cupRound ?? null);
			handlers.setMatchResults({
				matchweek: data.matchweek,
				results: (data.fixtures || []).map((f) => ({
					homeTeamId: f.homeTeamId,
					awayTeamId: f.awayTeamId,
					homeTeam: f.homeTeam,
					awayTeam: f.awayTeam,
					finalHomeGoals: f.finalHomeGoals || 0,
					finalAwayGoals: f.finalAwayGoals || 0,
					events: f.events || [],
					attendance: f.attendance || null,
					homeLineup: f.homeLineup || [],
					awayLineup: f.awayLineup || [],
				})),
			});
		});

		socket.on("matchSegmentStart", (data) => {
			if (!inRoom()) return;
			handlers.setIsMatchActionPending(false);
			handlers.setIsLiveSimulation(true);
			refs.matchReplayActiveRef.current = false;
			// Relógio começa um minuto antes do primeiro update: dá espaço para a pausa de introdução
			// (5s no servidor antes do loop de minutos) mostrar o relógio em repouso.
			// Ao chegar o primeiro matchMinuteUpdate, o relógio avança para startMin.
			handlers.setLiveMinute(data.startMin - 1);
			handlers.setIsPlayingMatch(true);
			handlers.setActiveTab("live");
			// Always sync cup state from the server payload (handles reconnect mid-match)
			if (data.isCup) {
				handlers.setIsCupMatch(true);
			} else {
				handlers.setIsCupMatch(false);
			}
			handlers.setCurrentCupRound(data.cupRound ?? null);
			if (data.startMin === 1) {
				// First half — set up match UI from scratch
				handlers.setShowHalftimePanel(false);
				handlers.setSubsMade(0);
				handlers.setSubbedOut([]);
				handlers.setConfirmedSubs([]);
				handlers.setSwapSource(null);
				handlers.setSwapTarget(null);
				handlers.setMatchResults({
					matchweek: data.matchweek,
					results: (data.fixtures || []).map((f) => ({
						homeTeamId: f.homeTeamId,
						awayTeamId: f.awayTeamId,
						homeTeam: f.homeTeam,
						awayTeam: f.awayTeam,
						finalHomeGoals: f.finalHomeGoals || 0,
						finalAwayGoals: f.finalAwayGoals || 0,
						events: f.events || [],
						attendance: f.attendance || null,
						homeLineup: f.homeLineup || [],
						awayLineup: f.awayLineup || [],
					})),
				});
			} else if (data.startMin === 46) {
				// Second half — dismiss halftime panel, merge intro events from payload.
				// Planned subs are realized now: drop the pending undo list and the
				// swap selection so a later pause (forced swap, sub request) doesn't
				// resurface the stale "Confirmadas" strip. subsMade persists — it's
				// the per-match sub counter, shared across both halves.
				handlers.setShowHalftimePanel(false);
				handlers.setConfirmedSubs([]);
				handlers.setSwapSource(null);
				handlers.setSwapTarget(null);
				handlers.setMatchResults((prev) => {
					if (!prev) return prev;
					const updatedResults = (prev.results || []).map((r) => {
						const update = (data.fixtures || []).find(
							(f) =>
								f.homeTeamId === r.homeTeamId &&
								f.awayTeamId === r.awayTeamId,
						);
						if (!update) return r;
						const existingEvents = r.events || [];
						const newEvents = (update.events || []).filter(
							(ne) =>
								!existingEvents.some(
									(ee) =>
										ee.minute === ne.minute &&
										ee.type === ne.type &&
										ee.playerId === ne.playerId,
								),
						);
						return {
							...r,
							events: [...existingEvents, ...newEvents],
							homeLineup: update.homeLineup?.length
								? update.homeLineup
								: r.homeLineup,
							awayLineup: update.awayLineup?.length
								? update.awayLineup
								: r.awayLineup,
						};
					});
					return { ...prev, results: updatedResults };
				});
			}
		});

		socket.on("matchMinuteUpdate", (data) => {
			if (!inRoom()) return;
			// Don't let ET minutes from another fixture advance the clock for coaches
			// whose match already ended in regulation (isCupExtraTime would be false).
			if (data.minute <= 90 || refs.isCupExtraTimeRef.current) {
				handlers.setLiveMinute(data.minute);
			}
			// Check for penalty suspense events — only show for the player's own match
			const myTeamId = refs.meRef.current?.teamId;
			let myFixtureWithSuspense = null;
			for (const f of data.fixtures || []) {
				const isMyFixture =
					myTeamId != null &&
					(f.homeTeamId === myTeamId || f.awayTeamId === myTeamId);
				if (!isMyFixture) continue;
				for (const e of f.minuteEvents || []) {
					if (e.penaltySuspense) {
						myFixtureWithSuspense = f;
						handlers.setPenaltySuspense({
							playerName: e.playerName,
							result: e.penaltyResult,
							team: e.team,
						});
						// After suspense, update the score AND add the held-back event
						setTimeout(() => {
							handlers.setPenaltySuspense(null);
							// Play goal sound and flash for scored penalty
							if (e.type === "penalty_goal") {
								playGoalSound();
								const flashKey = `${f.homeTeamId}_${f.awayTeamId}_${e.team}`;
								refs.setGoalFlashRef((prev) => ({
									...prev,
									[flashKey]: Date.now(),
								}));
							}
							handlers.setMatchResults((prev) => {
								if (!prev) return prev;
								const updatedResults = (prev.results || []).map((r) => {
									if (
										r.homeTeamId !== f.homeTeamId ||
										r.awayTeamId !== f.awayTeamId
									)
										return r;
									// Revelacao atomica: adicionar tudo o que ficou retido deste minuto -
									// o evento de penalti E os restantes eventos do mesmo minuto (ex.: um golo
									// aberto do adversario). Sem isto, o golo do adversario aparecia no painel
									// ANTES da revelacao do penalty (sensacao de ter sido marcado antes).
									const existingEvents = r.events || [];
									const toAdd = (f.minuteEvents || []).filter(
										(ne) =>
											!existingEvents.some(
												(ee) =>
													ee.minute === ne.minute &&
													ee.type === ne.type &&
													ee.playerId === ne.playerId,
												),
										);
									return {
										...r,
										finalHomeGoals: Math.max(r.finalHomeGoals || 0, f.homeGoals),
										finalAwayGoals: Math.max(r.finalAwayGoals || 0, f.awayGoals),
										events: [...existingEvents, ...toAdd],
									};
								});
								return { ...prev, results: updatedResults };
							});
						}, 3000);
					}
				}
			}
			// Penalty suspense para fixtures onde NÃO somos participantes — sem popup,
			// apenas flash e atualização de score após o mesmo delay de 3s.
			for (const f of data.fixtures || []) {
				const isMyFixture =
					myTeamId != null &&
					(f.homeTeamId === myTeamId || f.awayTeamId === myTeamId);
				if (isMyFixture) continue;
				const isHumanFixture = (refs.playersRef.current || []).some(
					(p) => p.teamId === f.homeTeamId || p.teamId === f.awayTeamId,
				);
				for (const e of f.minuteEvents || []) {
					if (e.penaltySuspense) {
						setTimeout(() => {
							if (e.type === "penalty_goal") {
								if (isHumanFixture) playGoalSound();
								const flashKey = `${f.homeTeamId}_${f.awayTeamId}_${e.team}`;
								refs.setGoalFlashRef((prev) => ({
									...prev,
									[flashKey]: Date.now(),
								}));
							}
							handlers.setMatchResults((prev) => {
								if (!prev) return prev;
								const updatedResults = (prev.results || []).map((r) => {
									if (
										r.homeTeamId !== f.homeTeamId ||
										r.awayTeamId !== f.awayTeamId
									)
										return r;
									return {
										...r,
										finalHomeGoals: f.homeGoals,
										finalAwayGoals: f.awayGoals,
									};
								});
								return { ...prev, results: updatedResults };
							});
						}, 3000);
					}
				}
			}
			handlers.setMatchResults((prev) => {
				if (!prev) return prev;
				const updatedResults = (prev.results || []).map((r) => {
					const update = (data.fixtures || []).find(
						(f) =>
							f.homeTeamId === r.homeTeamId && f.awayTeamId === r.awayTeamId,
					);
					if (!update) return r;
					const existingEvents = r.events || [];
					// If my fixture has penalty suspense active, hold back the score AND ALL of
					// this minute's events for that fixture (penalty + any same-minute event,
					// e.g. an opponent open-play goal) so the scoreboard only updates when the
					// modal reveals the outcome - atomically.
					const hasSuspense =
						myFixtureWithSuspense != null &&
						r.homeTeamId === myFixtureWithSuspense.homeTeamId &&
						r.awayTeamId === myFixtureWithSuspense.awayTeamId;
					const newEvents = hasSuspense
						? [] // revelacao atomica no timeout de suspense (3s)
						: (update.minuteEvents || [])
							.filter(
								(ne) =>
									!existingEvents.some(
										(ee) =>
											ee.minute === ne.minute &&
											ee.type === ne.type &&
											ee.playerId === ne.playerId,
									),
							)
						.map((ne) => {
							if (ne.type === "var_disallowed" && ne.wasGoal) {
								return { ...ne, type: "var_goal_pending" };
							}
							return ne;
						});
					return {
						...r,
						finalHomeGoals: hasSuspense ? r.finalHomeGoals : update.homeGoals,
						finalAwayGoals: hasSuspense ? r.finalAwayGoals : update.awayGoals,
						events: [...existingEvents, ...newEvents],
						homeLineup: update.homeLineup?.length
							? update.homeLineup
							: r.homeLineup,
						awayLineup: update.awayLineup?.length
							? update.awayLineup
							: r.awayLineup,
						homePossession: update.homePossession ?? r.homePossession ?? 50,
						awayPossession: update.awayPossession ?? r.awayPossession ?? 50,
					};
				});
				return { ...prev, results: updatedResults };
			});
			// Revelar VAR após 1 s: substituir var_goal_pending por var_disallowed
			(data.fixtures || []).forEach((f) => {
				const varPending = (f.minuteEvents || []).filter(
					(ne) => ne.type === "var_disallowed" && ne.wasGoal,
				);
				if (!varPending.length) return;
				const isMyFixtureVar =
					myTeamId != null &&
					(f.homeTeamId === myTeamId || f.awayTeamId === myTeamId);
				const isHumanFixtureVar = (refs.playersRef.current || []).some(
					(p) => p.teamId === f.homeTeamId || p.teamId === f.awayTeamId,
				);
				setTimeout(() => {
					handlers.setMatchResults((prev) => {
						if (!prev) return prev;
						const updated = (prev.results || []).map((r) => {
							if (
								r.homeTeamId !== f.homeTeamId ||
								r.awayTeamId !== f.awayTeamId
							)
								return r;
							return {
								...r,
								events: (r.events || []).map((e) =>
									e.type === "var_goal_pending" &&
									varPending.some(
										(vp) =>
											vp.minute === e.minute && vp.playerId === e.playerId,
									)
										? { ...e, type: "var_disallowed" }
										: e,
								),
							};
						});
						return { ...prev, results: updated };
					});
					if (isMyFixtureVar || isHumanFixtureVar) playVarSound();
				}, 1000);
			});
		});

		socket.on("halfTimeResults", (data) => {
			if (!inRoom()) return;
			console.warn("[HALFTIME] halfTimeResults received", data);
			handlers.setIsMatchActionPending(false);
			handlers.setMatchAction(null);
			handlers.setIsLiveSimulation(false);
			handlers.setMatchResults({
				matchweek: data.matchweek,
				results: (data.results || []).map((fx) => ({
					homeTeamId: fx.homeTeamId,
					awayTeamId: fx.awayTeamId,
					finalHomeGoals: fx.finalHomeGoals,
					finalAwayGoals: fx.finalAwayGoals,
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
			// Preservar subsMade/subbedOut — substituições da 1.ª parte contam
			// para o limite de 3 no intervalo (fix: sum diverged between mid-half
			// pause and halftime view).
			handlers.setConfirmedSubs([]);
			handlers.setSwapSource(null);
			handlers.setSwapTarget(null);
			handlers.setShowHalftimePanel(true);
			handlers.setIsPlayingMatch(true);
			handlers.setLiveMinute(45); // ensure replay effect enters halftime path (not end-of-match) on reconnect
			handlers.setActiveTab("live");
		});

		socket.on("matchActionRequired", (data) => {
			try {
				console.warn("[MATCH ACTION REQUIRED]", data);

				const isTargetCoach = isSameTeamId(
					data?.teamId,
					refs.meRef.current?.teamId,
				);
				if (!isTargetCoach) {
					return;
				}
				handlers.setIsMatchActionPending(true);

				const currentSquad = Array.isArray(refs.mySquadRef.current)
					? refs.mySquadRef.current
					: [];
				const currentPositions = refs.tacticRef.current?.positions || {};
				const squadById = new Map(currentSquad.map((p) => [Number(p.id), p]));

				const normalizedAction = { ...(data || {}) };

				const toCandidate = (player) => {
					if (!player || player.id === undefined || player.id === null) {
						return null;
					}
					const id = Number(player.id);
					const squadPlayer = squadById.get(id);
					return {
						id,
						name: player.name || squadPlayer?.name || "Jogador",
						position: player.position || squadPlayer?.position || "MED",
						skill: Number(player.skill ?? squadPlayer?.skill ?? 0),
						resistance: Number(
							player.resistance ?? squadPlayer?.resistance ?? 26,
						),
						form: Number(player.form ?? squadPlayer?.form ?? 32),
						is_star: Boolean(player.is_star ?? squadPlayer?.is_star),
						matchMinutes: Number(
							player.matchMinutes ?? squadPlayer?.matchMinutes ?? 0,
						),
						fatigueLoss: Number(
							player.fatigueLoss ?? squadPlayer?.fatigueLoss ?? 0,
						),
					};
				};

				if (normalizedAction.type === "penalty") {
					const incomingCandidates = (normalizedAction.takerCandidates || [])
						.map(toCandidate)
						.filter(Boolean);

					const titulares = currentSquad.filter(
						(player) => currentPositions[player.id] === "Titular",
					);
					const fallbackBase = titulares.length > 0 ? titulares : currentSquad;
					const fallbackCandidates = fallbackBase
						.map(toCandidate)
						.filter(Boolean);

					normalizedAction.takerCandidates =
						incomingCandidates.length > 0
							? incomingCandidates
							: fallbackCandidates;
				}

				if (normalizedAction.type === "injury") {
					const incomingBench = (normalizedAction.benchPlayers || [])
						.map(toCandidate)
						.filter(Boolean);

					if (incomingBench.length > 0) {
						normalizedAction.benchPlayers = incomingBench;
					} else {
						// Fallback: use players on the bench in the current tactic
						const suplentes = currentSquad
							.filter((player) => currentPositions[player.id] === "Suplente")
							.map(toCandidate)
							.filter(Boolean);
						normalizedAction.benchPlayers =
							suplentes.length > 0
								? suplentes
								: currentSquad.map(toCandidate).filter(Boolean);
					}
				}

				if (normalizedAction.type === "user_substitution") {
					normalizedAction.benchPlayers = (normalizedAction.benchPlayers || [])
						.map(toCandidate)
						.filter(Boolean);
					normalizedAction.onPitch = (normalizedAction.onPitch || [])
						.map(toCandidate)
						.filter(Boolean);
				}

				if (normalizedAction.type === "gk_red_card") {
					normalizedAction.benchPlayers = (normalizedAction.benchPlayers || [])
						.map(toCandidate)
						.filter(Boolean);
					normalizedAction.onPitch = (normalizedAction.onPitch || [])
						.map(toCandidate)
						.filter(Boolean);
				}

				if (normalizedAction.type === "emergency_gk") {
					// GR improvisado — o treinador escolhe EM CAMPO quem vai para a
					// baliza (o banco fica apenas informativo, sem GR disponível).
					normalizedAction.onPitch = (normalizedAction.onPitch || [])
						.map(toCandidate)
						.filter(Boolean);
					normalizedAction.benchPlayers = (normalizedAction.benchPlayers || [])
						.map(toCandidate)
						.filter(Boolean);
				}

				handlers.setMatchAction(normalizedAction);
				handlers.setActiveTab("live");

				clearInterval(refs.injuryCountdownRef.current);
				refs.injuryCountdownRef.current = null;
				handlers.setInjuryCountdown(null);

				if (
					normalizedAction.type === "injury" ||
					normalizedAction.type === "user_substitution" ||
					normalizedAction.type === "gk_red_card" ||
					normalizedAction.type === "emergency_gk"
				) {
					// Deadline do servidor (rejoin a meio da janela recebe o
					// expiresAt original) — fallback aos 60s históricos.
					const remaining =
						typeof data?.expiresAt === "number"
							? Math.max(
									1,
									Math.ceil((data.expiresAt - Date.now()) / 1000),
								)
							: 60;
					handlers.setInjuryCountdown(remaining);
					refs.injuryCountdownRef.current = setInterval(() => {
						handlers.setInjuryCountdown((prev) => {
							if (prev <= 1) {
								clearInterval(refs.injuryCountdownRef.current);
								refs.injuryCountdownRef.current = null;
								return 0;
							}
							return prev - 1;
						});
					}, 1000);
				}
			} catch (err) {
				console.error(
					"Error handling matchActionRequired:",
					err,
					"data:",
					data,
				);
			}
		});

		socket.on("matchActionResolved", (data) => {
			console.warn("[MATCH ACTION RESOLVED]", data);
			// Action pendente antes de limpar — o tipo/jogadores são
			// necessários para a sync abaixo (no caso automático o
			// cliente não a limpa por si).
			const prevAction = refs.matchActionRef.current;
			handlers.setIsMatchActionPending(false);
			clearInterval(refs.injuryCountdownRef.current);
			refs.injuryCountdownRef.current = null;
			handlers.setInjuryCountdown(null);
			handlers.setMatchAction(null);

			// Sync do estado local (positions/subbedOut/subsMade) com a
			// escolha aplicada — sobretudo em fallback/timeout, quando o
			// cliente não emitiu o resolve e ficaria desincronizado
			// (o jogador que entrou automaticamente apareceria como
			// Suplente no ecrã seguinte). Ações resolvidas pelo próprio
			// usuário já foram sincronizadas no handleResolveMatchAction.
			if (
				refs.resolvedActionIdRef?.current === data?.actionId ||
				data?.source !== "auto" ||
				!data?.choice
			)
				return;
			if (!isSameTeamId(data?.teamId, refs.meRef.current?.teamId)) return;
			const type = prevAction?.type;
			if (
				type !== "injury" &&
				type !== "gk_red_card" &&
				type !== "emergency_gk"
			)
				return;
			const toNum = (v) => (v == null ? null : Number(v));
			let outId = null;
			let extraOutId = null;
			let inId = null;
			let countSub = false;
			let markSubbedOut = true;
			if (type === "injury") {
				// O lesado sai sempre do campo; a entrada é opcional
				// (sem banco → joga com 10). A reposição consome sub.
				outId = toNum(
					(typeof data.choice === "object" ? data.choice.playerOut : null) ??
						prevAction?.injuredPlayer?.id,
				);
				inId = toNum(
					typeof data.choice === "object" ? data.choice.playerIn : data.choice,
				);
				countSub = inId != null;
			} else if (type === "gk_red_card") {
				// O GR expulso sai sempre; o sacrificado é opcional (casos
				// degenerados). Paragem → não consome sub.
				extraOutId = toNum(prevAction?.sentOffPlayer?.id);
				outId = toNum(data.choice?.playerOut);
				inId = toNum(data.choice?.playerIn);
			} else {
				// emergency_gk: escolha única (playerId) — o escolhido vai
				// para a baliza; o lesado/expulso sai. Não consome sub e o
				// que saiu é lesado/expulso (já filtrado por ids de eventos
				// no intervalo), não "substituído".
				markSubbedOut = false;
				inId = toNum(
					typeof data.choice === "object"
						? data.choice.playerId ?? data.choice.playerIn
						: data.choice,
				);
				outId = toNum(
					prevAction?.sentOffPlayer?.id ?? prevAction?.injuredPlayer?.id,
				);
			}
			if (outId == null && inId == null && extraOutId == null) return;

			handlers.setTactic((prevTactic) => {
				const newPositions = { ...prevTactic.positions };
				for (const id of [outId, extraOutId]) {
					if (id != null) delete newPositions[id];
				}
				if (inId != null) newPositions[inId] = "Titular";
				const next = { ...prevTactic, positions: newPositions };
				queueEmit("setTactic", next);
				return next;
			});
			if (markSubbedOut && outId != null && !Number.isNaN(outId)) {
				handlers.setSubbedOut((prev) =>
					prev.includes(outId) ? prev : [...prev, outId],
				);
			}
			if (countSub) {
				handlers.setSubsMade((n) => Math.min(MAX_MATCH_SUBS, n + 1));
			}
		});

		socket.on("substitutionPauseStarted", ({ teamId, coachName, type }) => {
			// Não mostrar o banner ao próprio treinador que pediu a pausa
			const myTeamId = refs.meRef.current?.teamId;
			if (myTeamId && myTeamId === teamId) return;
			handlers.setSubstitutionPause({ teamId, coachName, type });
		});

		socket.on("substitutionPauseEnded", ({ teamId }) => {
			handlers.setSubstitutionPause((prev) =>
				prev && prev.teamId === teamId ? null : prev,
			);
		});

		// Treinador esgotou as 3 substituições permitidas na partida (4ª tentativa
		// ou lesão sem reposição): avisa só o treinador da equipa envolvida.
		socket.on("substitutionCapReached", ({ teamId }) => {
			const myTeamId = refs.meRef.current?.teamId;
			if (!myTeamId || myTeamId !== teamId) return;
			handlers.addToast(
				"Esgotaste as 3 substituições permitidas na partida.",
			);
		});

		socket.on("coachDisconnected", () => {
			if (!inRoom()) return;
		});

		socket.on("matchActionExpired", ({ type }) => {
			handlers.setIsMatchActionPending(false);
			clearInterval(refs.injuryCountdownRef.current);
			refs.injuryCountdownRef.current = null;
			handlers.setInjuryCountdown(null);
			handlers.setMatchAction(null);
			handlers.addToast(
				type === "user_substitution"
					? "Substituição expirada — decisão automática aplicada"
					: type === "injury"
						? "Lesão sem substituição — decisão automática aplicada"
						: "Decisão expirada — ação automática aplicada",
			);
		});

		// BUG-11 FIX: matchResults clears showHalftimePanel (2nd half replay)
		socket.on("matchResults", (data) => {
			if (!inRoom()) return;
			handlers.setIsMatchActionPending(false);
			handlers.setMatchAction(null);
			handlers.setMatchResults(data);
			handlers.setMatchweekCount(data.matchweek);
			// As classificações do cliente ficam desatualizadas até o servidor
			// emitir os dados novos (teamsData/teamForms/topScorers) e
			// "standingsUpdated". Marca para o indicador "A atualizar…".
			handlers.setStandingsStale(true);
			handlers.setShowHalftimePanel(false);
			handlers.setIsCupMatch(false);
			handlers.setCupExtraTimeBadge(false);
			handlers.setActiveTab("live");

			// If live simulation drove the clock, don't restart a replay.
			// The match is already at minute 90 — just trigger the end-of-match transition.
			if (refs.isLiveSimulationRef.current) {
				handlers.setIsLiveSimulation(false);
				handlers.setLiveMinute(90);
				handlers.setIsPlayingMatch(true);
			} else if (refs.liveMinuteRef.current >= 45) {
				// Reconnect mid-second-half: replay was already past halftime.
				// Go straight to 90 — don't restart the replay from 45.
				refs.matchReplayActiveRef.current = false;
				handlers.setLiveMinute(90);
				handlers.setIsPlayingMatch(true);
			} else {
				// Reconnect/fallback: no live simulation was in progress, start a replay
				refs.matchReplayActiveRef.current = false;
				handlers.setLiveMinute(45);
				handlers.setIsPlayingMatch(true);
			}

			// Após jogo: todos os jogadores vão a "Não convocado" e a
			// mentalidade volta a Neutro (reset intencional de jornada).
			handlers.setTactic((prev) => {
				const allExcluded = Object.fromEntries(
					(refs.mySquadRef.current || []).map((p) => [p.id, "Excluído"]),
				);
				const next = { ...prev, positions: allExcluded, style: "Balanced" };
				queueEmit("setTactic", next);
				return next;
			});
		});

		socket.on("standingsUpdated", () => {
			if (!inRoom()) return;
			handlers.setStandingsStale(false);
		});

		socket.on("coachDismissed", ({ reason, teamName, detail }) => {
			if (!inRoom()) return;
			handlers.setJobOfferModal(null);
			refs.pendingDismissalRef.current = { reason, teamName, detail };
		});

		socket.on("boardBudgetWarning", (data) => {
			if (!inRoom()) return;
			handlers.setBoardWarning(data);
		});

		socket.on("coachMarketReport", (report) => {
			if (!inRoom()) return;
			if (!report || !Array.isArray(report.events) || report.events.length === 0)
				return;
			handlers.setCoachMarketReport(report);
		});

		socket.on("jobOffer", (data) => {
			if (!inRoom()) return;
			handlers.setJobOfferModal(data);
		});

		socket.on("chatMessage", (msg) => {
			const isOwn = msg.coachName === refs.meRef.current?.name;
			if (msg.channel === "room") {
				handlers.setRoomMessages((prev) => [...prev.slice(-199), msg]);
				if (!isOwn) {
					handlers.setUnreadRoom((prev) =>
						refs.chatOpenRef?.current &&
						refs.activeChatTabRef?.current === "room"
							? 0
							: prev + 1,
					);
				}
			} else if (msg.channel === "global") {
				handlers.setGlobalMessages((prev) => [...prev.slice(-199), msg]);
				if (!isOwn) {
					handlers.setUnreadGlobal((prev) =>
						refs.chatOpenRef?.current &&
						refs.activeChatTabRef?.current === "global"
							? 0
							: prev + 1,
					);
				}
			}
		});

		socket.on("chatHistory", ({ channel, messages }) => {
			if (channel === "room") handlers.setRoomMessages(messages || []);
			else if (channel === "global") handlers.setGlobalMessages(messages || []);
		});

		socket.on("globalPlayersUpdate", (players) => {
			handlers.setGlobalPlayers(players || []);
		});

		// Convite para mudar de sala vindo de outro treinador (estamos online
		// noutra sala). Mostra um modal Aceitar/Recusar no jogo.
		socket.on("roomInvite", (invite) => {
			if (handlers.setPendingRoomInvite && invite?.inviteId) {
				handlers.setPendingRoomInvite(invite);
			}
		});

		// BUG-15 FIX: Track socket connection state
		const onConnect = () => {
			handlers.setDisconnected(false);
			handlers.setJoining(false);
			// Re-join on reconnect using the meRef to avoid stale closure.
			// Também cobre o estado "à espera do teamAssigned" (roomCode
			// definido mas teamId ainda ausente): se o socket cair nesse
			// intervalo, o re-join faz o servidor re-emitir o teamAssigned.
			// No join manual inicial o roomCode ainda está vazio, por isso
			// não há join duplicado.
			const currentMe = refs.meRef.current;
			if (
				currentMe?.roomCode &&
				currentMe?.name &&
				currentMe?.token
			) {
				// Feedback imediato: o rejoin + flush se dão no gameState/
				// teamAssigned que se seguem.
				handlers.addToast("Ligação restabelecida — a sincronizar…");
				socket.emit("joinGame", {
					name: currentMe.name,
					token: currentMe.token,
					roomCode: currentMe.roomCode,
				});
			}
		};
		const onDisconnect = () => handlers.setDisconnected(true);

		socket.on("connect", onConnect);
		socket.on("disconnect", onDisconnect);
		socket.on("sessionDisplaced", () => handlers.setSessionDisplaced(true));
		socket.on("kicked", ({ reason } = {}) => {
			// Notificar o coach expulso e forçar saída da sala
			handlers.setGameDialog({
				title: "Removido da sala",
				message: reason || "Foste removido da sala pelo Admin.",
				onClose: () => {
					handlers.setGameDialog(null);
					handlers.setMe(null);
					handlers.setRoomCode("");
				},
			});
		});
		// adminUsersUpdated is handled directly by AdminPanel.jsx via its own socket.on.
		// No listener needed here — registering a no-op was wasting a listener slot.

		return () => {
			socket.off("teamsData");
			socket.off("teamForms");
			socket.off("playerListUpdate");
			socket.off("mySquad");
			socket.off("marketUpdate");
			socket.off("transferHistory");
			socket.off("transferCompleted");
			socket.off("globalNews");
			socket.off("globalNewsUpdated");
			socket.off("auctionStarted");
			socket.off("auctionBidConfirmed");
			socket.off("auctionBidPlaced");
			socket.off("auctionClosed");
			socket.off("auctionPaused");
			socket.off("auctionResumed");
			socket.off("systemMessage");
			socket.off("transferProposalResult");
			socket.off("playerSigned");
			socket.off("renewContractCounterOffer");
			socket.off("contractRequest");
			socket.off("teamAssigned");
			socket.off("teamSquadData");
			socket.off("nextMatchSummary");
			socket.off("seasonState");
			socket.off("calendarData");
			socket.off("topScorers");
			socket.off("seasonEnd");
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
			socket.off("palmaresData");
			socket.off("clubHistoryData");
			socket.off("clubNewsData");
			socket.off("clubNewsUpdated");
			socket.off("playerHistoryData");
			socket.off("playerSearchResults");
			socket.off("financeData");
			socket.off("stadiumBuilt");
			socket.off("matchReplay");
			socket.off("matchSegmentStart");
			socket.off("matchMinuteUpdate");
			socket.off("matchResults");
			socket.off("standingsUpdated");
			socket.off("halfTimeResults");
			socket.off("matchActionRequired");
			socket.off("matchActionResolved");
			socket.off("substitutionPauseStarted");
			socket.off("substitutionPauseEnded");
			socket.off("coachDisconnected");
			socket.off("matchActionExpired");
			socket.off("roomLocked");
			socket.off("awaitingCoaches");
			socket.off("gameState");
			socket.off("tacticFamiliarity");
			socket.off("allTacticFamiliarity");
			socket.off("coachDismissed");
			socket.off("boardBudgetWarning");
			socket.off("coachMarketReport");
			socket.off("jobOffer");
			socket.off("chatMessage");
			socket.off("chatHistory");
			socket.off("globalPlayersUpdate");
			socket.off("roomInvite");
			socket.off("connect", onConnect);
			socket.off("disconnect", onDisconnect);
			socket.off("sessionDisplaced");
			socket.off("kicked");
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps
}
