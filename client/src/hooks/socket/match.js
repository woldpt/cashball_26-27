import { socket, queueEmit } from "../../socket.js";
import { isSameTeamId } from "../../utils/teamHelpers.js";
import { playGoalSound, playVarSound } from "../../utils/audio.js";
import { readGoalFlashEntry, isGoalType, computePenaltySteps } from "../../components/live/liveHelpers.js";
import { MAX_MATCH_SUBS, PENALTY_SUSPENSE_DISPLAY_MS } from "../../constants/index.js";

/**
 * Listeners de Jogo ao vivo (replay, ações, intervalo).
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerMatchListeners(handlers, refs, ctx) {
	socket.on("matchReplay", (data) => {
		if (!ctx.inRoom()) return;
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
		if (!ctx.inRoom()) return;
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
		if (!ctx.inRoom()) return;
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
			const suspenseEvents = (f.minuteEvents || []).filter((e) => e.penaltySuspense);
			if (!suspenseEvents.length) continue;
			myFixtureWithSuspense = f;
			// Fila de penáltis: N shows escalonados (um por penálti) + revelação
			// atómica no fim. Timers canceláveis — um tick novo cancela a fila
			// pendente anterior; sem isto, o clear de um minuto antigo matava o
			// penálti do minuto novo, e 2 penáltis no mesmo minuto sobrescreviam-se
			// (só o último aparecia).
			ctx.penaltyTimers.current.forEach(clearTimeout);
			ctx.penaltyTimers.current = [];
			for (const step of computePenaltySteps(suspenseEvents, PENALTY_SUSPENSE_DISPLAY_MS)) {
				ctx.penaltyTimers.current.push(
					setTimeout(() => {
						if (step.action === "show") {
							handlers.setPenaltySuspense({
								playerName: step.event.playerName,
								result: step.event.penaltyResult,
								team: step.event.team,
								// Tipo do evento (não a string) decide a cor — robusto a
								// mudanças de texto no servidor.
								isGoal: step.event.type === "penalty_goal",
							});
							return;
						}
						// Revelação atómica no fim da fila: limpa o popup e atualiza
						// score + eventos retidos uma só vez — sem isto, um golo aberto
						// no mesmo minuto do penálti entrava em silêncio, sem flash.
						handlers.setPenaltySuspense(null);
						const revealedGoals = (f.minuteEvents || []).filter((ne) => ne && isGoalType(ne.type));
						if (revealedGoals.length) {
							playGoalSound();
							refs.setGoalFlashRef((prev) => {
								const next = { ...prev };
								for (const g of revealedGoals) {
									const flashKey = `${f.homeTeamId}_${f.awayTeamId}_${g.team}`;
									next[flashKey] = { ts: Date.now(), n: readGoalFlashEntry(next[flashKey]).n + 1 };
								}
								return next;
							});
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
					}, step.atMs),
				);
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
								[flashKey]: { ts: Date.now(), n: readGoalFlashEntry(prev[flashKey]).n + 1 },
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
					}, PENALTY_SUSPENSE_DISPLAY_MS);
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
		if (!ctx.inRoom()) return;
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
					// Fallback: banco da tática atual. NUNCA o plantel inteiro — quem
					// está em campo não pode entrar (o servidor rejeita a escolha e a
					// reposição não se aplica). Sem suplentes a lista fica vazia e o
					// treinador é avisado que joga com menos um.
					normalizedAction.benchPlayers = currentSquad
						.filter(
							(player) => currentPositions[player.id] === "Suplente",
						)
						.map(toCandidate)
						.filter(Boolean);
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

	socket.on("matchActionExpired", () => {
		handlers.setIsMatchActionPending(false);
		clearInterval(refs.injuryCountdownRef.current);
		refs.injuryCountdownRef.current = null;
		handlers.setInjuryCountdown(null);
		handlers.setMatchAction(null);
	});

	// BUG-11 FIX: matchResults clears showHalftimePanel (2nd half replay)
	socket.on("matchResults", (data) => {
		if (!ctx.inRoom()) return;
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
		if (!ctx.inRoom()) return;
		handlers.setStandingsStale(false);
	});

	return () => {
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
		socket.off("matchActionExpired");
	};
}
