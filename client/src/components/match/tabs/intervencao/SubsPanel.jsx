import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getPosStyle } from "../../matchConstants.js";
import {
  CompactPlayerCard,
  MatchIcon,
  TacticsButtons,
} from "../../shared/index.js";
import { PRESSURE_OPTIONS, TALK_OPTIONS } from "../../../../constants/index.js";
import {
  useCompactViewport,
  useIsMobile,
  useLandscapePhone,
  useMobileLandscape,
} from "../../../../hooks/useIsMobile.js";
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
import { MatchSummaryBlock } from "./Panels.jsx";
import { OrdersCard } from "../../../shared/OrdersCard.jsx";

// Rótulos pt-PT dos estilos de intervalo (o TacticsButtons usa os valores em inglês).
const STYLE_LABELS = {
  Defensive: "Defensivo",
  Balanced: "Neutro",
  Offensive: "Ofensivo",
};

/**
 * Instruções de jogo: mentalidade + pressão e, ao intervalo, a conversa
 * no balneário (vale para a 2.ª parte).
 * - `compact` (telemóvel): barras segmentadas, a 1.ª sem etiqueta.
 * - `cards` (3.ª coluna do desktop): secções com cartões e o efeito de cada opção.
 * @param {Object} props
 * @param {{style?: string, pressure?: string, talk?: string}} props.tactic
 * @param {(patch: Object) => void} props.onUpdateTactic
 * @param {boolean} [props.showTalk] - Só no intervalo da 1.ª para a 2.ª parte.
 * @param {"compact"|"cards"} [props.variant]
 * @returns {JSX.Element}
 */
