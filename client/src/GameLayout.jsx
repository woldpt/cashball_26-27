import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DUR, EASE, SPRING, fadeSlide, sheetUp } from "./motion.js";
import { socket } from "./socket.js";
import { useGame } from "./contexts/GameContext.jsx";
import { useTactics } from "./contexts/TacticsContext.jsx";
import { GameHeader } from "./components/layout/GameHeader.jsx";
import { WelcomeModal } from "./components/modals/WelcomeModal.jsx";
import { isSameTeamId } from "./utils/teamHelpers.js";
import { useMobileLandscape } from "./hooks/useIsMobile.js";
import { useInbox } from "./hooks/useInbox.js";
import { useCoachTutorial } from "./hooks/useCoachTutorial.js";
import { NAV_GROUPS, getGroupTabKeys, getGroupTabs } from "./constants/navigation.js";
import { CoachTutorial } from "./components/tutorial/CoachTutorial.jsx";
import { COACH_TUTORIAL_STEPS } from "./components/tutorial/coachTutorialSteps.js";
import { OfflineBanner } from "./components/shared/OfflineBanner.jsx";
import { RoomPauseBanner } from "./components/shared/RoomPauseBanner.jsx";
import { GameRoutes } from "./GameRoutes.jsx";
import { GameOverlays } from "./GameOverlays.jsx";
import { GroupBackdrop } from "./components/shared/GroupBackdrop.jsx";

/**
 * Renders the entire game UI. All state comes from useGame() and useTactics().
 * No props — fully self-contained within the context providers.
 */
