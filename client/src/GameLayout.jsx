import { AnimatePresence, motion } from "framer-motion";
import { socket } from "./socket.js";
import { useGame } from "./contexts/GameContext.jsx";
import { useTactics } from "./contexts/TacticsContext.jsx";
import { PlayerAvatar } from "./components/shared/PlayerAvatar.jsx";
import { WelcomeModal } from "./components/modals/WelcomeModal.jsx";
import { DismissalModal } from "./components/modals/DismissalModal.jsx";
import { SeasonEndModal } from "./components/modals/SeasonEndModal.jsx";
import { JobOfferModal } from "./components/modals/JobOfferModal.jsx";
import { CoachMarketModal } from "./components/modals/CoachMarketModal.jsx";
import { AdminPanel } from "./components/admin/AdminPanel.jsx";
import { PlayerHistoryModal } from "./components/modals/PlayerHistoryModal.jsx";
import { CupDrawPopup } from "./components/modals/CupDrawPopup.jsx";
import { PenaltySuspensePopup } from "./components/modals/PenaltySuspensePopup.jsx";
import { PenaltyShootoutPopup } from "./components/modals/PenaltyShootoutPopup.jsx";
import { PenaltyTakerPopup } from "./components/modals/PenaltyTakerPopup.jsx";
import { WaitingCoachesModal } from "./components/modals/WaitingCoachesModal.jsx";
import { MatchPage } from "./components/match/MatchPage.jsx";
import {
  LiveMatchHero,
  LiveFixtureRow,
  LiveStandingsPanel,
  isDrawnAt90,
} from "./components/live/index.js";