function MatchInstructions({ tactic, onUpdateTactic, showTalk = false, variant = "compact" }) {
  const cards = variant === "cards";
  const groups = [
    { key: "style", label: "Mentalidade", value: tactic.style, options: undefined },
    { key: "pressure", label: "Pressão", value: tactic.pressure ?? "MEDIA", options: PRESSURE_OPTIONS },
    showTalk && { key: "talk", label: cards ? "Conversa ao intervalo" : "Conversa", value: tactic.talk, options: TALK_OPTIONS },
  ].filter(Boolean);
  const buttons = (g, className) => (
    <TacticsButtons
      className={className}
      options={g.options}
      field={g.key}
      value={g.value}
      onChange={onUpdateTactic}
      variant={cards ? "cards" : "segmented"}
      ariaLabel={g.label}
    />
  );
  if (cards) {
    return (
      <div className="flex w-full flex-col gap-3">
        {groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-1.5">
            <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.6)]" />
              {g.label}
            </h4>
            {buttons(g, "w-full")}
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1.5">
      {groups.map((g, i) =>
        i === 0 ? (
          <div key={g.key}>{buttons(g, "w-full")}</div>
        ) : (
          <div key={g.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[9px] font-black uppercase tracking-wider text-on-surface-variant">
              {g.label}
            </span>
            {buttons(g, "flex-1 min-w-0")}
          </div>
        ),
      )}
    </div>
  );
}

/* Largura da faixa lateral (peek) em que a zona das skills da página de trás
 * permanece minimamente destapada no mobile. */
const PEEK_W = 96;

/**
 * Folha da stack de páginas mobile (Titulares/Suplentes). A folha à frente
 * ocupa quase toda a largura; a de trás estaciona deslocada PEEK_W px para a
 * direita — o seu bordo direito fica alinhado ao do container e só a zona das
 * métricas dos cartões (skill │ forma) permanece visível na faixa lateral,
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

/* ── SubsPanel — Titulares | Suplentes | Tática ──────────────────────────
 * Desktop (md+): 3-col grid — Titulares, Suplentes (só a lista) e Tática
 * (posse, mentalidade/pressão/conversa e ordens para o jogo). A confirmação
 * é a pill flutuante ao centro, igual ao mobile.
 * Mobile:
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
  maxSubs,
  injuryCountdown,
  confirmHint,
  canConfirmSwap,
  noReplacement = false,
  onResetSub,
  onConfirmSub,
  onResolveAction,
  confirmedSubs,
  pauseInitialIdx = null,
  confirmResetAll,
  onArmResetAll,
  summary,
  showTalk = false,
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
  // Intervenção em vertical: SKILL principal à direita (só telemóvel em
  // vertical — landscape phone e ecrã baixo mantêm a ordem normal).
  const isMobileWidth = useIsMobile();
  const isLandscape = useMobileLandscape();
  const portraitPhone = isMobileWidth && !isLandscape;

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
  const justInIds = useMemo(
    () => new Set((confirmedSubs || []).map((s) => Number(s.in))),
    [confirmedSubs],
  );
  const cardCtx = useMemo(
    () => ({
      justInIds,
      isHalftime,
      isForcedSwap,
      isGkRedCard,
      isEmergencyGk,
      forceOutPlayer,
      subsMade,
      maxSubs,
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
      maxSubs,
      subbedOut,
      grAvailableOnBench,
      effectiveOutId,
      selectedInId,
      playerMatchStats,
      justInIds,
    ],
  );

  // Mobile: confirmar devolve a folha de partida aos titulares.
  const mobileOnConfirmSub = () => {
    onConfirmSub();
    setUserPage("pitch");
  };
  // Guarda anti-toque-duplo do botão flutuante (no intervalo, um toque
  // duplo sem isto metia duas entradas na fila).
  const [confirming, setConfirming] = useState(false);
  const flashConfirming = (fn) => () => {
    if (confirming) return;
    setConfirming(true);
    fn();
    window.setTimeout(() => setConfirming(false), 900);
  };

  const sharedSwapProps = {
    isHalftime,
    isUserSubPause,
    isForcedSwap,
    isEmergencyGk,
    noReplacement,
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

  // Confirmar em fila (intervalo/pausa) + resolução imediata — partilhados
  // pela pill do mobile vertical e do desktop.
  const queuedConfirm = flashConfirming(mobileOnConfirmSub);
  const resolveGk = flashConfirming(() => onResolveAction(selectedInId));
  const resolveSwap = flashConfirming(() =>
    onResolveAction({
      playerOut: effectiveOutId,
      playerIn: noReplacement ? null : selectedInId,
    }),
  );

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
        /* ═══ Desktop: Titulares | Suplentes | Tática ═══
         * A confirmação é a pill flutuante ao centro (igual ao mobile
         * vertical); a 3.ª coluna junta posse, mentalidade/pressão/conversa e
         * as ordens para o jogo. */
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,1.05fr)] h-full min-h-0 overflow-hidden">
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
            />
            <TacticColumn
              isHalftime={isHalftime}
              isUserSubPause={isUserSubPause}
              subsMade={subsMade}
              maxSubs={maxSubs}
              confirmedSubs={confirmedSubs}
              pauseInitialIdx={pauseInitialIdx}
              confirmResetAll={confirmResetAll}
              onArmResetAll={onArmResetAll}
              summary={summary}
              tactic={tactic}
              onUpdateTactic={onUpdateTactic}
              showTalk={showTalk}
              confirmHint={confirmHint}
              canConfirmSwap={canConfirmSwap}
              noReplacement={noReplacement}
            />
          </div>
          <FloatingConfirmButton
            canConfirmSwap={canConfirmSwap}
            isForcedSwap={isForcedSwap}
            injuryCountdown={injuryCountdown}
            isHalftime={isHalftime}
            isUserSubPause={isUserSubPause}
            isEmergencyGk={isEmergencyGk}
            noReplacement={noReplacement}
            sourcePlayer={sourcePlayer}
            targetPlayer={targetPlayer}
            onQueue={queuedConfirm}
            onResolveGk={resolveGk}
            onResolveSwap={resolveSwap}
            confirming={confirming}
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
            <SubsCounter subsMade={subsMade} max={maxSubs} />
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
              <MatchInstructions tactic={tactic} onUpdateTactic={onUpdateTactic} showTalk={showTalk} />
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
                  const { disabled, selected, forcedOut, stats, justIn } =
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
                      skillLast={portraitPhone}
                      showMatchStats
                      goals={stats?.goals ?? 0}
                      yellowCards={stats?.yellowCards ?? 0}
                      swapIndicator={isHalftime}
                      forcedOut={forcedOut}
                      justIn={justIn}
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
                      skillLast={portraitPhone}
                      posRight
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
         * na zona das skills (skill │ forma). A troca é um deslizamento
         * horizontal curto entre slots — swipe/tap na faixa lateral ou chip 'Sai'.
         * Cada folha é o próprio scroller vertical → posições de scroll são
         * preservadas entre trocas (sem remount). */
        <div className="flex flex-col flex-1 min-h-0">
        {/* ── Top cluster: mentalidade (intervalo e pausas a meio do jogo)
         *  + indicador de página ── */}
        <div className="shrink-0 border-b border-outline-variant/15 bg-surface-container-low/95">
          {!shortLandscape && (
            <>
              {/* Mentalidade sempre visível — 3 botões na mesma altura (min-h-9)
               * que o antigo toggle recolhível. */}
              <div className="flex min-h-9 items-center px-4 pt-1 pb-0.5">
                <MatchInstructions tactic={tactic} onUpdateTactic={onUpdateTactic} showTalk={showTalk} />
              </div>
            </>
          )}

          {/* Indicador de página (informação; a navegação é swipe / tap) + contador de subs */}
          <div className={`flex items-center gap-2 ${shortLandscape ? "px-4 pt-0.5 pb-1" : "px-4 pt-1 pb-2"}`}>
            <div className="flex flex-1 min-w-0 items-center gap-1.5">
              {[
                { key: "pitch", label: "Em campo", n: onPitchPlayers.length },
                { key: "bench", label: "Banco", n: benchPlayers.length },
              ].map((pg) => (
                <button
                  key={pg.key}
                  type="button"
                  onClick={() => setUserPage(pg.key)}
                  aria-pressed={frontPage === pg.key}
                  aria-label={pg.key === "pitch" ? "Ver titulares em campo" : "Ver banco de suplentes"}
                  className={`flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    frontPage === pg.key
                      ? "bg-surface-container-high text-on-surface shadow-sm shadow-black/20"
                      : "text-on-surface-variant/50 hover:text-on-surface-variant"
                  }`}
                >
                  <span className="truncate">{pg.label}</span>
                  <span className="ml-1 tabular-nums opacity-70">({pg.n})</span>
                </button>
              ))}
            </div>
            <SubsCounter subsMade={subsMade} max={maxSubs} />
            {isUserSubPause && (() => {
              const start = pauseInitialIdx ?? confirmedSubs.length;
              const queued = confirmedSubs.slice(start);
              if (queued.length === 0) return null;
              return (
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-300/80 tabular-nums">
                  Fila · {queued.length}
                </span>
              );
            })()}
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
              skillLast={portraitPhone}
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
              skillLast={portraitPhone}
              posRight
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

          {/* ── Confirmação flutuante (partilhada com o desktop): pill ao
           *  centro quando ambos os intervenientes estão escolhidos. */}
          <FloatingConfirmButton
            canConfirmSwap={canConfirmSwap}
            isForcedSwap={isForcedSwap}
            injuryCountdown={injuryCountdown}
            isHalftime={isHalftime}
            isUserSubPause={isUserSubPause}
            isEmergencyGk={isEmergencyGk}
            noReplacement={noReplacement}
            sourcePlayer={sourcePlayer}
            targetPlayer={targetPlayer}
            onQueue={queuedConfirm}
            onResolveGk={resolveGk}
            onResolveSwap={resolveSwap}
            confirming={confirming}
          />
        </div>

      </div>
      )}
    </div>
  );
}

