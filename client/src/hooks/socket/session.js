import { socket, flushOutbox, queueEmit, subscribeSessionDisplaced } from "../../socket.js";
import { getDeviceId, loadSavedSession } from "../../utils/localStorage.js";
import { loadTacticSnapshot } from "../../utils/uiSnapshot.js";
import { SIM_SPEED_PRESETS, DEFAULT_SIM_SPEED } from "../../constants/index.js";
import { hasSeenWelcome, hasSeenWelcomeThisSession } from "./helpers.js";

/**
 * Listeners de Sessão, sala e ligação.
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerSessionListeners(handlers, refs, ctx) {
	// Handlers com referência: o `off` sem handler apagava os listeners de módulo
	// (socket.js) e de outros componentes no mesmo evento.
	const onTeamAssigned = (data) => {
		// O teamAssigned confirma que o join terminou; sem cancelar este
		// timeout, o cliente repetia o join a cada 10 segundos.
		if (refs.joinTimerRef?.current) {
			clearTimeout(refs.joinTimerRef.current);
			refs.joinTimerRef.current = null;
		}
		// Fallback à sessão guardada: se `me` caiu (ou o ref ainda não foi
		// sincronizado), o `teamAssigned` era descartado e o cliente ficava
		// em "A entrar na sala..." para sempre, a repetir o join.
		const saved = loadSavedSession();
		const currentMe =
			refs.meRef.current ||
			(saved ? { name: saved.name, token: saved.token } : null);
		// Só precisamos do name — o joinGame já foi emitido por este socket.
		// O roomCode pode ainda não estar atualizado no ref porque o React
		// não processou a atualização do handleJoinSuccess (mesmo event loop).
		if (!currentMe?.name) return;
		handlers.setMe((prev) => ({
			...(prev || {
				name: currentMe.name,
				token: currentMe.token,
				roomCode: currentMe.roomCode,
			}),
			teamId: data.teamId,
		}));
		// Troca de clube (convite aceite): largar o briefing do clube antigo
		// e pedir o Jornal do novo — sem isto, ambos ficavam obsoletos até
		// ao próximo broadcast (o refetch do briefing segue via me.teamId).
		// O meRef ainda tem o clube anterior (o setMe acima é assíncrono).
		if (refs.meRef.current?.teamId !== data.teamId) {
			handlers.setNextMatchSummary(null);
			socket.emit("getGlobalNews");
		}
		// Merge das versões de avatar dos coaches da sala (exibição em listas/chat)
		if (data.coachAvatars && typeof data.coachAvatars === "object") {
			handlers.setCoachAvatars((prev) => ({
				...prev,
				...data.coachAvatars,
			}));
		}
		// Seeds procedurais partilhados (mesma cara para todos — ver coachAvatar.js)
		if (data.coachAvatarSeeds && typeof data.coachAvatarSeeds === "object") {
			handlers.setCoachAvatarSeeds((prev) => ({
				...prev,
				...data.coachAvatarSeeds,
			}));
		}
		const pendingDismissal = refs.pendingDismissalRef.current;
		// Troca de clube no modal de despedimento: o servidor re-emite o
		// teamAssigned (com as alternativas atualizadas) e o modal só muda de clube.
		if (!pendingDismissal && data.dismissalOptions) {
			handlers.setDismissalModal((prev) => (prev ? { ...prev, newTeam: data } : prev));
			ensureJoinState();
			return;
		}
		if (pendingDismissal) {
			refs.pendingDismissalRef.current = null;
			handlers.setDismissalModal({ ...pendingDismissal, newTeam: data });
			ensureJoinState();
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
		ensureJoinState();
	};
	socket.on("teamAssigned", onTeamAssigned);
	// Rede de segurança pós-join (X4Z1BI): se a rajada do join (mySquad +
	// gameState) se perdeu mas o sinal de join completo chegou, pedir o
	// snapshot ao servidor — sem isto o cliente fica preso nos defaults (S1,
	// plantel vazio, tática morta). Idempotente e sem loop: a resposta traz
	// gameState (marca visto) e o teamAssigned seguinte já não reemite.
	const ensureJoinState = () => {
		if (!refs.joinStateSeenRef.current) {
			refs.joinStateSeenRef.current = true;
			socket.emit("requestResync");
		}
	};
	const onGameState = (data) => {
		if (!ctx.inRoom()) return;
		refs.joinStateSeenRef.current = true;
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
		if (typeof data.msPerMinute === "number") {
			const key = Object.keys(SIM_SPEED_PRESETS).find(
				(k) => SIM_SPEED_PRESETS[k].ms === data.msPerMinute,
			);
			handlers.setSimSpeed(key || DEFAULT_SIM_SPEED);
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
		// (tática, resoluções) + repor intenções sticky.
		flushOutbox();
	};
	socket.on("gameState", onGameState);

	socket.on("roomLocked", ({ coaches }) => {
		if (!ctx.inRoom()) return;
		handlers.setLockedCoaches(coaches || []);
	});

	socket.on("awaitingCoaches", (offline) => {
		if (!ctx.inRoom()) return;
		handlers.setAwaitingCoaches(offline || []);
	});

	socket.on("roomRoster", (roster) => {
		if (!ctx.inRoom()) return;
		handlers.setRoomRoster(Array.isArray(roster) ? roster : []);
	});

	socket.on("coachDisconnected", () => {
		if (!ctx.inRoom()) return;
	});

	const onGlobalPlayersUpdate = (players) => {
		handlers.setGlobalPlayers(players || []);
	};
	socket.on("globalPlayersUpdate", onGlobalPlayersUpdate);

	// Convite para mudar de sala vindo de outro treinador (estamos online
	// noutra sala). Mostra um modal Aceitar/Recusar no jogo.
	socket.on("roomInvite", (invite) => {
		if (handlers.setPendingRoomInvite && invite?.inviteId) {
			handlers.setPendingRoomInvite(invite);
		}
	});

	// BUG-15 FIX: Track socket connection state
	let disconnectedAt = 0;
	// Sessão reclamada noutro dispositivo: este cliente não volta a entrar sozinho
	// (senão os dois roubavam o assento um ao outro); «Retomar aqui» recarrega.
	let displaced = false;
	const onConnect = () => {
		const downMs = disconnectedAt ? Date.now() - disconnectedAt : 0;
		disconnectedAt = 0;
		handlers.setDisconnected(false);
		handlers.setJoining(false);
		if (displaced) return;
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
			// Só se o utilizador chegou a ver o OfflineBanner (>1,5s offline);
			// um flape curto reconecta em silêncio.
			if (downMs > 1500) handlers.flashReconnect();
			// Nova rajada a caminho: rearmar a rede de segurança pós-join.
			refs.joinStateSeenRef.current = false;
			socket.emit("joinGame", {
				name: currentMe.name,
				token: currentMe.token,
				roomCode: currentMe.roomCode,
				deviceId: getDeviceId(),
			});
		}
	};
	const onDisconnect = () => {
		disconnectedAt = Date.now();
		handlers.setDisconnected(true);
	};

	socket.on("connect", onConnect);
	socket.on("disconnect", onDisconnect);
	const unsubDisplaced = subscribeSessionDisplaced(() => {
		displaced = true;
		handlers.setSessionDisplaced(true);
	});
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
	// adminUsersUpdated is handled directly by AdminPage via its own socket.on.
	// No listener needed here — registering a no-op was wasting a listener slot.
	// Foto/seed de avatar alterados por outro coach: merge sem refresh.
	socket.on("coachAvatarUpdated", (data) => {
		if (!data || typeof data.name !== "string" || !data.name) return;
		if (data.version != null) {
			const version = data.version;
			handlers.setCoachAvatars((prev) => ({ ...prev, [data.name]: version }));
		} else {
			handlers.setCoachAvatars((prev) => {
				const next = { ...prev };
				delete next[data.name];
				return next;
			});
		}
		if (data.seed) {
			const seed = data.seed;
			handlers.setCoachAvatarSeeds((prev) => ({ ...prev, [data.name]: seed }));
		} else {
			handlers.setCoachAvatarSeeds((prev) => {
				const next = { ...prev };
				delete next[data.name];
				return next;
			});
		}
	});
	return () => {
		socket.off("teamAssigned", onTeamAssigned);
		socket.off("roomLocked");
		socket.off("awaitingCoaches");
		socket.off("roomRoster");
		socket.off("gameState", onGameState);
		socket.off("coachDisconnected");
		socket.off("globalPlayersUpdate", onGlobalPlayersUpdate);
		socket.off("roomInvite");
		socket.off("connect", onConnect);
		socket.off("disconnect", onDisconnect);
		unsubDisplaced();
		socket.off("kicked");
		socket.off("coachAvatarUpdated");
	};
}
