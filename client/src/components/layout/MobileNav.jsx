import { AnimatePresence, motion } from "framer-motion";
import { SPRING, sheetUp } from "../../motion.js";
import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { usePlayCta } from "./usePlayCta.js";
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
          className="absolute bg-primary bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-t-full"
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
          className="absolute bg-primary bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-t-full"
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

/** Botão central JOGAR, elevado — mesmo estado da jornada que o do header. */
function PlayButton({ scrollToTop }) {
  const cta = usePlayCta(scrollToTop);
  const waiting = cta.state === "waiting";
  return (
    <div className="flex-1 flex items-end justify-center pb-1 relative">
      {/* glow halo enquanto há trabalho por fazer */}
      {cta.state === "idle" && (
        <span
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full opacity-40 pointer-events-none bg-primary"
        />
      )}
      <motion.button
        whileTap={{ scale: 0.9 }}
        data-tour="nav-play-mobile"
        onClick={cta.onClick}
        className={`relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-full font-black text-[9px] uppercase tracking-wider transition-all overflow-hidden shadow-lg mb-2.5 ${
          waiting
            ? "bg-surface-container-highest text-primary border-2 border-primary shadow-black/40"
            : "bg-primary text-on-primary shadow-primary/30"
        }`}
      >
        <span aria-hidden className="material-symbols-outlined text-[24px] leading-none relative z-10">
          {cta.icon}
        </span>
        <span className="relative z-10 leading-none tabular-nums">
          {waiting && cta.totalCoaches > 1 ? `${cta.readyCount}/${cta.totalCoaches}` : cta.short}
        </span>
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
 * Navegação mobile (< lg): barra inferior (área `bottom` do `.game-shell`)
 * e fly-ups por grupo. Lê tudo dos contextos.
 *
 * @param {{ scrollToTop: () => void }} props
 */
export function MobileNav({ scrollToTop }) {
  const {
    activeTab,
    isMatchInProgress,
    mobileSubMenu,
    setMobileSubMenu,
  } = useGame();

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
                className="lg:hidden fixed inset-0 z-(--z-flyup-scrim)"
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
                className="lg:hidden fixed bottom-[var(--mobile-nav-h)] left-0 right-0 z-(--z-flyup) px-3"
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
            className="lg:hidden [grid-area:bottom] relative z-(--z-mobile-nav) h-[var(--mobile-nav-h)] bg-surface-container-high/95 backdrop-blur-sm border-t border-outline-variant/30 flex items-stretch pb-[env(safe-area-inset-bottom)]"
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

    </>
  );
}
