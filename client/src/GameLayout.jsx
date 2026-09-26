import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeSlide } from "./motion.js";
import { useGame } from "./contexts/GameContext.jsx";
import { GameHeader } from "./components/layout/GameHeader.jsx";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { MobileNav } from "./components/layout/MobileNav.jsx";
import { SystemOverlays } from "./components/layout/SystemOverlays.jsx";
import { WelcomeModal } from "./components/modals/WelcomeModal.jsx";
import { useMobileLandscape } from "./hooks/useIsMobile.js";
import { useCoachTutorial } from "./hooks/useCoachTutorial.js";
import { CoachTutorial } from "./components/tutorial/CoachTutorial.jsx";
import { COACH_TUTORIAL_STEPS } from "./components/tutorial/coachTutorialSteps.js";
import { OfflineBanner } from "./components/shared/OfflineBanner.jsx";
import { RoomPauseBanner } from "./components/shared/RoomPauseBanner.jsx";
import { GameRoutes } from "./GameRoutes.jsx";
import { GameOverlays } from "./GameOverlays.jsx";
import { GroupBackdrop } from "./components/shared/GroupBackdrop.jsx";

/**
 * Renders the entire game UI. All state comes from useGame().
 * No props — fully self-contained within the context providers.
 */
export function GameLayout({ handleLogout, setAuthPhase }) {
  // ── All game state from GameContext ─────────────────────────────────────
  const {
    // State
    players,
    activeTab,
    welcomeModal,
    setWelcomeModal,
    dismissalModal,
    setMobileSubMenu,
    sidebarCollapsed,
    // Refs
    // Auth
    me,
    // Handlers
    navigateTab,
    // Derived
    isMatchInProgress,
    lockedCoaches,
    panelMode,
  } = useGame();


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

  // Shell de conteúdo: altura fixa (h-dvh na raiz) com scroll interno. As views
  // deixam de adivinhar a altura disponível via 100dvh — o wrapper entrega um
  // slot com altura definida (overflow-y-auto ou flex para páginas full-bleed).
  const contentRef = useRef(null);

  // Ao trocar de tab, a posição de scroll volta ao topo (o wrapper é o mesmo
  // nó DOM; o scrollTop sobreviveria ao remount do conteúdo sem este reset).
  useLayoutEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [activeTab]);

  // Sala com 2+ coaches humanos bloqueada até todos estarem online (semana em espera)
  const offlineLocked = lockedCoaches.filter(
    (n) => !players.some((p) => p.name === n),
  );
  const roomBlocked = lockedCoaches.length >= 2 && offlineLocked.length > 0;

  // Telemóvel em landscape (abaixo de lg): margens do conteúdo.
  const isMobileLandscape = useMobileLandscape();

  // Páginas full-bleed: gerem o próprio scroll interno (flex-col); o wrapper
  // e a cadeia grid → item → motion.div têm de passar min-h-0 para baixo,
  // senão a árvore fica à altura do conteúdo e o scroll interno nunca ocorre.
  const isFullBleedTab = activeTab === "squad" || activeTab === "leiloes";

  // Sequência central dos modais pós-jogo: penalties → mood → surpresas taça
  // → avisos/renovações → fim de época (seasonEnd POR ÚLTIMO). Decide quais
  // estão visíveis em cada render para nunca se sobreporem; os restantes
  // aguardam o fecho do atual (os dados continuam guardados).


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
      <SystemOverlays />
      <GameHeader
        handleLogout={handleLogout}
        setAuthPhase={setAuthPhase}
        scrollToTop={() => contentRef.current?.scrollTo(0, 0)}
      />

      <Sidebar scrollToTop={() => contentRef.current?.scrollTo(0, 0)} />

      <MobileNav scrollToTop={() => contentRef.current?.scrollTo(0, 0)} />

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