/* Etiqueta «Sai → Entra» do botão de confirmação; nomes longos passam a 2 linhas. */
function SwapLabel({ out, inn }) {
  return (
    <span>
      {out} <span aria-hidden="true" className="opacity-70">→</span> {inn}
    </span>
  );
}

const PILL_TONES = {
  emerald: {
    bg: "bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-600 text-emerald-950 ring-1 ring-white/40",
    glow: "0 0 0 0 rgba(52,211,153,0.55)",
    glowEnd: "0 0 0 14px rgba(52,211,153,0)",
    shadow: "shadow-[0_10px_30px_-6px_rgba(16,185,129,0.65),inset_0_1px_0_rgba(255,255,255,0.55)]",
  },
  indigo: {
    bg: "bg-gradient-to-b from-indigo-400 via-indigo-500 to-indigo-700 text-white ring-1 ring-white/30",
    glow: "0 0 0 0 rgba(129,140,248,0.55)",
    glowEnd: "0 0 0 14px rgba(129,140,248,0)",
    shadow: "shadow-[0_10px_30px_-6px_rgba(99,102,241,0.65),inset_0_1px_0_rgba(255,255,255,0.4)]",
  },
};

/* ── ConfirmPill — botão de confirmação com entrada em mola, halo pulsante e
 * brilho a varrer. Movimento reduzido: sem halo nem brilho. */
