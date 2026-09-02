import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MAX_MATCH_SUBS, POSITION_SHORT_LABELS } from "../../../constants/index.js";
import {
  getPosStyle,
  sortPlayersByPos,
  buildPositionRows,
  filterMatchEvents,
  buildPlayerMatchStats,
} from "../matchConstants.js";
import {
  PossessionBar,
  EventCard,
  RefWeatherBar,
  TacticsButtons,
  ConfirmedSubsStrip,
  MatchPlayerCard,
  CompactPlayerCard,
  MatchIcon,
  PrimaryButton,
  GhostButton,
  OpponentGridCard,
} from "../shared/index.js";
import { TeamCrest } from "../../live/TeamCrest.jsx";

// Halftime style values → labels (TacticsButtons uses the English values).
const STYLE_LABELS = {
  Defensive: "Defensivo",
  Balanced: "Equilibrado",
  Offensive: "Ofensivo",
};

/* ── IntervencaoView — substitutions + chronology + opponent ─────────────
 * Simplified layout:
 *   [Descrição do ecrã]            [Scoreboard]   [Anular todas]
 *   [Tab Cronologia] [Tab Substituições] [Tab Adversário]
 *   (Subs)  Titulares | Suplentes | [Mentalidade | Substituições]
 *   [Iniciar/Continuar]  ← full-width button em MatchPage (mantido)
 * ──────────────────────────────────────────────────────────────────────── */
