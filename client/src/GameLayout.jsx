import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeSlide } from "./motion.js";
import { useGame } from "./contexts/GameContext.jsx";
import { GameHeader } from "./components/layout/GameHeader.jsx";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { MobileNav } from "./components/layout/MobileNav.jsx";
import {
  SystemOverlays,
  GameNoticeBar,
} from "./components/layout/SystemOverlays.jsx";
import { WelcomeModal } from "./components/modals/WelcomeModal.jsx";
import { useCoachTutorial } from "./hooks/useCoachTutorial.js";
import { CoachTutorial } from "./components/tutorial/CoachTutorial.jsx";
import { COACH_TUTORIAL_STEPS } from "./components/tutorial/coachTutorialSteps.js";
import { OfflineBanner } from "./components/shared/OfflineBanner.jsx";
import { RoomPauseBanner } from "./components/shared/RoomPauseBanner.jsx";
import { CmTicker } from "./components/ui/CmTicker.jsx";
import { AssistantCoach } from "./components/shared/AssistantCoach.jsx";
import { useAssistantCoach } from "./hooks/useAssistantCoach.js";
import { GameRoutes } from "./GameRoutes.jsx";
import { GameOverlays } from "./GameOverlays.jsx";
import { GroupBackdrop } from "./components/shared/GroupBackdrop.jsx";
import { FULL_BLEED_TABS } from "./constants/navigation.js";

/**
 * Shell do jogo: compõe header, navegação, conteúdo e overlays.
 * O estado vem do `useGame()`; `handleLogout`/`setAuthPhase` vêm da App.
 *
 * @param {Object} props
 * @param {() => void} props.handleLogout Termina a sessão.
 * @param {(phase: string) => void} props.setAuthPhase Muda a fase de autenticação da App.
 * @returns {JSX.Element}
 */
export function GameLayout({ handleLogout, setAuthPhase }) {
  // ── All game state from GameContext ─────────────────────────────────────
  const {
    activeTab,
    welcomeModal,
    setWelcomeModal,
    dismissalModal,
    setMobileSubMenu,
    sidebarCollapsed,
    // Auth
    me,
    teams,
    // Handlers
    navigateTab,
    // Derived
    isMatchInProgress,
    panelMode,
    toasts,
    dismissToast,
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
  const assistant = useAssistantCoach();
  // O tutorial também é o adjunto a falar — a barra espera nos dois casos.
  const showAssistant = tutorial.active || assistant.tip != null;

  // Shell de conteúdo: altura fixa (h-dvh na raiz) com scroll interno. As views
  // deixam de adivinhar a altura disponível via 100dvh — o wrapper entrega um
  // slot com altura definida (overflow-y-auto ou flex para páginas full-bleed).
  const contentRef = useRef(null);
  const scrollToTop = () => contentRef.current?.scrollTo(0, 0);

  // Ao trocar de tab, a posição de scroll volta ao topo (o wrapper é o mesmo
  // nó DOM; o scrollTop sobreviveria ao remount do conteúdo sem este reset).
  useLayoutEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [activeTab]);

  /** Navega para a tab do passo e abre o submenu mobile correspondente. */
  const handleTutorialNavigate = (step) => {
    if (!step) return;
    if (step.tab && step.tab !== activeTab) navigateTab(step.tab);
    setMobileSubMenu(step.submenu ?? null);
    scrollToTop();
  };

  // Páginas full-bleed gerem o próprio scroll interno (flex-col); o wrapper e
  // o motion.div têm de passar min-h-0 para baixo, senão a árvore fica à
  // altura do conteúdo e o scroll interno nunca ocorre.
  const isFullBleedTab = FULL_BLEED_TABS.has(activeTab);

  return (
    <div className="h-dvh overflow-hidden bg-surface text-on-surface font-body tracking-tight relative isolate">
      {/* Fundo fotográfico da tab ativa, sempre visível (inclusive no
          direto). Fica atrás da camada .ambient. */}
      <GroupBackdrop tabKey={activeTab} />
      {/* Atmosfera de fundo do interior (ver .ambient em index.css). Fica atrás
          de todo o conteúdo (isolate + -z-10) e não intercepta cliques. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 ambient" />
      <OfflineBanner />
      <SystemOverlays />

      {/* Só o chrome e o conteúdo entram na grelha (ver .game-shell); os
          overlays ficam fora para nunca ocuparem uma célula. */}
      <div
        className="game-shell"
        data-collapsed={sidebarCollapsed || undefined}
        data-match={isMatchInProgress || undefined}
      >
        <GameHeader
          handleLogout={handleLogout}
          setAuthPhase={setAuthPhase}
          scrollToTop={scrollToTop}
          replayTutorial={replayTutorial}
        />

        <Sidebar scrollToTop={scrollToTop} />

        {panelMode === null && (
          <main
            className={`[grid-area:main] min-h-0 flex flex-col ${isMatchInProgress ? "pb-3 lg:pb-0" : ""}`}
          >
            {/* Avisos em fluxo (empurram o conteúdo, nunca o tapam). */}
            <div className="shrink-0 flex flex-col">
              <RoomPauseBanner />
              <GameNoticeBar notices={toasts} onDismiss={dismissToast} />
            </div>
            <div
              ref={contentRef}
              className={
                isFullBleedTab
                  ? "flex-1 min-h-0 flex flex-col overflow-hidden"
                  : "flex-1 min-h-0 overflow-y-auto p-4 lg:p-6"
              }
            >
              <AnimatePresence mode="sync" initial={false}>
                <motion.div
                  key={activeTab}
                  className={isFullBleedTab ? "flex-1 min-h-0 flex flex-col" : undefined}
                  initial={fadeSlide.initial}
                  animate={fadeSlide.animate}
                  exit={fadeSlide.exit}
                  transition={fadeSlide.transition}
                >
                  <GameRoutes handleLogout={handleLogout} setAuthPhase={setAuthPhase} />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        )}

        {/* Notícias CM só existem no Jornal. Adjunto e notícias não falam ao
            mesmo tempo: a barra espera pela dica. */}
        {activeTab === "jornal" && (
          <CmTicker hidden={isMatchInProgress} paused={showAssistant} />
        )}

        <MobileNav scrollToTop={scrollToTop} />
      </div>

      <GameOverlays />

      {/* O tutorial é o adjunto a falar — as dicas normais calam-se entretanto. */}
      {!tutorial.active && <AssistantCoach {...assistant} />}

      <WelcomeModal
        welcomeModal={dismissalModal ? null : welcomeModal}
        me={me}
        setWelcomeModal={setWelcomeModal}
        onNewWelcomeClose={startTutorial}
      />

      <AnimatePresence>
        {tutorial.active && !isMatchInProgress && !welcomeModal && (
          <CoachTutorial
            stepIndex={tutorial.index}
            color={teams.find((t) => Number(t.id) === Number(me?.teamId))?.color_primary}
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
      </AnimatePresence>
    </div>
  );
}
