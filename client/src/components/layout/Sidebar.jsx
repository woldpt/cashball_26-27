import { motion } from "framer-motion";
import { SPRING } from "../../motion.js";
import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { useInbox } from "../../hooks/useInbox.js";
import { isSameTeamId } from "../../utils/teamHelpers.js";
import { NAV_GROUPS } from "../../constants/navigation.js";

/**
 * Barra lateral desktop: tabs por grupo, botão de encolher e JOGAR fixo ao fundo.
 * Oculta por completo durante o jogo. Lê tudo do `useGame()`.
 *
 * @param {{ scrollToTop: () => void }} props
 */
export function Sidebar({ scrollToTop }) {
  const {
    players,
    me,
    activeTab,
    activeAuctions,
    marketPairs,
    navigateTab,
    isMatchInProgress,
    teamInfo,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useGame();
  const { tactic } = useTactics();

  const myReady = players.find((p) => p.name === me?.name)?.ready;
  const liveAuctionCount = activeAuctions.filter(
    (a) => !a.closed && !a.paused,
  ).length;
  const marketListedCount = marketPairs.filter(
    (p) =>
      p.transfer_status === "fixed" && !isSameTeamId(p.team_id, me?.teamId),
  ).length;
  const { unreadCount: inboxUnreadCount } = useInbox();

  const renderSidebarTab = ({ key, label, icon, cupBracket }) => {
    const badgeCount =
      key === "leiloes"
        ? liveAuctionCount
        : key === "market"
          ? marketListedCount
          : key === "jornal"
            ? inboxUnreadCount
            : 0;
    const isActive = activeTab === key;
    return (
      <motion.button
        key={key}
        data-tour={`nav-${key}`}
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
          if (cupBracket) socket.emit("requestCupBracket");
          scrollToTop();
        }}
        title={sidebarCollapsed ? label : undefined}
        aria-current={isActive ? "page" : undefined}
        aria-disabled={isMatchInProgress || undefined}
        className={`relative w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${sidebarCollapsed ? "justify-center" : ""} ${
          isMatchInProgress
            ? "text-on-surface-variant/25 cursor-not-allowed"
            : isActive
              ? "text-primary"
              : "text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
        }`}
      >
        {isActive && (
          <motion.span
            layoutId="sidebarTabIndicator"
            className="absolute inset-0 rounded-lg bg-primary-container/25 ring-1 ring-inset ring-primary/20"
            transition={SPRING.indicator}
          />
        )}
        <span aria-hidden className="relative material-symbols-outlined text-[20px] shrink-0 leading-none">
          {icon}
        </span>
        {!sidebarCollapsed && <span className="relative">{label}</span>}
        {badgeCount > 0 && (
          <span
            className={`absolute flex items-center justify-center rounded-full bg-red-500 text-white font-black leading-none tabular-nums ${
              sidebarCollapsed
                ? "-top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px]"
                : "right-2 top-1/2 -translate-y-1/2 min-w-5 h-5 px-1.5 text-[10px]"
            }`}
            title={label}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </motion.button>
    );
  };

  return (
    <div className={isMatchInProgress ? "hidden" : "contents"}>
      <nav
        aria-label="Navegação principal"
        className={`hidden lg:flex fixed left-0 top-[var(--header-h)] bottom-0 flex-col z-10 transition-all duration-200 bg-surface-container-high border-r border-outline-variant/15 ${sidebarCollapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]"}`}
      >
        {/* Bola de encolher — sobreposta ao centro da linha direita da barra. */}
        <button
          onClick={() => {
            if (isMatchInProgress) return;
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            try {
              localStorage.setItem("sidebarCollapsed", String(next));
            } catch {
              /* ignorar */
            }
          }}
          disabled={isMatchInProgress}
          title={
            isMatchInProgress
              ? "Indisponível durante o jogo"
              : sidebarCollapsed
                ? "Expandir menu"
                : "Encolher menu"
          }
          aria-label={
            isMatchInProgress
              ? "Encolher menu (indisponível durante o jogo)"
              : sidebarCollapsed
                ? "Expandir menu"
                : "Encolher menu"
          }
          aria-expanded={!sidebarCollapsed}
          aria-disabled={isMatchInProgress || undefined}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-highest border border-outline-variant/40 text-on-surface-variant shadow-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
            isMatchInProgress
              ? "opacity-40 cursor-not-allowed"
              : "hover:text-on-surface hover:border-primary/50"
          }`}
        >
          <span aria-hidden className="material-symbols-outlined text-[16px] leading-none">
            {sidebarCollapsed ? "chevron_right" : "chevron_left"}
          </span>
        </button>
        {/* Jornal fica fora do scroller para nunca ficar escondido. */}
        <div className="shrink-0 px-2 pt-2 border-b border-outline-variant/20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.055 } },
            }}
          >
            {NAV_GROUPS[0].tabs.map(renderSidebarTab)}
          </motion.div>
        </div>
        <div className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.055 } },
            }}
          >
            {NAV_GROUPS.slice(1).map((group) => (
              <motion.div
                key={group.id}
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.055 } },
                }}
              >
                {sidebarCollapsed ? (
                  <div
                    aria-hidden
                    className="mx-auto my-2 w-6 border-t border-outline-variant/25"
                  />
                ) : (
                  <p
                    aria-hidden
                    className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/50"
                  >
                    {group.label}
                  </p>
                )}
                {group.tabs.map(renderSidebarTab)}
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* JOGAR — pinned to bottom */}
        <div
          className={`shrink-0 p-2 border-t border-outline-variant/20 ${!isMatchInProgress && activeTab !== "tactic" && !myReady ? "relative" : ""}`}
        >
          {/* glow halo behind button (idle only) */}
          {!isMatchInProgress && activeTab !== "tactic" && !myReady && (
            <span
              className="absolute inset-1 rounded-lg opacity-30 pointer-events-none"
              style={{ background: "var(--color-primary, #a8e6b0)" }}
            />
          )}
          <button
            data-tour="nav-play"
            onClick={() => {
              if (isMatchInProgress) return;
              navigateTab("tactic");
              scrollToTop();
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
            className={`relative w-full flex items-center gap-3 px-2 py-3.5 text-sm font-black uppercase tracking-widest rounded-lg overflow-hidden ${sidebarCollapsed ? "justify-center" : ""} ${
              isMatchInProgress
                ? "bg-red-500/15 text-red-400 border border-red-500/30 cursor-not-allowed"
                : activeTab === "tactic"
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/30"
                  : "bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25 shadow-md shadow-primary/20"
            }`}
          >
            <span aria-hidden className="material-symbols-outlined text-[20px] shrink-0 leading-none relative z-10">
              {isMatchInProgress ? "sensors" : "strategy"}
            </span>
            {!sidebarCollapsed && (
              <span className="flex-1 text-left relative z-10">
                {isMatchInProgress ? "AO VIVO" : "JOGAR"}
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
