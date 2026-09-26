import { AnimatePresence, motion } from "framer-motion";
import { SPRING, sheetUp } from "../../motion.js";
import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { useMobileLandscape } from "../../hooks/useIsMobile.js";
import { useInbox } from "../../hooks/useInbox.js";
import { isSameTeamId } from "../../utils/teamHelpers.js";
import { getGroupTabKeys, getGroupTabs } from "../../constants/navigation.js";

/** Badge vermelho de contagem (nº de negócios / não-lidas). */
function CountBadge({ count, title, className = "-top-1 -right-2" }) {
  if (count <= 0) return null;
  return (
    <span
      className={`absolute ${className} flex items-center justify-center rounded-full bg-red-500 text-white font-black leading-none min-w-[18px] h-[18px] px-1 text-[10px]`}
      title={title}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Botão de grupo (Gestão / Competição / Transferências): abre o fly-up.
 * O indicador partilha o `layoutId` com o Jornal (só um está ativo de cada vez).
 */
function MobileGroupButton({ groupId, icon, label, tour, isChildActive, isOpen, onToggle }) {
  const isMobileLandscape = useMobileLandscape();
  const highlighted = isChildActive || isOpen;
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      data-tour={tour}
      onClick={onToggle}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
        highlighted ? "text-primary" : "text-on-surface-variant"
      }`}
    >
      {highlighted && (
        <motion.span
          layoutId="mobileTabIndicator"
          className={`absolute bg-primary ${isMobileLandscape ? "left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-r-full" : "top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"}`}
          transition={SPRING.indicator}
        />
      )}
      <span className="relative inline-block">
        <span className="material-symbols-outlined text-[22px] leading-none">
          {icon}
        </span>
        {groupId === "transferencias" && <TransferSumBadge />}
      </span>
      <span>{label}</span>
    </motion.button>
  );
}

/** Soma dos negócios ativos no botão Transferências (esconde com o fly-up aberto). */
function TransferSumBadge() {
  const { activeAuctions, marketPairs, me, mobileSubMenu } = useGame();
  const liveAuctionCount = activeAuctions.filter(
    (a) => !a.closed && !a.paused,
  ).length;
  const marketListedCount = marketPairs.filter(
    (p) =>
      p.transfer_status === "fixed" && !isSameTeamId(p.team_id, me?.teamId),
  ).length;
  const total = liveAuctionCount + marketListedCount;
  if (total <= 0 || mobileSubMenu === "transferencias") return null;
  return (
    <CountBadge count={total} title={`${total} negócio(s) activo(s)`} />
  );
}

/** Botão do Jornal (caixa de entrada) com badge de não-lidas. */
function JournalButton({ scrollToTop }) {
  const { activeTab, navigateTab, setMobileSubMenu } = useGame();
  const { unreadCount } = useInbox();
  const isMobileLandscape = useMobileLandscape();
  const isActive = activeTab === "jornal";
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      data-tour="nav-jornal-mobile"
      onClick={() => {
        navigateTab("jornal");
        setMobileSubMenu(null);
        scrollToTop();
      }}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
        isActive ? "text-primary" : "text-on-surface-variant"
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="mobileTabIndicator"
          className={`absolute bg-primary ${isMobileLandscape ? "left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-r-full" : "top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"}`}
          transition={SPRING.indicator}
        />
      )}
      <span className="relative inline-block">
        <span className="material-symbols-outlined text-[22px] leading-none">
          newspaper
        </span>
        <CountBadge count={unreadCount} title="Por ler" />
      </span>
      <span>Jornal</span>
    </motion.button>
  );
}

/** Botão central JOGAR, elevado. */
function PlayButton({ scrollToTop }) {
  const { players, me, activeTab, navigateTab, teamInfo, setMobileSubMenu } =
    useGame();
  const { tactic } = useTactics();
  const isMobileLandscape = useMobileLandscape();
  const myReady = players.find((p) => p.name === me?.name)?.ready;
  const isActive = activeTab === "tactic";
  return (
    <div className={isMobileLandscape ? "flex-1 flex items-center justify-center relative" : "flex-1 flex items-end justify-center pb-1 relative"}>
      {/* glow halo */}
      {!isActive && !myReady && (
        <span
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full opacity-40 pointer-events-none"
          style={{ background: "var(--color-primary, #a8e6b0)" }}
        />
      )}
      <motion.button
        whileTap={{ scale: 0.9 }}
        data-tour="nav-play-mobile"
        onClick={() => {
          navigateTab("tactic");
          setMobileSubMenu(null);
          scrollToTop();
          if (socket && teamInfo?.id && tactic) {
            socket.emit("requestTacticFamiliarity", teamInfo.id);
            socket.emit("requestAllTacticFamiliarity");
          }
        }}
        className={`relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-full font-black text-[9px] uppercase tracking-wider transition-all overflow-hidden shadow-lg ${
          isActive
            ? "bg-primary text-on-primary shadow-primary/40"
            : "bg-primary text-on-primary shadow-primary/30"
        }`}
        style={isMobileLandscape ? undefined : { marginBottom: "10px" }}
      >
        <span aria-hidden className="material-symbols-outlined text-[24px] leading-none relative z-10">
          strategy
        </span>
        <span className="relative z-10 leading-none">JOGAR</span>
      </motion.button>
    </div>
  );
}

/**
 * Fly-up de um grupo: uma fila de botões (Gestão, Transferências, Competição).
 * Só Transferências mostra badges por botão (Mercado / Leilões).
 */
function GroupFlyUp({ groupId, scrollToTop }) {
  const { activeTab, activeAuctions, marketPairs, me, navigateTab, setMobileSubMenu } =
    useGame();
  const liveAuctionCount = activeAuctions.filter(
    (a) => !a.closed && !a.paused,
  ).length;
  const marketListedCount = marketPairs.filter(
    (p) =>
      p.transfer_status === "fixed" && !isSameTeamId(p.team_id, me?.teamId),
  ).length;
  return (
    <div className="flex">
      {getGroupTabs(groupId).map(({ key, shortLabel, icon, cupBracket }) => {
        const badge =
          key === "market"
            ? marketListedCount
            : key === "leiloes"
              ? liveAuctionCount
              : 0;
        return (
          <button
            key={key}
            data-tour={groupId === "competicao" ? undefined : `nav-${key}-sub`}
            onClick={() => {
              navigateTab(key);
              if (cupBracket) socket.emit("requestCupBracket");
              setMobileSubMenu(null);
              scrollToTop();
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 transition-colors ${
              activeTab === key
                ? "text-primary bg-primary/10"
                : "text-on-surface-variant hover:bg-surface-bright"
            }`}
          >
            <span className="relative inline-block">
              <span className="material-symbols-outlined text-[24px] leading-none">
                {icon}
              </span>
              {badge > 0 && (
                <CountBadge
                  count={badge}
                  title={`${badge} negócio(s)`}
                  className="-top-1.5 -right-2"
                />
              )}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider">
              {shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Navegação mobile (< lg): barra inferior (rail vertical em landscape),
 * fly-ups por grupo e pill AO VIVO. Lê tudo dos contextos.
 *
 * @param {{ scrollToTop: () => void }} props
 */
export function MobileNav({ scrollToTop }) {
  const {
    activeTab,
    isMatchInProgress,
    showHalftimePanel,
    mobileSubMenu,
    setMobileSubMenu,
  } = useGame();
  const isMobileLandscape = useMobileLandscape();

  const groups = [
    { groupId: "gestao", icon: "manage_accounts", label: "Gestão", tour: "nav-gestao" },
    { groupId: "competicao", icon: "emoji_events", label: "Compet.", tour: "nav-competicao" },
    { groupId: "transferencias", icon: "swap_horiz", label: "Transfer.", tour: "nav-transferencias" },
  ];

  return (
    <>
      {!isMatchInProgress && (
        <>
          {/* Overlay + flyup num único AnimatePresence (fade / sheet-up) */}
          <AnimatePresence initial={false}>
            {mobileSubMenu && (
              <motion.div
                key="flyup-overlay"
                className="lg:hidden fixed inset-0 z-38"
                onClick={() => setMobileSubMenu(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              />
            )}

            {/* Flyup sub-menu panel */}
            {mobileSubMenu && (
              <motion.div
                key="flyup-panel"
                className={
                  isMobileLandscape
                    ? "lg:hidden fixed bottom-4 left-[72px] w-[min(480px,calc(100vw-88px))] z-39"
                    : "lg:hidden fixed bottom-16 left-0 right-0 z-39 px-3"
                }
                initial={sheetUp.initial}
                animate={sheetUp.animate}
                exit={sheetUp.exit}
                transition={sheetUp.transition}
              >
                <div className="bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden">
                  <GroupFlyUp groupId={mobileSubMenu} scrollToTop={scrollToTop} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main nav bar — 5 buttons, JOGAR no centro */}
          <nav
            aria-label="Navegação móvel"
            className={
              isMobileLandscape
                ? "lg:hidden fixed left-0 top-[var(--header-h)] bottom-0 w-[var(--rail-w)] z-40 flex flex-col bg-surface-container-high/95 backdrop-blur-sm border-r border-outline-variant/30 py-2 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
                : "lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-high/95 backdrop-blur-sm border-t border-outline-variant/30 z-40 flex items-stretch pb-[env(safe-area-inset-bottom)]"
            }
          >
            <JournalButton scrollToTop={scrollToTop} />
            <MobileGroupButton
              groupId="gestao"
              icon="manage_accounts"
              label="Gestão"
              tour="nav-gestao"
              isChildActive={getGroupTabKeys("gestao").includes(activeTab)}
              isOpen={mobileSubMenu === "gestao"}
              onToggle={() =>
                setMobileSubMenu(mobileSubMenu === "gestao" ? null : "gestao")
              }
            />
            <PlayButton scrollToTop={scrollToTop} />
            {groups.slice(1).map((g) => (
              <MobileGroupButton
                key={g.groupId}
                groupId={g.groupId}
                icon={g.icon}
                label={g.label}
                tour={g.tour}
                isChildActive={getGroupTabKeys(g.groupId).includes(activeTab)}
                isOpen={mobileSubMenu === g.groupId}
                onToggle={() =>
                  setMobileSubMenu(
                    mobileSubMenu === g.groupId ? null : g.groupId,
                  )
                }
              />
            ))}
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
    </>
  );
}