import { GameDialog } from "./components/shared/GameDialog.jsx";
import { TransferProposalModal } from "./components/modals/TransferProposalModal.jsx";
import { SigningCelebrationModal } from "./components/modals/SigningCelebrationModal.jsx";
import { PostMatchMoodModal } from "./components/modals/PostMatchMoodModal.jsx";
import { AuctionsPage } from "./pages/AuctionsPage.jsx";
import { UserSettingsPage } from "./pages/UserSettingsPage.jsx";
import { RoomHub } from "./components/chat/RoomHub.jsx";
import { StandingsTab } from "./views/StandingsTab.jsx";
import { BracketTab } from "./views/BracketTab.jsx";
import { TrainingTab } from "./views/TrainingTab.jsx";
import { CupTab } from "./views/CupTab.jsx";
import { CalendarioTab } from "./views/CalendarioTab.jsx";
import { ClubTab } from "./views/ClubTab.jsx";
import { FinancesTab } from "./views/FinancesTab.jsx";
import { StadiumTab } from "./views/StadiumTab.jsx";
import { PlayersTab } from "./views/PlayersTab.jsx";
import { PlayerSearchView } from "./views/PlayerSearchView.jsx";
import { TeamSquadView } from "./views/TeamSquadView.jsx";
import { TacticsView } from "./views/TacticsView.jsx";
import { TransferHub } from "./components/ui/TransferHub.jsx";
import { DIVISION_NAMES } from "./constants/index.js";
import { isSameTeamId } from "./utils/teamHelpers.js";

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
    season,
    seasonYear,
    activeTab,
    topScorers,
    standingsStale,
    prevStandings,
    marketPositionFilter,
    setMarketPositionFilter,
    marketSort,
    setMarketSort,
    marketPairs,
    activeAuctions,
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
    coachMarketReport,
    setCoachMarketReport,
    seasonEndModal,
    isCupMatch,
    cupPreMatch,
    cupMatchRoundName,
    cupExtraTimeBadge,
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
    playerSearchLoading,
    setPlayerSearchLoading,
    cupBracketData,
    calendarData,
    calFilter,
    setCalFilter,
    liveMinute,
    isPlayingMatch,
    isLiveSimulation,
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
    dismissToast,
    handleHalftimeReady,
    handleOpenTeamSquad,
    handleCloseTeamSquad,
    navigateTab,
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
    redCardedHalftimeIds,
    injuredHalftimeIds,
    myTeamInCup,
    lockedCoaches,
    panelMode,
    panelFixture,
    panelIsReady,
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
    adminPanelOpen,
    setAdminPanelOpen,
    userDropdownOpen,
    setUserDropdownOpen,
  } = useGame();

  // ── Derived ───────────────────────────────────────────────────────────
  const myReady = players.find((p) => p.name === me?.name)?.ready;

  // Badges da barra lateral: nº de leilões a decorrer e nº de jogadores em lista de transferências
  const liveAuctionCount = activeAuctions.filter(
    (a) => !a.closed && !a.paused,
  ).length;
  const marketListedCount = marketPairs.filter(
    (p) =>
      p.transfer_status === "fixed" && !isSameTeamId(p.team_id, me?.teamId),
  ).length;
  // Soma de negócios activos (leilões a decorrer + mercado) para o badge do
  // botão "Transferências" na navegação mobile (onde Mercado e Leilões se unem).
  const transferBadgeCount = liveAuctionCount + marketListedCount;
  const totalCoaches =
    players.length +
    awaitingCoaches.filter((n) => !players.some((p) => p.name === n)).length;

  // Sala com 2+ coaches humanos bloqueada até todos estarem online (semana em espera)
  const offlineLocked = lockedCoaches.filter(
    (n) => !players.some((p) => p.name === n),
  );
  const roomBlocked = lockedCoaches.length >= 2 && offlineLocked.length > 0;

  // Jogo ao vivo que envolve pelo menos um coach humano (sala multiplayer)
  const isHumanFixture = (m) =>
    players.some(
      (p) => p.teamId === m?.homeTeamId || p.teamId === m?.awayTeamId,
    );
  const sortHumanFirst = (a, b) =>
    Number(isHumanFixture(b)) - Number(isHumanFixture(a));

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
            role="button"
            tabIndex={0}
            onClick={() => dismissToast(t.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") dismissToast(t.id);
            }}
            className="bg-surface-container border border-outline-variant/60 text-on-surface text-sm font-bold px-5 py-3 rounded-md shadow-2xl toast-slide-in pointer-events-auto cursor-pointer select-none flex items-center gap-3"
          >
            <span className="flex-1">{t.msg}</span>
            <span
              className="material-symbols-outlined text-base opacity-50 hover:opacity-100 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(t.id);
              }}
              aria-label="Fechar notificação"
            >
              close
            </span>
          </div>
        ))}
      </div>
      <header
        className="fixed top-0 left-0 right-0 h-14 z-160 flex items-center border-b border-outline-variant/20"
        style={{
          background:
            teamInfo?.color_primary || "var(--color-surface-container-low)",
        }}
      >
        <div className="relative flex items-center justify-between w-full px-4 lg:px-6">
          {/* Left: brand + session info */}
          <div className="flex items-center gap-3">
            <h1
              className="text-base font-headline font-black tracking-tighter uppercase"
              style={{
                color: teamInfo?.color_secondary || "var(--color-on-surface)",
              }}
            >
              CashBall <span style={{ opacity: 0.55 }}>26/27</span>
            </h1>
            <span
              className="hidden md:block text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{
                color: teamInfo?.color_secondary || "var(--color-on-surface)",
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
                <span className="flex flex-col items-center gap-0.5 px-3.5 py-1 rounded-full bg-surface border border-outline-variant/50">
                  <span className="text-lg font-headline font-black tabular-nums leading-none text-on-surface">
                    {liveMinute}'
                  </span>
                  <span className="text-[7px] font-bold uppercase tracking-widest leading-none text-on-surface opacity-70">
                    {liveMinute > 90
                      ? "Prolongamento"
                      : liveMinute > 45
                        ? "2ª Parte"
                        : "1ª Parte"}
                  </span>
                </span>
              ) : liveMinute === 45 && !isCupMatch ? (
                <span className="px-3 py-1 rounded-full bg-surface border border-outline-variant/50 text-[10px] font-black uppercase tracking-widest text-on-surface opacity-90">
                  Intervalo
                </span>
              ) : isCupMatch ? (
                <span className="px-3 py-1 rounded-full bg-surface border border-outline-variant/50 text-[9px] font-black uppercase tracking-widest text-on-surface opacity-90">
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
              onMouseUp={(e) => e.stopPropagation()}
              onClick={() => setRoomHubOpen((v) => !v)}
              title="Sala e Chat"
              className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span
                className="material-symbols-outlined text-[20px] leading-none"
                style={{
                  color: teamInfo?.color_secondary || "var(--color-on-surface)",
                }}
              >
                chat
              </span>
              {/* Badge: nº total de coaches na sala */}
              <span className="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black leading-none flex items-center justify-center px-1">
                {totalCoaches}
              </span>
              {/* Badge: mensagens não lidas */}
              {unreadRoom + unreadGlobal > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black leading-none flex items-center justify-center px-1">
                  {unreadRoom + unreadGlobal > 9
                    ? "9+"
                    : unreadRoom + unreadGlobal}
                </span>
              )}
            </button>

            {/* User dropdown — disabled during live match */}
            <div className="relative">
              <button
                onClick={() => {
                  if (isPlayingMatch) return;
                  setUserDropdownOpen((v) => !v);
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
                    style={{
                      color:
                        teamInfo?.color_secondary || "var(--color-on-surface)",
                    }}
                  >
                    {me.name}
                  </span>
                  <span
                    className="text-xs leading-tight opacity-70"
                    style={{
                      color:
                        teamInfo?.color_secondary || "var(--color-on-surface)",
                    }}
                  >
                    {teamInfo?.name}
                  </span>
                </div>
                <span
                  className="material-symbols-outlined text-[16px] leading-none opacity-60"
                  style={{
                    color:
                      teamInfo?.color_secondary || "var(--color-on-surface)",
                  }}
                >
                  {userDropdownOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {/* Dropdown menu */}
              {userDropdownOpen && !isPlayingMatch && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-170"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  {/* Menu */}
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-1 w-56 bg-surface-container border border-outline-variant/30 rounded-lg shadow-xl overflow-hidden z-180"
                  >
                    {/* A minha conta */}
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigateTab("user_settings");
                        window.scrollTo(0, 0);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-bright transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                        person
                      </span>
                      A minha conta
                    </button>

                    {/* Admin (only for fabio) */}
                    {me?.name?.toLowerCase() === "fabio" && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setAdminPanelOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-[18px] text-amber-400">
                          admin_panel_settings
                        </span>
                        Admin
                      </button>
                    )}

                    {/* Divider */}
                    <div className="border-t border-outline-variant/20" />

                    {/* Sair */}
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-red-400">
                        logout
                      </span>
                      Sair
                    </button>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <nav
        className={`hidden lg:flex fixed left-0 top-14 bottom-0 flex-col z-10 transition-all duration-200 bg-surface-container-low border-r border-outline-variant/15 ${sidebarCollapsed ? "w-14" : "w-64"}`}
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
        <div className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
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
              { key: "stadium", label: "Estádio", icon: "stadium" },
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
              { key: "scout", label: "Scout", icon: "search" },
            ].map(({ key, label, icon }) => {
              const badgeCount =
                key === "leiloes"
                  ? liveAuctionCount
                  : key === "market"
                    ? marketListedCount
                    : 0;
              return (
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
                  navigateTab(key);
                  if (key === "bracket") socket.emit("requestCupBracket");
                  window.scrollTo(0, 0);
                }}
                title={sidebarCollapsed ? label : undefined}
                className={`relative w-full flex items-center gap-3 px-2 py-2.5 text-sm font-bold rounded-lg transition-all text-left ${sidebarCollapsed ? "justify-center" : ""} ${
                  isMatchInProgress
                    ? "text-on-surface-variant/25 cursor-not-allowed"
                    : activeTab === key
                      ? "bg-primary-container/25 text-primary"
                      : "text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px] shrink-0 leading-none">
                  {icon}
                </span>
                {!sidebarCollapsed && <span>{label}</span>}
                {badgeCount > 0 && (
                  <span
                    className={`absolute flex items-center justify-center rounded-full bg-red-500 text-white font-black leading-none ${
                      sidebarCollapsed
                        ? "-top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px]"
                        : "right-2 top-1/2 -translate-y-1/2 min-w-5 h-5 px-1.5 text-[10px]"
                    }`}
                    title={sidebarCollapsed ? label : undefined}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </motion.button>
              );
            })}
          </motion.div>
        </div>

        {/* JOGAR — pinned to bottom */}
        <div
          className={`shrink-0 p-2 border-t border-outline-variant/20 ${!isMatchInProgress && activeTab !== "tactic" && !myReady ? "relative" : ""}`}
        >
          {/* glow halo behind button (idle only) */}
          {!isMatchInProgress && activeTab !== "tactic" && !myReady && (
            <span
              className="absolute inset-1 rounded-lg blur-md opacity-30 pointer-events-none"
              style={{ background: "var(--color-primary, #a8e6b0)" }}
            />
          )}
          <button
            onClick={() => {
              if (isMatchInProgress) return;
              navigateTab("tactic");
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
            className={`relative w-full flex items-center gap-3 px-2 py-3.5 text-sm font-black uppercase tracking-widest rounded-lg overflow-hidden ${
              sidebarCollapsed ? "justify-center" : ""
            } ${!isMatchInProgress && activeTab !== "tactic" && !myReady ? "animate-heartbeat" : ""} ${
              isMatchInProgress
                ? "bg-red-500/15 text-red-400 border border-red-500/30 cursor-not-allowed"
                : activeTab === "tactic"
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/30"
                  : "bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25 shadow-md shadow-primary/20"
            }`}
          >
            {/* shimmer sweep (idle only) */}
            {!isMatchInProgress && activeTab !== "tactic" && !myReady && (
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)",
                  animation: "shimmer-sweep 2.6s ease-in-out infinite",
                }}
              />
            )}
            <span className="material-symbols-outlined text-[20px] shrink-0 leading-none relative z-10">
              {isMatchInProgress ? "sensors" : "strategy"}
            </span>
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left relative z-10">
                  {isMatchInProgress ? "AO VIVO" : "JOGAR"}
                </span>
                <span className="relative flex h-2 w-2 shrink-0 z-10">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isMatchInProgress
                        ? "bg-red-500"
                        : activeTab === "tactic"
                          ? "bg-on-primary/40"
                          : "bg-primary"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isMatchInProgress
                        ? "bg-red-500"
                        : activeTab === "tactic"
                          ? "bg-on-primary/60"
                          : "bg-primary"
                    }`}
                  />
                </span>
              </>
            )}
          </button>
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
            <div className="lg:hidden fixed bottom-16 left-0 right-0 z-39 px-3">
              <div className="bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden">
                {mobileSubMenu === "gestao" && (
                  <div className="flex">
                    {[
                      {
                        key: "finances",
                        label: "Finanças",
                        icon: "payments",
                      },
                      {
                        key: "stadium",
                        label: "Estádio",
                        icon: "stadium",
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
                          navigateTab(key);
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
                      { key: "scout", label: "Scout", icon: "search" },
                    ].map(({ key, label, icon }) => (
                      <button
                        key={key}
                        onClick={() => {
                          navigateTab(key);
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
                          navigateTab(key);
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

          {/* Main nav bar — 5 buttons, JOGAR no centro */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-low/95 backdrop-blur-sm border-t border-outline-variant/30 z-40 flex items-stretch pb-[env(safe-area-inset-bottom)]">
            {/* Clube */}
            {(() => {
              const isActive = activeTab === "club";
              return (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => {
                    navigateTab("club");
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

            {/* ── JOGAR — centro elevado ── */}
            {(() => {
              const isActive = activeTab === "tactic";
              return (
                <div className="flex-1 flex items-end justify-center pb-1 relative">
                  {/* glow halo */}
                  {!isActive && !myReady && (
                    <span
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full blur-lg opacity-40 pointer-events-none"
                      style={{ background: "var(--color-primary, #a8e6b0)" }}
                    />
                  )}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      navigateTab("tactic");
                      setMobileSubMenu(null);
                      window.scrollTo(0, 0);
                      if (socket && teamInfo?.id && tactic) {
                        socket.emit("requestTacticFamiliarity", teamInfo.id);
                        socket.emit("requestAllTacticFamiliarity");
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-full font-black text-[9px] uppercase tracking-wider transition-all overflow-hidden shadow-lg ${!isActive && !myReady ? "animate-heartbeat" : ""} ${
                      isActive
                        ? "bg-primary text-on-primary shadow-primary/40"
                        : "bg-primary text-on-primary shadow-primary/30"
                    }`}
                    style={{ marginBottom: "10px" }}
                  >
                    {/* shimmer sweep (idle) */}
                    {!isActive && !myReady && (
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
                          animation: "shimmer-sweep 2.6s ease-in-out infinite",
                        }}
                      />
                    )}
                    <span className="material-symbols-outlined text-[24px] leading-none relative z-10">
                      strategy
                    </span>
                    <span className="relative z-10 leading-none">JOGAR</span>
                  </motion.button>
                </div>
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
              const isChildActive = ["market", "leiloes", "scout"].includes(
                activeTab,
              );
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
                  <span className="relative">
                    <span className="material-symbols-outlined text-[22px] leading-none">
                      swap_horiz
                    </span>
                    {transferBadgeCount > 0 && (
                      <span
                        className="absolute -top-1 -right-2 flex items-center justify-center rounded-full bg-red-500 text-white font-black leading-none min-w-[18px] h-[18px] px-1 text-[10px]"
                        title={`${transferBadgeCount} negócio(s) activo(s)`}
                      >
                        {transferBadgeCount > 99 ? "99+" : transferBadgeCount}
                      </span>
                    )}
                  </span>
                  <span>Transfer.</span>
                </motion.button>
              );
            })()}
          </nav>
        </>
      )}

      {/* LIVE pill during match (mobile) */}
      {isMatchInProgress && !showHalftimePanel && (
        <div className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 h-9 px-5 z-40 flex items-center justify-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 backdrop-blur-sm shadow-lg shadow-black/40">
          <span className="material-symbols-outlined text-red-400 text-[18px] leading-none animate-pulse">
            sensors
          </span>
          <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">
            AO VIVO
          </span>
        </div>
      )}

      {panelMode === null && (
        <main
          className={`pt-14 pb-16 lg:pb-12 transition-all duration-200 ${sidebarCollapsed ? "lg:ml-14" : "lg:ml-64"}`}
        >
          <div className="p-4 lg:p-6">
            {roomBlocked && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <span className="material-symbols-outlined text-amber-400 text-[20px] leading-none mt-0.5">
                  lock
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-400">
                    Sala bloqueada — semana em espera
                  </p>
                  <p className="text-[11px] text-on-surface-variant/80 font-semibold mt-0.5 leading-snug">
                    A semana só avança quando todos os coaches estiverem online.
                    Aguardando: {offlineLocked.join(", ")}.
                  </p>
                </div>
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
                        {/* ── ROW 1: MY GAME + VIRTUAL CLASSIFICATION ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
                          <div
                            className={`${isCupMatch ? "lg:col-span-3" : "lg:col-span-2"}`}
                          >
                            {/* ── HERO: MY MATCH ─────────────────────── */}
                            {matchResults && (
                              <LiveMatchHero
                                myMatch={myMatch}
                                teams={teams}
                                players={players}
                                me={me}
                                liveMinute={liveMinute}
                                isPlayingMatch={isPlayingMatch}
                                isMatchActionPending={isMatchActionPending}
                                isCupMatch={isCupMatch}
                                cupMatchRoundName={cupMatchRoundName}
                                substitutionPause={substitutionPause}
                                goalFlashRef={goalFlashRef}
                                isCupExtraTime={isCupExtraTime}
                                matchResults={matchResults}
                                onScoreClick={() => {
                                  if (isPlayingMatch && !isMatchActionPending) {
                                    socket.emit("request_substitution");
                                  } else {
                                    setMatchDetailFixture(myMatch);
                                    setShowMatchDetail(true);
                                  }
                                }}
                              />
                            )}
                          </div>
                          {/* ── VIRTUAL CLASSIFICATION COLUMN ── */}
                          {!isCupMatch && matchResults?.results && (
                            <div className="lg:col-span-1 min-h-0">
                              <LiveStandingsPanel
                                teams={teams}
                                matchResults={matchResults}
                                liveMinute={liveMinute}
                                myTeamId={me.teamId}
                                teamForms={teamForms}
                                applyLiveResults={
                                  standingsStale ||
                                  isLiveSimulation ||
                                  showHalftimePanel
                                }
                              />
                            </div>
                          )}
                        </div>

                        {/* ── ROW 2: ALL DIVISIONS ── */}
                        {!isCupMatch &&
                          (() => {
                            const myDiv = teams.find(
                              (t) => t.id === me.teamId,
                            )?.division;
                            const allDivs = [1, 2, 3, 4];
                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4">
                                {allDivs.map((div) => {
                                  const isMyDiv = div === myDiv;
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
                                    )
                                    .sort(sortHumanFirst);
                                  return (
                                    <div
                                      key={div}
                                      className="flex flex-col gap-2"
                                    >
                                      <div
                                        className={`px-3 py-2 rounded-t-md border-b-2 bg-surface-container-high ${
                                          isMyDiv
                                            ? "border-primary/60"
                                            : "border-outline-variant/20"
                                        }`}
                                      >
                                        <h3
                                          className={`font-headline font-extrabold text-[9px] sm:text-[10px] lg:text-[11px] tracking-tighter uppercase ${
                                            isMyDiv
                                              ? "text-primary"
                                              : "text-on-surface/50"
                                          }`}
                                        >
                                          {DIVISION_NAMES[div] || `Div ${div}`}
                                          {isMyDiv && (
                                            <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[7px] font-black uppercase tracking-widest border border-primary/30">
                                              A tua divisão
                                            </span>
                                          )}
                                        </h3>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        {divMatches.length === 0 ? (
                                          <div className="text-[10px] text-on-surface-variant/30 px-3 py-2 text-center italic">
                                            Sem jogos
                                          </div>
                                        ) : (
                                          divMatches.map((match, idx) => (
                                            <LiveFixtureRow
                                              key={idx}
                                              match={match}
                                              teams={teams}
                                              players={players}
                                              liveMinute={liveMinute}
                                              goalFlashRef={goalFlashRef}
                                              onOpenDetail={() => {
                                                setMatchDetailFixture(match);
                                                setShowMatchDetail(true);
                                              }}
                                            />
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}

                        {/* ── CUP MULTIVIEW (all other games in responsive columns) ── */}
                        {isCupMatch && matchResults?.results && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {matchResults.results
                              .filter(
                                (m) =>
                                  m.homeTeamId !== me.teamId &&
                                  m.awayTeamId !== me.teamId,
                              )
                              .filter((m) => {
                                // After 90', only show games still in extra time (score tied at 90)
                                if (liveMinute <= 90) return true;
                                return isDrawnAt90(m);
                              })
                              .sort(sortHumanFirst)
                              .map((match, idx) => (
                                <LiveFixtureRow
                                  key={idx}
                                  match={match}
                                  teams={teams}
                                  players={players}
                                  liveMinute={liveMinute}
                                  goalFlashRef={goalFlashRef}
                                  onOpenDetail={() => {
                                    setMatchDetailFixture(match);
                                    setShowMatchDetail(true);
                                  }}
                                />
                              ))}
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
                        standingsStale={standingsStale}
                        prevStandings={prevStandings}
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
                      />
                    )}

                    {activeTab === "stadium" && (
                      <StadiumTab
                        teamInfo={teamInfo}
                        currentBudget={currentBudget}
                        capacityRevPerGame={capacityRevPerGame}
                        financeData={financeData}
                        setGameDialog={setGameDialog}
                      />
                    )}

                    {activeTab === "players" && (
                      <PlayersTab
                        mySquad={mySquad}
                        annotatedSquad={annotatedSquad}
                        matchweekCount={matchweekCount}
                        season={season}
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
                        avatarSeed={avatarSeed}
                        players={players}
                        palmares={palmares}
                        palmaresTeamId={palmaresTeamId}
                        clubHistory={clubHistory}
                        clubHistoryTeamId={clubHistoryTeamId}
                        setTransferProposalModal={setTransferProposalModal}
                        myBudget={currentBudget}
                        currentMatchweek={matchweekCount + 1}
                        calendarData={calendarData}
                        teams={teams}
                        onBack={handleCloseTeamSquad}
                        onOpenTeamSquad={handleOpenTeamSquad}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
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

                    {activeTab === "scout" && (
                      <PlayerSearchView
                        me={me}
                        players={players}
                        myBudget={currentBudget}
                        matchweekCount={matchweekCount}
                        season={season}
                        playerSearchData={playerSearchData}
                        playerSearchLoading={playerSearchLoading}
                        setPlayerSearchLoading={setPlayerSearchLoading}
                        setTransferProposalModal={setTransferProposalModal}
                        setGameDialog={setGameDialog}
                        buyPlayer={buyPlayer}
                        openAuctionBid={openAuctionBid}
                        onOpenPlayerHistory={(player) =>
                          socket.emit("requestPlayerHistory", {
                            playerId: player.id,
                          })
                        }
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
                        onBack={() => navigateTab("club")}
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
                                  token: s.token,
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

      <SigningCelebrationModal
        signing={signingCelebration}
        onClose={() => setSigningCelebration(null)}
        teams={teams}
        me={me}
      />

      <PostMatchMoodModal
        mood={postMatchMood}
        onClose={() => setPostMatchMood(null)}
      />

      <GameDialog dialog={gameDialog} onClose={() => setGameDialog(null)} />

      <PenaltySuspensePopup penaltySuspense={penaltySuspense} />

      <PenaltyTakerPopup
        key={matchAction?.actionId ?? "none"}
        matchAction={matchAction}
        teams={teams}
        onResolveAction={handleResolveMatchAction}
      />

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
          matchResults={matchResults}
          isCupExtraTime={isCupExtraTime}
        />
      )}

      {/* Modal de espera multiplayer no intervalo */}
      {/* Espectadores da Taça (sem fixture nesta ronda → !myMatch) são auto-ready
          ao intervalo; permitir cancelar bloquearia o jogo sem razão. */}
      <WaitingCoachesModal
        players={players}
        visible={
          panelMode === "halftime" &&
          panelIsReady &&
          lockedCoaches &&
          lockedCoaches.length >= 2
        }
        onCancel={() => socket.emit("setReady", false)}
        canCancel={!(isCupMatch && !myMatch)}
      />

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

      <CoachMarketModal
        report={coachMarketReport}
        onClose={() => setCoachMarketReport(null)}
      />

      <SeasonEndModal
        data={seasonEndModal}
        teams={teams}
        me={me}
        onClose={() => setSeasonEndModal(null)}
      />

      <PlayerHistoryModal
        playerHistoryModal={playerHistoryModal}
        setPlayerHistoryModal={setPlayerHistoryModal}
        myTeamId={me?.teamId}
        matchweekCount={matchweekCount}
        season={season}
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

      <AdminPanel
        open={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
      />
    </div>
  );
}
