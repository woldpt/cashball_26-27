import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeSlide } from "./motion.js";
import { useGame } from "./contexts/GameContext.jsx";
import { GameHeader } from "./components/layout/GameHeader.jsx";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { MobileNav } from "./components/layout/MobileNav.jsx";
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
    sessionDisplaced,
    toasts,
    activeTab,
    welcomeModal,
    setWelcomeModal,
    dismissalModal,
    renderError,
    reconnectFlash,
    setMobileSubMenu,
    sidebarCollapsed,
    // Refs
    // Auth
    me,
    // Handlers
    dismissToast,
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