function ConfirmPill({ tone, onClick, disabled, ariaLabel, icon, children }) {
  const t = PILL_TONES[tone];
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      initial={reduced ? false : { opacity: 0, scale: 0.8, y: 8 }}
      animate={
        reduced
          ? { opacity: 1 }
          : { opacity: 1, scale: 1, y: 0, boxShadow: [t.glow, t.glowEnd] }
      }
      transition={
        reduced
          ? { duration: 0 }
          : {
              default: { type: "spring", stiffness: 380, damping: 22 },
              boxShadow: { duration: 1.6, repeat: Infinity, ease: "easeOut" },
            }
      }
      whileHover={reduced ? undefined : { scale: 1.04 }}
      whileTap={reduced ? undefined : { scale: 0.94 }}
      className={`pointer-events-auto relative flex min-h-12 max-w-[calc(100%-2rem)] items-center gap-2 overflow-hidden rounded-full px-6 py-2.5 text-sm font-black tracking-tight ${t.bg} ${t.shadow} disabled:opacity-70`}
    >
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent"
          initial={{ x: "-150%" }}
          animate={{ x: "450%" }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
        />
      )}
      <span className="relative flex shrink-0 items-center justify-center rounded-full bg-black/15 p-1">
        {icon}
      </span>
      <span className="relative min-w-0 text-center leading-tight [overflow-wrap:anywhere] line-clamp-2">{children}</span>
    </motion.button>
  );
}

/* ── FloatingConfirmButton — pill de confirmação ao centro ───────────────
 * Um só botão a meio do ecrã, visível quando ambos os intervenientes estão
 * escolhidos (todos os modos: intervalo/pausa em fila, GR improvisado e
 * trocas forçadas com countdown). O wrapper não interceta toques — só o
 * botão — para não roubar scroll às listas. Partilhado pelo mobile vertical
 * e pelo desktop (a 3.ª coluna é a Tática, sem barra de Substituições). */
function FloatingConfirmButton({
  canConfirmSwap,
  isForcedSwap,
  injuryCountdown,
  isHalftime,
  isUserSubPause,
  isEmergencyGk,
  noReplacement,
  sourcePlayer,
  targetPlayer,
  onQueue,
  onResolveGk,
  onResolveSwap,
  confirming,
}) {
  if (!canConfirmSwap) return null;
  return (
    <div className="absolute inset-x-0 top-[38%] z-[5] flex -translate-y-1/2 flex-col items-center gap-2 pointer-events-none">
      {isForcedSwap && injuryCountdown !== null && (
        <>
          <span role="status" className="sr-only">
            {isEmergencyGk
              ? "Escolha automática iminente — quem vai para a baliza?"
              : "Substituição automática iminente — escolhe o substituto."}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-auto rounded-full border border-amber-400/40 bg-zinc-950/90 px-3 py-1 text-xs font-black tabular-nums text-amber-300 shadow-lg animate-pulse motion-reduce:animate-none"
          >
            Auto em {injuryCountdown}s
          </span>
        </>
      )}
      {isHalftime || isUserSubPause ? (
        <ConfirmPill
          tone="emerald"
          onClick={onQueue}
          disabled={confirming}
          ariaLabel={`Substituir ${sourcePlayer?.name} por ${targetPlayer?.name}`}
          icon={<MatchIcon name="confirm" className="h-4 w-4 shrink-0" />}
        >
          <SwapLabel out={sourcePlayer?.name} inn={targetPlayer?.name} />
        </ConfirmPill>
      ) : isEmergencyGk ? (
        <ConfirmPill
          tone="indigo"
          onClick={onResolveGk}
          disabled={confirming}
          ariaLabel={`${targetPlayer?.name} vai para a baliza`}
          icon={<span aria-hidden="true" className="text-sm leading-none">🧤</span>}
        >
          <span>{targetPlayer?.name} para a baliza</span>
        </ConfirmPill>
      ) : (
        <ConfirmPill
          tone="indigo"
          onClick={onResolveSwap}
          disabled={confirming}
          ariaLabel={noReplacement ? "Continuar sem substituição" : `Substituir ${sourcePlayer?.name} por ${targetPlayer?.name}`}
          icon={<MatchIcon name="confirm" className="h-4 w-4 shrink-0" />}
        >
          {noReplacement ? (
            <span>Continuar sem substituição</span>
          ) : (
            <SwapLabel out={sourcePlayer?.name} inn={targetPlayer?.name} />
          )}
        </ConfirmPill>
      )}
    </div>
  );
}

