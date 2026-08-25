import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MAX_MATCH_SUBS } from "../../../constants/index.js";
import {
  getPosStyle,
  PITCH_POS_COLORS,
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
  MatchPitch,
  MatchPlayerCard,
  MatchIcon,
  PrimaryButton,
  GhostButton,
} from "../shared/index.js";
import { TeamCrest } from "../../live/TeamCrest.jsx";

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
  const oppTactic = isHome ? fixture?._t2 : fixture?._t1;
  const oppFormation = oppTactic?.formation || null;
  const oppStyleRaw = (oppTactic?.style || "").toString().toUpperCase();
  const oppStyleLabel = !oppStyleRaw
    ? null
    : oppStyleRaw === "OFENSIVO" || oppStyleRaw === "OFFENSIVE"
      ? "Ofensivo"
      : oppStyleRaw === "DEFENSIVO" || oppStyleRaw === "DEFENSIVE"
        ? "Defensivo"
        : "Equilibrado";
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
              oppFormation={oppFormation}
              oppStyleLabel={oppStyleLabel}
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
 * Mentalidade/controlos empilhados por cima das listas, com controlo
 * segmentado Em campo/Banco a mostrar UMA lista de cada vez (dá a altura
 * total à lista ativa). */
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
  // Mobile: mostra UMA lista de cada vez (Em campo / Banco).
  const [mobileList, setMobileList] = useState("pitch");

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
   * Seleciona o jogador que sai e salta para o banco (mobile) para escolher
   * quem entra.
   * @param {object} p
   */
  const pickOut = (p) => {
    handlePickOut(p);
    setMobileList("bench");
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

      {/* ═══ Mobile: Mentalidade em cima, listas abaixo ═══ */}
      <div className="flex md:hidden flex-1 min-h-0 overflow-hidden flex-col">
        {/* Substituições e Mentalidade / swap block — empilhado, sem height fixo. */}
        <div className="shrink-0 px-4 py-3 border-b border-outline-variant/15 bg-surface-container-high/30 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase">
              Substituições e Mentalidade
            </h3>
            {isHalftime && <SubsCounter subsMade={subsMade} />}
          </div>
          {isHalftime && (
            <TacticsButtons
              className="w-full"
              value={tactic.style}
              onChange={onUpdateTactic}
            />
          )}
          <SwapControls {...sharedSwapProps} />
          {isHalftime && confirmedSubs.length > 0 && (
            <ConfirmedSubsStrip
              subs={confirmedSubs}
              annotatedSquad={annotatedSquad}
              onUndoSub={onUndoSub}
            />
          )}
        </div>

        {/* Segmented Em campo / Banco */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-outline-variant/15">
          <div className="flex-1 flex rounded-md bg-surface-container p-1 gap-1">
            {[
              { key: "pitch", label: `Em campo (${onPitchPlayers.length})` },
              { key: "bench", label: `Banco (${benchPlayers.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMobileList(tab.key)}
                className={`flex-1 min-w-0 py-2 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all ${
                  mobileList === tab.key
                    ? "bg-surface-container-high text-on-surface shadow-sm shadow-black/20"
                    : "text-on-surface-variant/70 hover:text-on-surface-variant hover:bg-surface-container-high/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active list */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {mobileList === "pitch" ? (
            <TitularesColumn
              className=""
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
          ) : (
            <SuplentesColumn
              className=""
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
}) {
  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
        <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          Titulares
        </h3>
        <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
          {players.length}
        </span>
      </div>
      {grLockedNoReplacement && (
        <p className="shrink-0 px-4 py-1.5 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border-b border-amber-500/20">
          Sem GR no banco — o guarda-redes não pode sair
        </p>
      )}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
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
            <MatchPlayerCard
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
}) {
  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
        <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
          Suplentes
        </h3>
        <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
          {players.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
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
            <MatchPlayerCard
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
      {/* Resumo da partida ancorado ao fundo da coluna dos suplentes. */}
      {summary && (
        <div className="shrink-0 p-3 border-t border-outline-variant/15 bg-surface-container-high/30">
          <MatchSummaryBlock {...summary} />
        </div>
      )}
    </div>
  );
}

/* ── Mentalidade | Substituições column (desktop) ────────────────────────
 * The 3rd column is split into two stacked rows, each with its own header:
 *   1. "Mentalidade"    → Estilo de jogo (táticas) + Resumo da partida
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
    <div className="space-y-3">
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 min-w-0 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_minmax(0,1fr)]">
        <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-wide">
          Sai
        </span>
        <SwapSlot
          tone="rose"
          player={effectiveOutId ? sourcePlayer : null}
          placeholder="Escolhe quem sai"
        />
        <MatchIcon
          name="chevron-right"
          className="hidden h-4 w-4 text-on-surface-variant/60 shrink-0 sm:block"
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
 *
 * @param {string} tone - Color tone of the filled chip ("rose"|"emerald").
 * @param {object} player - Player to display; null renders the placeholder.
 * @param {string} placeholder - Empty-state hint text.
 */
function SwapSlot({ tone, player, placeholder }) {
  if (!player) {
    return (
      <span className="border border-dashed border-outline-variant/40 text-on-surface-variant/50 text-xs font-semibold px-3 py-1.5 rounded-md truncate min-w-0">
        {placeholder}
      </span>
    );
  }
  const posStyle = getPosStyle(player.position);
  const toneClass =
    tone === "rose"
      ? "bg-rose-950/80 text-rose-200 border-rose-800/50"
      : "bg-emerald-950/80 text-emerald-200 border-emerald-800/50";
  return (
    <span
      className={`flex items-center gap-1.5 border ${toneClass} text-xs font-semibold px-2 py-1 rounded-md min-w-0`}
    >
      <span
        className={`shrink-0 px-1 py-px rounded text-[9px] font-bold uppercase tracking-widest border ${posStyle.badgeBg} ${posStyle.badgeText} ${posStyle.badgeBorder}`}
      >
        {player.position}
      </span>
      <span className="truncate min-w-0">{player.name}</span>
    </span>
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
          Resumo da partida
        </span>
        {liveMinute != null && (
          <span className="text-[10px] font-bold tabular-nums text-on-surface-variant">
            {liveMinute}'
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="flex flex-1 min-w-0 items-center justify-end gap-1.5">
          <span className="truncate text-xs font-bold text-on-surface">{hInfo.name}</span>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: hInfo.color_primary }}
          />
        </span>
        <span className="shrink-0 text-lg font-black font-headline tabular-nums text-on-surface">
          {fixture.finalHomeGoals ?? 0} : {fixture.finalAwayGoals ?? 0}
        </span>
        <span className="flex flex-1 min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: aInfo.color_primary }}
          />
          <span className="truncate text-xs font-bold text-on-surface">{aInfo.name}</span>
        </span>
      </div>
      {fixture.homePossession != null && (
        <>
          <div className="h-1.5 rounded-full overflow-hidden bg-surface-container-high/80 flex">
            <div
              className="h-full"
              style={{
                width: `${fixture.homePossession}%`,
                background: hInfo.color_primary || "#6366f1",
              }}
            />
            <div
              className="h-full flex-1"
              style={{ background: aInfo.color_primary || "#f43f5e" }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-bold tabular-nums text-on-surface-variant">
            <span>{fixture.homePossession}%</span>
            <span className="uppercase tracking-widest">posse</span>
            <span>{fixture.awayPossession}%</span>
          </div>
        </>
      )}
    </div>
  );
}

function AdversarioPanel({
  hasLineups,
  oppInfo,
  oppFormation,
  oppStyleLabel,
  oppRows,
  oppBench,
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header do adversário: crest + nome + formação */}
      <div className="shrink-0 px-4 pt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeamCrest team={oppInfo} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-black font-headline uppercase tracking-tight text-on-surface truncate">
              {oppInfo?.name || "Adversário"}
            </span>
            {(oppFormation || oppStyleLabel) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                {[oppFormation, oppStyleLabel].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Normalized padding — old code mixed `px-3 pt-2 pb-3 pt-3`. */}
      {/* Mobile: single scroll (pitch → bench). Desktop: 2-col grid with
       * internal scroll per column. */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-2 md:auto-rows-fr min-h-0 overflow-y-auto md:overflow-hidden p-4 gap-4">
        {/* Opponent pitch */}
        <div className="shrink-0 md:min-h-0 md:min-w-0 md:flex md:items-center md:justify-center overflow-hidden">
          {!hasLineups ? (
            <EmptyState
              icon="📋"
              message="Escalações indisponíveis durante a simulação"
            />
          ) : oppRows.ATA?.length === 0 && oppRows.MED?.length === 0 ? (
            <EmptyState
              icon="🤷"
              message="Sem dados da escalação do adversário"
            />
          ) : (
            <MatchPitch rows={oppRows} posColors={PITCH_POS_COLORS} showFatigue={false} />
          )}
        </div>

        {/* Opponent bench */}
        <div className="shrink-0 md:flex-none min-w-0 flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
            <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase">
              Banco
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
            {!hasLineups || oppBench.length === 0 ? (
              <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">
                Sem dados do banco adversário
              </p>
            ) : (
              oppBench.map((p) => (
                <MatchPlayerCard
                  key={p.id ?? p.name}
                  player={p}
                  posStyle={getPosStyle(p.position)}
                  selectable={false}
                  disabled={false}
                  showFatigue={false}
                />
              ))
            )}
          </div>
        </div>
      </div>
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
