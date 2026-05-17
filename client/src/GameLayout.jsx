import { AnimatePresence } from "framer-motion";
import { socket } from "./socket.js";
import { useGame } from "./contexts/GameContext.jsx";
import { useTactics } from "./contexts/TacticsContext.jsx";
import { PlayerLink } from "./components/shared/PlayerLink.jsx";
import { PlayerAvatar } from "./components/shared/PlayerAvatar.jsx";
import { WelcomeModal } from "./components/modals/WelcomeModal.jsx";
import { DismissalModal } from "./components/modals/DismissalModal.jsx";
import { SeasonEndModal } from "./components/modals/SeasonEndModal.jsx";
import { JobOfferModal } from "./components/modals/JobOfferModal.jsx";
import { PlayerHistoryModal } from "./components/modals/PlayerHistoryModal.jsx";
import { CupDrawPopup } from "./components/modals/CupDrawPopup.jsx";
import { PenaltySuspensePopup } from "./components/modals/PenaltySuspensePopup.jsx";
import { PenaltyShootoutPopup } from "./components/modals/PenaltyShootoutPopup.jsx";
import { MatchPage } from "./components/match/MatchPage.jsx";
import { RefereePopup } from "./components/modals/RefereePopup.jsx";
import { GameDialog } from "./components/shared/GameDialog.jsx";
import { TransferProposalModal } from "./components/modals/TransferProposalModal.jsx";
import { AuctionNotification } from "./components/ui/AuctionNotification.jsx";
import { AuctionsPage } from "./pages/AuctionsPage.jsx";
import { UserSettingsPage } from "./pages/UserSettingsPage.jsx";
import { NewsTicker } from "./components/ui/NewsTicker.jsx";
import { RoomHub } from "./components/chat/RoomHub.jsx";
import { StandingsTab } from "./views/StandingsTab.jsx";
import { BracketTab } from "./views/BracketTab.jsx";
import { TrainingTab } from "./views/TrainingTab.jsx";
import { CupTab } from "./views/CupTab.jsx";
import { CalendarioTab } from "./views/CalendarioTab.jsx";
import { ClubTab } from "./views/ClubTab.jsx";
import { FinancesTab } from "./views/FinancesTab.jsx";
import { PlayersTab } from "./views/PlayersTab.jsx";
import { TeamSquadView } from "./views/TeamSquadView.jsx";
import { TacticsView } from "./views/TacticsView.jsx";
import { TransferHub } from "./components/ui/TransferHub.jsx";
import { DIVISION_NAMES } from "./constants/index.js";
import { isSameTeamId } from "./utils/teamHelpers.js";
import { getMatchLastEventText } from "./utils/playerHelpers.js";

const WEATHER_LABELS = {
	"☀️": "Sol",
	"🌧️": "Chuva",
	"⛈️": "Chuva forte",
	"💨": "Vento",
	"🥶": "Frio",
	"🌫️": "Nevoeiro",
	"❄️": "Neve",
};

/**
 * Renders the entire game UI. All state comes from useGame() and useTactics().
 * No props — fully self-contained within the context providers.
 */
