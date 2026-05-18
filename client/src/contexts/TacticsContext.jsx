import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { socket } from "../socket";
import { TACTIC_FORMATIONS } from "../constants/index.js";
import {
	buildAutoPositions,
	getAvailablePositionCounts,
	isFormationAvailable,
	isPlayerAvailable,
} from "../utils/playerHelpers.js";
import { useGame } from "./GameContext.jsx";

const TacticsContext = createContext(null);

/**
 * Provides tactic-specific state, computed values and handlers.
 * Consumes useGame() for all game state — no props needed beyond children.
 */
export function TacticsProvider({ children }) {
	const {
		tactic,
		setTactic,
		tacticFamiliarity,
		setTacticFamiliarity,
		allTacticFamiliarity,
		setAllTacticFamiliarity,
		swapSource,
		setSwapSource,
		swapTarget,
		setSwapTarget,
		subbedOut,
		setSubbedOut,
		confirmedSubs,
		setConfirmedSubs,
		subsMade,
		setSubsMade,
		mySquad,
		matchweekCount,
		nextMatchSummary,
		players,
		me,
		teamInfo,
		disconnected,
		isCupMatch,
		showHalftimePanel,
		isPlayingMatch,
		annotatedSquad, // computed by GameContext
	} = useGame();

	// ── UI state owned exclusively by this context ──────────────────────────
	const [openStatusPickerId, setOpenStatusPickerId] = useState(null);
	const [dragOverPlayerId, setDragOverPlayerId] = useState(null);
	const [dragPlayerId, setDragPlayerId] = useState(null);
	const [dragOverSection, setDragOverSection] = useState(null);
	const dragPlayerStatusRef = useRef(null);

	// ── Computed values ──────────────────────────────────────────────────────
	const availablePositionCounts = useMemo(
		() => getAvailablePositionCounts(mySquad, matchweekCount + 1),
		[mySquad, matchweekCount],
	);

	const formationAvailabilityByValue = useMemo(
		() =>
			Object.fromEntries(
				TACTIC_FORMATIONS.map(({ value }) => [
					value,
					isFormationAvailable(value, availablePositionCounts),
				]),
			),
		[availablePositionCounts],
	);

	const titulares = useMemo(
		() => mySquad.filter((p) => tactic.positions[p.id] === "Titular"),
		[mySquad, tactic.positions],
	);

	// Só conta titulares que estão efectivamente disponíveis (não lesionados / suspensos).
	// Impede que um jogador indisponível pre-seleccionado de uma ronda anterior
	// habilite o botão "Jogar Jornada" sem validação.
	const isLineupComplete = useMemo(() => {
		const validTitulares = annotatedSquad.filter(
			(p) => p.status === "Titular" && !p.isUnavailable,
		);
		return (
			validTitulares.filter((p) => p.position === "GR").length === 1 &&
			validTitulares.filter((p) => p.position !== "GR").length === 10
		);
	}, [annotatedSquad]);

	const nextMatchOpponent = nextMatchSummary?.opponent || null;
	const nextMatchReferee = nextMatchSummary?.referee || null;

	// ── Close status picker on any outside click ─────────────────────────────
	useEffect(() => {
		if (!openStatusPickerId) return;
		const close = () => setOpenStatusPickerId(null);
		document.addEventListener("click", close);
		return () => document.removeEventListener("click", close);
	}, [openStatusPickerId]);

	// ── Handlers ─────────────────────────────────────────────────────────────

	const updateTactic = useCallback(
		(patch) => {
			setTactic((prev) => {
				const next = { ...prev, ...patch };
				socket.emit("setTactic", next);
				return next;
			});
		},
		[setTactic],
	);

	const handleClearTactic = useCallback(() => {
		setTactic((prev) => {
			const allExcluded = Object.fromEntries(
				mySquad.map((p) => [p.id, "Excluído"]),
			);
			const next = { ...prev, formation: "", positions: allExcluded };
			socket.emit("setTactic", next);
			return next;
		});
	}, [mySquad, setTactic]);

	const handleAutoPick = useCallback(
		(formation) => {
			const availableCounts = getAvailablePositionCounts(
				mySquad,
				matchweekCount + 1,
			);
			if (!isFormationAvailable(formation, availableCounts)) return;

			const autoPositions = buildAutoPositions(
				mySquad,
				formation,
				matchweekCount + 1,
			);
			setTactic((prev) => {
				const next = { ...prev, formation, positions: autoPositions };
				socket.emit("setTactic", next);
				return next;
			});
		},
		[matchweekCount, mySquad, setTactic],
	);

	const handleSelectOut = useCallback(
		(playerId) => {
			setSwapSource((prev) => (prev === playerId ? null : playerId));
			if (swapSource !== null) setSwapTarget(null);
		},
		[swapSource, setSwapSource, setSwapTarget],
	);

	const handleSelectIn = useCallback(
		(playerId) => {
			setSwapTarget((prev) => (prev === playerId ? null : playerId));
		},
		[setSwapTarget],
	);

	const handleConfirmSub = useCallback(() => {
		if (!swapSource || !swapTarget || subsMade >= 3) return;
		const srcPlayer = mySquad.find((p) => p.id === swapSource);
		const tgtPlayer = mySquad.find((p) => p.id === swapTarget);
		if (
			srcPlayer &&
			tgtPlayer &&
			(srcPlayer.position === "GR") !== (tgtPlayer.position === "GR")
		)
			return;
		setTactic((prevTactic) => {
			const newPositions = { ...prevTactic.positions };
			newPositions[swapSource] = "Suplente";
			newPositions[swapTarget] = "Titular";
			const next = { ...prevTactic, positions: newPositions };
			socket.emit("setTactic", next);
			return next;
		});
		setSubbedOut((prev) => [...prev, swapSource]);
		setConfirmedSubs((prev) => [...prev, { out: swapSource, in: swapTarget }]);
		setSubsMade((n) => n + 1);
		setSwapSource(null);
		setSwapTarget(null);
	}, [
		swapSource,
		swapTarget,
		subsMade,
		mySquad,
		setTactic,
		setSubbedOut,
		setConfirmedSubs,
		setSubsMade,
		setSwapSource,
		setSwapTarget,
	]);

	const handleResetSub = useCallback(() => {
		setSwapSource(null);
		setSwapTarget(null);
	}, [setSwapSource, setSwapTarget]);

	const handleResetAllSubs = useCallback(() => {
		setTactic((prevTactic) => {
			const newPositions = { ...prevTactic.positions };
			confirmedSubs.forEach(({ out: outId, in: inId }) => {
				newPositions[outId] = "Titular";
				newPositions[inId] = "Suplente";
			});
			const next = { ...prevTactic, positions: newPositions };
			socket.emit("setTactic", next);
			return next;
		});
		setSubbedOut([]);
		setConfirmedSubs([]);
		setSubsMade(0);
		setSwapSource(null);
		setSwapTarget(null);
	}, [
		confirmedSubs,
		setTactic,
		setSubbedOut,
		setConfirmedSubs,
		setSubsMade,
		setSwapSource,
		setSwapTarget,
	]);

	const handleSetPlayerStatus = useCallback(
		(playerId, status) => {
			setTactic((prev) => {
				const newPositions = { ...prev.positions };
				const player = mySquad.find((p) => p.id === playerId);
				if (player?.isJunior) return prev;

				if (status === "Titular" || status === "Suplente") {
					if (player && !isPlayerAvailable(player, matchweekCount + 1))
						return prev;
				}

				if (status === "Titular") {
					const currentTitulares = Object.entries(newPositions).filter(
						([id, s]) => s === "Titular" && Number(id) !== playerId,
					).length;
					if (currentTitulares >= 11) return prev;
				}

				if (status === "Suplente") {
					const currentSubs = Object.entries(newPositions).filter(
						([id, s]) => s === "Suplente" && Number(id) !== playerId,
					).length;
					if (currentSubs >= 5) return prev;
				}

				if (status === "Titular") {
					const pl = mySquad.find((p) => p.id === playerId);
					if (pl?.position === "GR") {
						mySquad.forEach((p) => {
							if (
								p.id !== playerId &&
								p.position === "GR" &&
								newPositions[p.id] === "Titular"
							) {
								newPositions[p.id] = "Suplente";
							}
						});
					}
				}

				newPositions[playerId] = status;
				const next = { ...prev, positions: newPositions };
				socket.emit("setTactic", next);
				return next;
			});
			setOpenStatusPickerId(null);
		},
		[mySquad, matchweekCount, setTactic],
	);

	const handleSwapPlayerStatuses = useCallback(
		(draggedId, targetId) => {
			setTactic((prev) => {
				const newPositions = { ...prev.positions };
				const draggedStatus = newPositions[draggedId] ?? "Excluído";
				const targetStatus = newPositions[targetId] ?? "Excluído";

				const draggedPlayer = mySquad.find((p) => p.id === draggedId);
				const targetPlayer = mySquad.find((p) => p.id === targetId);
				if (draggedPlayer?.isJunior || targetPlayer?.isJunior) return prev;

				// Só bloqueia trocas GR ↔ jogador de campo (integridade da baliza)
				if (draggedStatus === "Titular" || targetStatus === "Titular") {
					if (!draggedPlayer || !targetPlayer) return prev;
					const draggedIsGR = draggedPlayer.position === "GR";
					const targetIsGR = targetPlayer.position === "GR";
					if (draggedIsGR !== targetIsGR) return prev;
				}
				if (targetStatus === "Titular" || targetStatus === "Suplente") {
					if (
						draggedPlayer &&
						!isPlayerAvailable(draggedPlayer, matchweekCount + 1)
					)
						return prev;
				}
				if (draggedStatus === "Titular" || draggedStatus === "Suplente") {
					if (
						targetPlayer &&
						!isPlayerAvailable(targetPlayer, matchweekCount + 1)
					)
						return prev;
				}
				newPositions[draggedId] = targetStatus;
				newPositions[targetId] = draggedStatus;
				const next = { ...prev, positions: newPositions };
				socket.emit("setTactic", next);
				return next;
			});
			setDragOverPlayerId(null);
			setDragPlayerId(null);
			dragPlayerStatusRef.current = null;
		},
		[mySquad, matchweekCount, setTactic],
	);

	/**
	 * Muda o status de um jogador para a secção-alvo sem trocar com ninguém.
	 * Usado quando se arrasta para uma área vazia da lista (zona de drop).
	 */
	const handleDropToSection = useCallback(
		(playerId, targetSection) => {
			if (!playerId) return;
			setTactic((prev) => {
				const newPositions = { ...prev.positions };
				const player = mySquad.find((p) => p.id === playerId);
				if (!player || player.isJunior) return prev;

				const currentSection = newPositions[playerId] ?? "Excluído";
				if (currentSection === targetSection) return prev;

				// Verificar disponibilidade
				if (targetSection === "Titular" || targetSection === "Suplente") {
					if (!isPlayerAvailable(player, matchweekCount + 1)) return prev;
				}

				// Verificar capacidade
				if (targetSection === "Titular") {
					const count = Object.entries(newPositions).filter(
						([id, s]) => s === "Titular" && Number(id) !== playerId,
					).length;
					if (count >= 11) return prev;
					// Regra do GR: só um GR no 11; deslocar o existente para suplentes
					if (player.position === "GR") {
						Object.entries(newPositions).forEach(([id, s]) => {
							const p = mySquad.find((x) => x.id === Number(id));
							if (
								p &&
								p.id !== playerId &&
								p.position === "GR" &&
								s === "Titular"
							) {
								newPositions[id] = "Suplente";
							}
						});
					}
				}
				if (targetSection === "Suplente") {
					const count = Object.entries(newPositions).filter(
						([id, s]) => s === "Suplente" && Number(id) !== playerId,
					).length;
					if (count >= 5) return prev;
				}

				newPositions[playerId] = targetSection;
				const next = { ...prev, positions: newPositions };
				socket.emit("setTactic", next);
				return next;
			});
			setDragOverPlayerId(null);
			setDragPlayerId(null);
			dragPlayerStatusRef.current = null;
		},
		[mySquad, matchweekCount, setTactic],
	);

	const handleDragStart = useCallback((e) => {
		const playerId = Number(e.currentTarget.dataset.playerId);
		if (Number.isNaN(playerId)) return;
		setDragPlayerId(playerId);
		dragPlayerStatusRef.current = e.currentTarget.dataset.playerStatus;
	}, []);

	const handleReady = useCallback(() => {
		const isReady = players.find((p) => p.name === me?.name)?.ready;
		socket.emit("setReady", !isReady);
	}, [players, me]);

	const handleHalftimeReady = useCallback(() => {
		socket.emit("setReady", true);
	}, []);

	// ── Context value ────────────────────────────────────────────────────────
	const value = {
		// State (from useGame)
		tactic,
		setTactic,
		tacticFamiliarity,
		setTacticFamiliarity,
		allTacticFamiliarity,
		setAllTacticFamiliarity,
		swapSource,
		setSwapSource,
		swapTarget,
		setSwapTarget,
		subbedOut,
		setSubbedOut,
		confirmedSubs,
		setConfirmedSubs,
		subsMade,
		setSubsMade,
		// UI state (owned by this context)
		openStatusPickerId,
		setOpenStatusPickerId,
		dragOverPlayerId,
		setDragOverPlayerId,
		dragPlayerId,
		setDragPlayerId,
		dragOverSection,
		setDragOverSection,
		dragPlayerStatusRef,
		// Computed
		annotatedSquad,
		titulares,
		formationAvailabilityByValue,
		isLineupComplete,
		nextMatchOpponent,
		nextMatchReferee,
		// Handlers
		updateTactic,
		handleClearTactic,
		handleAutoPick,
		handleSelectOut,
		handleSelectIn,
		handleConfirmSub,
		handleResetSub,
		handleResetAllSubs,
		handleSetPlayerStatus,
		handleSwapPlayerStatuses,
		handleDropToSection,
		handleDragStart,
		handleReady,
		handleHalftimeReady,
		// Read-only game props (for TacticsView)
		mySquad,
		matchweekCount,
		teamInfo,
		nextMatchSummary,
		players,
		me,
		showHalftimePanel,
		isPlayingMatch,
		disconnected,
		isCupMatch,
	};

	return (
		<TacticsContext.Provider value={value}>{children}</TacticsContext.Provider>
	);
}

/**
 * Consumes the TacticsContext. Must be used inside a <TacticsProvider>.
 * Co-exported in the same file as the Provider (single-file context pattern).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTactics() {
	const ctx = useContext(TacticsContext);
	if (!ctx)
		throw new Error("useTactics must be used within a <TacticsProvider>");
	return ctx;
}