export function GameLayout({ handleLogout, setAuthPhase }) {
  // ── All game state from GameContext ─────────────────────────────────────
  const {
    // State
    players,
    sessionDisplaced,
    toasts,
    activeTab,
    marketPairs,
    activeAuctions,
    welcomeModal,
    setWelcomeModal,
    dismissalModal,
    showHalftimePanel,
    renderError,
    reconnectFlash,
    mobileSubMenu,
    setMobileSubMenu,
    sidebarCollapsed,
    setSidebarCollapsed,
    // Refs
    // Auth
    me,
    // Handlers
    dismissToast,
    navigateTab,
    // Derived
    isMatchInProgress,
    teamInfo,
    lockedCoaches,
    panelMode,
  } = useGame();

  // ── Derived ───────────────────────────────────────────────────────────
  const myReady = players.find((p) => p.name === me?.name)?.ready;

  // ── Tutorial guiado (contas novas de Coach) ───────────────────────────
  const {
    tutorial,
    startTutorial,
    replayTutorial,
    nextStep,
    prevStep,
    skipTutorial,
    finishTutorial,
  } = useCoachTutorial(me);

  /** Navega para a tab do passo e abre o submenu mobile correspondente. */
  const handleTutorialNavigate = (step) => {
    if (!step) return;
    if (step.tab && step.tab !== activeTab) navigateTab(step.tab);
    setMobileSubMenu(step.submenu ?? null);
    contentRef.current?.scrollTo(0, 0);
  };

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
  // Badge do Jornal: itens por ler na caixa de entrada (inclui as bandeiras
  // vermelhas, que contam sempre). Mesmo badge do Mercado/Leilões.
  const { unreadCount: inboxUnreadCount } = useInbox();

  // ── Voo do badge (mobile): ao abrir o fly-up, a soma vira badges individuais ──
  const transfIconRef = useRef(null); // âncora de origem no nav (wrapper do ícone TRANSF)
  // Shell de conteúdo: altura fixa (h-dvh na raiz) com scroll interno. As views
  // deixam de adivinhar a altura disponível via 100dvh — o wrapper entrega um
  // slot com altura definida (overflow-y-auto ou flex para páginas full-bleed).
  const contentRef = useRef(null);

  // Ao trocar de tab, a posição de scroll volta ao topo (o wrapper é o mesmo
  // nó DOM; o scrollTop sobreviveria ao remount do conteúdo sem este reset).
  useLayoutEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [activeTab]);
  const subIconRefs = useRef({}); // { market, leiloes } → wrappers dos ícones no fly-up
  const [transferFlyers, setTransferFlyers] = useState([]);
  const transferFlyTimerRef = useRef(0);
  const transferLandTimerRef = useRef(0);
  // Aterragem antecipada: o destino começa o fade-in ~100 ms antes da
  // remoção do flyer (crossfade no mesmo ponto, sem janela vazia = sem piscar).
  const [transferLanded, setTransferLanded] = useState(false);
  const prevTransferMenuOpenRef = useRef(false);

  useLayoutEffect(() => {
    const open = mobileSubMenu === "transferencias";
    if (open === prevTransferMenuOpenRef.current) return; // já está aberto ou já fechou
    prevTransferMenuOpenRef.current = open;

    // Centro aproximado do badge vermelho ancorado a um ícone (-top-1 -right-2).
    const iconBadgeCenter = (el) => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.right - 3, y: r.top + 4 } : null;
    };

    const targets = [
      ["market", marketListedCount],
      ["leiloes", liveAuctionCount],
    ];
    const items = [];
    if (open) {
      // O fly-up monta com y positivo (sheetUp) — o destino final fica acima.
      const from = iconBadgeCenter(transfIconRef.current);
      const liftY = sheetUp.initial.y || 0;
      for (const [key, count] of targets) {
        if (count <= 0 || !from) continue;
        const dest = iconBadgeCenter(subIconRefs.current[key]);
        if (!dest) continue;
        items.push({ id: key, from, to: { x: dest.x, y: dest.y - liftY }, count });
      }
    } else {
      // Regresso: dos botões do fly-up para o TRANSF (ainda montados no exit).
      const to = iconBadgeCenter(transfIconRef.current);
      for (const [key, count] of targets) {
        if (count <= 0 || !to) continue;
        const from = iconBadgeCenter(subIconRefs.current[key]);
        if (!from) continue;
        items.push({ id: key, from, to, count });
      }
    }
    setTransferFlyers(items);
    setTransferLanded(false);
    window.clearTimeout(transferFlyTimerRef.current);
    window.clearTimeout(transferLandTimerRef.current);
    // O destino começa a aparecer antes da aterragem (crossfade); o flyer
    // sai logo após o voo (DUR.slow ≈ 280 ms), já com o destino quase opaco.
    transferLandTimerRef.current = window.setTimeout(
      () => setTransferLanded(true),
      DUR.slow * 1000 - 100,
    );
    transferFlyTimerRef.current = window.setTimeout(
      () => setTransferFlyers([]),
      DUR.slow * 1000 + 60,
    );
  }, [mobileSubMenu, marketListedCount, liveAuctionCount]);

  useEffect(
    () => () => {
      window.clearTimeout(transferFlyTimerRef.current);
      window.clearTimeout(transferLandTimerRef.current);
    },
    [],
  );


  const transferMenuOpen = mobileSubMenu === "transferencias";
  // Durante o voo o badge de origem e o de destino ficam escondidos para não
  // haver dupla contagem no ponto de aterragem. O `transferFlyers` só é
  // preenchido no useLayoutEffect (1 commit de atraso), por isso usamos o
  // prev para já considerar "a voar" no primeiro frame da abertura/fecho.
  /* eslint-disable react-hooks/refs -- guard do 1º frame lê prev ref intencionalmente; derivado propaga para badges */
  const transferIsOpening = transferMenuOpen && !prevTransferMenuOpenRef.current;
  const transferIsClosing = !transferMenuOpen && prevTransferMenuOpenRef.current;
  const transferFlyingNow =
    transferFlyers.length > 0 || transferIsOpening || transferIsClosing;
  // `transferLanded` antecipa o fade-in do destino para ainda durante o voo
  // (crossfade no ponto de aterragem) — sem ele havia ~150 ms sem nada visível.
  const transfSumHidden =
    transferMenuOpen || (transferFlyingNow && !transferLanded);
  const subBadgesResting =
    transferMenuOpen && (!transferFlyingNow || transferLanded);
  /* eslint-enable react-hooks/refs */
  // Sala com 2+ coaches humanos bloqueada até todos estarem online (semana em espera)
  const offlineLocked = lockedCoaches.filter(
    (n) => !players.some((p) => p.name === n),
  );
  const roomBlocked = lockedCoaches.length >= 2 && offlineLocked.length > 0;

  // ── Tactic-specific from TacticsContext ─────────────────────────────────
  const { tactic } = useTactics();

  // Telemóvel em landscape (abaixo de lg): header compacto + rail vertical à esquerda.
  const isMobileLandscape = useMobileLandscape();

  // Páginas full-bleed: gerem o próprio scroll interno (flex-col); o wrapper
  // e a cadeia grid → item → motion.div têm de passar min-h-0 para baixo,
  // senão a árvore fica à altura do conteúdo e o scroll interno nunca ocorre.
  const isFullBleedTab = activeTab === "squad" || activeTab === "leiloes";

  // Sequência central dos modais pós-jogo: penalties → mood → surpresas taça
  // → avisos/renovações → fim de época (seasonEnd POR ÚLTIMO). Decide quais
  // estão visíveis em cada render para nunca se sobreporem; os restantes
  // aguardam o fecho do atual (os dados continuam guardados).

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
          contentRef.current?.scrollTo(0, 0);
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
    <div className="h-dvh overflow-hidden bg-surface text-on-surface font-body tracking-tight flex flex-col relative isolate">
      {/* Fundo fotográfico da tab ativa, sempre visível (inclusive no
          direto). Fica atrás da camada .ambient. */}
      <GroupBackdrop tabKey={activeTab} />
      {/* Atmosfera de fundo do interior (ver .ambient em index.css). Fica atrás
          de todo o conteúdo (isolate + -z-10) e não intercepta cliques. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 ambient" />
      <RoomPauseBanner />
      <OfflineBanner />
      {/* Flash de reconnect (ex-toast 5): modal que desvanece sozinho. */}
      <AnimatePresence initial={false}>
        {reconnectFlash && (
          <motion.div
            key={reconnectFlash.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-[99998] flex items-center justify-center px-4"
          >
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container px-6 py-4 text-center shadow-2xl">
              <span
                aria-hidden
                className="material-symbols-outlined animate-spin text-2xl leading-none text-primary"
              >
                sync
              </span>
              <p className="mt-1 text-sm font-bold text-on-surface">
                Ligação restabelecida — a sincronizar…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      {/* Toast notifications — AnimatePresence para o exit; o container fica
          sempre montado (pointer-events-none) para os toasts poderem sair. */}
      <div className="fixed top-[calc(var(--header-h)+0.5rem)] right-4 z-100 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
          <motion.div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => dismissToast(t.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") dismissToast(t.id);
            }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-surface-container border border-outline-variant/60 text-on-surface text-sm font-bold px-5 py-3 rounded-md shadow-2xl pointer-events-auto cursor-pointer select-none flex items-center gap-3"
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
          </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <GameHeader
        handleLogout={handleLogout}
        setAuthPhase={setAuthPhase}
        scrollToTop={() => contentRef.current?.scrollTo(0, 0)}
      />

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      {/* Oculta por completo durante o jogo (o painel de jogo ocupa a largura
          toda); `contents` evita remontar a nav e repetir a animação de entrada. */}
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
              className="absolute inset-1 rounded-lg blur-md opacity-30 pointer-events-none"
              style={{ background: "var(--color-primary, #a8e6b0)" }}
            />
          )}
          <button
            data-tour="nav-play"
            onClick={() => {
              if (isMatchInProgress) return;
              navigateTab("tactic");
              contentRef.current?.scrollTo(0, 0);
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
            className={`relative w-full flex items-center gap-3 px-2 py-3.5 text-sm font-black uppercase tracking-widest rounded-lg overflow-hidden ${sidebarCollapsed ? "justify-center" : ""} ${!isMatchInProgress && activeTab !== "tactic" && !myReady ? "animate-heartbeat" : ""} ${
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
      </div>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────────────────── */}
      {/* ── Mobile bottom nav (< lg) ─────────────────────────────── */}
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
                {mobileSubMenu === "gestao" && (
                  <div className="flex">
                    {getGroupTabs("gestao").map(({ key, shortLabel, icon }) => (
                      <button
                        key={key}
                        data-tour={`nav-${key}-sub`}
                        onClick={() => {
                          navigateTab(key);
                          setMobileSubMenu(null);
                          contentRef.current?.scrollTo(0, 0);
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
                          {shortLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {mobileSubMenu === "transferencias" && (
                  <div className="flex">
                    {/* eslint-disable react-hooks/refs -- callbacks de ref intencionais para medir posição dos badges */}
                    {getGroupTabs("transferencias").map(({ key, shortLabel, icon }) => {
                      const badge =
                        key === "market"
                          ? marketListedCount
                          : key === "leiloes"
                            ? liveAuctionCount
                            : 0;
                      return (
                      <button
                        key={key}
                        data-tour={`nav-${key}-sub`}
                        onClick={() => {
                          navigateTab(key);
                          setMobileSubMenu(null);
                          contentRef.current?.scrollTo(0, 0);
                        }}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 transition-colors ${
                          activeTab === key
                            ? "text-primary bg-primary/10"
                            : "text-on-surface-variant hover:bg-surface-bright"
                        }`}
                      >
                        <span
                          ref={(el) => {
                            if (el) subIconRefs.current[key] = el;
                            else delete subIconRefs.current[key];
                          }}
                          className="relative inline-block"
                        >
                          <span className="material-symbols-outlined text-[24px] leading-none">
                            {icon}
                          </span>
                          {badge > 0 && (
                            <motion.span
                              initial={false}
                              animate={{
                                opacity: subBadgesResting ? 1 : 0,
                                scale: subBadgesResting ? 1 : 0.5,
                              }}
                              // Esconde INSTANTANEO no descolagem do flyer de
                              // regresso (badge + flyer no mesmo ponto =
                              // double-count); fade-in de DUR.fast apenas na
                              // aterragem, apos o flyer ser removido.
                              transition={
                                subBadgesResting
                                  ? { duration: DUR.fast, ease: "easeOut" }
                                  : { duration: 0 }
                              }
                              className="absolute -top-1.5 -right-2 flex items-center justify-center rounded-full bg-red-500 text-white font-black leading-none min-w-[18px] h-[18px] px-1 text-[10px] shadow-md"
                              title={`${badge} negócio(s)`}
                            >
                              {badge > 99 ? "99+" : badge}
                            </motion.span>
                          )}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          {shortLabel}
                        </span>
                      </button>
                      );
                    })}
                    {/* eslint-enable react-hooks/refs */}
                  </div>
                )}
                {mobileSubMenu === "competicao" && (
                  <div className="flex">
                    {getGroupTabs("competicao").map(({ key, shortLabel, icon, cupBracket }) => (
                      <button
                        key={key}
                        onClick={() => {
                          navigateTab(key);
                          if (cupBracket)
                            socket.emit("requestCupBracket");
                          setMobileSubMenu(null);
                          contentRef.current?.scrollTo(0, 0);
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
                          {shortLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
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
            {/* Jornal (caixa de entrada — primeira entrada do menu) */}
            {(() => {
              const isActive = activeTab === "jornal";
              return (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  data-tour="nav-jornal-mobile"
                  onClick={() => {
                    navigateTab("jornal");
                    setMobileSubMenu(null);
                    contentRef.current?.scrollTo(0, 0);
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
                    {inboxUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-2 flex items-center justify-center rounded-full bg-red-500 text-white font-black leading-none min-w-[18px] h-[18px] px-1 text-[10px]">
                        {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
                      </span>
                    )}
                  </span>
                  <span>Jornal</span>
                </motion.button>
              );
            })()}

            {/* Gestão (Finanças + Plantel) */}
            {(() => {
              const isChildActive = getGroupTabKeys("gestao").includes(activeTab);
              const isOpen = mobileSubMenu === "gestao";
              return (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  data-tour="nav-gestao"
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
                      className={`absolute bg-primary ${isMobileLandscape ? "left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-r-full" : "top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"}`}
                      transition={SPRING.indicator}
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
                <div className={isMobileLandscape ? "flex-1 flex items-center justify-center relative" : "flex-1 flex items-end justify-center pb-1 relative"}>
                  {/* glow halo */}
                  {!isActive && !myReady && (
                    <span
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full blur-lg opacity-40 pointer-events-none"
                      style={{ background: "var(--color-primary, #a8e6b0)" }}
                    />
                  )}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    data-tour="nav-play-mobile"
                    onClick={() => {
                      navigateTab("tactic");
                      setMobileSubMenu(null);
                      contentRef.current?.scrollTo(0, 0);
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
                    style={isMobileLandscape ? undefined : { marginBottom: "10px" }}
                  >
                    <span aria-hidden className="material-symbols-outlined text-[24px] leading-none relative z-10">
                      strategy
                    </span>
                    <span className="relative z-10 leading-none">JOGAR</span>
                  </motion.button>
                </div>
              );
            })()}

            {/* Competição (Classificações + Calendário) */}
            {(() => {
              const isChildActive = getGroupTabKeys("competicao").includes(
                activeTab,
              );
              const isOpen = mobileSubMenu === "competicao";
              return (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  data-tour="nav-competicao"
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
                      className={`absolute bg-primary ${isMobileLandscape ? "left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-r-full" : "top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"}`}
                      transition={SPRING.indicator}
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
            {/* eslint-disable react-hooks/refs */}
            {(() => {
              const isChildActive = getGroupTabKeys("transferencias").includes(
                activeTab,
              );
              const isOpen = mobileSubMenu === "transferencias";
              return (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  data-tour="nav-transferencias"
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
                      className={`absolute bg-primary ${isMobileLandscape ? "left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-r-full" : "top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"}`}
                      transition={SPRING.indicator}
                    />
                  )}
                  <span ref={transfIconRef} className="relative inline-block">
                    <span className="material-symbols-outlined text-[22px] leading-none">
                      swap_horiz
                    </span>
                    {transferBadgeCount > 0 && (
                      <motion.span
                        initial={false}
                        animate={{
                          scale: transfSumHidden ? 0 : 1,
                          opacity: transfSumHidden ? 0 : 1,
                        }}
                        // Esconde INSTANTANEO quando parte (o flyer herda a
                        // contagem no ponto de descolagem — um fade de 150ms
                        // deixava badge + flyer no mesmo ponto = double-count).
                        // Fade-in de DUR.fast apenas na aterragem, quando o
                        // flyer ja foi removido (exit instantaneo).
                        transition={
                          transfSumHidden
                            ? { duration: 0 }
                            : { duration: DUR.fast, ease: "easeOut" }
                        }
                        className="absolute -top-1 -right-2 flex items-center justify-center rounded-full bg-red-500 text-white font-black leading-none min-w-[18px] h-[18px] px-1 text-[10px]"
                        title={`${transferBadgeCount} negócio(s) activo(s)`}
                      >
                        {transferBadgeCount > 99 ? "99+" : transferBadgeCount}
                      </motion.span>
                    )}
                  </span>
                  <span>Transfer.</span>
                </motion.button>
              );
            })()}
            {/* eslint-enable react-hooks/refs */}
          </nav>

          {/* Badges em voo: TRANSF ↔ fly-up (só durante a transição) */}
          <div className="lg:hidden pointer-events-none fixed inset-0 z-[45]">
            <AnimatePresence>
              {transferFlyers.map((f) => (
                <motion.span
                  key={`${transferMenuOpen ? "open" : "back"}-${f.id}`}
                  className="absolute left-0 top-0"
                  initial={{ x: f.from.x, y: f.from.y, scale: 1, opacity: 1 }}
                  animate={{ x: f.to.x, y: f.to.y, scale: 1, opacity: 1 }}
                  // Exit instantaneo: o flyer ja esta ancorado ao centro da
                // badge de destino quando e removido, por isso a remocao e
                // invisivel e o fade-in da badge (DUR.fast) nao sobrepoe o
                // flyer — sem double-count no ponto de aterragem.
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0 } }}
                  transition={{ duration: DUR.slow, ease: EASE }}
                >
                  <span className="flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white font-black leading-none min-w-[18px] h-[18px] px-1 text-[10px] shadow-lg shadow-black/40">
                    {f.count > 99 ? "99+" : f.count}
                  </span>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
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
          className={`flex-1 min-h-0 flex flex-col ${
            isMobileLandscape
              // A rail vertical (w-[var(--rail-w)]) só está montada quando
              // !isMatchInProgress — fora disso a ml-var ficava órfã e deixava
              // uma faixa vazia à esquerda do ecrã de jogo ao vivo.
              // Em jogo, o pill "AO VIVO" (fixed bottom-3) flutua sobre o
              // conteúdo; reservamos pb-16 (igual ao retrato) para o conteúdo
              // não ser coberto, em vez de pb-3.
              ? `transition-all duration-200 pt-[var(--header-h)] ${isMatchInProgress ? "pb-16 ml-0" : "pb-3 ml-[var(--rail-w)]"}`
              : `pt-[var(--header-h)] pb-16 lg:pb-0 transition-all duration-200 ${isMatchInProgress ? "lg:ml-0" : sidebarCollapsed ? "lg:ml-[var(--sidebar-w-collapsed)]" : "lg:ml-[var(--sidebar-w)]"}`
          }`}
        >
          {/* Wrapper de scroll: a maioria das tabs rola aqui (mesma UX de antes,
              mas ancorada ao shell). "squad" e "leiloes" são páginas full-bleed
              que gerem o próprio scroll interno (flex-col). */}
          <div
            ref={contentRef}
            className={
              isFullBleedTab
                ? "flex-1 min-h-0 flex flex-col overflow-hidden"
                : "flex-1 min-h-0 overflow-y-auto p-4 lg:p-6"
            }
          >
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
            <div
              className={
                isFullBleedTab
                  ? "grid grid-cols-1 gap-6 flex-1 min-h-0 grid-rows-[minmax(0,1fr)]"
                  : "grid grid-cols-1 gap-6"
              }
            >
              <div className={isFullBleedTab ? "flex flex-col min-h-0" : undefined}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    className={
                      isFullBleedTab ? "flex-1 min-h-0 flex flex-col" : undefined
                    }
                    initial={fadeSlide.initial}
                    animate={fadeSlide.animate}
                    exit={fadeSlide.exit}
                    transition={fadeSlide.transition}
                  >
                    <GameRoutes
                        handleLogout={handleLogout}
                        setAuthPhase={setAuthPhase}
                        replayTutorial={replayTutorial}
                    />

                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </main>
      )}

      <GameOverlays />

      <WelcomeModal
        welcomeModal={dismissalModal ? null : welcomeModal}
        me={me}
        setWelcomeModal={setWelcomeModal}
        onNewWelcomeClose={startTutorial}
      />

      {tutorial.active && !isMatchInProgress && !welcomeModal && (
        <CoachTutorial
          stepIndex={tutorial.index}
          onNavigate={handleTutorialNavigate}
          onNext={() => {
            if (tutorial.index >= COACH_TUTORIAL_STEPS.length - 1) {
              // Fim do tutorial: fecha o fly-up para não bloquear o dedo no ecrã.
              setMobileSubMenu(null);
              finishTutorial();
            } else {
              nextStep();
            }
          }}
          onBack={prevStep}
          onSkip={() => {
            // Saltar: fecha o fly-up que o passo atual possa ter aberto.
            setMobileSubMenu(null);
            skipTutorial();
          }}
        />
      )}

    </div>
  );
}