export function GameLayout({ handleLogout, setAuthPhase }) {
	// ── All game state from GameContext ─────────────────────────────────────
	const {
		// State
		teams,
		teamForms,
		players,
		mySquad,
		sessionDisplaced,
		toasts,
		awaitingCoaches,
		roomCreator,
		matchResults,
		allMatchResults,
		matchweekCount,
		seasonYear,
		activeTab,
		setActiveTab,
		topScorers,
		marketPositionFilter,
		setMarketPositionFilter,
		marketSort,
		setMarketSort,
		activeAuctions,
		nextMatchSummary,
		nextMatchSummaryLoading,
		refereePopup,
		setRefereePopup,
		gameDialog,
		setGameDialog,
		cupDraw,
		showCupDrawPopup,
		cupDrawRevealIdx,
		cupRoundResults,
		cupResultsFilter,
		setCupResultsFilter,
		cupPenaltyPopup,
		setCupPenaltyPopup,
		cupPenaltyKickIdx,
		welcomeModal,
		setWelcomeModal,
		jobOfferModal,
		setJobOfferModal,
		dismissalModal,
		setDismissalModal,
		seasonEndModal,
		isCupMatch,
		cupPreMatch,
		cupMatchRoundName,
		cupExtraTimeBadge,
		palmares,
		palmaresTeamId,
		clubNews,
		newsTickerItems,
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
		cupBracketData,
		calendarData,
		calFilter,
		setCalFilter,
		liveMinute,
		isPlayingMatch,
		showHalftimePanel,
		matchAction,
		injuryCountdown,
		goalFlashRef,
		renderError,
		setShowMatchDetail,
		roomHubOpen,
		setRoomHubOpen,
		roomMessages,
		globalMessages,
		globalPlayers,
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
		chatMessagesRef,
		roomHubRef,
		chatOpenRef,
		activeChatTabRef,
		// Auth
		me,
		setMe,
		backendUrl,
		// Handlers
		addToast,
		handleHalftimeReady,
		handleOpenTeamSquad,
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
		redCardedHalftimeIds,
		injuredHalftimeIds,
		myTeamInCup,
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
		// Additional state needed by JSX
		sidebarUserPrefRef,
		isCupExtraTime,
		substitutionPause,
		isMatchActionPending,
		setMatchDetailFixture,
		penaltySuspense,
		setShowCupDrawPopup,
		setCupDrawRevealIdx,
		setCupPenaltyKickIdx,
		setSeasonEndModal,
	} = useGame();

	// ── Tactic-specific from TacticsContext ─────────────────────────────────
	const { tactic, annotatedSquad } = useTactics();

	return (
		<div className="min-h-dvh bg-surface text-on-surface font-body tracking-tight">
			{renderError && (
				<div
					style={{ position: "fixed", inset: 0, zIndex: 99999 }}
					className="flex flex-col items-center justify-center bg-black/95 gap-4 p-8 overflow-auto"
				>
					<p className="text-4xl">💥</p>
					<h2 className="text-xl font-bold text-red-400">
						Erro de Renderização
					</h2>
					<pre className="text-xs text-zinc-400 max-w-xl overflow-auto p-3 bg-zinc-900 rounded whitespace-pre-wrap">
						{(() => {
							try {
								return renderError?.stack || String(renderError);
							} catch (e) {
								return `[ERROR DISPLAY] ${String(e)}`;
							}
						})()}
					</pre>
					<button
						onClick={() => window.location.reload()}
						className="mt-2 px-6 py-2 rounded-lg bg-red-500 text-white font-bold text-sm"
					>
						Recarregar
					</button>
				</div>
			)}
			{sessionDisplaced && (
				<div
					style={{ position: "fixed", inset: 0, zIndex: 9999 }}
					className="flex flex-col items-center justify-center bg-black/90 gap-6 p-8"
				>
					<p className="text-5xl">📱</p>
					<h2 className="text-xl font-bold text-white text-center">
						Sessão aberta noutro dispositivo
					</h2>
					<p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">
						A tua sessão foi assumida por outro dispositivo ou janela.
					</p>
					<button
						onClick={() => window.location.reload()}
						className="mt-2 px-6 py-2 rounded-lg bg-yellow-500 text-black font-bold text-sm"
					>
						Retomar aqui
					</button>
				</div>
			)}
			{/* Toast notifications */}
			<div className="fixed top-16 right-4 z-100 flex flex-col gap-2 pointer-events-none">
				{toasts.map((t) => (
					<div
						key={t.id}
						className="bg-surface-container border border-outline-variant/60 text-on-surface text-sm font-bold px-5 py-3 rounded-md shadow-2xl toast-slide-in"
					>
						{t.msg}
					</div>
				))}
			</div>
			<header
				className="fixed top-0 left-0 right-0 h-14 z-160 flex items-center"
				style={{
					background: teamInfo?.color_primary || "#131313",
					borderBottom: "1px solid #201f1f",
				}}
			>
				<div className="relative flex items-center justify-between w-full px-4 lg:px-6">
					{/* Left: brand + session info */}
					<div className="flex items-center gap-3">
						<h1
							className="text-base font-headline font-black tracking-tighter uppercase"
							style={{ color: teamInfo?.color_secondary || "#e5e2e1" }}
						>
							CashBall <span style={{ opacity: 0.55 }}>26/27</span>
						</h1>
						<span
							className="hidden md:block text-[10px] font-bold uppercase tracking-[0.2em]"
							style={{
								color: teamInfo?.color_secondary || "#e5e2e1",
								opacity: 0.7,
							}}
						>
							{seasonYear} · J{currentJornada} · {me.roomName || me.roomCode}
						</span>
					</div>

					{/* Center: live clock (absolute so it's always centered) */}
					{isMatchInProgress && (
						<div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
							{isPlayingMatch ? (
								<>
									<span
										className="text-xl font-headline font-black tabular-nums leading-none"
										style={{ color: teamInfo?.color_secondary || "#e5e2e1" }}
									>
										{liveMinute}'
									</span>
									<span
										className="text-[8px] font-bold uppercase tracking-widest"
										style={{
											color: teamInfo?.color_secondary || "#e5e2e1",
											opacity: 0.55,
										}}
									>
										{liveMinute > 90
											? "Prolongamento"
											: liveMinute > 45
												? "2ª Parte"
												: "1ª Parte"}
									</span>
								</>
							) : liveMinute === 45 && !isCupMatch ? (
								<span
									className="text-xs font-black uppercase tracking-widest"
									style={{
										color: teamInfo?.color_secondary || "#e5e2e1",
										opacity: 0.7,
									}}
								>
									Intervalo
								</span>
							) : isCupMatch ? (
								<span
									className="text-[10px] font-black uppercase tracking-widest"
									style={{
										color: teamInfo?.color_secondary || "#e5e2e1",
										opacity: 0.7,
									}}
								>
									🏆 {cupMatchRoundName}
									{cupPreMatch
										? " · Pré-Jogo"
										: cupExtraTimeBadge
											? " · Prol."
											: ""}
								</span>
							) : null}
						</div>
					)}

					{/* Right: user menu + chat */}
					<div className="flex items-center gap-1">
						{/* RoomHub button — unified: Coaches + Chat */}
						<button
							onClick={() => setRoomHubOpen((v) => !v)}
							title="Sala e Chat"
							className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
						>
							<span
								className="material-symbols-outlined text-[20px] leading-none"
								style={{ color: teamInfo?.color_secondary || "#e5e2e1" }}
							>
								chat
							</span>
							{(unreadRoom + unreadGlobal > 0 || players.length > 0) && (
								<span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black leading-none flex items-center justify-center px-1">
									{unreadRoom + unreadGlobal > 9
										? "9+"
										: unreadRoom + unreadGlobal || players.length}
								</span>
							)}
						</button>

						{/* User button — opens settings page; disabled during live match */}
						<button
							onClick={() => {
								if (isPlayingMatch) return;
								setActiveTab("user_settings");
								window.scrollTo(0, 0);
							}}
							disabled={isPlayingMatch}
							title={
								isPlayingMatch
									? "Definições bloqueadas durante o jogo"
									: "Definições do Utilizador"
							}
							className={`flex items-center gap-2 transition-colors rounded-lg px-2 py-1 ${
								isPlayingMatch
									? "opacity-40 cursor-not-allowed"
									: "hover:bg-white/10"
							}`}
						>
							<PlayerAvatar seed={`${me.name}|${avatarSeed}`} size="sm" />
							<div className="hidden lg:flex flex-col items-start">
								<span
									className="text-sm font-bold leading-tight"
									style={{ color: teamInfo?.color_secondary || "#e5e2e1" }}
								>
									{me.name}
								</span>
								<span
									className="text-xs leading-tight opacity-70"
									style={{ color: teamInfo?.color_secondary || "#e5e2e1" }}
								>
									{teamInfo?.name}
								</span>
							</div>
							<span
								className="material-symbols-outlined text-[16px] leading-none opacity-60"
								style={{ color: teamInfo?.color_secondary || "#e5e2e1" }}
							>
								expand_more
							</span>
						</button>
					</div>
				</div>
			</header>

			{/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
			<nav
				className={`hidden lg:flex fixed left-0 top-14 bottom-0 bg-surface-container-low flex-col z-10 transition-all duration-200 ${sidebarCollapsed ? "w-14" : "w-64"}`}
			>
				{/* Toggle button */}
				<button
					onClick={() => {
						const next = !sidebarCollapsed;
						setSidebarCollapsed(next);
						sidebarUserPrefRef.current = next;
						try {
							localStorage.setItem("sidebarCollapsed", String(next));
						} catch {
							/* ignore */
						}
					}}
					title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
					className="shrink-0 flex items-center justify-center h-10 border-b border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
				>
					<span className="material-symbols-outlined text-[18px] leading-none">
						{sidebarCollapsed ? "chevron_right" : "chevron_left"}
					</span>
				</button>
				<div className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
					<motion.div
						initial="hidden"
						animate="visible"
						variants={{
							hidden: {},
							visible: { transition: { staggerChildren: 0.055 } },
						}}
					>
						{[
							{ key: "club", label: "Clube", icon: "groups_3" },
							{ key: "finances", label: "Finanças", icon: "payments" },
							{ key: "players", label: "Plantel", icon: "group" },
							{ key: "training", label: "Treino", icon: "fitness_center" },
							{
								key: "calendario",
								label: "Calendário",
								icon: "calendar_month",
							},
							{
								key: "standings",
								label: "Classificações",
								icon: "leaderboard",
							},
							{
								key: "bracket",
								label: "Taça",
								icon: "emoji_events",
							},
							{ key: "market", label: "Mercado", icon: "swap_horiz" },
							{ key: "leiloes", label: "Leilões", icon: "gavel" },
						].map(({ key, label, icon }) => (
							<motion.button
								key={key}
								variants={{
									hidden: { opacity: 0, x: -12 },
									visible: {
										opacity: 1,
										x: 0,
										transition: { duration: 0.2 },
									},
								}}
								onClick={() => {
									if (isMatchInProgress) return;
									setActiveTab(key);
									if (key === "bracket") socket.emit("requestCupBracket");
									window.scrollTo(0, 0);
								}}
								title={sidebarCollapsed ? label : undefined}
								className={`w-full flex items-center gap-3 px-2 py-3 text-sm font-bold transition-all text-left ${sidebarCollapsed ? "justify-center" : ""} ${
									isMatchInProgress
										? "text-on-surface-variant/25 cursor-not-allowed"
										: activeTab === key
											? "bg-primary-container/20 text-primary border-l-4 border-primary"
											: "text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
								}`}
							>
								<span className="material-symbols-outlined text-[20px] shrink-0 leading-none">
									{icon}
								</span>
								{!sidebarCollapsed && <span>{label}</span>}
							</motion.button>
						))}
					</motion.div>
					<div className="pt-2">
						<button
							onClick={() => {
								if (isMatchInProgress) return;
								setActiveTab("tactic");
								window.scrollTo(0, 0);
								if (socket && teamInfo?.id && tactic) {
									socket.emit("requestTacticFamiliarity", teamInfo.id);
									socket.emit("requestAllTacticFamiliarity");
								}
							}}
							title={
								sidebarCollapsed
									? isMatchInProgress
										? "AO VIVO"
										: "JOGAR"
									: undefined
							}
							className={`w-full flex items-center gap-3 px-2 py-3.5 text-sm font-black uppercase tracking-widest transition-all rounded-sm ${sidebarCollapsed ? "justify-center" : ""} ${
								isMatchInProgress
									? "bg-red-500/15 text-red-400 border border-red-500/30 cursor-not-allowed"
									: activeTab === "tactic"
										? "bg-primary text-on-primary shadow-lg"
										: "bg-primary/10 text-primary border border-primary/40 hover:bg-primary/20"
							}`}
						>
							<span className="material-symbols-outlined text-[20px] shrink-0 leading-none">
								{isMatchInProgress ? "sensors" : "strategy"}
							</span>
							{!sidebarCollapsed && (
								<>
									<span className="flex-1 text-left">
										{isMatchInProgress ? "AO VIVO" : "JOGAR"}
									</span>
									<span className="relative flex h-2 w-2 shrink-0">
										<span
											className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isMatchInProgress ? "bg-red-500" : activeTab === "tactic" ? "bg-on-primary/40" : "bg-primary"}`}
										/>
										<span
											className={`relative inline-flex rounded-full h-2 w-2 ${isMatchInProgress ? "bg-red-500" : activeTab === "tactic" ? "bg-on-primary/60" : "bg-primary"}`}
										/>
									</span>
								</>
							)}
						</button>
					</div>
				</div>
			</nav>

			{/* ── MOBILE BOTTOM NAV ────────────────────────────────────────────── */}
			{/* ── Mobile bottom nav (< lg) ─────────────────────────────── */}
			{!isMatchInProgress && (
				<>
					{/* Overlay to close flyup when tapping outside */}
					{mobileSubMenu && (
						<div
							className="lg:hidden fixed inset-0 z-38"
							onClick={() => setMobileSubMenu(null)}
						/>
					)}

					{/* Flyup sub-menu panel */}
					{mobileSubMenu && (
						<div className="lg:hidden fixed bottom-24 left-0 right-0 z-39 px-3">
							<div className="bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden">
								{mobileSubMenu === "gestao" && (
									<div className="flex">
										{[
											{
												key: "finances",
												label: "Finanças",
												icon: "payments",
											},
											{ key: "players", label: "Plantel", icon: "group" },
											{
												key: "training",
												label: "Treino",
												icon: "fitness_center",
											},
										].map(({ key, label, icon }) => (
											<button
												key={key}
												onClick={() => {
													setActiveTab(key);
													setMobileSubMenu(null);
													window.scrollTo(0, 0);
												}}
												className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 transition-colors ${
													activeTab === key
														? "text-primary bg-primary/10"
														: "text-on-surface-variant hover:bg-surface-bright"
												}`}
											>
												<span className="material-symbols-outlined text-[24px] leading-none">
													{icon}
												</span>
												<span className="text-[10px] font-black uppercase tracking-wider">
													{label}
												</span>
											</button>
										))}
									</div>
								)}
								{mobileSubMenu === "transferencias" && (
									<div className="flex">
										{[
											{ key: "market", label: "Mercado", icon: "swap_horiz" },
											{ key: "leiloes", label: "Leilões", icon: "gavel" },
										].map(({ key, label, icon }) => (
											<button
												key={key}
												onClick={() => {
													setActiveTab(key);
													setMobileSubMenu(null);
													window.scrollTo(0, 0);
												}}
												className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 transition-colors ${
													activeTab === key
														? "text-primary bg-primary/10"
														: "text-on-surface-variant hover:bg-surface-bright"
												}`}
											>
												<span className="material-symbols-outlined text-[24px] leading-none">
													{icon}
												</span>
												<span className="text-[10px] font-black uppercase tracking-wider">
													{label}
												</span>
											</button>
										))}
									</div>
								)}
								{mobileSubMenu === "competicao" && (
									<div className="flex">
										{[
											{
												key: "standings",
												label: "Classif.",
												icon: "leaderboard",
											},
											{
												key: "calendario",
												label: "Calendário",
												icon: "calendar_month",
											},
											{
												key: "bracket",
												label: "Taça",
												icon: "emoji_events",
											},
										].map(({ key, label, icon }) => (
											<button
												key={key}
												onClick={() => {
													setActiveTab(key);
													if (key === "bracket")
														socket.emit("requestCupBracket");
													setMobileSubMenu(null);
													window.scrollTo(0, 0);
												}}
												className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 transition-colors ${
													activeTab === key
														? "text-primary bg-primary/10"
														: "text-on-surface-variant hover:bg-surface-bright"
												}`}
											>
												<span className="material-symbols-outlined text-[24px] leading-none">
													{icon}
												</span>
												<span className="text-[10px] font-black uppercase tracking-wider">
													{label}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					)}

					{/* Main nav bar — 5 buttons */}
					<nav className="lg:hidden fixed bottom-8 left-0 right-0 h-16 bg-surface-container-low/95 backdrop-blur-sm border-t border-outline-variant/30 z-40 flex">
						{/* Clube */}
						{(() => {
							const isActive = activeTab === "club";
							return (
								<motion.button
									whileTap={{ scale: 0.88 }}
									onClick={() => {
										setActiveTab("club");
										setMobileSubMenu(null);
										window.scrollTo(0, 0);
									}}
									className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
										isActive ? "text-primary" : "text-on-surface-variant"
									}`}
								>
									{isActive && (
										<motion.span
											layoutId="mobileTabIndicator"
											className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full"
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 35,
											}}
										/>
									)}
									<span className="material-symbols-outlined text-[22px] leading-none">
										groups_3
									</span>
									<span>Clube</span>
								</motion.button>
							);
						})()}

						{/* Gestão (Finanças + Plantel) */}
						{(() => {
							const isChildActive = ["finances", "players"].includes(activeTab);
							const isOpen = mobileSubMenu === "gestao";
							return (
								<motion.button
									whileTap={{ scale: 0.88 }}
									onClick={() => setMobileSubMenu(isOpen ? null : "gestao")}
									className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
										isChildActive || isOpen
											? "text-primary"
											: "text-on-surface-variant"
									}`}
								>
									{(isChildActive || isOpen) && (
										<motion.span
											layoutId="mobileTabIndicator"
											className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full"
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 35,
											}}
										/>
									)}
									<span className="material-symbols-outlined text-[22px] leading-none">
										manage_accounts
									</span>
									<span>Gestão</span>
								</motion.button>
							);
						})()}

						{/* Competição (Classificações + Calendário) */}
						{(() => {
							const isChildActive = ["standings", "calendario"].includes(
								activeTab,
							);
							const isOpen = mobileSubMenu === "competicao";
							return (
								<motion.button
									whileTap={{ scale: 0.88 }}
									onClick={() => setMobileSubMenu(isOpen ? null : "competicao")}
									className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
										isChildActive || isOpen
											? "text-primary"
											: "text-on-surface-variant"
									}`}
								>
									{(isChildActive || isOpen) && (
										<motion.span
											layoutId="mobileTabIndicator"
											className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full"
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 35,
											}}
										/>
									)}
									<span className="material-symbols-outlined text-[22px] leading-none">
										emoji_events
									</span>
									<span>Compet.</span>
								</motion.button>
							);
						})()}

						{/* Transferências (Mercado + Leilões) */}
						{(() => {
							const isChildActive = ["market", "leiloes"].includes(activeTab);
							const isOpen = mobileSubMenu === "transferencias";
							return (
								<motion.button
									whileTap={{ scale: 0.88 }}
									onClick={() =>
										setMobileSubMenu(isOpen ? null : "transferencias")
									}
									className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
										isChildActive || isOpen
											? "text-primary"
											: "text-on-surface-variant"
									}`}
								>
									{(isChildActive || isOpen) && (
										<motion.span
											layoutId="mobileTabIndicator"
											className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full"
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 35,
											}}
										/>
									)}
									<span className="material-symbols-outlined text-[22px] leading-none">
										swap_horiz
									</span>
									<span>Transfer.</span>
								</motion.button>
							);
						})()}

						{/* JOGAR */}
						{(() => {
							const isActive = activeTab === "tactic";
							const goldColor = "#d4af37";
							return (
								<motion.button
									whileTap={{ scale: 0.88 }}
									onClick={() => {
										setActiveTab("tactic");
										setMobileSubMenu(null);
										window.scrollTo(0, 0);
										if (socket && teamInfo?.id && tactic) {
											socket.emit("requestTacticFamiliarity", teamInfo.id);
											socket.emit("requestAllTacticFamiliarity");
										}
									}}
									className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black uppercase tracking-wider transition-colors relative"
									style={{
										color: isActive ? goldColor : goldColor,
										opacity: isActive ? 1 : 0.75,
									}}
								>
									{isActive && (
										<motion.span
											layoutId="mobileTabIndicator"
											style={{ backgroundColor: goldColor }}
											className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 35,
											}}
										/>
									)}
									<span className="material-symbols-outlined text-[22px] leading-none">
										strategy
									</span>
									<span>JOGAR!</span>
								</motion.button>
							);
						})()}
					</nav>
				</>
			)}

			{/* LIVE bar during match (mobile) */}
			{isMatchInProgress && !showHalftimePanel && (
				<div className="lg:hidden fixed bottom-0 left-0 right-0 h-10 z-40 flex items-center justify-center bg-red-500/10 border-t border-red-500/30 backdrop-blur-sm">
					<span className="material-symbols-outlined text-red-400 text-[18px] leading-none mr-1.5 animate-pulse">
						sensors
					</span>
					<span className="text-red-400 text-[10px] font-black uppercase tracking-widest">
						AO VIVO
					</span>
				</div>
			)}

			{panelMode === null && (
				<main
					className={`pt-14 pb-24 lg:pb-12 transition-all duration-200 ${sidebarCollapsed ? "lg:ml-14" : "lg:ml-64"}`}
				>
					<div className="p-4 lg:p-6">
						{/* ─── TACTIC: HORIZONTAL ADVERSARY BANNER ──────────────────── */}
						{activeTab === "tactic" && (
							<div className="mb-4 rounded-md border border-outline-variant/20 bg-surface-container-low">
								{nextMatchOpponent ? (
									<div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
										{/* Jornada + VS */}
										<div className="shrink-0">
											<p className="text-[10px] uppercase tracking-[0.35em] text-on-surface-variant font-black mb-0.5">
												{nextMatchSummary?.isCup
													? `Taça · ${nextMatchSummary.cupRoundName}`
													: `Jornada ${nextMatchSummary?.matchweek ?? "—"}`}
											</p>
											<div className="flex items-center gap-2 flex-wrap">
												{nextMatchSummary?.isCup && (
													<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
														TAÇA
													</span>
												)}
												<span
													className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${nextMatchSummary?.venue === "Jamor" ? "bg-amber-500/20 text-amber-400" : nextMatchSummary?.venue === "Casa" ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"}`}
												>
													{nextMatchSummary?.venue ?? "-"}
												</span>
												<div>
													<p className="text-white font-black text-lg leading-tight">
														vs {nextMatchOpponent.name}
													</p>
													{(() => {
														const coach = players.find(
															(p) => p.teamId === nextMatchOpponent.id,
														);
														return coach ? (
															<p className="text-[10px] text-amber-400 font-bold">
																Treinador: {coach.name}
															</p>
														) : null;
													})()}
												</div>
											</div>
										</div>
										{/* Standings */}
										<div className="shrink-0 text-center">
											<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-0.5">
												Posição
											</p>
											<p className="text-base font-black">
												<span className="text-primary">
													{nextMatchSummary?.team?.position
														? `${nextMatchSummary.team.position}º`
														: "—"}
												</span>
												<span className="text-zinc-600 mx-1.5">vs</span>
												<span className="text-amber-400">
													{nextMatchOpponent.position
														? `${nextMatchOpponent.position}º`
														: "—"}
												</span>
											</p>
										</div>
										{/* Opponent pts */}
										<div className="shrink-0 text-center">
											<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-0.5">
												Pts Adv.
											</p>
											<p className="text-on-surface font-headline font-black text-base">
												{nextMatchOpponent.points ?? "—"}
											</p>
										</div>
										{/* GM / GS */}
										<div className="shrink-0 text-center">
											<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-0.5">
												GM / GS Adv.
											</p>
											<p className="text-sm font-black">
												<span className="text-primary">
													{nextMatchOpponent.goalsFor ?? "—"}
												</span>
												<span className="text-on-surface-variant/40 mx-1">
													/
												</span>
												<span className="text-error">
													{nextMatchOpponent.goalsAgainst ?? "—"}
												</span>
											</p>
										</div>
										{/* Opponent form */}
										<div className="shrink-0">
											<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-1">
												Forma Adv.
											</p>
											<div className="flex items-center gap-1">
												{(nextMatchOpponent.last5 || "-----")
													.split("")
													.slice(0, 5)
													.reverse()
													.map((r, i) => (
														<span
															key={`adv-${r}-${i}`}
															className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${r === "V" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : r === "E" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : r === "D" ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-surface text-on-surface-variant border-outline-variant/20"}`}
														>
															{r}
														</span>
													))}
											</div>
										</div>
										{/* Último confronto */}
										{nextMatchOpponent.lastConfrontation &&
											(() => {
												const lc = nextMatchOpponent.lastConfrontation;
												const resultClass =
													lc.result === "V"
														? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
														: lc.result === "E"
															? "bg-amber-500/15 text-amber-400 border-amber-500/30"
															: "bg-red-500/15 text-red-400 border-red-500/30";
												const venueClass =
													lc.venue === "Casa"
														? "bg-emerald-500/20 text-emerald-400"
														: "bg-sky-500/20 text-sky-400";
												const dateLabel =
													lc.competition === "league"
														? `Época ${lc.season} · J${lc.matchweek}`
														: `Época ${lc.season} · Taça (${lc.cupRoundName ?? `Ronda ${lc.cupRound}`})`;
												const tieBreaker = lc.penalties
													? `(p.p. ${lc.penalties.goalsFor}–${lc.penalties.goalsAgainst})`
													: lc.extraTime
														? `(a.p. ${lc.goalsFor + lc.extraTime.goalsFor}–${lc.goalsAgainst + lc.extraTime.goalsAgainst})`
														: null;
												return (
													<div className="shrink-0">
														<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-1">
															Último Confronto
														</p>
														<div className="flex items-center gap-2">
															<span
																className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${resultClass}`}
															>
																{lc.result}
															</span>
															<div className="flex flex-col leading-tight">
																<div className="flex items-center gap-1.5">
																	<span className="text-on-surface font-black text-sm tabular-nums">
																		{lc.goalsFor}–{lc.goalsAgainst}
																	</span>
																	<span
																		className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${venueClass}`}
																	>
																		{lc.venue}
																	</span>
																	{lc.competition === "cup" && (
																		<span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
																			Taça
																		</span>
																	)}
																</div>
																<span className="text-[10px] text-on-surface-variant font-bold">
																	{dateLabel}
																	{tieBreaker ? ` ${tieBreaker}` : ""}
																</span>
															</div>
														</div>
													</div>
												);
											})()}
										{/* Weather Forecast */}
										{nextMatchSummary?.weatherForecast && (
											<div className="shrink-0">
												<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-1">
													Previsão Meteo
												</p>
												<div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-outline-variant/30 bg-surface/60">
													<span className="text-lg">
														{nextMatchSummary.weatherForecast.emoji}
													</span>
													<span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
														{nextMatchSummary.weatherForecast.condition ===
														"sol"
															? "Sol"
															: nextMatchSummary.weatherForecast.condition ===
																	"chuva"
																? "Chuva"
																: nextMatchSummary.weatherForecast.condition ===
																		"chuva_forte"
																	? "Chuva forte"
																	: nextMatchSummary.weatherForecast
																				.condition === "vento"
																		? "Vento"
																		: nextMatchSummary.weatherForecast
																					.condition === "frio"
																			? "Frio"
																			: nextMatchSummary.weatherForecast
																						.condition === "nevoeiro"
																				? "Nevoeiro"
																				: nextMatchSummary.weatherForecast
																							.condition === "neve"
																					? "Neve"
																					: "—"}
													</span>
												</div>
											</div>
										)}
										{/* Referee */}
										<div className="shrink-0">
											<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black mb-1">
												Árbitro
											</p>
											<button
												type="button"
												onClick={() => setRefereePopup(nextMatchReferee)}
												className="flex items-center gap-2 rounded-md border border-outline-variant/30 bg-surface px-3 py-2 hover:border-tertiary/40 transition-colors"
											>
												<span className="font-black text-white text-sm">
													{nextMatchReferee?.name || "A definir"}
												</span>
												<span className="text-[10px] uppercase tracking-widest font-black text-tertiary">
													Ver balança
												</span>
											</button>
										</div>
									</div>
								) : (
									<div className="px-5 py-4 text-sm font-bold text-on-surface-variant">
										{nextMatchSummaryLoading
											? "A carregar próximo jogo…"
											: "Sem jogo disponível."}
									</div>
								)}
							</div>
						)}
						<div className="grid grid-cols-1 gap-6">
							<div>
								<AnimatePresence mode="wait" initial={false}>
									<motion.div
										key={activeTab}
										initial={{ opacity: 0, y: 14 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -8 }}
										transition={{
											duration: 0.22,
											ease: [0.25, 0.46, 0.45, 0.94],
										}}
									>
										{activeTab === "live" && (matchResults || matchAction) && (
											<div
												className={`bg-surface-container text-on-surface font-body p-3 sm:p-6 border border-outline-variant/20 shadow-sm relative overflow-hidden${isMatchInProgress ? " rounded-lg" : " min-h-150 rounded-lg"}`}
											>
												{/* ── HERO: MY MATCH ─────────────────────── */}
												{matchResults &&
													(() => {
														const myMatch = matchResults.results.find(
															(m) =>
																m.homeTeamId === me.teamId ||
																m.awayTeamId === me.teamId,
														);
														if (!myMatch) return null;
														const hInfo = teams.find(
															(t) => t.id === myMatch.homeTeamId,
														);
														const aInfo = teams.find(
															(t) => t.id === myMatch.awayTeamId,
														);
														const matchEvents = myMatch.events || [];
														const weatherEvent = matchEvents.find(
															(e) => e.type === "weather",
														);

														// If ET is running for other fixtures but my match was decided at 90', hide this block
														if (isCupExtraTime) {
															const reg90Home = matchEvents.filter(
																(e) =>
																	e.minute <= 90 &&
																	e.type === "goal" &&
																	e.team === "home",
															).length;
															const reg90Away = matchEvents.filter(
																(e) =>
																	e.minute <= 90 &&
																	e.type === "goal" &&
																	e.team === "away",
															).length;
															if (reg90Home !== reg90Away) return null;
														}

														const homeGoals = matchEvents.filter(
															(e) =>
																e.minute <= liveMinute &&
																(e.type === "goal" ||
																	e.type === "penalty_goal") &&
																e.team === "home",
														);
														const awayGoals = matchEvents.filter(
															(e) =>
																e.minute <= liveMinute &&
																(e.type === "goal" ||
																	e.type === "penalty_goal") &&
																e.team === "away",
														);
														const maxMinute = isCupExtraTime ? 120 : 90;
														const progress = Math.min(
															100,
															(liveMinute / maxMinute) * 100,
														);

														return (
															<div className="relative overflow-hidden mb-4 rounded-lg bg-surface-container-low border border-outline-variant/10">
																{/* Stadium radial glow */}
																<div
																	className="absolute inset-0 pointer-events-none"
																	style={{
																		background: `radial-gradient(ellipse 90% 50% at 50% 0%, ${hInfo?.color_primary || "#333"}18 0%, transparent 70%)`,
																	}}
																/>

																<div className="relative z-10 flex flex-col items-center px-4 pt-5 pb-4">
																	{/* Match label */}
																	<div className="flex items-center justify-between w-full mb-5">
																		<div className="flex items-center gap-2">
																			{isPlayingMatch && (
																				<span className="w-2 h-2 rounded-full bg-error animate-pulse shrink-0" />
																			)}
																			<span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/50 font-black">
																				{isCupMatch
																					? `Taça · ${cupMatchRoundName}`
																					: `${DIVISION_NAMES[hInfo?.division] || ""} · Jornada ${matchResults.matchweek}`}
																			</span>
																		</div>
																	</div>

																	{/* Banner de pausa de substituição — visível aos outros treinadores */}
																	{substitutionPause && (
																		<div className="w-full mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
																			<span className="material-symbols-outlined text-[16px] shrink-0">
																				pause_circle
																			</span>
																			<span>
																				{substitutionPause.coachName} está a
																				fazer substituições...
																			</span>
																		</div>
																	)}

																	{/* Stadium + attendance — above teams/score */}
																	{myMatch.attendance && (
																		<div className="flex items-center justify-center gap-1 text-[10px] text-on-surface-variant/50 mb-3">
																			<span className="text-zinc-400 text-[11px] font-bold">
																				{hInfo?.stadium_name
																					? `${hInfo.stadium_name} `
																					: ""}
																				🏟{" "}
																				{myMatch.attendance.toLocaleString(
																					"pt-PT",
																				)}{" "}
																				adeptos
																			</span>
																		</div>
																	)}

																	{/* Weather badge */}
																	{weatherEvent && (
																		<div className="flex items-center justify-center gap-1 text-[10px] text-on-surface-variant/50 mb-3">
																			<span>{weatherEvent.emoji}</span>
																			<span>
																				{WEATHER_LABELS[weatherEvent.emoji] ||
																					""}
																			</span>
																		</div>
																	)}

																	{/* Teams + Score row */}
																	<div className="flex justify-center items-start gap-4 sm:gap-10 w-full max-w-xl">
																		{/* Home team */}
																		<div className="flex flex-col items-center gap-2 flex-1 min-w-0">
																			<div className="relative mb-1">
																				<span
																					className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center text-base sm:text-xl font-black border-2 ${myMatch.homeTeamId === me.teamId ? "border-primary" : "border-outline-variant/20"}`}
																					style={{
																						backgroundColor:
																							hInfo?.color_primary || "#333",
																						color:
																							hInfo?.color_secondary || "#fff",
																					}}
																				>
																					{(hInfo?.name || "")
																						.substring(0, 3)
																						.toUpperCase()}
																				</span>
																				{(() => {
																					const homeCoach = players.find(
																						(p) =>
																							p.teamId === myMatch.homeTeamId,
																					);
																					if (!homeCoach) return null;
																					const isMe =
																						myMatch.homeTeamId === me.teamId;
																					return (
																						<div
																							className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-sm font-black text-[8px] tracking-widest uppercase whitespace-nowrap shadow-lg ${isMe ? "bg-primary text-on-primary" : "bg-amber-500 text-zinc-950"}`}
																						>
																							{homeCoach.name}
																						</div>
																					);
																				})()}
																			</div>
																			<h2 className="text-sm sm:text-base font-headline font-black tracking-tighter uppercase leading-none text-center mt-2 truncate w-full px-1">
																				{hInfo?.name}
																			</h2>
																			{/* Home events */}
																			<div className="flex flex-col items-start w-full gap-0.5">
																				{matchEvents
																					.filter(
																						(e) =>
																							e.minute <= liveMinute &&
																							e.team === "home" &&
																							[
																								"goal",
																								"penalty_goal",
																								"own_goal",
																								"var_disallowed",
																								"var_goal_pending",
																								"yellow",
																								"red",
																								"injury",
																								"substitution",
																								"halftime_sub",
																							].includes(e.type),
																					)
																					.sort((a, b) => a.minute - b.minute)
																					.map((e, i) => {
																						const isSub =
																							e.type === "substitution" ||
																							e.type === "halftime_sub";
																						const icon =
																							e.type === "goal" ||
																							e.type === "penalty_goal" ||
																							e.type === "var_goal_pending"
																								? "⚽"
																								: e.type === "own_goal"
																									? "⚽🔙"
																									: e.type === "var_disallowed"
																										? "🚩"
																										: e.type === "yellow"
																											? "🟨"
																											: e.type === "red"
																												? "🟥"
																												: e.type === "injury"
																													? "🚑"
																													: isSub
																														? "🔁"
																														: "";
																						const subOutName =
																							e.type === "halftime_sub"
																								? e.outPlayerName
																								: null;
																						const name =
																							e.playerName ||
																							e.player_name ||
																							e.player ||
																							"?";
																						const minuteLabel =
																							e.type === "halftime_sub"
																								? "HT"
																								: `${e.minute}'`;
																						return (
																							<div
																								key={`${e.minute}-${e.type}-${e.playerId || name}-${i}`}
																								className="flex items-center gap-1 text-[9px] leading-tight w-full"
																							>
																								<span className="text-on-surface-variant/40 tabular-nums shrink-0">
																									{minuteLabel}
																								</span>
																								<span className="shrink-0">
																									{icon}
																								</span>
																								<span
																									className={`font-bold truncate min-w-0 ${e.type === "goal" || e.type === "penalty_goal" || e.type === "var_goal_pending" ? "text-primary" : e.type === "own_goal" ? "text-orange-400" : e.type === "var_disallowed" ? "text-amber-400/60 line-through" : e.type === "red" ? "text-red-400" : isSub ? "text-emerald-400/80" : "text-on-surface-variant/70"}`}
																								>
																									{isSub && subOutName ? (
																										<span className="opacity-60 line-through mr-0.5">
																											{subOutName}
																										</span>
																									) : null}
																									<PlayerLink
																										playerId={e.playerId}
																									>
																										{name}
																									</PlayerLink>
																								</span>
																							</div>
																						);
																					})}
																			</div>
																		</div>

																		{/* Score */}
																		{(() => {
																			const myFlashHome =
																				goalFlashRef[
																					`${myMatch.homeTeamId}_${myMatch.awayTeamId}_home`
																				];
																			const myFlashAway =
																				goalFlashRef[
																					`${myMatch.homeTeamId}_${myMatch.awayTeamId}_away`
																				];
																			const nowTs = Date.now();
																			const myHomeFlashing =
																				myFlashHome &&
																				nowTs - myFlashHome < 1500;
																			const myAwayFlashing =
																				myFlashAway &&
																				nowTs - myFlashAway < 1500;
																			return (
																				<button
																					onClick={() => {
																						if (
																							isPlayingMatch &&
																							!isMatchActionPending
																						) {
																							socket.emit(
																								"request_substitution",
																							);
																						} else {
																							setMatchDetailFixture(myMatch);
																							setShowMatchDetail(true);
																						}
																					}}
																					className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
																				>
																					<div className="font-headline text-5xl sm:text-7xl font-black tracking-tighter flex items-center gap-3">
																						<span
																							style={{
																								color: myHomeFlashing
																									? "#ff4444"
																									: undefined,
																								transition: myHomeFlashing
																									? "none"
																									: "color 1.25s ease",
																							}}
																						>
																							{homeGoals.length}
																						</span>
																						<span className="text-on-surface/20 text-3xl sm:text-5xl">
																							:
																						</span>
																						<span
																							style={{
																								color: myAwayFlashing
																									? "#ff4444"
																									: undefined,
																								transition: myAwayFlashing
																									? "none"
																									: "color 1.25s ease",
																							}}
																						>
																							{awayGoals.length}
																						</span>
																					</div>
																				</button>
																			);
																		})()}

																		{/* Away team */}
																		<div className="flex flex-col items-center gap-2 flex-1 min-w-0">
																			<div className="relative mb-1">
																				<span
																					className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center text-base sm:text-xl font-black border-2 ${myMatch.awayTeamId === me.teamId ? "border-primary" : "border-outline-variant/20"}`}
																					style={{
																						backgroundColor:
																							aInfo?.color_primary || "#333",
																						color:
																							aInfo?.color_secondary || "#fff",
																					}}
																				>
																					{(aInfo?.name || "")
																						.substring(0, 3)
																						.toUpperCase()}
																				</span>
																				{(() => {
																					const awayCoach = players.find(
																						(p) =>
																							p.teamId === myMatch.awayTeamId,
																					);
																					if (!awayCoach) return null;
																					const isMe =
																						myMatch.awayTeamId === me.teamId;
																					return (
																						<div
																							className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-sm font-black text-[8px] tracking-widest uppercase whitespace-nowrap shadow-lg ${isMe ? "bg-primary text-on-primary" : "bg-amber-500 text-zinc-950"}`}
																						>
																							{awayCoach.name}
																						</div>
																					);
																				})()}
																			</div>
																			<h2 className="text-sm sm:text-base font-headline font-black tracking-tighter uppercase leading-none text-center mt-2 truncate w-full px-1">
																				{aInfo?.name}
																			</h2>
																			{/* Away events */}
																			<div className="flex flex-col items-end w-full gap-0.5">
																				{matchEvents
																					.filter(
																						(e) =>
																							e.minute <= liveMinute &&
																							e.team === "away" &&
																							[
																								"goal",
																								"penalty_goal",
																								"own_goal",
																								"var_disallowed",
																								"var_goal_pending",
																								"yellow",
																								"red",
																								"injury",
																								"substitution",
																								"halftime_sub",
																							].includes(e.type),
																					)
																					.sort((a, b) => a.minute - b.minute)
																					.map((e, i) => {
																						const isSub =
																							e.type === "substitution" ||
																							e.type === "halftime_sub";
																						const icon =
																							e.type === "penalty_goal"
																								? "⚽(Pen)"
																								: e.type === "goal" ||
																										e.type ===
																											"var_goal_pending"
																									? "⚽"
																									: e.type === "own_goal"
																										? "⚽🔙"
																										: e.type ===
																												"var_disallowed"
																											? "🚩"
																											: e.type === "yellow"
																												? "🟨"
																												: e.type === "red"
																													? "🟥"
																													: e.type === "injury"
																														? "🚑"
																														: isSub
																															? "🔁"
																															: "";
																						const subOutName =
																							e.type === "halftime_sub"
																								? e.outPlayerName
																								: null;
																						const name =
																							e.playerName ||
																							e.player_name ||
																							e.player ||
																							"?";
																						const minuteLabel =
																							e.type === "halftime_sub"
																								? "HT"
																								: `${e.minute}'`;
																						return (
																							<div
																								key={`${e.minute}-${e.type}-${e.playerId || name}-${i}`}
																								className="flex items-center gap-1 text-[9px] leading-tight w-full justify-end"
																							>
																								<span
																									className={`font-bold truncate min-w-0 ${e.type === "goal" || e.type === "penalty_goal" || e.type === "var_goal_pending" ? "text-primary" : e.type === "own_goal" ? "text-orange-400" : e.type === "var_disallowed" ? "text-amber-400/60 line-through" : e.type === "red" ? "text-red-400" : isSub ? "text-emerald-400/80" : "text-on-surface-variant/70"}`}
																								>
																									{isSub && subOutName ? (
																										<span className="opacity-60 line-through mr-0.5">
																											{subOutName}
																										</span>
																									) : null}
																									<PlayerLink
																										playerId={e.playerId}
																									>
																										{name}
																									</PlayerLink>
																								</span>
																								<span className="shrink-0">
																									{icon}
																								</span>
																								<span className="text-on-surface-variant/40 tabular-nums shrink-0">
																									{minuteLabel}
																								</span>
																							</div>
																						);
																					})}
																			</div>
																		</div>
																	</div>

																	{/* Progress bar + attendance */}
																	<div className="w-full max-w-xs sm:max-w-sm mt-5 space-y-1.5">
																		<div className="relative h-1 bg-outline-variant/20 rounded-full overflow-hidden">
																			<div
																				className="h-full bg-primary transition-all duration-1000"
																				style={{ width: `${progress}%` }}
																			/>
																			{matchEvents
																				.filter(
																					(e) =>
																						e.minute <= liveMinute &&
																						[
																							"goal",
																							"penalty_goal",
																							"own_goal",
																							"red",
																							"penalty_miss",
																						].includes(e.type),
																				)
																				.map((e, i) => {
																					const isHomeEvent = e.team === "home";
																					const dotColor =
																						e.type === "goal" ||
																						e.type === "penalty_goal" ||
																						e.type === "own_goal"
																							? isHomeEvent
																								? hInfo?.color_primary || "#fff"
																								: aInfo?.color_primary || "#aaa"
																							: e.type === "red"
																								? "#ef4444"
																								: "#a855f7"; // penalty_miss → purple
																					return (
																						<span
																							key={`${e.minute}-${e.type}-${e.playerId || i}`}
																							className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
																							style={{
																								left: `${Math.min(98, Math.max(2, (e.minute / maxMinute) * 100))}%`,
																							}}
																						>
																							<span
																								className="block w-1.5 h-1.5 rounded-full"
																								style={{
																									backgroundColor: dotColor,
																								}}
																							/>
																						</span>
																					);
																				})}
																		</div>
																		<div className="flex justify-between text-[14px] text-on-surface-variant/30">
																			<span>0'</span>
																			<span className="font-bold text-primary/60">
																				{liveMinute}'
																			</span>
																			<span>
																				{isCupExtraTime ? "120'" : "90'"}
																			</span>
																		</div>
																		{/* ── Commentary phrase ── */}
																		{(() => {
																			const latestWithText = [...matchEvents]
																				.filter(
																					(e) =>
																						e.minute <= liveMinute && e.text,
																				)
																				.sort((a, b) => b.minute - a.minute)[0];
																			if (!latestWithText) return null;
																			// Strip leading "[NN']" or "[HT]" prefix plus optional emoji
																			const phrase = latestWithText.text
																				.replace(
																					/^\[(?:\d+'|HT)\]\s*\S*\s*/,
																					"",
																				)
																				.trim();
																			if (!phrase) return null;
																			const isGoal =
																				latestWithText.type === "goal" ||
																				latestWithText.type === "penalty_goal";
																			return (
																				<div
																					key={`${latestWithText.minute}-${latestWithText.type}`}
																					className="w-full text-center pt-3 pb-0.5 px-2"
																					style={{
																						animation:
																							"commentaryFadeIn 0.6s ease",
																					}}
																				>
																					<p
																						className={`text-[11px] sm:text-[16px] leading-snug italic font-medium tracking-wide ${
																							isGoal
																								? "text-primary/90"
																								: "text-on-surface-variant/55"
																						}`}
																						style={{
																							fontFamily:
																								"Georgia, 'Times New Roman', serif",
																						}}
																					>
																						"{phrase}"
																					</p>
																				</div>
																			);
																		})()}
																	</div>
																</div>
															</div>
														);
													})()}

												{/* ── MULTIVIEW GRID ─────────────────────── */}
												{!isCupMatch && (
													<div className="overflow-x-auto mt-2">
														<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4 min-w-[360px]">
															{(() => {
																const myDiv = teams.find(
																	(t) => t.id === me.teamId,
																)?.division;
																const divs = [
																	myDiv,
																	...[1, 2, 3, 4].filter((d) => d !== myDiv),
																];
																return divs.map((div) => {
																	const isMyDiv = myDiv === div;
																	const divMatches = matchResults.results
																		.filter(
																			(m) =>
																				teams.find((t) => t.id === m.homeTeamId)
																					?.division === div,
																		)
																		.filter(
																			(m) =>
																				m.homeTeamId !== me.teamId &&
																				m.awayTeamId !== me.teamId,
																		);
																	return (
																		<div
																			key={div}
																			className="flex flex-col gap-2"
																		>
																			{/* Division header */}
																			<div
																				className={`px-3 py-2 rounded-t-md border-b-2 bg-surface-container-high ${isMyDiv ? "border-primary" : "border-outline-variant/20"}`}
																			>
																				<h3
																					className={`font-headline font-extrabold text-[9px] sm:text-[10px] lg:text-[11px] tracking-tighter uppercase ${isMyDiv ? "text-primary" : "text-on-surface/50"}`}
																				>
																					{DIVISION_NAMES[div] || `Div ${div}`}
																				</h3>
																			</div>
																			{/* Match cards */}
																			<div className="flex flex-col gap-1.5">
																				{divMatches.length === 0 && (
																					<div className="text-[10px] text-on-surface-variant/30 px-3 py-2 text-center italic">
																						Sem jogos
																					</div>
																				)}
																				{divMatches.map((match, idx) => {
																					const hInfo = teams.find(
																						(t) => t.id === match.homeTeamId,
																					);
																					const aInfo = teams.find(
																						(t) => t.id === match.awayTeamId,
																					);
																					const matchEvents =
																						match.events || [];
																					const currentHome =
																						matchEvents.filter(
																							(e) =>
																								e.minute <= liveMinute &&
																								(e.type === "goal" ||
																									e.type === "penalty_goal") &&
																								e.team === "home",
																						);
																					const currentAway =
																						matchEvents.filter(
																							(e) =>
																								e.minute <= liveMinute &&
																								(e.type === "goal" ||
																									e.type === "penalty_goal") &&
																								e.team === "away",
																						);
																					const isHumanMatch = players.some(
																						(p) =>
																							p.teamId === match.homeTeamId ||
																							p.teamId === match.awayTeamId,
																					);
																					const flashHome =
																						goalFlashRef[
																							`${match.homeTeamId}_${match.awayTeamId}_home`
																						];
																					const flashAway =
																						goalFlashRef[
																							`${match.homeTeamId}_${match.awayTeamId}_away`
																						];
																					const now = Date.now();
																					const homeFlashing =
																						flashHome && now - flashHome < 1500;
																					const awayFlashing =
																						flashAway && now - flashAway < 1500;
																					const lastHomeEvent =
																						getMatchLastEventText(
																							matchEvents,
																							liveMinute,
																							"home",
																						);
																					const lastAwayEvent =
																						getMatchLastEventText(
																							matchEvents,
																							liveMinute,
																							"away",
																						);
																					return (
																						<button
																							key={idx}
																							onClick={() => {
																								setMatchDetailFixture(match);
																								setShowMatchDetail(true);
																							}}
																							className={`w-full text-left rounded-md overflow-hidden transition-colors ${isHumanMatch ? "bg-primary-container/10 border-l-2 border-primary/60" : "bg-surface-container hover:bg-surface-bright"}`}
																						>
																							<div className="flex justify-between items-center px-3 py-2">
																								<span className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
																									<span
																										className="w-2 h-2 rounded-sm shrink-0"
																										style={{
																											background:
																												hInfo?.color_primary ||
																												"#555",
																										}}
																									/>
																									<span className="flex flex-col min-w-0">
																										<span
																											className={`text-[9px] sm:text-[10px] lg:text-[11px] font-bold truncate ${isHumanMatch && players.some((p) => p.teamId === match.homeTeamId) ? "text-primary" : "text-on-surface/80"}`}
																										>
																											{hInfo?.name}
																										</span>
																										{(() => {
																											const c = players.find(
																												(p) =>
																													p.teamId ===
																													match.homeTeamId,
																											);
																											return c ? (
																												<span className="text-[8px] sm:text-[9px] text-amber-400 font-bold truncate leading-none">
																													{c.name}
																												</span>
																											) : null;
																										})()}
																									</span>
																								</span>
																								<span className="font-headline font-black text-xs sm:text-sm shrink-0 flex items-center gap-1 px-1">
																									<span
																										style={{
																											color: homeFlashing
																												? "#ff4444"
																												: undefined,
																											transition: homeFlashing
																												? "none"
																												: "color 1.25s ease",
																										}}
																									>
																										{currentHome.length}
																									</span>
																									<span className="text-on-surface/20 text-xs">
																										-
																									</span>
																									<span
																										style={{
																											color: awayFlashing
																												? "#ff4444"
																												: undefined,
																											transition: awayFlashing
																												? "none"
																												: "color 1.25s ease",
																										}}
																									>
																										{currentAway.length}
																									</span>
																								</span>
																								<span className="flex items-center gap-1.5 flex-1 min-w-0 pl-1 justify-end">
																									<span className="flex flex-col min-w-0 items-end">
																										<span
																											className={`text-[9px] sm:text-[10px] lg:text-[11px] font-bold truncate ${isHumanMatch && players.some((p) => p.teamId === match.awayTeamId) ? "text-primary" : "text-on-surface/80"}`}
																										>
																											{aInfo?.name}
																										</span>
																										{(() => {
																											const c = players.find(
																												(p) =>
																													p.teamId ===
																													match.awayTeamId,
																											);
																											return c ? (
																												<span className="text-[8px] sm:text-[9px] text-amber-400 font-bold truncate leading-none">
																													{c.name}
																												</span>
																											) : null;
																										})()}
																									</span>
																									<span
																										className="w-2 h-2 rounded-sm shrink-0"
																										style={{
																											background:
																												aInfo?.color_primary ||
																												"#555",
																										}}
																									/>
																								</span>
																							</div>
																							{(lastHomeEvent ||
																								lastAwayEvent) && (
																								<div className="flex px-3 pb-1.5 gap-1">
																									<span className="flex-1 text-[8px] sm:text-[9px] text-on-surface-variant/40 truncate">
																										{lastHomeEvent}
																									</span>
																									<span className="flex-1 text-[8px] sm:text-[9px] text-on-surface-variant/40 truncate text-right">
																										{lastAwayEvent}
																									</span>
																								</div>
																							)}
																						</button>
																					);
																				})}
																			</div>
																		</div>
																	);
																});
															})()}
														</div>
													</div>
												)}

												{/* ── CUP MULTIVIEW (single list, no division groups) ── */}
												{isCupMatch && matchResults?.results && (
													<div className="grid grid-cols-1 md:grid-cols-2 gap-1">
														{matchResults.results
															.filter(
																(m) =>
																	m.homeTeamId !== me.teamId &&
																	m.awayTeamId !== me.teamId,
															)
															.filter((m) => {
																// After 90', only show games still in extra time (score tied at 90)
																if (liveMinute <= 90) return true;
																const goals90Home = (m.events || []).filter(
																	(e) =>
																		e.minute <= 90 &&
																		e.type === "goal" &&
																		e.team === "home",
																).length;
																const goals90Away = (m.events || []).filter(
																	(e) =>
																		e.minute <= 90 &&
																		e.type === "goal" &&
																		e.team === "away",
																).length;
																return goals90Home === goals90Away;
															})
															.map((match, idx) => {
																const hInfo = teams.find(
																	(t) => t.id === match.homeTeamId,
																);
																const aInfo = teams.find(
																	(t) => t.id === match.awayTeamId,
																);
																const matchEvents = match.events || [];
																const currentHome = matchEvents.filter(
																	(e) =>
																		e.minute <= liveMinute &&
																		e.type === "goal" &&
																		e.team === "home",
																);
																const currentAway = matchEvents.filter(
																	(e) =>
																		e.minute <= liveMinute &&
																		e.type === "goal" &&
																		e.team === "away",
																);
																const isHumanMatch = players.some(
																	(p) =>
																		p.teamId === match.homeTeamId ||
																		p.teamId === match.awayTeamId,
																);
																const flashHome =
																	goalFlashRef[
																		`${match.homeTeamId}_${match.awayTeamId}_home`
																	];
																const flashAway =
																	goalFlashRef[
																		`${match.homeTeamId}_${match.awayTeamId}_away`
																	];
																// eslint-disable-next-line react-hooks/purity
																const now = Date.now();
																const homeFlashing =
																	flashHome && now - flashHome < 1500;
																const awayFlashing =
																	flashAway && now - flashAway < 1500;

																return (
																	<div
																		key={idx}
																		className={`bg-surface-container-low rounded-md overflow-hidden ${isHumanMatch ? "border-l-2 border-l-primary/50" : ""}`}
																	>
																		<div className="flex items-center">
																			<div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 min-w-0">
																				<span
																					className="w-2 h-2 rounded-full shrink-0"
																					style={{
																						backgroundColor:
																							hInfo?.color_primary || "#666",
																					}}
																				/>
																				<span className="flex flex-col min-w-0">
																					<span className="text-sm font-bold text-on-surface truncate">
																						{hInfo?.name}
																					</span>
																					{(() => {
																						const c = players.find(
																							(p) =>
																								p.teamId === match.homeTeamId,
																						);
																						return c ? (
																							<span className="text-[8px] text-amber-400 font-bold truncate leading-none">
																								{c.name}
																							</span>
																						) : null;
																					})()}
																				</span>
																			</div>
																			<button
																				onClick={() => {
																					setMatchDetailFixture(match);
																					setShowMatchDetail(true);
																				}}
																				title="Ver detalhes da partida"
																				className="px-3 py-1.5 bg-surface-container hover:bg-surface-bright text-on-surface text-center font-headline min-w-13 flex gap-1 items-center justify-center text-sm leading-none transition-colors cursor-pointer"
																			>
																				<span
																					className="font-black"
																					style={{
																						color: homeFlashing
																							? "#ff4444"
																							: undefined,
																						transition: homeFlashing
																							? "none"
																							: "color 1.25s ease",
																					}}
																				>
																					{currentHome.length}
																				</span>
																				<span className="text-on-surface-variant/30 text-xs">
																					-
																				</span>
																				<span
																					className="font-black"
																					style={{
																						color: awayFlashing
																							? "#ff4444"
																							: undefined,
																						transition: awayFlashing
																							? "none"
																							: "color 1.25s ease",
																					}}
																				>
																					{currentAway.length}
																				</span>
																			</button>
																			<div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 min-w-0 justify-end">
																				<span className="flex flex-col min-w-0 items-end">
																					<span className="text-sm font-bold text-on-surface truncate">
																						{aInfo?.name}
																					</span>
																					{(() => {
																						const c = players.find(
																							(p) =>
																								p.teamId === match.awayTeamId,
																						);
																						return c ? (
																							<span className="text-[8px] text-amber-400 font-bold truncate leading-none">
																								{c.name}
																							</span>
																						) : null;
																					})()}
																				</span>
																				<span
																					className="w-2 h-2 rounded-full shrink-0"
																					style={{
																						backgroundColor:
																							aInfo?.color_primary || "#666",
																					}}
																				/>
																			</div>
																		</div>
																		<div className="flex text-[9px] text-on-surface-variant/40 px-2.5 pb-1">
																			<span className="flex-1 truncate">
																				{getMatchLastEventText(
																					matchEvents,
																					liveMinute,
																					"home",
																				)}
																			</span>
																			<span className="flex-1 truncate text-right">
																				{getMatchLastEventText(
																					matchEvents,
																					liveMinute,
																					"away",
																				)}
																			</span>
																		</div>
																	</div>
																);
															})}
													</div>
												)}
											</div>
										)}

										{activeTab === "standings" && (
											<StandingsTab
												teams={teams}
												teamForms={teamForms}
												topScorers={topScorers}
												myTeamId={me.teamId}
												completedJornada={completedJornada}
												matchweekCount={matchweekCount}
												palmares={palmares}
												onTeamClick={handleOpenTeamSquad}
												players={players}
												allMatchResults={allMatchResults}
											/>
										)}

										{activeTab === "bracket" && (
											<BracketTab
												bracketData={cupBracketData}
												me={me}
												players={players}
											/>
										)}

										{activeTab === "cup" && (
											<CupTab
												cupRoundResults={cupRoundResults}
												cupDraw={cupDraw}
												me={me}
												teams={teams}
												cupResultsFilter={cupResultsFilter}
												setCupResultsFilter={setCupResultsFilter}
											/>
										)}

										{activeTab === "calendario" && (
											<CalendarioTab
												calendarData={calendarData}
												me={me}
												teams={teams}
												seasonYear={seasonYear}
												calFilter={calFilter}
												setCalFilter={setCalFilter}
												matchweekCount={matchweekCount}
												handleOpenTeamSquad={handleOpenTeamSquad}
											/>
										)}
										{activeTab === "club" && (
											<ClubTab
												teamInfo={teamInfo}
												seasonYear={seasonYear}
												me={me}
												currentBudget={currentBudget}
												totalWeeklyWage={totalWeeklyWage}
												loanAmount={loanAmount}
												palmaresTeamId={palmaresTeamId}
												palmares={palmares}
												clubNews={clubNews}
											/>
										)}

										{activeTab === "finances" && (
											<FinancesTab
												financeData={financeData}
												totalWeeklyWage={totalWeeklyWage}
												completedJornada={completedJornada}
												loanInterestPerWeek={loanInterestPerWeek}
												loanAmount={loanAmount}
												currentBudget={currentBudget}
												seasonYear={seasonYear}
												capacityRevPerGame={capacityRevPerGame}
												mySquad={mySquad}
												showTransferSales={showTransferSales}
												setShowTransferSales={setShowTransferSales}
												showTransferPurchases={showTransferPurchases}
												setShowTransferPurchases={setShowTransferPurchases}
												showTicketBreakdown={showTicketBreakdown}
												setShowTicketBreakdown={setShowTicketBreakdown}
												setGameDialog={setGameDialog}
												teamInfo={teamInfo}
											/>
										)}

										{activeTab === "players" && (
											<PlayersTab
												mySquad={mySquad}
												annotatedSquad={annotatedSquad}
												totalWeeklyWage={totalWeeklyWage}
												currentBudget={currentBudget}
												teamInfo={teamInfo}
												matchweekCount={matchweekCount}
												isPlayingMatch={isPlayingMatch}
												showHalftimePanel={showHalftimePanel}
												renewPlayerContract={renewPlayerContract}
												listPlayerAuction={listPlayerAuction}
												listPlayerFixed={listPlayerFixed}
												removeFromTransferList={removeFromTransferList}
												onOpenPlayerHistory={(player) =>
													socket.emit("requestPlayerHistory", {
														playerId: player.id,
													})
												}
											/>
										)}

										{activeTab === "squad" && (
											<TeamSquadView
												selectedTeam={selectedTeam}
												selectedTeamSquad={selectedTeamSquad}
												selectedTeamLoading={selectedTeamLoading}
												me={me}
												players={players}
												palmares={palmares}
												palmaresTeamId={palmaresTeamId}
												setTransferProposalModal={setTransferProposalModal}
												myBudget={currentBudget}
												currentMatchweek={matchweekCount + 1}
												calendarData={calendarData}
												teams={teams}
											/>
										)}

										{activeTab === "training" && (
											<TrainingTab
												me={me}
												players={players}
												matchweekCount={matchweekCount}
											/>
										)}

										{activeTab === "tactic" && <TacticsView />}

										{activeTab === "market" && (
											<TransferHub
												players={filteredMarketPlayers}
												teams={teams}
												budget={teamInfo?.budget ?? 0}
												me={me}
												marketPositionFilter={marketPositionFilter}
												setMarketPositionFilter={setMarketPositionFilter}
												marketSort={marketSort}
												setMarketSort={setMarketSort}
												isSameTeamId={isSameTeamId}
												buyPlayer={buyPlayer}
												openAuctionBid={openAuctionBid}
												onOpenPlayerHistory={(player) =>
													socket.emit("requestPlayerHistory", {
														playerId: player.id,
													})
												}
												setGameDialog={setGameDialog}
												matchweekCount={matchweekCount}
											/>
										)}

										{activeTab === "leiloes" && (
											<AuctionsPage
												activeAuctions={activeAuctions}
												me={me}
												teams={teams}
												teamInfo={teamInfo}
												matchweekCount={matchweekCount}
												socket={socket}
											/>
										)}

										{activeTab === "user_settings" && (
											<UserSettingsPage
												me={me}
												teamInfo={teamInfo}
												palmares={palmares}
												backendUrl={backendUrl}
												avatarSeed={avatarSeed}
												onAvatarSeedChange={setAvatarSeed}
												onBack={() => setActiveTab("club")}
												onLogout={handleLogout}
												onLeaveRoom={() => {
													if (me?.roomCode) {
														socket.emit("leaveRoom");
														try {
															const s = JSON.parse(
																window.localStorage.getItem(
																	"cashballSession",
																) || "{}",
															);
															window.localStorage.setItem(
																"cashballSession",
																JSON.stringify({
																	name: s.name,
																	password: s.password,
																	roomCode: "",
																}),
															);
														} catch {
															/* ignorar */
														}
													}
													resetGameState();
													setMe(null);
													setAuthPhase("mode");
												}}
											/>
										)}
									</motion.div>
								</AnimatePresence>
							</div>
						</div>
					</div>
				</main>
			)}

			<TransferProposalModal
				transferProposalModal={transferProposalModal}
				setTransferProposalModal={setTransferProposalModal}
			/>

			{/* ── Auction toast notification ─────────────────────────────────── */}
			<AuctionNotification
				activeAuctions={activeAuctions}
				currentPage={activeTab}
				onNavigateToAuctions={() => {
					setActiveTab("leiloes");
					window.scrollTo(0, 0);
				}}
			/>
			<RefereePopup
				refereePopup={refereePopup}
				closeRefereePopup={closeRefereePopup}
				teamInfo={teamInfo}
				nextMatchOpponent={nextMatchOpponent}
			/>

			<GameDialog dialog={gameDialog} onClose={() => setGameDialog(null)} />

			<PenaltySuspensePopup penaltySuspense={penaltySuspense} />

			<CupDrawPopup
				showCupDrawPopup={showCupDrawPopup}
				cupDraw={cupDraw}
				cupDrawRevealIdx={cupDrawRevealIdx}
				me={me}
				players={players}
				setShowCupDrawPopup={setShowCupDrawPopup}
				setCupDrawRevealIdx={setCupDrawRevealIdx}
			/>

			<PenaltyShootoutPopup
				cupPenaltyPopup={cupPenaltyPopup}
				cupPenaltyKickIdx={cupPenaltyKickIdx}
				teams={teams}
				setCupPenaltyPopup={setCupPenaltyPopup}
				setCupPenaltyKickIdx={setCupPenaltyKickIdx}
			/>

			{panelMode !== null && (
				<MatchPage
					key={panelMode}
					mode={panelMode}
					onClose={handleCloseMatch}
					fixture={panelFixture}
					liveMinute={liveMinute}
					teams={teams}
					isCupMatch={isCupMatch}
					cupMatchRoundName={cupMatchRoundName}
					currentJornada={currentJornada}
					isPlayingMatch={isPlayingMatch}
					sidebarCollapsed={sidebarCollapsed}
					onReady={handleHalftimeReady}
					isReady={panelIsReady}
					cupPreMatch={cupPreMatch}
					myTeamInCup={myTeamInCup}
					myTeamId={me?.teamId}
					redCardedHalftimeIds={redCardedHalftimeIds}
					injuredHalftimeIds={injuredHalftimeIds}
					matchAction={matchAction}
					injuryCountdown={injuryCountdown}
					onResolveAction={handleResolveMatchAction}
				/>
			)}

			<DismissalModal
				dismissalModal={dismissalModal}
				onContinue={() => setDismissalModal(null)}
			/>

			<WelcomeModal
				welcomeModal={dismissalModal ? null : welcomeModal}
				me={me}
				setWelcomeModal={setWelcomeModal}
			/>

			<JobOfferModal
				jobOfferModal={jobOfferModal}
				setJobOfferModal={setJobOfferModal}
			/>

			<SeasonEndModal
				data={seasonEndModal}
				teams={teams}
				me={me}
				onClose={() => setSeasonEndModal(null)}
			/>

			<NewsTicker
				newsTickerItems={newsTickerItems}
				hidden={isMatchInProgress}
			/>

			<PlayerHistoryModal
				playerHistoryModal={playerHistoryModal}
				setPlayerHistoryModal={setPlayerHistoryModal}
				myTeamId={me?.teamId}
				matchweekCount={matchweekCount}
				isPlayingMatch={isPlayingMatch}
				showHalftimePanel={showHalftimePanel}
				renewPlayerContract={renewPlayerContract}
				listPlayerAuction={listPlayerAuction}
				listPlayerFixed={listPlayerFixed}
				removeFromTransferList={removeFromTransferList}
				buyPlayer={buyPlayer}
				openAuctionBid={openAuctionBid}
				myBudget={teamInfo?.budget ?? 0}
				setGameDialog={setGameDialog}
			/>

			<RoomHub
				me={me}
				roomHubRef={roomHubRef}
				roomHubOpen={roomHubOpen}
				setRoomHubOpen={setRoomHubOpen}
				roomMessages={roomMessages}
				globalMessages={globalMessages}
				globalPlayers={globalPlayers}
				players={players}
				teams={teams}
				roomCreator={roomCreator}
				matchweekCount={matchweekCount}
				unreadRoom={unreadRoom}
				unreadGlobal={unreadGlobal}
				chatInput={chatInput}
				setChatInput={setChatInput}
				chatMessagesRef={chatMessagesRef}
				addToast={addToast}
				awaitingCoaches={awaitingCoaches}
				chatOpenRef={chatOpenRef}
				activeChatTabRef={activeChatTabRef}
			/>
		</div>
	);
}