/**
 * TacticColumn — 3.ª coluna do desktop: contador/anular subs, posse de bola,
 * mentalidade + pressão (+ conversa ao intervalo) e as ordens para o jogo.
 * @param {Object} props
 * @param {boolean} props.isHalftime
 * @param {boolean} props.isUserSubPause
 * @param {number} props.subsMade
 * @param {number} props.maxSubs
 * @param {Array<Object>} props.confirmedSubs
 * @param {number|null} props.pauseInitialIdx
 * @param {boolean} props.confirmResetAll
 * @param {() => void} props.onArmResetAll
 * @param {Object} props.summary - {fixture, hInfo, aInfo, liveMinute} para a posse.
 * @param {Object} props.tactic
 * @param {(patch: Object) => void} props.onUpdateTactic
 * @param {boolean} props.showTalk
 * @param {string|null} props.confirmHint
 * @param {boolean} props.canConfirmSwap
 * @param {boolean} props.noReplacement
 * @returns {JSX.Element}
 */
function TacticColumn({
  isHalftime,
  isUserSubPause,
  subsMade,
  maxSubs,
  confirmedSubs,
  pauseInitialIdx,
  confirmResetAll,
  onArmResetAll,
  summary,
  tactic,
  onUpdateTactic,
  showTalk,
  confirmHint,
  canConfirmSwap,
  noReplacement,
}) {
  const start = pauseInitialIdx ?? confirmedSubs.length;
  const queued = confirmedSubs.slice(start);
  return (
    <div className="flex flex-col min-h-0 min-w-0 bg-surface-container-high/30">
      <div className="shrink-0 px-3 py-2.5 flex items-center gap-2 bg-surface-container-high/50 border-b border-outline-variant/15">
        <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
          <span className="truncate">Tática</span>
        </h3>
        {(isHalftime || isUserSubPause) && (
          <span className="ml-auto shrink-0">
            <SubsCounter subsMade={subsMade} max={maxSubs} />
          </span>
        )}
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
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3 [&>*]:shrink-0">
        {summary && <MatchSummaryBlock {...summary} />}
        <div className="rounded-xl border border-outline-variant/25 bg-surface-container/60 p-3">
          <MatchInstructions tactic={tactic} onUpdateTactic={onUpdateTactic} showTalk={showTalk} variant="cards" />
        </div>
        <OrdersCard tactic={tactic} onUpdateTactic={onUpdateTactic} />
      </div>
      <div className="shrink-0 px-3 py-1.5 border-t border-outline-variant/15 space-y-1">
        {isUserSubPause && queued.length > 0 && (
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300/80 tabular-nums">
            Fila · {queued.length}
          </p>
        )}
        {(noReplacement || !canConfirmSwap) && confirmHint && (
          <p role="status" className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-200">
            <span aria-hidden="true">⚠</span>
            {confirmHint}
          </p>
        )}
      </div>
    </div>
  );
}
