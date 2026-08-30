import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	startTransition,
} from "react";
import { socket } from "../socket";
import {
  DEFAULT_TACTIC,
  LOAN_INTEREST_RATE,
  TRANSFER_LISTED_PRICE_MULT,
  SEASON_CALENDAR,
} from "../constants/index.js";
import { isPlayerAvailable } from "../utils/playerHelpers.js";
import {
	computeNavigateTabAction,
	computeOpenSquadHistoryAction,
	computePopStateAction,
} from "../utils/squadNavigation.js";
import {
	playNotification,
	playGoalSound,
	playVarSound,
} from "../utils/audio.js";
import { useSocketListeners } from "../hooks/useSocketListeners.js";

const GameContext = createContext(null);

/**
 * Provider that owns ALL game state except auth.
 * Receives auth bridge props from App.jsx so useSocketListeners
 * can update me / joining / etc.
 */
export function GameProvider({
	// Auth bridge (owned by App.jsx, consumed by socket listeners)
	me,
	setMe,
	setRoomCode,
	setJoining,
	setJoinError,
	// Auth refs (needed by socket listeners for closures)
	meRef,
	roomCodeRef,
	joinTimerRef,
	backendUrl,
	children,
}) {
	// ── Game state ─────────────────────────────────────────────────────────
	const [teams, setTeams] = useState([]);
	const [prevStandings, setPrevStandings] = useState([]);
	const [teamForms, setTeamForms] = useState({});
	const [players, setPlayers] = useState([]);
	const [mySquad, setMySquad] = useState([]);
	const [disconnected, setDisconnected] = useState(false);
	const [sessionDisplaced, setSessionDisplaced] = useState(false);
	const [toasts, setToasts] = useState([]);
	const [lockedCoaches, setLockedCoaches] = useState([]);
	const [awaitingCoaches, setAwaitingCoaches] = useState([]);
	const [roomCreator, setRoomCreator] = useState("");
	const [matchResults, setMatchResults] = useState(null);
	const [allMatchResults, setAllMatchResults] = useState({});
	const [matchweekCount, setMatchweekCount] = useState(0);
	const [season, setSeason] = useState(1);
	// Fica true entre o fim de jogo (matchResults) e a chegada dos dados
	// actualizados (standingsUpdated). Usado para mostrar o indicador
	// "A atualizar classificação…" sem bloquear o ecrã.
	const [standingsStale, setStandingsStale] = useState(false);
	const [seasonYear, setSeasonYear] = useState(2026);
	// Persiste a tab activa em sessionStorage para sobreviver a refresh/reconexão
	// mobile sem poluir o history do browser (o plantel tem o seu próprio back-stack).
	const [activeTab, setActiveTab] = useState(() => {
		try {
			const saved = sessionStorage.getItem("cashball_tab");
			if (saved && !["club", "standings", "players", "finances", "tactic", "live", "calendar", "market", "cup", "bracket", "user_settings", "squad"].includes(saved)) return "club";
			return saved || "club";
		} catch {
			return "club";
		}
	});
	const [topScorers, setTopScorers] = useState([]);
	const [marketPairs, setMarketPairs] = useState([]);
	const [marketPositionFilter, setMarketPositionFilter] = useState("all");
	const [marketSort, setMarketSort] = useState("quality-desc");
	const [auctionBid, setAuctionBid] = useState("");
	const [selectedAuctionPlayer, setSelectedAuctionPlayer] = useState(null);
	const [isAuctionExpanded, setIsAuctionExpanded] = useState(false);
	const [myAuctionBid, setMyAuctionBid] = useState(null);
	const [auctionResult, setAuctionResult] = useState(null);
	const [activeAuctions, setActiveAuctions] = useState([]);
	const [nextMatchSummary, setNextMatchSummary] = useState(null);
	const [nextMatchSummaryLoading, setNextMatchSummaryLoading] = useState(false);
	const [refereePopup, setRefereePopup] = useState(null);
	const [gameDialog, setGameDialog] = useState(null);
	const [cupDraw, setCupDraw] = useState(null);
	const [showCupDrawPopup, setShowCupDrawPopup] = useState(false);
	const [cupDrawRevealIdx, setCupDrawRevealIdx] = useState(0);
	const [cupRoundResults, setCupRoundResults] = useState(null);

	const [cupResultsFilter, setCupResultsFilter] = useState("all");
	const [cupPenaltyPopup, setCupPenaltyPopup] = useState(null);
	const [cupPenaltyKickIdx, setCupPenaltyKickIdx] = useState(0);
	const [pendingCupRoundResults, setPendingCupRoundResults] = useState(null);
	const [welcomeModal, setWelcomeModal] = useState(null);
	const [jobOfferModal, setJobOfferModal] = useState(null);
	const [dismissalModal, setDismissalModal] = useState(null);
	const [coachMarketReport, setCoachMarketReport] = useState(null);
	const [seasonEndModal, setSeasonEndModal] = useState(null);
	// ── Admin panel ──
	const [adminPanelOpen, setAdminPanelOpen] = useState(false);
	const [adminUsers, setAdminUsers] = useState([]);
	// ── User dropdown ──
	const [userDropdownOpen, setUserDropdownOpen] = useState(false);
	const [isCupMatch, setIsCupMatch] = useState(false);
	const [calendarIndex, setCalendarIndex] = useState(0);
	const [cupPreMatch, setCupPreMatch] = useState(false);
	// Ronda da Taça em curso (1..5) — fonte: payload do servidor
	// (cupPreMatch / cupHalfTimeResults / matchSegmentStart / cupRoundResults /
	// matchReplay). O nome ("Oitavos de final", "Final", ...) é derivado no
	// client via SEASON_CALENDAR, evitando duplicar a lista no backend.
	const [currentCupRound, setCurrentCupRound] = useState(null);
	const cupMatchRoundName =
		SEASON_CALENDAR.find((e) => e.type === "cup" && e.round === currentCupRound)
			?.roundName || null;
	const [cupExtraTimeBadge, setCupExtraTimeBadge] = useState(false);
	const [isCupExtraTime, setIsCupExtraTime] = useState(false);
	const [cupActiveTeamIds, setCupActiveTeamIds] = useState([]);
	const [palmares, setPalmares] = useState({ trophies: [], allChampions: [] });
	const [palmaresTeamId, setPalmaresTeamId] = useState(null);
	const [clubHistory, setClubHistory] = useState(null);
	const [clubHistoryTeamId, setClubHistoryTeamId] = useState(null);
	const [clubNews, setClubNews] = useState([]);
	const [playerHistoryModal, setPlayerHistoryModal] = useState(null);
	const [financeData, setFinanceData] = useState(null);
	const [showTransferSales, setShowTransferSales] = useState(false);
	const [showTransferPurchases, setShowTransferPurchases] = useState(false);
	const [showTicketBreakdown, setShowTicketBreakdown] = useState(false);
	const [selectedTeam, setSelectedTeam] = useState(null);
	const [selectedTeamSquad, setSelectedTeamSquad] = useState([]);
	const [selectedTeamLoading, setSelectedTeamLoading] = useState(false);
	const [transferProposalModal, setTransferProposalModal] = useState(null);
	const [signingCelebration, setSigningCelebration] = useState(null);
	const [postMatchMood, setPostMatchMood] = useState(null);
	const [playerSearchData, setPlayerSearchData] = useState({
		results: [],
		total: 0,
		truncated: false,
	});
	const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
	const [cupBracketData, setCupBracketData] = useState(null);
	const [calendarData, setCalendarData] = useState(null);
	const [calFilter, setCalFilter] = useState("all");
	const [tactic, setTactic] = useState(DEFAULT_TACTIC);
	const [tacticFamiliarity, setTacticFamiliarity] = useState(null);
	const [allTacticFamiliarity, setAllTacticFamiliarity] = useState({});
	const [liveMinute, setLiveMinute] = useState(90);
	const [isPlayingMatch, setIsPlayingMatch] = useState(false);
	const [isLiveSimulation, setIsLiveSimulation] = useState(false);
	const [showHalftimePanel, setShowHalftimePanel] = useState(false);
	const [matchAction, setMatchAction] = useState(null);
	const [isMatchActionPending, setIsMatchActionPending] = useState(false);
	const [injuryCountdown, setInjuryCountdown] = useState(null);
	const [subsMade, setSubsMade] = useState(0);
	const [goalFlashRef, setGoalFlashRef] = useState({});
	const [substitutionPause, setSubstitutionPause] = useState(null);
	const [renderError, setRenderError] = useState(null);
	const [swapSource, setSwapSource] = useState(null);
	const [swapTarget, setSwapTarget] = useState(null);
	const [subbedOut, setSubbedOut] = useState([]);
	const [confirmedSubs, setConfirmedSubs] = useState([]);
	const [penaltySuspense, setPenaltySuspense] = useState(null);
	const [showMatchDetail, setShowMatchDetail] = useState(false);
	const [matchDetailFixture, setMatchDetailFixture] = useState(null);
	const [roomHubOpen, setRoomHubOpen] = useState(false);
	const [roomMessages, setRoomMessages] = useState([]);
	const [globalMessages, setGlobalMessages] = useState([]);
	const [globalPlayers, setGlobalPlayers] = useState([]);
	const [unreadRoom, setUnreadRoom] = useState(0);
	const [unreadGlobal, setUnreadGlobal] = useState(0);
	const [chatInput, setChatInput] = useState("");
	const [mobileSubMenu, setMobileSubMenu] = useState(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
		try {
			return localStorage.getItem("sidebarCollapsed") === "true";
		} catch {
			return false;
		}
	});
	const [avatarSeed, setAvatarSeed] = useState("");

	// ── Refs ────────────────────────────────────────────────────────────────
	const injuryCountdownRef = useRef(null);
	const chatMessagesRef = useRef(null);
	const roomHubRef = useRef(null);
	const chatOpenRef = useRef(false);
	const activeChatTabRef = useRef("room");
	const sidebarUserPrefRef = useRef(sidebarCollapsed);
	const isPlayingMatchRef = useRef(false);
	const showHalftimePanelRef = useRef(false);
	const matchActionRef = useRef(null);
	const isCupDrawRef = useRef(false);
	const teamsRef = useRef([]);
	const playersRef = useRef([]);
	const isLiveSimulationRef = useRef(false);
	const isCupExtraTimeRef = useRef(false);
	const pendingDismissalRef = useRef(null);
	const matchReplayActiveRef = useRef(false);
	const liveMinuteRef = useRef(0);
	const selectedTeamRef = useRef(null);
	const ackedPostMatchKeyRef = useRef(null);
	const activeTabRef = useRef("club");
	const teamSquadReturnTabRef = useRef("club");
	const marketPairsRef = useRef([]);
	const mySquadRef = useRef([]);
	const tacticRef = useRef({ positions: {} });
	const goalFlashRefSetter = useRef(setGoalFlashRef);

	// ── Helpers ──────────────────────────────────────────────────────────────
	const addToast = useCallback((msg) => {
		const id = Date.now();
		setToasts((prev) => [...prev, { id, msg }]);
		setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
	}, []);

	const dismissToast = useCallback((id) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	// ── Avatar seed fetch ───────────────────────────────────────────────────
	useEffect(() => {
		if (!me?.name) return;
		fetch(`${backendUrl}/auth/avatar-seed?name=${encodeURIComponent(me.name)}`)
			.then((r) => r.json())
			.then((data) => {
				if (data?.seed) setAvatarSeed(data.seed);
			})
			.catch(() => {});
	}, [me?.name, backendUrl]);

	// ── Ref sync effects ─────────────────────────────────────────────────────
	useEffect(() => {
		isPlayingMatchRef.current = isPlayingMatch;
		if (isPlayingMatch) {
			startTransition(() => {
				setSelectedAuctionPlayer(null);
				setAuctionBid("");
				setMyAuctionBid(null);
				setAuctionResult(null);
				setShowCupDrawPopup(false);
			});
		}
	}, [isPlayingMatch]);

	useEffect(() => {
		isLiveSimulationRef.current = isLiveSimulation;
	}, [isLiveSimulation]);
	useEffect(() => {
		showHalftimePanelRef.current = showHalftimePanel;
	}, [showHalftimePanel]);
	useEffect(() => {
		matchActionRef.current = matchAction;
	}, [matchAction]);
	useEffect(() => {
		isCupExtraTimeRef.current = isCupExtraTime;
	}, [isCupExtraTime]);
	useEffect(() => {
		liveMinuteRef.current = liveMinute;
	}, [liveMinute]);
	useEffect(() => {
		teamsRef.current = teams;
	}, [teams]);
	useEffect(() => {
		playersRef.current = players;
	}, [players]);
	useEffect(() => {
		mySquadRef.current = mySquad;
	}, [mySquad]);
	useEffect(() => {
		tacticRef.current = tactic;
	}, [tactic]);
	useEffect(() => {
		selectedTeamRef.current = selectedTeam;
	}, [selectedTeam]);
	useEffect(() => {
		activeTabRef.current = activeTab;
		try {
			sessionStorage.setItem("cashball_tab", activeTab);
		} catch {
			// sessionStorage indisponível (modo privado/limite) — ignora
		}
	}, [activeTab]);
	useEffect(() => {
		marketPairsRef.current = marketPairs;
	}, [marketPairs]);
	useEffect(() => {
		meRef.current = me;
	}, [me, meRef]);
	useEffect(() => {
		roomCodeRef.current = me?.roomCode || "";
	}, [me?.roomCode, roomCodeRef]);

	// ── Me → players sync (sets teamId after join) ─────────────────────────
	useEffect(() => {
		if (me && !me.teamId && players.length > 0) {
			const p = players.find((x) => x.name === me.name);
			if (p && p.teamId) {
				if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
				startTransition(() => {
					setMe((prev) => (prev ? { ...prev, teamId: p.teamId } : prev));
					setJoining(false);
					setJoinError("");
				});
			}
		}
	}, [players, me, setMe, setJoining, setJoinError, joinTimerRef]);

	// ── Auto-collapse sidebar during Live ───────────────────────────────────
	const isMatchInProgress = useMemo(
		() => isPlayingMatch || showHalftimePanel || !!matchAction,
		[isPlayingMatch, showHalftimePanel, matchAction],
	);

	useEffect(() => {
		if (isMatchInProgress) {
			sidebarUserPrefRef.current = sidebarCollapsed;
			startTransition(() => setSidebarCollapsed(true));
		} else {
			startTransition(() => setSidebarCollapsed(sidebarUserPrefRef.current));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isMatchInProgress]);

	// ── Match clock effect ──────────────────────────────────────────────────
	useEffect(() => {
		if (isPlayingMatch) {
			if (isMatchActionPending) return;
			if (isLiveSimulation) {
				if (liveMinute >= 120 && isCupExtraTime) {
					const timer = setTimeout(() => {
						setIsPlayingMatch(false);
						setIsLiveSimulation(false);
						setIsCupExtraTime(false);
						socket.emit("cupExtraTimeDone");
					}, 2000);
					return () => clearTimeout(timer);
				}
				if (liveMinute >= 90 && !isCupExtraTime) {
					const timer = setTimeout(() => {
						setIsPlayingMatch(false);
						setIsLiveSimulation(false);
						if (isCupMatch) {
							socket.emit("cupSecondHalfDone");
						} else {
							socket.emit("leagueAnimDone");
							setActiveTab("standings");
						}
					}, 3000);
					return () => clearTimeout(timer);
				}
				return;
			}
			const isSecondHalfReplay = !showHalftimePanel;
			if (
				liveMinute < 45 ||
				(liveMinute >= 45 && liveMinute < 90 && isSecondHalfReplay) ||
				(isCupExtraTime && liveMinute >= 90 && liveMinute < 120)
			) {
				const timer = setTimeout(() => {
					setLiveMinute((m) => m + 1);
				}, 1000);
				return () => clearTimeout(timer);
			} else if (liveMinute === 45 && !isSecondHalfReplay && !showHalftimePanel) {
				startTransition(() => setIsPlayingMatch(false));
			} else if (liveMinute >= 120 && isCupExtraTime) {
				const timer = setTimeout(() => {
					setIsPlayingMatch(false);
					setIsCupExtraTime(false);
					socket.emit("cupExtraTimeDone");
				}, 2000);
				return () => clearTimeout(timer);
			} else if (liveMinute >= 90 && !isCupExtraTime) {
				const timer = setTimeout(() => {
					setIsPlayingMatch(false);
					if (isCupMatch) {
						socket.emit("cupSecondHalfDone");
					} else {
						socket.emit("leagueAnimDone");
						setActiveTab("standings");
					}
				}, 3000);
				return () => clearTimeout(timer);
			}
		}
	}, [
		isPlayingMatch,
		liveMinute,
		matchResults,
		showHalftimePanel,
		isCupMatch,
		isCupExtraTime,
		isMatchActionPending,
		isLiveSimulation,
	]);

	// ── Standings staleness safety net ─────────────────────────────────────
	// Se o servidor nunca emitir standingsUpdated (erro/rede lenta), não
	// deixar o indicador "A atualizar…" preso para sempre.
	useEffect(() => {
		if (!standingsStale) return;
		const t = setTimeout(() => setStandingsStale(false), 10000);
		return () => clearTimeout(t);
	}, [standingsStale]);

	// ── Goal flash per-minute effect ───────────────────────────────────────
	useLayoutEffect(() => {
		if (!isPlayingMatch || !matchResults?.results || liveMinute < 1) return;
		matchResults.results.forEach((match) => {
			const events = (match.events || []).filter((e) => e.minute === liveMinute);
			if (!events.length) return;
			events.forEach((e) => {
				if (["goal", "penalty_goal", "var_goal_pending"].includes(e.type)) {
					setGoalFlashRef((prev) => {
						const key2 = `${match.homeTeamId}_${match.awayTeamId}_${e.team}`;
						return { ...prev, [key2]: Date.now() };
					});
				}
			});
			const isMyMatch =
				me?.teamId != null &&
				(match.homeTeamId === me.teamId || match.awayTeamId === me.teamId);
			const isHumanMatch = players.some(
				(p) => p.teamId === match.homeTeamId || p.teamId === match.awayTeamId,
			);
			if (isMyMatch || isHumanMatch) {
				const hasGoal = events.some((e) =>
					["goal", "penalty_goal", "var_goal_pending"].includes(e.type),
				);
				const hasVar = events.some((e) => e.type === "var_disallowed");
				const hasOtherEvent = events.some((e) =>
					["red", "injury"].includes(e.type),
				);
				if (hasGoal) playGoalSound();
				else if (hasVar) playVarSound();
				else if (hasOtherEvent) playNotification();
			}
		});
	}, [liveMinute, matchResults, me?.teamId, players]); // eslint-disable-line react-hooks/exhaustive-deps

	// ── Post-match mood modal (Vitória / Adeptos descontentes / Empate) ─────
	// Liga → aparece ao chegar ao tab Classificação. Taça → tab Taça/Bracket.
	// Sem timeout: requer clique do coach para avançar. Mostra uma vez por
	// jornada/ronda (guard `ackedPostMatchKeyRef`).
	useEffect(() => {
		const myId = me?.teamId;
		if (myId == null) return;

		const buildMood = (outcome, oppId, myGoals, oppGoals, source, roundLabel, key) => ({
			outcome,
			opponentTeamId: oppId,
			opponentName:
				teams.find((t) => Number(t.id) === Number(oppId))?.name || "—",
			myGoals,
			oppGoals,
			source,
			roundLabel,
			key,
		});

		// Liga
		if (activeTab === "standings" && matchResults?.results) {
			const myMatch = matchResults.results.find(
				(r) =>
					Number(r.homeTeamId) === Number(myId) ||
					Number(r.awayTeamId) === Number(myId),
			);
			if (myMatch) {
				const isHome = Number(myMatch.homeTeamId) === Number(myId);
				// Liga envia fixtures com finalHomeGoals/finalAwayGoals; a Taça usa
				// homeGoals/awayGoals. Aceitar ambos os formatos (ver LeagueStandings).
				const myGoals = isHome
					? (myMatch.homeGoals ?? myMatch.finalHomeGoals ?? 0)
					: (myMatch.awayGoals ?? myMatch.finalAwayGoals ?? 0);
				const oppGoals = isHome
					? (myMatch.awayGoals ?? myMatch.finalAwayGoals ?? 0)
					: (myMatch.homeGoals ?? myMatch.finalHomeGoals ?? 0);
				const oppId = isHome ? myMatch.awayTeamId : myMatch.homeTeamId;
				const outcome =
					myGoals > oppGoals ? "win" : myGoals < oppGoals ? "loss" : "draw";
				const key = `league:${matchResults.matchweek}`;
				if (ackedPostMatchKeyRef.current !== key) {
					ackedPostMatchKeyRef.current = key;
					setPostMatchMood(
						buildMood(
							outcome,
							oppId,
							myGoals,
							oppGoals,
							"league",
							`Jornada ${matchResults.matchweek}`,
							key,
						),
					);
				}
			}
		}

		// Taça
		if (
			(activeTab === "cup" || activeTab === "bracket") &&
			cupRoundResults?.results
		) {
			const myMatch = cupRoundResults.results.find(
				(r) =>
					Number(r.homeTeamId) === Number(myId) ||
					Number(r.awayTeamId) === Number(myId),
			);
			if (myMatch) {
				const isHome = Number(myMatch.homeTeamId) === Number(myId);
				const myGoals = isHome ? myMatch.homeGoals : myMatch.awayGoals;
				const oppGoals = isHome ? myMatch.awayGoals : myMatch.homeGoals;
				const oppId = isHome ? myMatch.awayTeamId : myMatch.homeTeamId;
				const outcome =
					Number(myMatch.winnerId) === Number(myId) ? "win" : "loss";
				const key = `cup:${cupRoundResults.round}`;
				if (ackedPostMatchKeyRef.current !== key) {
					ackedPostMatchKeyRef.current = key;
					setPostMatchMood(
						buildMood(
							outcome,
							oppId,
							myGoals,
							oppGoals,
							"cup",
							cupRoundResults.roundName || `Taça R${cupRoundResults.round}`,
							key,
						),
					);
				}
			}
		}
	}, [activeTab, matchResults, cupRoundResults, me?.teamId, teams]);

	// ── Cup draw reveal animation ───────────────────────────────────────────
	useEffect(() => {
		if (!showCupDrawPopup || !cupDraw) return;
		const totalTeams = (cupDraw.fixtures || []).length * 2;
		if (cupDrawRevealIdx >= totalTeams) return;
		const delay = cupDraw.humanInCup ? 700 : 200;
		const timer = setTimeout(() => setCupDrawRevealIdx((i) => i + 1), delay);
		return () => clearTimeout(timer);
	}, [showCupDrawPopup, cupDraw, cupDrawRevealIdx]);

	useEffect(() => {
		if (!showCupDrawPopup || !cupDraw || cupDraw.humanInCup) return;
		startTransition(() => {
			setShowCupDrawPopup(false);
			socket.emit("cupDrawAcknowledged");
		});
	}, [showCupDrawPopup, cupDraw]);

	// ── Penalty shootout reveal ─────────────────────────────────────────────
	useEffect(() => {
		if (!cupPenaltyPopup) return;
		const total = (cupPenaltyPopup.kicks || []).length;
		if (cupPenaltyKickIdx >= total) return;
		const timer = setTimeout(() => setCupPenaltyKickIdx((i) => i + 1), 3500);
		return () => clearTimeout(timer);
	}, [cupPenaltyPopup, cupPenaltyKickIdx]);

	useEffect(() => {
		if (cupPenaltyPopup !== null) return;
		if (!pendingCupRoundResults) return;
		startTransition(() => {
			setPendingCupRoundResults(null);
			setActiveTab("cup");
			setIsCupMatch(false);
			setCupPreMatch(false);
			setIsCupExtraTime(false);
			setCupExtraTimeBadge(false);
			setIsPlayingMatch(false);
			setMatchResults(null);
		});
	}, [cupPenaltyPopup, pendingCupRoundResults]);

	// ── Tab-driven data fetches ─────────────────────────────────────────────
	useEffect(() => {
		if ((activeTab !== "club" && activeTab !== "standings") || !me?.teamId)
			return;
		socket.emit("requestPalmares", { teamId: me.teamId });
		if (activeTab === "club") {
			socket.emit("requestClubNews", { teamId: me.teamId });
		}
	}, [activeTab, me?.teamId]);

	useEffect(() => {
		if (activeTab !== "finances" || !me?.teamId) return;
		socket.emit("requestFinanceData", { teamId: me.teamId });
	}, [activeTab, me?.teamId, matchweekCount]);

	useEffect(() => {
		if (activeTab !== "tactic" || !me?.teamId) return;
		startTransition(() => setNextMatchSummaryLoading(true));
		socket.emit("requestNextMatchSummary", { teamId: me.teamId });
	}, [activeTab, me?.teamId, matchweekCount, calendarIndex]);

	useEffect(() => {
		if (!matchweekCount) return;
		startTransition(() => {
			setActiveAuctions((prev) => prev.filter((a) => !a.closed));
		});
	}, [matchweekCount]);

	useEffect(() => {
		if (activeTab !== "calendario") return;
		socket.emit("requestCalendar");
	}, [activeTab, matchweekCount]);

	// ── Chat / RoomHub effects ──────────────────────────────────────────────
	useEffect(() => {
		if (chatMessagesRef.current) {
			chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
		}
	}, [roomMessages, globalMessages, roomHubOpen]);

	useEffect(() => {
		if (!roomHubOpen) return;
		startTransition(() => {
			setUnreadRoom(0);
			setUnreadGlobal(0);
		});
	}, [roomHubOpen]);

	useEffect(() => {
		if (!roomHubOpen) return;
		const close = (e) => {
			if (roomHubRef.current && !roomHubRef.current.contains(e.target)) {
				setRoomHubOpen(false);
			}
		};
		document.addEventListener("mouseup", close);
		return () => document.removeEventListener("mouseup", close);
	}, [roomHubOpen]);

	// ── Global error handler ───────────────────────────────────────────────
	useEffect(() => {
		const syncHandler = (event) => {
			console.error(
				"[GLOBAL ERROR]",
				event.error || event.reason || event.message,
			);
			const error =
				event.error || event.reason || new Error(event.message || "Unknown error");
			setRenderError(error);
			event.preventDefault();
		};
		const asyncHandler = (event) => {
			console.error("[UNHANDLED REJECTION]", event.reason);
			const error = event.reason || new Error("Unhandled promise rejection");
			setRenderError(error);
			event.preventDefault();
		};
		window.addEventListener("error", syncHandler);
		window.addEventListener("unhandledrejection", asyncHandler);
		return () => {
			window.removeEventListener("error", syncHandler);
			window.removeEventListener("unhandledrejection", asyncHandler);
		};
	}, []);

	// ── Socket listeners ────────────────────────────────────────────────────
	useSocketListeners(
		{
			setCalendarData,
			setTeams,
			setPrevStandings,
			setTeamForms,
			setPlayers,
			setMySquad,
			setMarketPairs,
			setSelectedAuctionPlayer,
			setIsAuctionExpanded,
			setAuctionBid,
			setMyAuctionBid,
			setAuctionResult,
			setActiveAuctions,
			setTopScorers,
			setSeasonEndModal,
			setSeasonYear,
			setMatchweekCount,
			setSeason,
			setSelectedTeamSquad,
			setSelectedTeamLoading,
			setNextMatchSummary,
			setNextMatchSummaryLoading,
			setCupDraw,
			setCupDrawRevealIdx,
			setShowCupDrawPopup,
			setCupRoundResults,
			setPendingCupRoundResults,
			setMatchResults,
			setAllMatchResults,
			setLiveMinute,
			setSubsMade,
			setSubbedOut,
			setConfirmedSubs,
			setSwapSource,
			setSwapTarget,
			setIsCupMatch,
			setCalendarIndex,
			setCupPreMatch,
			setCurrentCupRound,
			setCupExtraTimeBadge,
			setCupActiveTeamIds,
			setActiveTab,
			setIsPlayingMatch,
			setIsLiveSimulation,
			setShowHalftimePanel,
			setIsCupExtraTime,
			setTactic,
			setIsMatchActionPending,
			setMatchAction,
			setPenaltySuspense,
			setInjuryCountdown,
			setCupPenaltyPopup,
			setCupPenaltyKickIdx,
			setCupBracketData,
			setPalmares,
			setPalmaresTeamId,
			setClubHistory,
			setClubHistoryTeamId,
			setClubNews,
			setPlayerHistoryModal,
			setFinanceData,
			setLockedCoaches,
			setAwaitingCoaches,
			setRoomCreator,
			setRefereePopup,
			setGameDialog,
			setWelcomeModal,
			setJobOfferModal,
			setDismissalModal,
			setCoachMarketReport,
			setAdminUsers,
			setTransferProposalModal,
			setSigningCelebration,
			setPlayerSearchData,
			setPlayerSearchLoading,
			setMe,
			setRoomCode,
			setJoinError,
			setJoining,
			setDisconnected,
			setSessionDisplaced,
			setRoomMessages,
			setGlobalMessages,
			setGlobalPlayers,
			setUnreadRoom,
			setUnreadGlobal,
			addToast,
			setSubstitutionPause,
			setTacticFamiliarity,
			setAllTacticFamiliarity,
			setStandingsStale,
		},
		{
			isPlayingMatchRef,
			showHalftimePanelRef,
			matchActionRef,
			isCupDrawRef,
			meRef,
			roomCodeRef,
			teamsRef,
			mySquadRef,
			tacticRef,
			liveMinuteRef,
			isLiveSimulationRef,
			isCupExtraTimeRef,
			pendingDismissalRef,
			matchReplayActiveRef,
			selectedTeamRef,
			marketPairsRef,
			injuryCountdownRef,
			goalFlashRef,
			setGoalFlashRef: (fn) => {
				goalFlashRefSetter.current = fn;
				setGoalFlashRef(fn);
			},
			joinTimerRef,
			players,
			playersRef,
			chatOpenRef,
			activeChatTabRef,
		},
	);

	// ── Handlers ─────────────────────────────────────────────────────────────
	const handleHalftimeReady = useCallback(() => {
		socket.emit("setReady", true);
	}, []);

	const closeSquadState = useCallback(() => {
		setSelectedTeam(null);
		setSelectedTeamSquad([]);
		setSelectedTeamLoading(false);
	}, []);

	const handleOpenTeamSquad = useCallback((team) => {
		if (!team) return;
		if (activeTabRef.current !== "squad") {
			teamSquadReturnTabRef.current = activeTabRef.current;
		}
		// Cada equipa aberta empurra um novo entry no histórico do browser, de
		// modo que a pilha de navegação espelha a cadeia de equipas (A → B → C).
		// Assim o "Voltar" (e o back do browser) regressam à equipa anterior,
		// em vez de fechar o plantel inteiro e saltar níveis. Quando se abre a
		// partir de um separador normal e um entry { teamSquad } obsoleto ficou
		// no topo (ex.: saiu-se do plantel pela sidebar ou a app mudou de tab a
		// meio), substitui-se esse entry em vez de empilhar lixo.
		const historyAction = computeOpenSquadHistoryAction({
			activeTab: activeTabRef.current,
			historyState: window.history.state,
			teamId: team.id,
		});
		if (historyAction.useReplace) {
			window.history.replaceState(historyAction.state, "");
		} else {
			window.history.pushState(historyAction.state, "");
		}
		setActiveTab("squad");
		setSelectedTeam(team);
		setSelectedTeamSquad([]);
		setSelectedTeamLoading(true);
		socket.emit("requestTeamSquad", team.id);
		socket.emit("requestPalmares", { teamId: team.id });
		socket.emit("requestClubHistory", { teamId: team.id });
		// O calendário do plantel deriva os estados (done/current/future) de
		// calendarData.calendarIndex. Esse snapshot só é refrescado quando o
		// utilizador visita o separador Calendário — sem isto, abrir o plantel
		// de OUTRA equipa mostra estados de uma semana anterior (jornada já
		// jogada marcada como "Próximo Jogo" e a atual como "Agendado").
		socket.emit("requestCalendar");
	}, []);

	const handleCloseTeamSquad = useCallback(() => {
		if (window.history.state?.teamSquad) {
			window.history.back();
		} else {
			closeSquadState();
			setActiveTab(teamSquadReturnTabRef.current);
		}
	}, [closeSquadState]);

	/**
	 * Troca de separador a partir da UI (sidebar, nav móvel, JOGAR, ...). Se o
	 * utilizador estiver dentro do plantel de OUTRA equipa, sai desse modo e
	 * anula o entry { teamSquad } no topo do histórico — senão o "Voltar"
	 * (botão ← do modal de historial de jogador ou back do browser) voltaria
	 * a abrir a última equipa visualizada, em vez de ficar no separador atual.
	 */
	const navigateTab = useCallback(
		(key) => {
			const action = computeNavigateTabAction({
				activeTab: activeTabRef.current,
				historyState: window.history.state,
			});
			if (action.closeSquad) {
				closeSquadState();
				if (action.neutralizeHistory) {
					window.history.replaceState({ tab: key }, "");
				}
			}
			setActiveTab(key);
		},
		[closeSquadState],
	);

	useEffect(() => {
		const onPopState = () => {
			const action = computePopStateAction({
				state: window.history.state,
				activeTab: activeTabRef.current,
				selectedTeam: selectedTeamRef.current,
			});
			if (action.type === "restore") {
				// A regressar a uma equipa anterior da cadeia (A → B → C, back → B).
				const team = (teamsRef.current || []).find(
					(t) => t.id === action.teamId,
				);
				if (team) {
					setSelectedTeam(team);
					setSelectedTeamSquad([]);
					setSelectedTeamLoading(true);
					socket.emit("requestTeamSquad", team.id);
					socket.emit("requestPalmares", { teamId: team.id });
					socket.emit("requestClubHistory", { teamId: team.id });
					setActiveTab("squad");
				}
			} else if (action.type === "exit") {
				// Sair do plantel por completo.
				setSelectedTeam(null);
				setSelectedTeamSquad([]);
				setSelectedTeamLoading(false);
				setActiveTab(teamSquadReturnTabRef.current);
			}
			// "ignore": entry obsoleto do histórico — o utilizador já está noutro
			// separador, o back não repõe uma equipa antiga.
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const closeRefereePopup = useCallback(() => setRefereePopup(null), []);

	const handleResolveMatchAction = useCallback(
		(playerIdOrChoice) => {
			if (!matchAction) return;
			const payload = {
				actionId: matchAction.actionId,
				teamId: matchAction.teamId,
			};
			if (typeof playerIdOrChoice === "object" && playerIdOrChoice !== null) {
				payload.choice = playerIdOrChoice;
			} else {
				payload.playerId = playerIdOrChoice;
			}
			socket.emit("resolveMatchAction", payload);
			setMatchAction(null);
			setIsMatchActionPending(false);
			if (
				["user_substitution", "injury", "gk_red_card"].includes(matchAction.type) &&
				typeof playerIdOrChoice === "object" &&
				playerIdOrChoice !== null
			) {
				const { playerOut, playerIn } = playerIdOrChoice;
				setTactic((prevTactic) => {
					const newPositions = { ...prevTactic.positions };
					delete newPositions[playerOut];
					if (matchAction.type === "gk_red_card") {
						const sentOffId = matchAction.sentOffPlayer?.id;
						if (sentOffId != null) delete newPositions[sentOffId];
					}
					newPositions[playerIn] = "Titular";
					const next = { ...prevTactic, positions: newPositions };
					socket.emit("setTactic", next);
					return next;
				});
			}
		},
		[matchAction],
	);

	const handleCloseMatch = useCallback(() => {
		setMatchAction(null);
		setShowHalftimePanel(false);
		setShowMatchDetail(false);
		setMatchDetailFixture(null);
	}, []);

	const buyPlayer = useCallback((playerId) => {
		socket.emit("buyPlayer", playerId);
	}, []);

	const renewPlayerContract = useCallback((player) => {
		const defaultWage = Math.round(
			Math.max(player.wage || 0, (player.skill || 0) * 70) * 1.15,
		);
		setGameDialog({
			mode: "prompt",
			title: `Renovar Contrato — ${player.name}`,
			description: `Proposta de salário semanal (€/semana). Posição: ${player.position} · Skill: ${player.skill}`,
			defaultValue: String(defaultWage),
			confirmLabel: "Renovar",
			onConfirm: (val) => {
				const offeredWage = Number(val);
				if (!Number.isFinite(offeredWage) || offeredWage <= 0) return;
				socket.emit("renewContract", { playerId: player.id, offeredWage });
			},
			onCancel: () => {},
		});
	}, []);

	const listPlayerAuction = useCallback((player) => {
		const defaultPrice = Math.round(
			(player.value || 0) * TRANSFER_LISTED_PRICE_MULT,
		);
		setGameDialog({
			mode: "prompt",
			title: `Leilão — ${player.name}`,
			description: `Valor base de licitação (€). O jogador será leiloado ao melhor oferente.`,
			defaultValue: String(defaultPrice),
			confirmLabel: "Colocar em Leilão",
			onConfirm: (val) => {
				const price = Number(val);
				if (!Number.isFinite(price) || price < 0) return;
				socket.emit("listPlayerForTransfer", {
					playerId: player.id,
					mode: "auction",
					startingPrice: price,
				});
			},
			onCancel: () => {},
		});
	}, []);

	const listPlayerFixed = useCallback((player) => {
		const defaultPrice = Math.round((player.value || 0) * 1.1);
		setGameDialog({
			mode: "prompt",
			title: `Venda Directa — ${player.name}`,
			description: `Preço fixo de transferência (€). Qualquer clube pode comprar imediatamente por este valor.`,
			defaultValue: String(defaultPrice),
			confirmLabel: "Colocar à Venda",
			onConfirm: (val) => {
				const fixedPrice = Number(val);
				if (!Number.isFinite(fixedPrice) || fixedPrice <= 0) return;
				socket.emit("listPlayerForTransfer", {
					playerId: player.id,
					mode: "fixed",
					price: fixedPrice,
				});
			},
			onCancel: () => {},
		});
	}, []);

	const removeFromTransferList = useCallback((player) => {
		setGameDialog({
			mode: "confirm",
			title: `Retirar da Lista`,
			description: `Tens a certeza que queres retirar ${player.name} da lista de transferências?`,
			confirmLabel: "Retirar",
			danger: true,
			onConfirm: () => socket.emit("removeFromTransferList", player.id),
			onCancel: () => {},
		});
	}, []);

	const openAuctionBid = useCallback(() => {
		setActiveTab("leiloes");
		window.scrollTo(0, 0);
	}, []);

	// ── Derived values ──────────────────────────────────────────────────────
	const teamInfo = useMemo(
		() => teams.find((t) => t.id == me?.teamId),
		[teams, me?.teamId],
	);

	const myMatch = useMemo(
		() =>
			matchResults?.results?.find(
				(r) =>
					Number(r.homeTeamId) === Number(me?.teamId) ||
					Number(r.awayTeamId) === Number(me?.teamId),
			),
		[matchResults, me?.teamId],
	);

	const mySideInHalftime = myMatch?.homeTeamId === me?.teamId ? "home" : "away";
	const redCardedHalftimeIds = new Set(
		(myMatch?.events || [])
			.filter((e) => e.type === "red" && e.team === mySideInHalftime)
			.map((e) => e.playerId)
			.filter(Boolean),
	);
	const injuredHalftimeIds = new Set(
		(myMatch?.events || [])
			.filter((e) => e.type === "injury" && e.team === mySideInHalftime)
			.map((e) => e.playerId)
			.filter(Boolean),
	);

	const myTeamInCup =
		cupActiveTeamIds.length === 0 ||
		cupActiveTeamIds.includes(me?.teamId) ||
		cupActiveTeamIds.includes(Number(me?.teamId));

	const annotatedSquad = useMemo(
		() =>
			mySquad
				.map((p) => {
					const isOut = activeTab === "live" && subbedOut.includes(p.id);
					return {
						...p,
						status: isOut ? "Out" : tactic.positions[p.id] || "Excluído",
						isSubbedOut: isOut,
						isUnavailable: !isPlayerAvailable(p, matchweekCount + 1),
					};
				})
				.sort((a, b) => {
					const posOrder = { GR: 1, DEF: 2, MED: 3, ATA: 4 };
					const aPos = posOrder[a.position] || 5;
					const bPos = posOrder[b.position] || 5;
					if (aPos !== bPos) return aPos - bPos;
					return a.name.localeCompare(b.name);
				}),
		[mySquad, tactic.positions, activeTab, subbedOut, matchweekCount],
	);

	// Penáltis são resolvidos via `PenaltyTakerPopup` (modal sobre o jogo ao
	// vivo) — não abrir o painel de substituições a ecrã inteiro para eles.
	const panelMode =
		matchAction && matchAction.type !== "penalty"
			? "action"
			: showHalftimePanel
				? "halftime"
				: showMatchDetail
					? "detail"
					: null;

	const panelFixture = matchAction
		? (() => {
				const fd = matchAction?.fixtureData;
				if (fd) return fd;
				const actionTeamId = matchAction?.teamId;
				if (!actionTeamId) return null;
				return (
					matchResults?.results?.find(
						(r) =>
							Number(r.homeTeamId) === Number(actionTeamId) ||
							Number(r.awayTeamId) === Number(actionTeamId),
					) || null
				);
			})()
		: showHalftimePanel
			? myMatch || (isCupMatch ? matchResults?.results?.[0] || null : null)
			: showMatchDetail
				? matchDetailFixture
				: null;

	const panelIsReady = !!players.find((p) => p.name === me?.name)?.ready;

	const nextMatchOpponent = nextMatchSummary?.opponent || null;
	const nextMatchReferee = nextMatchSummary?.referee || null;

	const currentJornada = (matchweekCount % 14) + 1;
	const completedJornada =
		matchweekCount > 0 ? ((matchweekCount - 1) % 14) + 1 : 0;

	const totalWeeklyWage = useMemo(
		() => mySquad.reduce((acc, p) => acc + (p.wage || 0), 0),
		[mySquad],
	);
	const capacityRevPerGame = (teamInfo?.stadium_capacity || 10000) * 15;
	const loanAmount = teamInfo?.loan_amount || 0;
	const loanInterestPerWeek = Math.round(loanAmount * LOAN_INTEREST_RATE);
	const currentBudget = teamInfo?.budget || 0;

	const filteredMarketPlayers = useMemo(() => {
		const marketTeamId = me?.teamId;
		const getPlayerPrice = (player) => {
			const isListed = player.transfer_status && player.transfer_status !== "none";
			return isListed
				? player.transfer_price || player.value * 0.75
				: player.value * 1.2;
		};
		const comparePlayers = (a, b) => {
			if (marketSort === "price-asc") return getPlayerPrice(a) - getPlayerPrice(b);
			if (marketSort === "price-desc")
				return getPlayerPrice(b) - getPlayerPrice(a);
			if (marketSort === "quality-asc") return (a.skill || 0) - (b.skill || 0);
			return (b.skill || 0) - (a.skill || 0);
		};
		return marketPairs
			.filter((player) => player.team_id !== marketTeamId)
			.filter((player) =>
				marketPositionFilter === "all"
					? true
					: player.position === marketPositionFilter,
			)
			.map((player) => ({ ...player, marketPrice: getPlayerPrice(player) }))
			.sort(comparePlayers);
	}, [marketPairs, marketPositionFilter, marketSort, me?.teamId]);

	const resetGameState = useCallback(() => {
		matchReplayActiveRef.current = false;
		isLiveSimulationRef.current = false;
		isCupExtraTimeRef.current = false;
		if (injuryCountdownRef.current) {
			clearInterval(injuryCountdownRef.current);
			injuryCountdownRef.current = null;
		}
		setInjuryCountdown(null);
		setTeams([]);
		setPrevStandings([]);
		setTeamForms({});
		setPlayers([]);
		setMySquad([]);
		setMarketPairs([]);
		setTopScorers([]);
		setMatchResults(null);
		setAllMatchResults({});
		setMatchweekCount(0);
		setStandingsStale(false);
		setActiveTab("club");
		setTactic(DEFAULT_TACTIC);
		setLockedCoaches([]);
		setAwaitingCoaches([]);
		setRoomCreator("");
		setNextMatchSummary(null);
		setNextMatchSummaryLoading(false);
		setIsPlayingMatch(false);
		setIsLiveSimulation(false);
		setShowHalftimePanel(false);
		setMatchAction(null);
		setIsMatchActionPending(false);
		setLiveMinute(90);
		setSubsMade(0);
		setSwapSource(null);
		setSwapTarget(null);
		setSubbedOut([]);
		setConfirmedSubs([]);
		setRefereePopup(null);
		setCupDraw(null);
		setShowCupDrawPopup(false);
		setCupRoundResults(null);
		setCupPenaltyPopup(null);
		setWelcomeModal(null);
		setDismissalModal(null);
		setIsCupMatch(false);
		setCupPreMatch(false);
		setCurrentCupRound(null);
		setCupExtraTimeBadge(false);
		setIsCupExtraTime(false);
		setCupActiveTeamIds([]);
		setPalmares({ trophies: [], allChampions: [] });
		setPalmaresTeamId(null);
		setClubHistory(null);
		setClubHistoryTeamId(null);
		setSelectedTeam(null);
		setSelectedTeamSquad([]);
		setSelectedTeamLoading(false);
		setSelectedAuctionPlayer(null);
		setAuctionBid("");
		setMyAuctionBid(null);
		setAuctionResult(null);
		setCalendarData(null);
		setCalFilter("all");
		setCupBracketData(null);
		setSeasonYear(2026);
		setClubNews([]);
		setFinanceData(null);
		setJobOfferModal(null);
		setSeasonEndModal(null);
		setPenaltySuspense(null);
		setShowMatchDetail(false);
		setMatchDetailFixture(null);
		setRoomMessages([]);
		setGlobalMessages([]);
		setGlobalPlayers([]);
		setGameDialog(null);
		setUnreadRoom(0);
		setUnreadGlobal(0);
		setSubstitutionPause(null);
		setTransferProposalModal(null);
		setSigningCelebration(null);
		setPostMatchMood(null);
		setShowTransferSales(false);
		setShowTransferPurchases(false);
		setShowTicketBreakdown(false);
		setCoachMarketReport(null);
		setPlayerHistoryModal(null);
		setPlayerSearchData({ results: [], total: 0, truncated: false });
		setPlayerSearchLoading(false);
		setPendingCupRoundResults(null);
		setTacticFamiliarity(null);
		setAllTacticFamiliarity({});
		setSeason(1);
		setCalendarIndex(0);
		setCupResultsFilter("all");
		setCupDrawRevealIdx(0);
		setCupPenaltyKickIdx(0);
		setChatInput("");
		setMobileSubMenu(null);
	}, []);

	// ── Context value ────────────────────────────────────────────────────────
	const value = {
		// State
		teams,
		setTeams,
		prevStandings,
		setPrevStandings,
		teamForms,
		setTeamForms,
		players,
		setPlayers,
		mySquad,
		setMySquad,
		disconnected,
		setDisconnected,
		sessionDisplaced,
		setSessionDisplaced,
		toasts,
		lockedCoaches,
		awaitingCoaches,
		roomCreator,
		matchResults,
		allMatchResults,
		matchweekCount,
		season,
		seasonYear,
		activeTab,
		setActiveTab,
		navigateTab,
		topScorers,
		standingsStale,
		marketPairs,
		marketPositionFilter,
		setMarketPositionFilter,
		marketSort,
		setMarketSort,
		auctionBid,
		selectedAuctionPlayer,
		isAuctionExpanded,
		setIsAuctionExpanded,
		myAuctionBid,
		setMyAuctionBid,
		auctionResult,
		activeAuctions,
		nextMatchSummary,
		nextMatchSummaryLoading,
		setNextMatchSummaryLoading,
		refereePopup,
		setRefereePopup,
		gameDialog,
		setGameDialog,
		cupDraw,
		showCupDrawPopup,
		setShowCupDrawPopup,
		cupDrawRevealIdx,
		setCupDrawRevealIdx,
		cupRoundResults,
		cupResultsFilter,
		setCupResultsFilter,
		cupPenaltyPopup,
		setCupPenaltyPopup,
		cupPenaltyKickIdx,
		setCupPenaltyKickIdx,
		pendingCupRoundResults,
		welcomeModal,
		setWelcomeModal,
		jobOfferModal,
		setJobOfferModal,
		dismissalModal,
		setDismissalModal,
		coachMarketReport,
		setCoachMarketReport,
		seasonEndModal,
		setSeasonEndModal,
		// Admin
		adminPanelOpen,
		setAdminPanelOpen,
		adminUsers,
		setAdminUsers,
		// User dropdown
		userDropdownOpen,
		setUserDropdownOpen,
		isCupMatch,
		calendarIndex,
		cupPreMatch,
		cupMatchRoundName,
		currentCupRound,
		cupExtraTimeBadge,
		isCupExtraTime,
		cupActiveTeamIds,
		palmares,
		palmaresTeamId,
		clubHistory,
		clubHistoryTeamId,
		clubNews,
		playerHistoryModal,
		setPlayerHistoryModal,
		financeData,
		showTransferSales,
		setShowTransferSales,
		showTransferPurchases,
		setShowTransferPurchases,
		showTicketBreakdown,
		setShowTicketBreakdown,
		selectedTeam,
		selectedTeamSquad,
		selectedTeamLoading,
		transferProposalModal,
		setTransferProposalModal,
		signingCelebration,
		setSigningCelebration,
		postMatchMood,
		setPostMatchMood,
		playerSearchData,
		setPlayerSearchData,
		playerSearchLoading,
		setPlayerSearchLoading,
		cupBracketData,
		calendarData,
		calFilter,
		setCalFilter,
		tactic,
		setTactic,
		tacticFamiliarity,
		setTacticFamiliarity,
		allTacticFamiliarity,
		setAllTacticFamiliarity,
		liveMinute,
		isPlayingMatch,
		isLiveSimulation,
		showHalftimePanel,
		matchAction,
		isMatchActionPending,
		injuryCountdown,
		subsMade,
		setSubsMade,
		goalFlashRef,
		substitutionPause,
		renderError,
		swapSource,
		setSwapSource,
		swapTarget,
		setSwapTarget,
		subbedOut,
		setSubbedOut,
		confirmedSubs,
		setConfirmedSubs,
		penaltySuspense,
		showMatchDetail,
		setShowMatchDetail,
		matchDetailFixture,
		setMatchDetailFixture,
		roomHubOpen,
		setRoomHubOpen,
		roomMessages,
		setRoomMessages,
		globalMessages,
		setGlobalMessages,
		globalPlayers,
		setGlobalPlayers,
		unreadRoom,
		unreadGlobal,
		chatInput,
		setChatInput,
		mobileSubMenu,
		setMobileSubMenu,
		sidebarCollapsed,
		setSidebarCollapsed,
		avatarSeed,
		setAvatarSeed,
		// Refs
		injuryCountdownRef,
		chatMessagesRef,
		roomHubRef,
		chatOpenRef,
		activeChatTabRef,
		sidebarUserPrefRef,
		// Auth bridge (re-exposed)
		me,
		setMe,
		meRef,
		roomCodeRef,
		joinTimerRef,
		backendUrl,
		// Handlers
		addToast,
		dismissToast,
		handleHalftimeReady,
		handleOpenTeamSquad,
		handleCloseTeamSquad,
		closeRefereePopup,
		handleResolveMatchAction,
		handleCloseMatch,
		buyPlayer,
		renewPlayerContract,
		listPlayerAuction,
		listPlayerFixed,
		removeFromTransferList,
		openAuctionBid,
		resetGameState,
		// Derived
		isMatchInProgress,
		teamInfo,
		myMatch,
		mySideInHalftime,
		redCardedHalftimeIds,
		injuredHalftimeIds,
		myTeamInCup,
		annotatedSquad,
		panelMode,
		panelFixture,
		panelIsReady,
		nextMatchOpponent,
		nextMatchReferee,
		currentJornada,
		completedJornada,
		totalWeeklyWage,
		capacityRevPerGame,
		loanAmount,
		loanInterestPerWeek,
		currentBudget,
		filteredMarketPlayers,
	};

	return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/**
 * Consumes the GameContext. Must be used inside a <GameProvider>.
 * Co-exported in the same file as the Provider (single-file context pattern).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
	const ctx = useContext(GameContext);
	if (!ctx) throw new Error("useGame must be used within a <GameProvider>");
	return ctx;
}
