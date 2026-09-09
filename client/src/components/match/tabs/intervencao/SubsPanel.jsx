import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getPosStyle } from "../matchConstants.js";
import {
  CompactPlayerCard,
  MatchIcon,
  TacticsButtons,
} from "../shared/index.js";
import {
  useCompactViewport,
  useLandscapePhone,
} from "../../../hooks/useIsMobile.js";
import {
  getBenchCardState,
  getPitchCardState,
  usePrefersReducedMotion,
  useSubsDrag,
} from "./subsSelection.js";
import {
  SubsCounter,
  SuplentesColumn,
  TitularesColumn,
} from "./PlayerLists.jsx";
import { SwapControls } from "./SwapControls.jsx";

// Rótulos pt-PT dos estilos de intervalo (o TacticsButtons usa os valores em inglês).
const STYLE_LABELS = {
  Defensive: "Defensivo",
  Balanced: "Equilibrado",
  Offensive: "Ofensivo",
};

/* Largura da faixa lateral (peek) em que a zona das skills da página de trás
 * permanece minimamente destapada no mobile. */
const PEEK_W = 64;

/**
 * Folha da stack de páginas mobile (Titulares/Suplentes). A folha à frente
 * ocupa quase toda a largura; a de trás estaciona deslocada PEEK_W px para a
 * direita — o seu bordo direito fica alinhado ao do container e só a zona das
 * métricas dos cartões (skill │ RES forma) permanece visível na faixa lateral,
 * escurecida.
 *
 * A troca é um deslizamento horizontal curto entre os dois slots: sem 3D, sem
 * elasticidade e sem drag livre sobre o scroller → as folhas assentam estáveis
 * (sem "boiar") mesmo com re-renders do jogo em curso.
 *
 * @param {boolean} props.isFront - Esta folha é a da frente?
 * @param {boolean} props.reducedMotion - Prefere movimento reduzido (troca instantânea).
 */
function StackSheet({ isFront, reducedMotion, children }) {
  return (
    <motion.div
      initial={false}
      animate={
        isFront
          ? { x: 0, filter: "brightness(1)" }
          : { x: PEEK_W, filter: "brightness(0.55) saturate(0.85)" }
      }
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              x: { duration: 0.34, ease: [0.32, 0.72, 0.24, 1] },
              filter: { duration: 0.34 },
            }
      }
      style={{
        zIndex: isFront ? 2 : 1,
        pointerEvents: isFront ? "auto" : "none",
        width: `calc(100% - ${PEEK_W}px)`,
      }}
      aria-hidden={!isFront}
      {...(!isFront ? { inert: true } : {})}
      className={`absolute left-0 top-0 h-full overflow-hidden rounded-lg bg-surface-container ${isFront ? "shadow-[10px_0_24px_-12px_rgba(0,0,0,0.9)]" : ""}`}
    >
      <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
    </motion.div>
  );
}

/* ── SubsPanel — Titulares | Suplentes | Mentalidade | Substituições ─────
 * Desktop (md+): 3-col grid — a 3ª coluna tem a Mentalidade no topo e as
 * Substituições fixas ao fundo. Mobile:
 * stack de duas páginas sobrepostas (Titulares/Suplentes) com deslizamento
 * horizontal —
 * top cluster (mentalidade recolhível + indicador de página), folha ativa
 * como scroller próprio, peek da outra página em baixo e barra de ação
 * contextual na zona do polegar. Navegação: seleção, swipe horizontal,
 * chip 'Sai' ou tap no peek. */
