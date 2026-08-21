import { useEffect } from "react";
import { socket } from "../socket.js";
import { isSameTeamId } from "../utils/teamHelpers.js";
import { playGoalSound, playVarSound } from "../utils/audio.js";
import { POSITION_SHORT_LABELS, POSITION_TEXT_CLASS } from "../constants/index.js";

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
			value: `J${contractEndMatchweek} · E${contractEndSeason}`,
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
			// Never open the cup draw popup during an active match
			if (refs.isPlayingMatchRef.current) return;
			refs.isCupDrawRef.current = true;
			// Close any open auction modal to avoid overlap with the draw animation
			handlers.setSelectedAuctionPlayer(null);
			handlers.setAuctionBid("");
			handlers.setMyAuctionBid(null);
			handlers.setAuctionResult(null);
			handlers.setCupDraw(data);
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
			handlers.setCupMatchRoundName(data.roundName);
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
					attendance: null,
				})),
			});
				handlers.setLiveMinute(45);
				handlers.setSubsMade(0);
				handlers.setSubbedOut([]);
				handlers.setConfirmedSubs([]);
				handlers.setSwapSource(null);
				handlers.setSwapTarget(null);
				handlers.setShowHalftimePanel(true);
				handlers.setIsPlayingMatch(true);
				handlers.setIsCupMatch(true);
				handlers.setCupPreMatch(false);
				handlers.setCupMatchRoundName(data.roundName);
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
					socket.emit("setReady", true);
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
					attendance: null,
				})),
			});
				handlers.setLiveMinute(90);
				handlers.setSubsMade(0);
				// Keep subbedOut across halves into ET: a player who left cannot re-enter.
				handlers.setConfirmedSubs([]);
				handlers.setSwapSource(null);
				handlers.setSwapTarget(null);
				handlers.setShowHalftimePanel(true);
				handlers.setIsCupMatch(true);
				handlers.setCupPreMatch(false);
				handlers.setCupMatchRoundName(data.roundName);
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
					socket.emit("setReady", true);
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
			socket.emit("requestCupBracket");
	
			handlers.setCupRoundResults(data);
			// Don't navigate away yet — if a penalty shootout popup is open, wait for it to close first.
			handlers.setPendingCupRoundResults(data);
			// matchweek doesn't increment after cup rounds, so the useEffect in App.jsx
			// won't fire — refresh calendar manually.
			socket.emit("requestCalendar");
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
					attendance: null,
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
			handlers.setCupMatchRoundName(data.roundName);
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
			handlers.setPlayerSearchResults(data?.results || []);
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
					confirmLabel: "Aceitar",
					cancelLabel: "Leilão",
					onConfirm: () =>
						socket.emit("acceptCounterOffer", { playerId, accepted: true }),
					onCancel: () =>
						socket.emit("acceptCounterOffer", { playerId, accepted: false }),
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
				const endText =
					contractEndMatchweek && contractEndSeason
						? ` Contrato até à J${contractEndMatchweek} da época ${contractEndSeason}.`
						: "";
				const headline = isRenegotiation
					? `📈 ${agent} viu o teu plantel no Excel: ${playerName} vale muito mais do que recebe. Exige €${requestedWage.toLocaleString("pt-PT")}/sem ou ameaça "conversas com outros clubes".${endText}`
					: `📞 ${agent} ligou em pânico: ${playerName} anda a olhar para vitrinas de troféus que não são as tuas! Exige €${requestedWage.toLocaleString("pt-PT")}/sem.${endText}`;
				handlers.setGameDialog({
					mode: "confirm",
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
					confirmLabel: "Aceitar",
					cancelLabel: "Leilão",
					cancelDanger: true,
					onConfirm: () =>
						socket.emit("renewContract", {
							playerId,
							offeredWage: requestedWage,
						}),
					onCancel: () =>
						socket.emit("declineContractRequest", { playerId }),
				});
			},
		);
		socket.on("transferProposalResult", ({ ok, message }) => {
			handlers.addToast(message);
			if (ok) handlers.setTransferProposalModal(null);
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
				if (data.cupRoundName) handlers.setCupMatchRoundName(data.cupRoundName);
			} else {
				handlers.setIsCupMatch(false);
			}
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
				if (data.cupRoundName) handlers.setCupMatchRoundName(data.cupRoundName);
			} else {
				handlers.setIsCupMatch(false);
			}
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
				// Second half — dismiss halftime panel, merge intro events from payload
				handlers.setShowHalftimePanel(false);
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
									// Add the held-back penalty event now
									const suspenseEvents = (f.minuteEvents || []).filter(
										(ne) => ne.penaltySuspense,
									);
									const existingEvents = r.events || [];
									const toAdd = suspenseEvents.filter(
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
										finalHomeGoals: f.homeGoals,
										finalAwayGoals: f.awayGoals,
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
					// If my fixture has penalty suspense active, hold back the score AND
					// the penalty_goal/penalty_miss events so the scoreboard only updates
					// after the modal reveals the outcome.
					const hasSuspense =
						myFixtureWithSuspense != null &&
						r.homeTeamId === myFixtureWithSuspense.homeTeamId &&
						r.awayTeamId === myFixtureWithSuspense.awayTeamId;
					const newEvents = (update.minuteEvents || [])
						.filter(
							(ne) =>
								!existingEvents.some(
									(ee) =>
										ee.minute === ne.minute &&
										ee.type === ne.type &&
										ee.playerId === ne.playerId,
								) && !(hasSuspense && ne.penaltySuspense),
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
				})),
			});
			handlers.setSubsMade(0);
			handlers.setSubbedOut([]); // Reset substituted-out players for the new match
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
							player.resistance ?? squadPlayer?.resistance ?? 0,
						),
						form: Number(player.form ?? squadPlayer?.form ?? 100),
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

				handlers.setMatchAction(normalizedAction);
				handlers.setActiveTab("live");

				clearInterval(refs.injuryCountdownRef.current);
				refs.injuryCountdownRef.current = null;
				handlers.setInjuryCountdown(null);

				if (
					normalizedAction.type === "injury" ||
					normalizedAction.type === "user_substitution" ||
					normalizedAction.type === "gk_red_card"
				) {
					handlers.setInjuryCountdown(60);
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

		socket.on("matchActionResolved", () => {
			console.warn("[MATCH ACTION RESOLVED]");
			handlers.setIsMatchActionPending(false);
			clearInterval(refs.injuryCountdownRef.current);
			refs.injuryCountdownRef.current = null;
			handlers.setInjuryCountdown(null);
			handlers.setMatchAction(null);
		});

		socket.on("substitutionPauseStarted", ({ teamId, coachName }) => {
			// Não mostrar o banner ao próprio treinador que pediu a pausa
			const myTeamId = refs.meRef.current?.teamId;
			if (myTeamId && myTeamId === teamId) return;
			handlers.setSubstitutionPause({ teamId, coachName });
		});

		socket.on("substitutionPauseEnded", ({ teamId }) => {
			handlers.setSubstitutionPause((prev) =>
				prev && prev.teamId === teamId ? null : prev,
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
			const myTeamId = refs.meRef.current?.teamId;
			const myDivision = refs.teamsRef.current.find(
				(t) => t.id === myTeamId,
			)?.division;
			for (const r of data.results || []) {
				const homeDiv = refs.teamsRef.current.find(
					(t) => t.id === r.homeTeamId,
				)?.division;
				if (myDivision && homeDiv !== myDivision) continue;
	
				}
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

			// Após jogo: todos os jogadores vão a "Não convocado"
			handlers.setTactic((prev) => {
				const allExcluded = Object.fromEntries(
					(refs.mySquadRef.current || []).map((p) => [p.id, "Excluído"]),
				);
				const next = { ...prev, positions: allExcluded };
				socket.emit("setTactic", next);
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

		// BUG-15 FIX: Track socket connection state
		const onConnect = () => {
			handlers.setDisconnected(false);
			handlers.setJoining(false);
			// Re-join on reconnect using the meRef to avoid stale closure.
			const currentMe = refs.meRef.current;
			if (
				currentMe?.teamId &&
				currentMe?.roomCode &&
				currentMe?.name &&
				currentMe?.token
			) {
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
			socket.off("auctionStarted");
			socket.off("auctionBidConfirmed");
			socket.off("auctionBidPlaced");
			socket.off("auctionClosed");
			socket.off("auctionPaused");
			socket.off("auctionResumed");
			socket.off("systemMessage");
			socket.off("transferProposalResult");
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
			socket.off("coachDismissed");
			socket.off("coachMarketReport");
			socket.off("jobOffer");
			socket.off("chatMessage");
			socket.off("chatHistory");
			socket.off("globalPlayersUpdate");
			socket.off("connect", onConnect);
			socket.off("disconnect", onDisconnect);
			socket.off("sessionDisplaced");
			socket.off("kicked");
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps
}