export function IntervencaoView({
  mode,
  fixture,
  liveMinute,
  teams,
  myTeamId,
  isCupMatch,
  isCupExtraTime,
  matchAction,
  injuryCountdown,
  tactic,
  onUpdateTactic,
  annotatedSquad,
  subbedOut,
  confirmedSubs,
  subsMade,
  swapSource,
  swapTarget,
  onSelectOut,
  onSelectIn,
  onConfirmSub,
  onResetSub,
  onUndoSub,
  onResetAllSubs,
  redCardedHalftimeIds,
  injuredHalftimeIds,
  onResolveAction,
}) {
  const [centerTab, setCenterTab] = useState("subs");
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Two-tap arm for "Anular todas" auto-disarms after 3s so a stale armed
  // state can't surprise the user later.
  useEffect(() => {
    if (!confirmResetAll) return;
    const timer = setTimeout(() => setConfirmResetAll(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmResetAll]);

  /* ── Mode booleans ────────────────────────────────────────────── */
  const isHalftime = mode === "halftime";
  const isPreExtraTime =
    isHalftime && isCupMatch && (liveMinute ?? 0) >= 90 && !isCupExtraTime;
  const actionType = matchAction?.type || null;
  const isForcedSwap = actionType === "injury" || actionType === "gk_red_card";
  const isGkRedCard = actionType === "gk_red_card";
  const isActionSub = actionType === "user_substitution";

  const selectedOutId =
    typeof swapSource === "object" && swapSource !== null
      ? swapSource.id
      : swapSource;
  const selectedInId =
    typeof swapTarget === "object" && swapTarget !== null
      ? swapTarget.id
      : swapTarget;

  const forceOutPlayer =
    matchAction?.injuredPlayer ||
    matchAction?.sentOffPlayer ||
    matchAction?.dismissedPlayer ||
    null;

  /* ── Team info ────────────────────────────────────────────────── */
  const isHome =
    myTeamId != null && Number(fixture?.homeTeamId) === Number(myTeamId);
  const isMyFixture =
    myTeamId != null &&
    (Number(fixture?.homeTeamId) === Number(myTeamId) ||
      Number(fixture?.awayTeamId) === Number(myTeamId));
  const hInfo = teams?.find((t) => t.id === fixture?.homeTeamId);
  const aInfo = teams?.find((t) => t.id === fixture?.awayTeamId);

  // The normal squad comes from the database and intentionally keeps the
  // permanent skill. During a match, overlay the fixture's transient fatigue
  // state so the halftime decision compares tired starters with fresh bench
  // players without persisting match state into the squad.
  const liveOwnLineup = isHome ? fixture?.homeLineup : fixture?.awayLineup;
  const liveOwnById = new Map(
    (liveOwnLineup || []).map((player) => [Number(player.id), player]),
  );
  const panelSquad =
    isHalftime && isMyFixture
      ? annotatedSquad.map((player) => {
          const livePlayer = liveOwnById.get(Number(player.id));
          if (!livePlayer) return player;
          return {
            ...player,
            skill: livePlayer.skill ?? player.skill,
            matchMinutes: livePlayer.matchMinutes ?? 0,
            fatigueLoss: livePlayer.fatigueLoss ?? 0,
          };
        })
      : annotatedSquad;

  /* ── Our squad ────────────────────────────────────────────────── */
  const onPitchPlayers = isHalftime
    ? sortPlayersByPos(
        panelSquad.filter(
          (p) =>
            tactic?.positions?.[p.id] === "Titular" &&
            !subbedOut.includes(p.id) &&
            !redCardedHalftimeIds.has(p.id) &&
            !injuredHalftimeIds?.has(p.id),
        ),
      )
    : isActionSub
      ? sortPlayersByPos(matchAction?.onPitch || [])
      : isGkRedCard
        ? sortPlayersByPos(matchAction?.onPitch || [])
        : forceOutPlayer
          ? [forceOutPlayer]
          : [];

  const benchPlayers = isHalftime
    ? sortPlayersByPos(
        panelSquad
          .filter((p) => tactic?.positions?.[p.id] === "Suplente")
          .filter((p) => !injuredHalftimeIds?.has(p.id)),
      )
    : sortPlayersByPos(matchAction?.benchPlayers || []);

  const playerById = (id) =>
    panelSquad.find((p) => p.id === id) ||
    onPitchPlayers.find((p) => p.id === id) ||
    benchPlayers.find((p) => p.id === id) ||
    null;

  const effectiveOutId = isGkRedCard
    ? selectedOutId
    : selectedOutId || (isForcedSwap ? forceOutPlayer?.id : null);
  const targetPlayer = playerById(selectedInId);
  const sourcePlayer = playerById(effectiveOutId);
  const canConfirmSwap =
    !!effectiveOutId &&
    !!selectedInId &&
    (!isHalftime || subsMade < MAX_MATCH_SUBS);

  // During a forced swap the opponent/chronology tabs are noise — lock the
  // view on subs while the auto-substitution countdown runs.
  const activeCenterTab = isForcedSwap ? "subs" : centerTab;

  // Reason the confirm button is disabled — surfaced next to the button
  // instead of leaving the user guessing (was: silent disabled state).
  const confirmHint = canConfirmSwap
    ? null
    : !effectiveOutId
      ? "Escolhe o jogador que sai."
      : !selectedInId
        ? "Escolhe o jogador que entra."
        : isHalftime && subsMade >= MAX_MATCH_SUBS
          ? "Limite de substituições atingido."
          : null;

  /* ── Opponent data ────────────────────────────────────────────── */
  // Strict check: arrays vazios ([] são truthy) não contam como escalação.
  const hasLineups =
    !!fixture?.homeLineup?.length && !!fixture?.awayLineup?.length;
  const oppLineupRaw = isHome ? fixture?.awayLineup : fixture?.homeLineup;
  const oppLineup = oppLineupRaw || [];
  // Defensive: expulsos adversários não podem constar da escalação exibida
  // (o snapshot do servidor pode estar stale em jogos a decorrer).
  const oppRedCardedIds = new Set(
    (fixture?.events || [])
      .filter(
        (e) =>
          e.type === "red" &&
          e.team === (isHome ? "away" : "home") &&
          e.playerId != null,
      )
      .map((e) => Number(e.playerId)),
  );
  const oppLineupFiltered = oppLineup.filter(
    (p) => !oppRedCardedIds.has(Number(p.id)),
  );
  const oppStarters = sortPlayersByPos(
    oppLineupFiltered.filter((p) => p.is_starter === true).slice(0, 11),
  );
  const oppBench = sortPlayersByPos(
    oppLineupFiltered.filter((p) => p.is_starter === false),
  );
  const oppRows = buildPositionRows(oppStarters);
  const oppInfo = isHome ? aInfo : hInfo;

  /* ── Chronology events ────────────────────────────────────────── */
  const evts = fixture?.events || [];
  const weatherEvent = evts.find((e) => e.type === "weather");
  const visibleEvts = filterMatchEvents(evts, liveMinute);
  const playerMatchStats = buildPlayerMatchStats(evts, liveMinute);
  const referee = fixture.referee;

  /* ── Action title ─────────────────────────────────────────────── */
  const titleText = isPreExtraTime
    ? "Pausa antes do prolongamento"
    : isHalftime
      ? "Gestão da Equipa"
      : isForcedSwap
        ? `Substituição obrigatória · ${forceOutPlayer?.name || "jogador"}`
        : "Pausa para substituição";

  const actionTheme = isForcedSwap
    ? "from-red-700/20 via-orange-500/10 to-transparent"
    : isActionSub
      ? "from-cyan-500/20 via-blue-500/10 to-transparent"
      : "from-emerald-500/15 via-primary/10 to-transparent";

  /* ── Handlers ──────────────────────────────────────────────────── */
  const handlePickOut = (player) => {
    if (!player) return;
    onSelectOut(isHalftime ? player.id : player);
  };
  const handlePickIn = (player) => {
    if (!player) return;
    onSelectIn(isHalftime ? player.id : player);
  };

  /* ── Tabs ──────────────────────────────────────────────────────── */
  const tabs = [
    { key: "cronologia", label: "Cronologia" },
    { key: "subs", label: "Substituições" },
    { key: "adversario", label: "Adversário" },
  ];

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface-container-low"
      style={{
        background: `radial-gradient(ellipse 70% 40% at 50% 0%, ${hInfo?.color_primary || "#333"}12 0%, transparent 70%), var(--color-surface-container-low)`,
      }}
    >
      {/* Title bar — description on the left, reset far right. */}
      <div
        className={`shrink-0 px-4 sm:px-5 py-3 sm:py-4 border-b border-outline-variant/20 bg-gradient-to-r ${actionTheme} flex items-center justify-between gap-2 sm:gap-4`}
      >
        <div className="min-w-0 flex-1">
          {/* No truncate: a forced-swap title must never cut the player's name. */}
          <h2 className="text-base font-bold font-headline tracking-tight text-on-surface uppercase text-left leading-snug">
            {titleText}
          </h2>
        </div>

        {/* Two-tap confirm: destructive action wipes all planned subs. */}
        {isHalftime && confirmedSubs.length > 0 && (
          <GhostButton
            onClick={() => {
              if (confirmResetAll) {
                onResetAllSubs();
                setConfirmResetAll(false);
              } else {
                setConfirmResetAll(true);
              }
            }}
            icon={
              <MatchIcon
                name="reset"
                className="h-3.5 w-3.5 text-rose-400/80"
              />
            }
            className="text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
          >
            {confirmResetAll ? "Confirmar?" : "Anular todas"}
          </GhostButton>
        )}
      </div>

      {/* ── Main tab row: Cronologia | Substituições | Adversário ── */}
      {/* Hidden during forced swaps — the other tabs are noise while the
       * auto-substitution countdown runs. */}
      {!isForcedSwap && (
        <div className="shrink-0 px-4 py-2 bg-surface-container-high/50 border-b border-outline-variant/15">
          <div className="flex rounded-md bg-surface-container p-1.5 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCenterTab(tab.key)}
                className={`flex-1 min-w-0 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${
                  activeCenterTab === tab.key
                    ? "bg-surface-container-high text-on-surface shadow-sm shadow-black/20"
                    : "text-on-surface-variant/70 hover:text-on-surface-variant hover:bg-surface-container-high/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Active panel ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {activeCenterTab === "cronologia" ? (
          <motion.div
            key="cronologia"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <CronologiaPanel
              visibleEvts={visibleEvts}
              fixture={fixture}
              hInfo={hInfo}
              aInfo={aInfo}
              referee={referee}
              weatherEvent={weatherEvent}
            />
          </motion.div>
        ) : activeCenterTab === "adversario" ? (
          <motion.div
            key="adversario"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <AdversarioPanel
              hasLineups={hasLineups}
              oppInfo={oppInfo}
              oppRows={oppRows}
              oppBench={oppBench}
            />
          </motion.div>
        ) : (
          <motion.div
            key="subs"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <SubsPanel
              isHalftime={isHalftime}
              isForcedSwap={isForcedSwap}
              isGkRedCard={isGkRedCard}
              confirmedSubs={confirmedSubs}
              annotatedSquad={annotatedSquad}
              tactic={tactic}
              onUpdateTactic={onUpdateTactic}
              playerMatchStats={playerMatchStats}
              onPitchPlayers={onPitchPlayers}
              benchPlayers={benchPlayers}
              effectiveOutId={effectiveOutId}
              selectedInId={selectedInId}
              sourcePlayer={sourcePlayer}
              targetPlayer={targetPlayer}
              handlePickOut={handlePickOut}
              handlePickIn={handlePickIn}
              forceOutPlayer={forceOutPlayer}
              subbedOut={subbedOut}
              subsMade={subsMade}
              injuryCountdown={injuryCountdown}
              confirmHint={confirmHint}
              canConfirmSwap={canConfirmSwap}
              onResetSub={onResetSub}
              onConfirmSub={onConfirmSub}
              onResolveAction={onResolveAction}
              confirmedSubs={confirmedSubs}
              annotatedSquad={annotatedSquad}
              onUndoSub={onUndoSub}
              summary={{ fixture, hInfo, aInfo, liveMinute }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

/* Altura da faixa (peek) em que a página de trás fica visível no mobile. */
const PEEK_H = 56;

/**
 * Folha da stack de páginas mobile (Titulares/Suplentes). A folha à frente
 * ocupa quase toda a zona — menos a faixa do peek; a de trás desloca-se para
 * baixo (só o seu topo é visível) e fica escurecida. Ao perder a frente, a
 * folha vira para cima em torno do bordo superior (eixo X, como um cartão de
 * calendário) antes de assentar no slot de trás.
 *
 * @param {boolean} props.isFront - Esta folha é a da frente?
 * @param {number} props.stackY - Offset Y do slot de trás (altura do container menos PEEK_H).
 * @param {boolean} props.reducedMotion - Prefere movimento reduzido (troca instantânea).
 * @param {Function} [props.onDragEnd] - Fim do swipe horizontal ((e, info) => void);
 *   ligada apenas à folha da frente.
 */
function StackSheet({ isFront, stackY, reducedMotion, onDragEnd, children }) {
  return (
    <motion.div
      initial={false}
      drag={isFront && !reducedMotion ? "x" : false}
      dragElastic={0.12}
      onDragEnd={onDragEnd}
      animate={
        isFront
          ? { y: 0, rotateX: 0, scale: 1, filter: "brightness(1) saturate(1)" }
          : {
              y: stackY,
              // Vira para cima e volta a assentar plana no slot de trás.
              rotateX: reducedMotion ? 0 : [0, -102, 0],
              scale: 0.985,
              filter: "brightness(0.55) saturate(0.8)",
            }
      }
      transition={
        reducedMotion
          ? { duration: 0 }
          : isFront
            ? {
                y: { duration: 0.42, ease: [0.3, 0.8, 0.3, 1] },
                rotateX: { duration: 0.3 },
                scale: { duration: 0.42 },
                filter: { duration: 0.42 },
              }
            : {
                y: { delay: 0.26, duration: 0.34, ease: "easeIn" },
                rotateX: { duration: 0.58, times: [0, 0.42, 1] },
                scale: { duration: 0.42, delay: 0.2 },
                filter: { duration: 0.42, delay: 0.2 },
              }
      }
      style={{
        zIndex: isFront ? 3 : 1,
        transformOrigin: "top center",
        pointerEvents: isFront ? "auto" : "none",
        height: `calc(100% - ${PEEK_H}px)`,
      }}
      aria-hidden={!isFront}
      className={`absolute inset-x-0 top-0 overflow-hidden rounded-b-lg ${isFront ? "shadow-[0_12px_20px_-8px_rgba(0,0,0,0.6)]" : ""}`}
    >
      <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
    </motion.div>
  );
}

function EventList({ events }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
        <span className="text-2xl text-on-surface-variant/40">⚽</span>
        <p className="text-on-surface-variant/60 text-[11px] font-medium">
          Sem eventos
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <EventCard key={i} event={e} showTeamBadge={false} />
      ))}
    </div>
  );
}

/* ── Cronologia tab ────────────────────────────────────────────────────── */
function CronologiaPanel({
  visibleEvts,
  fixture,
  hInfo,
  aInfo,
  referee,
  weatherEvent,
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <PossessionBar
          homePossession={fixture.homePossession}
          awayPossession={fixture.awayPossession}
          homeColor={hInfo?.color_primary}
          awayColor={aInfo?.color_primary}
          compact
        />
        <RefWeatherBar
          attendance={fixture?.attendance}
          referee={referee}
          weatherEvent={weatherEvent}
          className="text-[10px]"
        />
        <EventList events={visibleEvts} />
      </div>
    </div>
  );
}

/* ── SubsPanel — Titulares | Suplentes | Mentalidade | Substituições ─────
 * Desktop (md+): 3-col grid — a 3ª coluna divide-se em 2 linhas
 * (Mentalidade por cima, Substituições por baixo). Mobile:
 * stack de duas páginas sobrepostas (Titulares/Suplentes) com flip 3D —
 * top cluster (mentalidade recolhível + indicador de página), folha ativa
 * como scroller próprio, peek da outra página em baixo e barra de ação
 * contextual na zona do polegar. Navegação: seleção, swipe horizontal,
 * chip 'Sai' ou tap no peek. */
function SubsPanel({
  isHalftime,
  isForcedSwap,
  isGkRedCard,
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
  annotatedSquad,
  onUndoSub,
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
  // Altura da zona da stack (para o offset px do slot de trás).
  const stackRef = useRef(null);
  const [stackH, setStackH] = useState(0);
  useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const measure = () => setStackH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Movimento reduzido → troca instantânea de folhas, sem flip.
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const cb = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);

  // Drag-and-drop swap (HTML5 DnD, no extra lib). `dragFrom` records the
  // dragged player + source side; `dragOverSide` highlights the valid target
  // column. Falling back to tap-pick-out/tap-pick-in stays fully supported
  // for touch. Drops only resolve across columns (pitch⇄bench).
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOverSide, setDragOverSide] = useState(null);

  const handleDragStart = (p, side) => (e) => {
    setDragFrom({ player: p, side });
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => {
    setDragFrom(null);
    setDragOverSide(null);
  };
  const handleDragOver = (side) => (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    setDragOverSide(side);
  };
  const resolveDrop = () => {
    setDragFrom(null);
    setDragOverSide(null);
  };
  const handleDropOnPitch = (target) => (e) => {
    e.preventDefault();
    const src = dragFrom;
    resolveDrop();
    if (!src || src.side !== "bench") return;
    handlePickOut(target);
    handlePickIn(src.player);
  };
  const handleDropOnBench = (target) => (e) => {
    e.preventDefault();
    const src = dragFrom;
    resolveDrop();
    if (!src || src.side !== "pitch") return;
    handlePickOut(src.player);
    handlePickIn(target);
  };

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
  // Visible warning replaces the old `title` tooltip — tooltips are
  // unreachable on touch, so the lock reason must be on screen.
  const grLockedNoReplacement =
    isHalftime &&
    !grAvailableOnBench &&
    onPitchPlayers.some((p) => p.position === "GR");

  // No banco, sem escolha de quem sai: a dica remete para o chip 'Sai', que
  // devolve aos titulares (a confirmHint genérica aponta para um cartão que
  // o utilizador não vê).
  const benchConfirmHint =
    !effectiveOutId && !isForcedSwap
      ? "Toca em 'Sai' para escolher quem sai."
      : confirmHint;

  const pitchBarHint = isForcedSwap
    ? `Substituição obrigatória — ${forceOutPlayer?.name || "jogador"} sai`
    : "Toca no jogador que sai";

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
    isForcedSwap,
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
  };

  // Swipe horizontal na folha da frente (vertical continua a pertencer ao
  // scroll nativo da lista; touch-action pan-y é posto pelo framer).
  const handleSheetDragEnd = (e, info) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    if (dx <= -60 || vx <= -500) setUserPage("bench");
    else if (dx >= 60 || vx >= 500) setUserPage("pitch");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ═══ Desktop: 3-column grid ═══ */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,1.05fr)] flex-1 min-h-0 overflow-hidden">
        <TitularesColumn
          className="border-r border-outline-variant/15"
          players={onPitchPlayers}
          isHalftime={isHalftime}
          isForcedSwap={isForcedSwap}
          isGkRedCard={isGkRedCard}
          forceOutPlayer={forceOutPlayer}
          subsMade={subsMade}
          grAvailableOnBench={grAvailableOnBench}
          grLockedNoReplacement={grLockedNoReplacement}
          effectiveOutId={effectiveOutId}
          playerMatchStats={playerMatchStats}
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
          isHalftime={isHalftime}
          forceOutPlayer={forceOutPlayer}
          subsMade={subsMade}
          subbedOut={subbedOut}
          selectedInId={selectedInId}
          playerMatchStats={playerMatchStats}
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
          subsMade={subsMade}
          tactic={tactic}
          onUpdateTactic={onUpdateTactic}
          confirmedSubs={confirmedSubs}
          annotatedSquad={annotatedSquad}
          onUndoSub={onUndoSub}
          swapProps={sharedSwapProps}
        />
      </div>

      {/* ═══ Mobile: stack de páginas Titulares/Suplentes (flip 3D) ═══
       * Duas folhas sobrepostas como cartões empilhados:
       *  - a folha de trás está deslocada PEEK_H px para baixo — o seu topo
       *    (1º cartão, com skill) é sempre visível na faixa inferior;
       *  - tocar no jogador que sai faz a folha virar para cima (eixo X) e
       *    os suplentes assentam à frente; swipe horizontal, chip 'Sai' ou o
       *    tap na faixa do peek trocam a ordem em sentido inverso.
       * Cada folha é o próprio scroller vertical → posições de scroll são
       * preservadas entre trocas (sem remount). */}
      <div className="md:hidden flex flex-col flex-1 min-h-0">
        {/* ── Top cluster: mentalidade (halftime) + indicador de página ── */}
        <div className="shrink-0 border-b border-outline-variant/15 bg-surface-container-low/95">
          {isHalftime && (
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
          <div className="flex items-center gap-2 px-4 pt-1 pb-2">
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
            {isHalftime && <SubsCounter subsMade={subsMade} />}
          </div>
        </div>

        {/* Substituições confirmadas (halftime) — acima da stack, no fluxo. */}
        {isHalftime && confirmedSubs.length > 0 && (
          <div className="shrink-0 border-b border-outline-variant/15 bg-cyan-950/10">
            <ConfirmedSubsStrip
              subs={confirmedSubs}
              annotatedSquad={annotatedSquad}
              onUndoSub={onUndoSub}
            />
          </div>
        )}

        {/* ── Stack de páginas ── */}
        <div
          ref={stackRef}
          className="relative flex-1 min-h-0 overflow-hidden"
          style={{ perspective: "1200px" }}
        >
          {/* Folha TITULARES (frente por omissão) */}
          <StackSheet
            isFront={frontPage === "pitch"}
            stackY={Math.max(stackH - PEEK_H, 0)}
            reducedMotion={reducedMotion}
            onDragEnd={handleSheetDragEnd}
          >
            <TitularesColumn
              flat
              players={onPitchPlayers}
              isHalftime={isHalftime}
              isForcedSwap={isForcedSwap}
              isGkRedCard={isGkRedCard}
              forceOutPlayer={forceOutPlayer}
              subsMade={subsMade}
              grAvailableOnBench={grAvailableOnBench}
              grLockedNoReplacement={grLockedNoReplacement}
              effectiveOutId={effectiveOutId}
              playerMatchStats={playerMatchStats}
              pickOut={pickOut}
              dragFrom={dragFrom}
              dragOverSide={dragOverSide}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDropOnPitch={handleDropOnPitch}
              handleDragEnd={handleDragEnd}
            />
          </StackSheet>

          {/* Folha SUPLENTES (peek com o 1º cartão atrás do topo) */}
          <StackSheet
            isFront={frontPage === "bench"}
            stackY={Math.max(stackH - PEEK_H, 0)}
            reducedMotion={reducedMotion}
            onDragEnd={handleSheetDragEnd}
          >
            <SuplentesColumn
              flat
              players={benchPlayers}
              isHalftime={isHalftime}
              forceOutPlayer={forceOutPlayer}
              subsMade={subsMade}
              subbedOut={subbedOut}
              selectedInId={selectedInId}
              playerMatchStats={playerMatchStats}
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

          {/* Tap na faixa do peek traz a página de trás para a frente. */}
          <button
            type="button"
            onClick={() =>
              setUserPage(frontPage === "pitch" ? "bench" : "pitch")
            }
            aria-label={
              frontPage === "pitch"
                ? "Traz o banco de suplentes para a frente"
                : "Traz os titulares para a frente"
            }
            className="absolute inset-x-0 bottom-0 z-[4] flex cursor-pointer items-center justify-end pr-2 outline-none focus-visible:bg-white/5"
            style={{ height: PEEK_H }}
          >
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high/90 border border-outline-variant/30 text-on-surface-variant/80 shadow-sm transition-transform ${
                frontPage === "pitch" ? "-rotate-90" : "rotate-90"
              }`}
            >
              <MatchIcon name="chevron-right" className="h-4 w-4" />
            </span>
          </button>
        </div>

        {/* ── Barra de ação contextual — sempre na zona do polegar ── */}
        <div className="shrink-0 border-t border-outline-variant/25 bg-surface-container-high/95">
          {frontPage === "bench" ? (
            <SwapControls
              {...sharedSwapProps}
              compact
              confirmHint={benchConfirmHint}
              onResetSub={mobileOnResetSub}
              onConfirmSub={mobileOnConfirmSub}
              outSlotAction={() => setUserPage("pitch")}
            />
          ) : (
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="min-w-0 truncate text-[11px] font-semibold text-on-surface-variant/80">
                {pitchBarHint}
              </span>
              {!isHalftime && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  Subs {subsMade}/{MAX_MATCH_SUBS}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Subs counter (halftime) ───────────────────────────────────────────── */
function SubsCounter({ subsMade }) {
  return (
    <div
      className="shrink-0 flex items-center gap-1.5"
      title={`${subsMade} de ${MAX_MATCH_SUBS} substituições usadas`}
    >
      <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
        Subs
      </span>
      {Array.from({ length: MAX_MATCH_SUBS }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i < subsMade ? "bg-emerald-400" : "bg-outline-variant/40"
          }`}
        />
      ))}
      <span className="text-[10px] font-black tabular-nums text-on-surface-variant ml-0.5">
        {subsMade}/{MAX_MATCH_SUBS}
      </span>
    </div>
  );
}

/* ── Titulares column ──────────────────────────────────────────────────── */
function TitularesColumn({
  className,
  players,
  isHalftime,
  isForcedSwap,
  isGkRedCard,
  forceOutPlayer,
  subsMade,
  grAvailableOnBench,
  grLockedNoReplacement,
  effectiveOutId,
  playerMatchStats,
  pickOut,
  dragFrom,
  dragOverSide,
  handleDragStart,
  handleDragOver,
  handleDropOnPitch,
  handleDragEnd,
  flat = false,
}) {
  // `flat` (mobile): lista em altura natural dentro do scroll único da página —
  // sem cabeçalho de coluna e sem scroll interno; cartão compacto de uma
  // linha. Desktop: cabeçalho + scroll próprio + cartão expandido.
  const Card = flat ? CompactPlayerCard : MatchPlayerCard;
  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      {!flat && (
        <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            Titulares
          </h3>
          <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
            {players.length}
          </span>
        </div>
      )}
      {grLockedNoReplacement && (
        <p className={`px-4 py-1.5 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border-b border-amber-500/20 ${flat ? "" : "shrink-0"}`}>
          Sem GR no banco — o guarda-redes não pode sair
        </p>
      )}
      <div className={flat ? "space-y-2 px-3 pt-2 pb-3" : "flex-1 overflow-y-auto px-3 py-2.5 space-y-2"}>
        {players.map((p) => {
          const noGrReplacement =
            isHalftime && p.position === "GR" && !grAvailableOnBench;
          const isLockedForced =
            isForcedSwap &&
            !isGkRedCard &&
            !!forceOutPlayer &&
            p.id !== forceOutPlayer.id;
          const disabled =
            noGrReplacement ||
            isLockedForced ||
            (isHalftime && subsMade >= MAX_MATCH_SUBS);
          const selected = effectiveOutId === p.id;
          const stats = playerMatchStats?.get(p.id);

          return (
            <Card
              key={p.id}
              player={p}
              posStyle={getPosStyle(p.position)}
              selected={selected}
              disabled={disabled}
              selectable={!disabled}
              onPick={() => pickOut(p)}
              showFatigue={false}
              showMatchStats
              goals={stats?.goals ?? 0}
              yellowCards={stats?.yellowCards ?? 0}
              swapIndicator={isHalftime}
              forcedOut={
                isForcedSwap && !!forceOutPlayer && p.id === forceOutPlayer.id
              }
              draggable={!disabled}
              onDragStart={handleDragStart(p, "pitch")}
              onDragOver={handleDragOver("pitch")}
              onDragDrop={handleDropOnPitch(p)}
              onDragEnd={handleDragEnd}
              dragOver={dragOverSide === "pitch" && dragFrom?.side === "bench"}
            />
          );
        })}
        {players.length === 0 && (
          <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">
            Sem opções em campo
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Suplentes column ──────────────────────────────────────────────────── */
function SuplentesColumn({
  className,
  players,
  isHalftime,
  forceOutPlayer,
  subsMade,
  subbedOut,
  selectedInId,
  playerMatchStats,
  handlePickIn,
  dragFrom,
  dragOverSide,
  handleDragStart,
  handleDragOver,
  handleDropOnBench,
  handleDragEnd,
  summary,
  flat = false,
}) {
  // `flat` (mobile): lista em altura natural dentro do scroll único da página.
  const Card = flat ? CompactPlayerCard : MatchPlayerCard;
  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      {!flat && (
        <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            Suplentes
          </h3>
          <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
            {players.length}
          </span>
        </div>
      )}
      <div className={flat ? "space-y-2 px-3 pt-2 pb-3" : "flex-1 overflow-y-auto px-3 py-2.5 space-y-2"}>
        {players.map((p) => {
          const alreadyUsed = isHalftime && subbedOut.includes(p.id);
          const positionMismatch =
            !!forceOutPlayer &&
            (forceOutPlayer.position === "GR") !== (p.position === "GR");
          const disabled =
            alreadyUsed ||
            positionMismatch ||
            (isHalftime && subsMade >= MAX_MATCH_SUBS);
          const selected = selectedInId === p.id;
          const stats = playerMatchStats?.get(p.id);

          return (
            <Card
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
        {players.length === 0 && (
          <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">
            Sem suplentes disponíveis
          </p>
        )}
      </div>
      {/* Posse de Bola — fim da lista (mobile flat) / fundo da coluna (desktop). */}
      {summary &&
        (flat ? (
          <div className="px-3 pt-1 pb-4">
            <MatchSummaryBlock {...summary} />
          </div>
        ) : (
          <div className="shrink-0 p-3 border-t border-outline-variant/15 bg-surface-container-high/30">
            <MatchSummaryBlock {...summary} />
          </div>
        ))}
    </div>
  );
}

/* ── Mentalidade | Substituições column (desktop) ────────────────────────
 * The 3rd column is split into two stacked rows, each with its own header:
 *   1. "Mentalidade"    → Estilo de jogo (táticas) + Posse de Bola
 *   2. "Substituições"  → controlos Sai→Entra + botões + Confirmadas */
function MentalidadeColumn({
  isHalftime,
  subsMade,
  tactic,
  onUpdateTactic,
  swapProps,
  confirmedSubs,
  annotatedSquad,
  onUndoSub,
}) {
  return (
    <div className="flex flex-col min-h-0 min-w-0 overflow-hidden bg-surface-container-high/30">
      {/* ── Row 1: Mentalidade ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden border-b border-outline-variant/15">
        <div className="shrink-0 px-4 py-3 flex items-center justify-between gap-2 bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
            Mentalidade
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col min-h-full p-4 space-y-4">
            {isHalftime && (
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
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Substituições ── */}
      <div className="flex flex-col shrink-0 min-h-0 overflow-hidden">
        <div className="shrink-0 px-4 py-3 flex items-center justify-between gap-2 bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 shadow-[0_0_8px_rgba(251,113,133,0.5)]" />
            Substituições
          </h3>
          {isHalftime && <SubsCounter subsMade={subsMade} />}
        </div>
        <div className="p-4 space-y-4">
          <SwapControls {...swapProps} />
          {isHalftime && confirmedSubs.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Confirmadas
              </span>
              <ConfirmedSubsStrip
                subs={confirmedSubs}
                annotatedSquad={annotatedSquad}
                onUndoSub={onUndoSub}
                className="rounded-md"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── SwapControls — Sai → Entra + Limpar/Substituir + hint + countdown ───
 * Shared between the desktop Mentalidade column and the mobile stacked
 * block. Mirrors the confirm branching: halftime (onConfirmSub) vs action
 * (onResolveAction). */
function SwapControls({
  isHalftime,
  isForcedSwap,
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
  compact = false,
  outSlotAction = null,
}) {
  // Local "resolving" state gives immediate feedback on click in action mode
  // (was: button fired and the user got no signal until the parent reacted).
  const [resolving, setResolving] = useState(false);
  // Halftime mirror: the confirm button is never unmounted, so feedback is a
  // brief transient state that auto-disarms instead of getting stuck.
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmHalftime = () => {
    setSubmitting(true);
    onConfirmSub();
    window.setTimeout(() => setSubmitting(false), 900);
  };

  return (
    <div className={`space-y-3 ${compact ? "px-4 py-3" : ""}`}>
      {/* Forced-swap countdown — a single pulsing element where urgency matters. */}
      {isForcedSwap && injuryCountdown !== null && (
        <>
          {/* One-time screen-reader announcement: the ticking number is
           * aria-hidden to avoid spamming the live region every second. */}
          <span role="status" className="sr-only">
            Substituição automática iminente — escolhe o substituto.
          </span>
          <span
            aria-hidden="true"
            className="block text-amber-300 font-black text-xs tabular-nums animate-pulse motion-reduce:animate-none"
          >
            Auto em {injuryCountdown}s
          </span>
        </>
      )}

      {/* The Sai/Entra chain — two grouped clusters so the eye can scan
       * "[who's leaving] → [who's coming in]". Empty slots are dashed
       * placeholders with an actionable hint (was: bare "—"). */}
      {/* Mobile: vertical stack (Sai ↓ Entra) with a flow arrow between the
       * slots; desktop: single horizontal row (Sai → Entra). */}
      {compact ? (
        // Mobile: 2 colunas — legenda (9px) + chip de uma linha, altura mínima.
        <div className="grid min-w-0 grid-cols-2 items-end gap-x-3 gap-y-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
            Sai
          </span>
          <span className="text-right text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
            Entra
          </span>
          <SwapSlot
            tone="rose"
            player={effectiveOutId ? sourcePlayer : null}
            placeholder="Quem sai"
            onClick={outSlotAction}
            ariaLabel={
              effectiveOutId
                ? "Trocador por quem sai — voltar aos titulares"
                : "Escolher quem sai — ver os titulares"
            }
          />
          <SwapSlot
            tone="emerald"
            player={selectedInId ? targetPlayer : null}
            placeholder="Quem entra"
          />
        </div>
      ) : (
        <div className="grid min-w-0 items-center gap-y-2 sm:gap-x-2 grid-cols-[auto_1fr] sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-wide">
            Sai
          </span>
          <SwapSlot
            tone="rose"
            player={effectiveOutId ? sourcePlayer : null}
            placeholder="Escolhe quem sai"
          />
          {/* Flow indicator: chevron-down (rotated) stacked on mobile, chevron-right on desktop. */}
          <MatchIcon
            name="chevron-right"
            title="Substituição"
            className="h-4 w-4 shrink-0 col-span-2 justify-self-center rotate-90 sm:col-auto sm:justify-self-start sm:rotate-0 text-on-surface-variant/60"
          />
          <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-wide">
            Entra
          </span>
          <SwapSlot
            tone="emerald"
            player={selectedInId ? targetPlayer : null}
            placeholder="Escolhe quem entra"
          />
        </div>
      )}

      {/* Why the confirm button is disabled — never leave it silent. */}
      {!canConfirmSwap && confirmHint && (
        <p className="text-[11px] font-semibold text-amber-300/90">
          {confirmHint}
        </p>
      )}

      {/* Action buttons */}
      {isHalftime ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <GhostButton
            onClick={onResetSub}
            icon={<MatchIcon name="reset" className="h-3.5 w-3.5" />}
            aria-label="Limpar seleção ou anular última substituição"
            className="h-11 flex-1 sm:h-10"
          >
            Limpar
          </GhostButton>
          <PrimaryButton
            onClick={handleConfirmHalftime}
            disabled={!canConfirmSwap || submitting}
            tone="emerald"
            icon={<MatchIcon name="confirm" className="h-4 w-4" />}
            className="h-11 flex-1 sm:h-10"
          >
            {submitting ? "A substituir…" : "Substituir"}
          </PrimaryButton>
        </div>
      ) : (
        <PrimaryButton
          disabled={!canConfirmSwap || resolving}
          onClick={() => {
            setResolving(true);
            onResolveAction({
              playerOut: effectiveOutId,
              playerIn: selectedInId,
            });
          }}
          tone="indigo"
          icon={<MatchIcon name="confirm" className="h-4 w-4" />}
          className="h-11 w-full sm:h-10"
        >
          {resolving ? "A substituir…" : "Substituir"}
        </PrimaryButton>
      )}
    </div>
  );
}

/**
 * SAI/ENTRA value box. Filled: pos badge + name chip.
 * Empty: dashed placeholder with an actionable hint.
 * Com `onClick` torna-se um botão (mobile: devolve à folha de titulares).
 *
 * @param {string} tone - Color tone of the filled chip ("rose"|"emerald").
 * @param {object} player - Player to display; null renders the placeholder.
 * @param {string} placeholder - Empty-state hint text.
 * @param {Function} [props.onClick] - Handler que torna o slot um botão.
 * @param {string} [props.ariaLabel] - Rótulo acessível quando é botão.
 */
function SwapSlot({ tone, player, placeholder, onClick = null, ariaLabel }) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "span";
  const tagProps = interactive
    ? { type: "button", onClick, "aria-label": ariaLabel }
    : {};
  if (!player) {
    return (
      <Tag
        {...tagProps}
        className={`border border-dashed border-outline-variant/40 text-on-surface-variant/50 text-xs font-semibold px-3 py-1.5 rounded-md truncate min-w-0 ${
          interactive ? "cursor-pointer active:scale-[0.98] transition-transform" : ""
        }`}
      >
        {placeholder}
      </Tag>
    );
  }
  const posStyle = getPosStyle(player.position);
  const toneClass =
    tone === "rose"
      ? "bg-rose-950/80 text-rose-200 border-rose-800/50"
      : "bg-emerald-950/80 text-emerald-200 border-emerald-800/50";
  return (
    <Tag
      {...tagProps}
      className={`flex items-center gap-1.5 border ${toneClass} text-xs font-semibold px-2 py-1 rounded-md min-w-0 ${
        interactive ? "cursor-pointer active:scale-[0.98] transition-transform" : ""
      }`}
    >
      <span
        className={`shrink-0 px-1 py-px rounded text-[9px] font-bold uppercase tracking-widest border ${posStyle.badgeBg} ${posStyle.badgeText} ${posStyle.badgeBorder}`}
      >
        {player.position}
      </span>
      <span className="truncate min-w-0">{player.name}</span>
    </Tag>
  );
}

/**
 * Scoreline + possession + minute. Fills the Mentalidade column's dead
 * space with decision-relevant context.
 *
 * @param {object} fixture - Fixture data (score, possession).
 * @param {object} hInfo - Home team info (name, color_primary).
 * @param {object} aInfo - Away team info (name, color_primary).
 * @param {number} liveMinute - Current match minute.
 * @param {string} className - Extra classes (e.g. "mt-auto").
 */
function MatchSummaryBlock({ fixture, hInfo, aInfo, liveMinute, className = "" }) {
  if (!fixture || !hInfo?.name || !aInfo?.name) return null;
  return (
    <div
      className={`rounded-md border border-outline-variant/25 bg-surface-container/60 p-3 space-y-2.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          Posse de Bola
        </span>
        {liveMinute != null && (
          <span className="text-[10px] font-bold tabular-nums text-on-surface-variant">
            {liveMinute}'
          </span>
        )}
      </div>
      {fixture.homePossession != null && (
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-container-high/80 flex">
          <div
            className="h-full"
            style={{
              width: `${fixture.homePossession}%`,
              background: hInfo.color_primary || "#6366f1",
              // Separador fino: quando as duas equipas têm a mesma cor,
              // a divisão da posse continuava visível.
              borderRight: "2px solid rgba(255,255,255,0.7)",
            }}
          />
          <div
            className="h-full flex-1"
            style={{ background: aInfo.color_primary || "#f43f5e" }}
          />
        </div>
      )}
    </div>
  );
}

function AdversarioPanel({
  hasLineups,
  oppInfo,
  oppRows,
  oppBench,
}) {
  // Sort each position row by skill descending
  const sortDesc = (arr) => [...arr].sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0));
  const gr = sortDesc(oppRows.GR);
  const def = sortDesc(oppRows.DEF);
  const med = sortDesc(oppRows.MED);
  const ata = sortDesc(oppRows.ATA);

  const hasAny = gr.length + def.length + med.length + ata.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header: crest + nome + formação */}
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-outline-variant/15 bg-surface-container-high/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeamCrest team={oppInfo} />
          <span className="text-sm font-black font-headline uppercase tracking-tight text-on-surface truncate">
            {oppInfo?.name || "Adversário"}
          </span>
        </div>
      </div>

      {/* Scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4">
        {!hasLineups ? (
          <EmptyState
            icon="📋"
            message="Escalações indisponíveis durante a simulação"
          />
        ) : !hasAny ? (
          <EmptyState
            icon="🤷"
            message="Sem dados da escalação do adversário"
          />
        ) : (
          <div className="space-y-3">
            {/* Grid 4 colunas: GR | DEF | MED | ATA */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <PositionColumn
                posStyle={getPosStyle("GR")}
                players={gr}
                label="Guarda-redes"
              />
              <PositionColumn
                posStyle={getPosStyle("DEF")}
                players={def}
                label="Defesa"
              />
              <PositionColumn
                posStyle={getPosStyle("MED")}
                players={med}
                label="Médio"
              />
              <PositionColumn
                posStyle={getPosStyle("ATA")}
                players={ata}
                label="Avançado"
              />
            </div>

            {/* Suplentes — faixa horizontal */}
            {oppBench.length > 0 && (
              <div className="rounded-md border border-outline-variant/15 bg-surface-container-high/20">
                <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Suplentes
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60 tabular-nums">
                    {oppBench.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                  {oppBench.map((p) => (
                    <BenchChip
                      key={p.id ?? p.name}
                      player={p}
                      posStyle={getPosStyle(p.position)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Coluna de posição: header + lista de jogadores ─────────────────── */
function PositionColumn({ posStyle, players, label }) {
  return (
    <div className="rounded-md border border-outline-variant/15 overflow-hidden">
      {/* Header com cor da posição */}
      <div
        className={`shrink-0 flex items-center justify-between px-2.5 py-1.5 border-b ${posStyle.badgeBorder} bg-gradient-to-r ${posStyle.bgGrad} to-transparent`}
      >
        <span
          className={`text-[9px] font-black uppercase tracking-widest ${posStyle.badgeText}`}
        >
          {label}
        </span>
        <span className="text-[9px] text-on-surface-variant/60 tabular-nums">
          {players.length}
        </span>
      </div>
      {/* Lista de jogadores */}
      <div className="p-1.5 space-y-1 min-h-[2rem]">
        {players.map((p) => (
          <OpponentGridCard
            key={p.id ?? p.name}
            player={p}
            posStyle={posStyle}
            hideResForm
          />
        ))}
        {players.length === 0 && (
          <p className="text-center text-on-surface-variant/40 text-[10px] py-2 font-medium">
            —
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Chip de suplente (compacto, inline) ─────────────────────────────── */
function BenchChip({ player, posStyle }) {
  const s = posStyle;
  return (
    <div
      className={`flex items-center gap-1.5 rounded border border-outline-variant/15 ${s.bgGrad} via-surface-container/40 to-transparent bg-gradient-to-r px-2 py-1`}
    >
      <span
        className={`shrink-0 w-4 text-center text-[8px] font-bold uppercase tracking-widest rounded px-1 border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}
      >
        {POSITION_SHORT_LABELS[player.position] || "?"}
      </span>
      <span className="truncate text-[11px] font-semibold text-on-surface max-w-[100px]">
        {player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className="ml-0.5 text-amber-400" aria-label="Craque">★</span>
        )}
      </span>
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
      <span className="text-3xl text-on-surface-variant/40">{icon}</span>
      <p className="text-on-surface-variant/80 text-xs font-medium text-center px-4">
        {message}
      </p>
    </div>
  );
}