export function SubsPanel({
  isHalftime,
  isUserSubPause = false,
  isForcedSwap,
  isGkRedCard,
  isEmergencyGk = false,
  tactic,
  onUpdateTactic,
  playerMatchStats,
  onPitchPlayers,
  benchPlayers,
  effectiveOutId,
  selectedInId,
  sourcePlayer,
  targetPlayer,
  handlePickOut,
  handlePickIn,
  forceOutPlayer,
  subbedOut,
  subsMade,
  injuryCountdown,
  confirmHint,
  canConfirmSwap,
  onResetSub,
  onConfirmSub,
  onResolveAction,
  confirmedSubs,
  pauseInitialIdx = null,
  confirmResetAll,
  onArmResetAll,
  summary,
}) {
  // Mobile: navegação explícita do utilizador na stack de páginas (swipe,
  // tap no peek ou chip 'Sai'). `null` = seguir a regra implícita:
  // há troca pendente → banco; senão → titulares. Substituições
  // obrigatórias já têm "quem sai" fixo, logo derivam para o banco.
  const [userPage, setUserPage] = useState(null);
  const hasPendingSwap = Boolean(effectiveOutId) || Boolean(selectedInId);
  const frontPage = userPage ?? (hasPendingSwap ? "bench" : "pitch");
  // Mentalidade recolhível (mobile) — fechada por omissão para não roubar
  // altura à lista; fecha-se sozinha após escolher estilo.
  const [mentalidadeOpen, setMentalidadeOpen] = useState(false);
  // Movimento reduzido → troca instantânea de folhas, sem flip.
  const reducedMotion = usePrefersReducedMotion();
  // Landscape phone: stack em vez da grid de 3 colunas (altura insuficiente).
  const compact = useCompactViewport();
  // Compressão extra só na banda landscape phone.
  const shortLandscape = useLandscapePhone();

  // Arrastar-largar entre colunas (só rato; em toque é por seleção).
  // Estado e regras vivem em `useSubsDrag` para as três vistas partilharem.
  const {
    dragFrom,
    dragOverSide,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDropOnPitch,
    handleDropOnBench,
  } = useSubsDrag({ handlePickOut, handlePickIn });

  /**
   * Seleciona o jogador que sai e traz a folha dos suplentes para a frente
   * (mobile) para escolher quem entra.
   * @param {object} p
   */
  const pickOut = (p) => {
    handlePickOut(p);
    setUserPage("bench");
  };

  const grAvailableOnBench = benchPlayers.some(
    (bp) => bp.position === "GR" && !subbedOut.includes(bp.id),
  );
  // Aviso visível em vez do antigo `title` — tooltips não chegam ao toque,
  // por isso o motivo do bloqueio tem de estar no ecrã.
  const grLockedNoReplacement =
    isHalftime &&
    !grAvailableOnBench &&
    onPitchPlayers.some((p) => p.position === "GR");

  // Contexto único para o estado dos cartões — titulares, banco e landscape
  // aplicam as mesmas regras via getPitchCardState/getBenchCardState.
  const cardCtx = useMemo(
    () => ({
      isHalftime,
      isForcedSwap,
      isGkRedCard,
      isEmergencyGk,
      forceOutPlayer,
      subsMade,
      subbedOut,
      grAvailableOnBench,
      effectiveOutId,
      selectedInId,
      playerMatchStats,
    }),
    [
      isHalftime,
      isForcedSwap,
      isGkRedCard,
      isEmergencyGk,
      forceOutPlayer,
      subsMade,
      subbedOut,
      grAvailableOnBench,
      effectiveOutId,
      selectedInId,
      playerMatchStats,
    ],
  );

  // No banco, sem escolha de quem sai: a dica remete para o chip 'Sai', que
  // devolve aos titulares (a confirmHint genérica aponta para um cartão que
  // o utilizador não vê).
  const benchConfirmHint =
    !effectiveOutId && !isForcedSwap
      ? "Toca em 'Sai' para escolher quem sai."
      : confirmHint;

  // Mobile: confirmar/limpar devolve a folha de partida aos titulares.
  const mobileOnResetSub = () => {
    onResetSub();
    setUserPage("pitch");
  };
  const mobileOnConfirmSub = () => {
    onConfirmSub();
    setUserPage("pitch");
  };

  const sharedSwapProps = {
    isHalftime,
    isUserSubPause,
    isForcedSwap,
    isEmergencyGk,
    injuryCountdown,
    effectiveOutId,
    sourcePlayer,
    selectedInId,
    targetPlayer,
    confirmHint,
    canConfirmSwap,
    onResetSub,
    onConfirmSub,
    onResolveAction,
    confirmedSubs,
    pauseInitialIdx,
  };

  // Swipe/tap na faixa lateral do peek. A faixa não é scrollável, por isso o
  // gesto horizontal nunca conflita com o scroll vertical nativo das listas.
  // Sem elasticidade: atinge o limiar → troca de página; senão → nada.
  const stripGesture = useRef(null);
  const stripSwipeGuard = useRef(false);
  const handleStripPointerDown = (e) => {
    stripGesture.current = { x0: e.clientX };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem pointer capture — o tap continua a funcionar */
    }
  };
  const handleStripPointerUp = (e) => {
    const g = stripGesture.current;
    stripGesture.current = null;
    if (!g) return;
    if (Math.abs(e.clientX - g.x0) >= 32) {
      // Era um swipe — ignora o click que se segue ao pointerup.
      stripSwipeGuard.current = true;
      setUserPage(frontPage === "pitch" ? "bench" : "pitch");
    }
  };
  const handleStripTap = () => {
    if (stripSwipeGuard.current) {
      stripSwipeGuard.current = false;
      return;
    }
    setUserPage(frontPage === "pitch" ? "bench" : "pitch");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {!compact ? (
        /* ═══ Desktop: 3-column grid ═══ */
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,1.05fr)] flex-1 min-h-0 overflow-hidden">
          <TitularesColumn
            className="border-r border-outline-variant/15"
            players={onPitchPlayers}
            isHalftime={isHalftime}
            isEmergencyGk={isEmergencyGk}
            cardCtx={cardCtx}
            handlePickIn={handlePickIn}
            grLockedNoReplacement={grLockedNoReplacement}
            pickOut={pickOut}
            dragFrom={dragFrom}
            dragOverSide={dragOverSide}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDropOnPitch={handleDropOnPitch}
            handleDragEnd={handleDragEnd}
          />
          <SuplentesColumn
            className="border-r border-outline-variant/15"
            players={benchPlayers}
            isEmergencyGk={isEmergencyGk}
            cardCtx={cardCtx}
            handlePickIn={handlePickIn}
            dragFrom={dragFrom}
            dragOverSide={dragOverSide}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDropOnBench={handleDropOnBench}
            handleDragEnd={handleDragEnd}
            summary={summary}
          />
          <MentalidadeColumn
            isHalftime={isHalftime}
            isUserSubPause={isUserSubPause}
            subsMade={subsMade}
            tactic={tactic}
            onUpdateTactic={onUpdateTactic}
            swapProps={sharedSwapProps}
          />
        </div>
      ) : shortLandscape ? (
        /* ═══ Landscape phone: duas colunas lado-a-lado ═══
         * Aproveita a largura (812px) para mostrar Titulares e
         * Suplentes em simultâneo — sem folhas sobrepostas, sem
         * peek, sem swipe. Cada coluna tem scroll próprio; a
         * lista passa de ~80px (1 cartão) para ~220px (6 cartões).
         * Mentalidade em modo compacto na barra do topo. */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Barra minimalista — mentalidade + contador + anular todas */}
          <div className="shrink-0 flex items-center justify-end gap-2 px-3 py-1.5 border-b border-outline-variant/15 bg-surface-container-low/95">
            <button
              type="button"
              onClick={() => setMentalidadeOpen((o) => !o)}
              aria-expanded={mentalidadeOpen}
              aria-label="Mentalidade — abrir/fechar"
              className={`flex shrink-0 items-center gap-1 rounded-md border px-2 transition-colors ${
                mentalidadeOpen
                  ? "h-9 border-violet-500/50 bg-violet-500/15 text-[9px] font-black uppercase tracking-wider text-violet-300"
                  : "h-9 border-outline-variant/40 text-[9px] font-black uppercase tracking-wider text-on-surface-variant/70 hover:border-violet-500/40 hover:text-violet-300"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
              {STYLE_LABELS[tactic.style] || tactic.style}
            </button>
            <SubsCounter subsMade={subsMade} />
            {confirmedSubs.length > 0 && (
              <button
                type="button"
                onClick={onArmResetAll}
                aria-label="Anular todas as substituições planeadas"
                className={`flex shrink-0 items-center justify-center rounded-md border transition-colors ${
                  confirmResetAll
                    ? "h-9 border-rose-500/50 bg-rose-500/15 px-2 text-[9px] font-black uppercase tracking-wider text-rose-300"
                    : "h-9 w-9 border-outline-variant/40 text-on-surface-variant/70 hover:border-rose-500/40 hover:text-rose-300"
                }`}
              >
                {confirmResetAll ? (
                  <span>Confirmar?</span>
                ) : (
                  <MatchIcon name="reset" className="h-3.5 w-3.5 text-rose-400/80" />
                )}
              </button>
            )}
          </div>
          {mentalidadeOpen && (
            <div className="shrink-0 border-b border-outline-variant/15 bg-surface-container-low/95 px-3 py-1.5">
              <TacticsButtons
                className="w-full"
                value={tactic.style}
                onChange={(next) => {
                  onUpdateTactic(next);
                  setMentalidadeOpen(false);
                }}
              />
            </div>
          )}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Titulares */}
            <div className="flex flex-col flex-1 min-h-0 min-w-0 border-r border-outline-variant/15 overflow-hidden">
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high/50 border-b border-outline-variant/15">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Titulares</span>
                <span className="ml-auto text-[10px] font-bold tabular-nums text-on-surface-variant">{onPitchPlayers.length}</span>
              </div>
              {grLockedNoReplacement && (
                <p className="px-3 py-1 text-[9px] font-semibold text-amber-300 bg-amber-500/10 border-b border-amber-500/20">Sem GR no banco — o guarda-redes não pode sair</p>
              )}
              {isEmergencyGk && (
                <p className="px-3 py-1 text-[9px] font-semibold text-amber-300 bg-amber-500/10 border-b border-amber-500/20">Escolhe um jogador para a baliza 🧤</p>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2 space-y-1.5" style={{ WebkitOverflowScrolling: "touch" }}>
                {onPitchPlayers.map((p) => {
                  const { disabled, selected, forcedOut, stats } =
                    getPitchCardState(p, cardCtx);
                  return (
                    <CompactPlayerCard
                      key={p.id}
                      player={p}
                      posStyle={getPosStyle(p.position)}
                      selected={selected}
                      disabled={disabled}
                      selectable={!disabled}
                      onPick={() => (isEmergencyGk ? handlePickIn(p) : pickOut(p))}
                      showFatigue={false}
                      showMatchStats
                      goals={stats?.goals ?? 0}
                      yellowCards={stats?.yellowCards ?? 0}
                      swapIndicator={isHalftime}
                      forcedOut={forcedOut}
                      draggable={!disabled}
                      onDragStart={handleDragStart(p, "pitch")}
                      onDragOver={handleDragOver("pitch")}
                      onDragDrop={handleDropOnPitch(p)}
                      onDragEnd={handleDragEnd}
                      dragOver={dragOverSide === "pitch" && dragFrom?.side === "bench"}
                    />
                  );
                })}
                {onPitchPlayers.length === 0 && (
                  <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">Sem opções em campo</p>
                )}
              </div>
            </div>
            {/* Suplentes */}
            <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high/50 border-b border-outline-variant/15">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Banco</span>
                <span className="ml-auto text-[10px] font-bold tabular-nums text-on-surface-variant">{benchPlayers.length}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2 space-y-1.5" style={{ WebkitOverflowScrolling: "touch" }}>
                {benchPlayers.map((p) => {
                  const { disabled, selected, stats } = getBenchCardState(
                    p,
                    cardCtx,
                  );
                  return (
                    <CompactPlayerCard
                      key={p.id}
                      player={p}
                      posStyle={getPosStyle(p.position)}
                      selected={selected}
                      disabled={disabled}
                      selectable={!disabled}
                      onPick={() => handlePickIn(p)}
                      showFatigue={false}
                      showMatchStats
                      goals={stats?.goals ?? 0}
                      yellowCards={stats?.yellowCards ?? 0}
                      draggable={!disabled}
                      onDragStart={handleDragStart(p, "bench")}
                      onDragOver={handleDragOver("bench")}
                      onDragDrop={handleDropOnBench(p)}
                      onDragEnd={handleDragEnd}
                      dragOver={dragOverSide === "bench" && dragFrom?.side === "pitch"}
                    />
                  );
                })}
                {benchPlayers.length === 0 && (
                  <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">Sem suplentes disponíveis</p>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-outline-variant/25 bg-surface-container-high/95 px-3 py-2">
            <SwapControls {...sharedSwapProps} />
          </div>
        </div>
      ) : (
        /* ═══ Mobile vertical: stack de páginas Titulares/Suplentes ═══
         * Duas folhas sobrepostas em largura: a folha de trás estaciona com o
         * bordo direito alinhado ao do container, ficando minimamente destapada
         * na zona das skills (skill │ RES forma). A troca é um deslizamento
         * horizontal curto entre slots — swipe/tap na faixa lateral ou chip 'Sai'.
         * Cada folha é o próprio scroller vertical → posições de scroll são
         * preservadas entre trocas (sem remount). */
        <div className="flex flex-col flex-1 min-h-0">
        {/* ── Top cluster: mentalidade (intervalo e pausas a meio do jogo)
         *  + indicador de página ── */}
        <div className="shrink-0 border-b border-outline-variant/15 bg-surface-container-low/95">
          {!shortLandscape && (
            <>
              <button
                type="button"
                onClick={() => setMentalidadeOpen((o) => !o)}
                aria-expanded={mentalidadeOpen}
                className="flex min-h-9 w-full items-center justify-between gap-2 px-4 pt-1.5 pb-1"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                    Mentalidade
                  </span>
                  <span className="truncate text-xs font-bold text-on-surface">
                    {STYLE_LABELS[tactic.style] || tactic.style}
                  </span>
                </span>
                <MatchIcon
                  name="chevron-right"
                  className={`h-4 w-4 shrink-0 text-on-surface-variant/60 transition-transform ${
                    mentalidadeOpen ? "rotate-[270deg]" : "rotate-90"
                  }`}
                />
              </button>
              {mentalidadeOpen && (
                <div className="px-4 pb-2">
                  <TacticsButtons
                    className="w-full"
                    value={tactic.style}
                    onChange={(next) => {
                      onUpdateTactic(next);
                      setMentalidadeOpen(false);
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* Indicador de página (informação; a navegação é swipe / tap) + contador de subs */}
          <div className={`flex items-center gap-2 ${shortLandscape ? "px-4 pt-0.5 pb-1" : "px-4 pt-1 pb-2"}`}>
            <div className="flex flex-1 min-w-0 items-center gap-1.5">
              {[
                { key: "pitch", label: "Em campo", n: onPitchPlayers.length },
                { key: "bench", label: "Banco", n: benchPlayers.length },
              ].map((pg) => (
                <span
                  key={pg.key}
                  className={`flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    frontPage === pg.key
                      ? "bg-surface-container-high text-on-surface shadow-sm shadow-black/20"
                      : "text-on-surface-variant/50"
                  }`}
                >
                  <span className="truncate">{pg.label}</span>
                  <span className="ml-1 tabular-nums opacity-70">({pg.n})</span>
                </span>
              ))}
            </div>
            <SubsCounter subsMade={subsMade} />
            {/* 'Anular todas' compacto (mobile) — dois toques para confirmar. */}
            {confirmedSubs.length > 0 && (
              <button
                type="button"
                onClick={onArmResetAll}
                aria-label="Anular todas as substituições planeadas"
                className={`flex shrink-0 items-center justify-center rounded-md border transition-colors ${
                  confirmResetAll
                    ? "h-9 border-rose-500/50 bg-rose-500/15 px-2 text-[9px] font-black uppercase tracking-wider text-rose-300"
                    : "h-9 w-9 border-outline-variant/40 text-on-surface-variant/70 hover:border-rose-500/40 hover:text-rose-300"
                }`}
              >
                {confirmResetAll ? (
                  <span>Confirmar?</span>
                ) : (
                  <MatchIcon name="reset" className="h-3.5 w-3.5 text-rose-400/80" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Stack de páginas ── */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* Folha TITULARES (frente por omissão) */}
          <StackSheet isFront={frontPage === "pitch"} reducedMotion={reducedMotion}>
            <TitularesColumn
              flat
              players={onPitchPlayers}
              isHalftime={isHalftime}
              isEmergencyGk={isEmergencyGk}
              cardCtx={cardCtx}
              handlePickIn={handlePickIn}
              grLockedNoReplacement={grLockedNoReplacement}
              pickOut={pickOut}
              dragFrom={dragFrom}
              dragOverSide={dragOverSide}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDropOnPitch={handleDropOnPitch}
              handleDragEnd={handleDragEnd}
            />
          </StackSheet>

          {/* Folha SUPLENTES (zona das skills destapada à direita quando atrás) */}
          <StackSheet isFront={frontPage === "bench"} reducedMotion={reducedMotion}>
            <SuplentesColumn
              flat
              players={benchPlayers}
              isEmergencyGk={isEmergencyGk}
              cardCtx={cardCtx}
              handlePickIn={handlePickIn}
              dragFrom={dragFrom}
              dragOverSide={dragOverSide}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDropOnBench={handleDropOnBench}
              handleDragEnd={handleDragEnd}
              summary={summary}
            />
          </StackSheet>

          {/* Faixa lateral do peek — tap ou swipe horizontal troca a página. */}
          <button
            type="button"
            onPointerDown={handleStripPointerDown}
            onPointerUp={handleStripPointerUp}
            onClick={handleStripTap}
            aria-label={
              frontPage === "pitch"
                ? "Traz o banco de suplentes para a frente"
                : "Traz os titulares para a frente"
            }
            className="absolute right-0 top-0 z-[4] flex h-full cursor-pointer items-center justify-center outline-none focus-visible:bg-white/5"
            style={{ width: PEEK_W }}
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high/90 border border-outline-variant/30 text-on-surface-variant/80 shadow-sm"
            >
              <MatchIcon name="chevron-right" className="h-4 w-4 rotate-180" />
            </span>
          </button>
        </div>

        {/* ── Barra de ação contextual — zona do polegar; só existe na folha
       *  do banco (a folha de titulares não precisa de rodapé). */}
        {frontPage === "bench" && (
          <div className="shrink-0 border-t border-outline-variant/25 bg-surface-container-high/95">
            <SwapControls
              {...sharedSwapProps}
              compact
              confirmHint={benchConfirmHint}
              onResetSub={mobileOnResetSub}
              onConfirmSub={mobileOnConfirmSub}
              outSlotAction={() => setUserPage("pitch")}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/* ── Mentalidade | Substituições column (desktop) ────────────────────────
 * A 3.ª coluna tem dois blocos, cada um com o seu cabeçalho:
 *   1. "Mentalidade"    → Estilo de jogo (táticas) — alinhada ao topo
 *   2. "Substituições"  → controlos Sai→Entra + botões + Confirmadas
 *                           — fixa ao fundo (mt-auto), com o espaço vazio
 *                           entre os dois blocos */
function MentalidadeColumn({
  isHalftime,
  isUserSubPause = false,
  subsMade,
  tactic,
  onUpdateTactic,
  swapProps,
}) {
  return (
    <div className="flex flex-col min-h-0 min-w-0 overflow-hidden bg-surface-container-high/30">
      {/* ── Row 1: Mentalidade — altura natural, SEM scroll: os botões nunca
       * podem ficar cortados; o overflow absorve-se na linha de baixo. */}
      <div className="shrink-0 border-b border-outline-variant/15">
        <div className="px-4 py-3 flex items-center justify-between gap-2 bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
            Mentalidade
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Estilo de jogo
            </span>
            <TacticsButtons
              className="w-full"
              value={tactic.style}
              onChange={onUpdateTactic}
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: Substituições — fixa ao fundo (mt-auto): com espaço sobra,
       * assenta no fim da coluna; se o conteúdo for maior que a coluna,
       * encolhe (min-h-0) e a zona interna faz scroll. */}
      <div className="mt-auto flex flex-col min-h-0 overflow-hidden border-t border-outline-variant/15">
        <div className="shrink-0 px-4 py-3 flex items-center justify-between gap-2 bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 shadow-[0_0_8px_rgba(251,113,133,0.5)]" />
            Substituições
          </h3>
          {(isHalftime || isUserSubPause) && <SubsCounter subsMade={subsMade} />}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <SwapControls {...swapProps} />
          </div>
        </div>
      </div>
    </div>
  );
}
