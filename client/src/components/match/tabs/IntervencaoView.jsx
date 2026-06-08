import { useState } from "react";
import { POSITION_SHORT_LABELS, MAX_MATCH_SUBS } from "../../../constants/index.js";
import {
  getPosStyle,
  PITCH_POS_COLORS,
  MATCH_EVENT_TYPES,
  sortPlayersByPos,
  buildPositionRows,
  filterMatchEvents,
} from "../matchConstants.js";
import {
  PossessionBar,
  EventCard,
  RefWeatherBar,
  TacticsButtons,
  ConfirmedSubsStrip,
  PitchFormation,
  MatchPlayerCard,
} from "../shared/index.js";

/* ── IntervencaoView — Substitutions + chronology + opponent ────────── */
export function IntervencaoView({
  mode, fixture, liveMinute, teams, myTeamId,
  matchAction, injuryCountdown, tactic, onUpdateTactic,
  annotatedSquad, subbedOut, confirmedSubs, subsMade,
  swapSource, swapTarget, onSelectOut, onSelectIn,
  onConfirmSub, onResetSub, onResetAllSubs,
  redCardedHalftimeIds, injuredHalftimeIds, onResolveAction,
}) {
  const [centerTab, setCenterTab] = useState("subs");

  /* ── Mode booleans ────────────────────────────────────────────── */
  const isHalftime = mode === "halftime";
  const actionType = matchAction?.type || null;
  const isPenalty = actionType === "penalty";
  const isForcedSwap = actionType === "injury" || actionType === "gk_red_card";
  const isActionSub = actionType === "user_substitution";

  const selectedOutId =
    typeof swapSource === "object" && swapSource !== null ? swapSource.id : swapSource;
  const selectedInId =
    typeof swapTarget === "object" && swapTarget !== null ? swapTarget.id : swapTarget;

  const forceOutPlayer =
    matchAction?.injuredPlayer || matchAction?.sentOffPlayer || matchAction?.dismissedPlayer || null;

  /* ── Team info ────────────────────────────────────────────────── */
  const isHome = myTeamId && fixture?.homeTeamId === myTeamId;
  const oppTeamId = isHome ? fixture?.awayTeamId : fixture?.homeTeamId;
  const oppInfo = teams?.find((t) => t.id === oppTeamId);
  const hInfo = teams?.find((t) => t.id === fixture?.homeTeamId);
  const aInfo = teams?.find((t) => t.id === fixture?.awayTeamId);
  const homeGoals = fixture?.finalHomeGoals ?? 0;
  const awayGoals = fixture?.finalAwayGoals ?? 0;
  const myTeamGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;

  /* ── Our squad ────────────────────────────────────────────────── */
  const onPitchPlayers = isHalftime
    ? sortPlayersByPos(
        annotatedSquad.filter(
          (p) =>
            tactic?.positions?.[p.id] === "Titular" &&
            !subbedOut.includes(p.id) &&
            !redCardedHalftimeIds.has(p.id) &&
            !injuredHalftimeIds?.has(p.id),
        ),
      )
    : isPenalty
      ? sortPlayersByPos(matchAction?.takerCandidates || [])
      : isActionSub
        ? sortPlayersByPos(matchAction?.onPitch || [])
        : forceOutPlayer
          ? [forceOutPlayer]
          : [];

  const benchPlayers = isHalftime
    ? sortPlayersByPos(
        annotatedSquad
          .filter((p) => tactic?.positions?.[p.id] === "Suplente")
          .filter((p) => !injuredHalftimeIds?.has(p.id)),
      )
    : isPenalty
      ? []
      : sortPlayersByPos(matchAction?.benchPlayers || []);

  const playerById = (id) =>
    annotatedSquad.find((p) => p.id === id) ||
    onPitchPlayers.find((p) => p.id === id) ||
    benchPlayers.find((p) => p.id === id) ||
    null;

  const effectiveOutId = selectedOutId || (isForcedSwap ? forceOutPlayer?.id : null);
  const targetPlayer = playerById(selectedInId);
  const canConfirmSwap =
    !!effectiveOutId && !!selectedInId && (!isHalftime || subsMade < MAX_MATCH_SUBS);

  /* ── Opponent data ────────────────────────────────────────────── */
  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;
  const oppLineupRaw = isHome ? fixture?.awayLineup : fixture?.homeLineup;
  const oppLineup = oppLineupRaw || [];
  const oppStarters = sortPlayersByPos(oppLineup.filter((p) => p.is_starter === true).slice(0, 11));
  const oppBench = sortPlayersByPos(oppLineup.filter((p) => p.is_starter === false));
  const oppTactic = isHome ? fixture?._t2 : fixture?._t1;
  const oppFormation = oppTactic?.formation || null;
  const oppStyleRaw = oppTactic?.style?.toUpperCase?.() || null;
  const oppStyleLabel =
    oppStyleRaw === "OFENSIVO" ? "Ofensivo"
      : oppStyleRaw === "DEFENSIVO" ? "Defensivo"
        : oppStyleRaw === "EQUILIBRADO" ? "Equilibrado"
          : null;
  const oppRows = buildPositionRows(oppStarters);

  /* ── Chronology events ────────────────────────────────────────── */
  const evts = fixture?.events || [];
  const weatherEvent = evts.find((e) => e.type === "weather");
  const visibleEvts = filterMatchEvents(evts, liveMinute);
  const ref = fixture.referee;

  /* ── Action title ─────────────────────────────────────────────── */
  const titleText = isHalftime
    ? "Gestão da Equipa"
    : isPenalty
      ? "Escolhe o marcador"
      : isForcedSwap
        ? `Substituição obrigatória · ${forceOutPlayer?.name || "jogador"}`
        : "Pausa para substituição";

  const actionTheme = isPenalty
    ? "from-amber-600/20 via-amber-500/5 to-transparent"
    : isForcedSwap
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

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[linear-gradient(170deg,#0d0d14_0%,#11111b_45%,#0e1018_100%)]">
      {/* Confirmed subs strip */}
      <ConfirmedSubsStrip subs={confirmedSubs} annotatedSquad={annotatedSquad} />

      {/* Title bar */}
      <div className={`shrink-0 px-5 py-4 border-b border-outline/40 bg-gradient-to-r ${actionTheme}`}>
        <div className="flex items-center gap-2">
          {oppInfo && (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] shrink-0" style={{ color: oppInfo?.color_primary || "#f59e0b" }}>
              {oppInfo?.name || "Adversário"}
            </span>
          )}
          <h2 className="text-base font-black font-headline tracking-tight text-on-surface uppercase text-center truncate flex-1">
            {titleText}
          </h2>
        </div>
        {isHalftime && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wide truncate max-w-[80px]">
              {teams?.find((t) => t.id === fixture?.homeTeamId)?.name || "Casa"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-lg font-black tabular-nums text-on-surface">{myTeamGoals}</span>
              <span className="text-on-surface-variant/60 text-sm font-black">–</span>
              <span className="text-lg font-black tabular-nums text-on-surface">{oppGoals}</span>
            </span>
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wide truncate max-w-[80px] text-right">
              {oppInfo?.name || "Fora"}
            </span>
          </div>
        )}
        {isForcedSwap && injuryCountdown !== null && (
          <p className="text-center text-amber-300 font-black text-[10px] mt-1 tracking-wide animate-pulse">
            Auto-substituição em {injuryCountdown}s
          </p>
        )}
      </div>

      {/* ── 2 columns: Chronology | Subs/Adversário ────────────── */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* ═══ LEFT: Chronology ═══ */}
        <div className="hidden md:flex flex-col min-h-0 overflow-hidden border-r border-outline/40 md:w-[280px] lg:w-[320px] shrink-0">
          <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
              Cronologia
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            <PossessionBar
              homePossession={fixture.homePossession}
              awayPossession={fixture.awayPossession}
              homeColor={hInfo?.color_primary}
              awayColor={aInfo?.color_primary}
              compact
            />
            <RefWeatherBar
              attendance={fixture?.attendance}
              referee={ref}
              weatherEvent={weatherEvent}
              className="text-[10px]"
            />
            <EventList events={visibleEvts} />
          </div>
        </div>

        {/* ═══ RIGHT: Subs / Adversário ═══ */}
        <div className="flex flex-col min-h-0 overflow-hidden flex-1">
          {/* Tab toggle */}
          <div className="shrink-0 flex border-b border-outline/40 bg-surface-container-high/70">
            {[
              { key: "subs", label: "Substituições" },
              { key: "adversario", label: "Adversário" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCenterTab(tab.key)}
                className={`flex-1 min-w-0 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
                  centerTab === tab.key
                    ? "text-on-surface border-primary bg-primary/5"
                    : "text-on-surface-variant/80 hover:text-on-surface-variant border-transparent hover:bg-surface-container/30"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {centerTab === "subs" ? (
            <SubsPanel
              isHalftime={isHalftime}
              isPenalty={isPenalty}
              isForcedSwap={isForcedSwap}
              confirmedSubs={confirmedSubs}
              annotatedSquad={annotatedSquad}
              tactic={tactic}
              onUpdateTactic={onUpdateTactic}
              onPitchPlayers={onPitchPlayers}
              benchPlayers={benchPlayers}
              effectiveOutId={effectiveOutId}
              selectedInId={selectedInId}
              handlePickOut={handlePickOut}
              handlePickIn={handlePickIn}
              forceOutPlayer={forceOutPlayer}
              subbedOut={subbedOut}
              subsMade={subsMade}
              isActionMode={mode === "action"}
            />
          ) : (
            <AdversarioPanel
              hasLineups={hasLineups}
              oppInfo={oppInfo}
              oppFormation={oppFormation}
              oppStyleLabel={oppStyleLabel}
              oppRows={oppRows}
              oppBench={oppBench}
            />
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <BottomBar
        effectiveOutId={effectiveOutId}
        selectedInId={selectedInId}
        sourcePlayer={playerById(effectiveOutId)}
        targetPlayer={targetPlayer}
        isHalftime={isHalftime}
        isPenalty={isPenalty}
        canConfirmSwap={canConfirmSwap}
        onResetSub={onResetSub}
        onConfirmSub={onConfirmSub}
        onResolveAction={onResolveAction}
      />

      {isHalftime && confirmedSubs.length > 0 && (
        <div className="shrink-0 border-t border-outline-variant/25 px-5 py-2 flex justify-center bg-surface-container/50">
          <button
            onClick={onResetAllSubs}
            className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-400/80 hover:text-rose-300 transition-colors"
          >
            ↺ Anular todas as substituições
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function EventList({ events }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
        <span className="text-2xl text-on-surface-variant/40">⚽</span>
        <p className="text-on-surface-variant/60 text-[11px] font-bold">Sem eventos</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {events.map((e, i) => (
        <EventCard key={i} event={e} showTeamBadge={false} />
      ))}
    </div>
  );
}

function SubsPanel({
  isHalftime, isPenalty, isForcedSwap, tactic, onUpdateTactic, onPitchPlayers, benchPlayers,
  effectiveOutId, selectedInId, handlePickOut, handlePickIn,
  forceOutPlayer, subbedOut, subsMade,
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Tactics (halftime only) */}
      {isHalftime && (
        <div className="px-4 py-3 border-b border-outline/40">
          <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2.5">
            Mentalidade
          </span>
          <TacticsButtons value={tactic.style} onChange={onUpdateTactic} />
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden">
        {/* On-pitch column */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h3 className="text-sm font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              {isPenalty ? "Candidatos" : "Titulares"}
            </h3>
            <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
              {onPitchPlayers.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {onPitchPlayers.map((p) => {
              const grAvailableOnBench = benchPlayers.some(
                (bp) => bp.position === "GR" && !subbedOut.includes(bp.id),
              );
              const noGrReplacement = isHalftime && p.position === "GR" && !grAvailableOnBench;
              const isLockedForced = isForcedSwap && !!forceOutPlayer && p.id !== forceOutPlayer.id;
              const disabled =
                noGrReplacement ||
                isLockedForced ||
                (isHalftime && subsMade >= MAX_MATCH_SUBS) ||
                (isPenalty && ![]);
              const selected = effectiveOutId === p.id;

              return (
                <MatchPlayerCard
                  key={p.id}
                  player={p}
                  posStyle={getPosStyle(p.position)}
                  selected={selected}
                  disabled={disabled}
                  selectable={!disabled}
                  onPick={() => handlePickOut(p)}
                  title={noGrReplacement ? "Não há GR no banco para substituir" : undefined}
                  swapIndicator={isHalftime && !isPenalty}
                />
              );
            })}
            {onPitchPlayers.length === 0 && (
              <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6">
                Sem opções em campo
              </p>
            )}
          </div>
        </div>

        {/* Bench column */}
        {!isPenalty ? (
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
              <h3 className="text-sm font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                Suplentes
              </h3>
              <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                {benchPlayers.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {benchPlayers.map((p) => {
                const alreadyUsed = isHalftime && subbedOut.includes(p.id);
                const positionMismatch = !!forceOutPlayer && (forceOutPlayer.position === "GR") !== (p.position === "GR");
                const disabled = alreadyUsed || positionMismatch || (isHalftime && subsMade >= MAX_MATCH_SUBS);
                const selected = selectedInId === p.id;

                return (
                  <MatchPlayerCard
                    key={p.id}
                    player={p}
                    posStyle={getPosStyle(p.position)}
                    selected={selected}
                    disabled={disabled}
                    selectable={!disabled}
                    onPick={() => handlePickIn(p)}
                  />
                );
              })}
              {benchPlayers.length === 0 && (
                <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6">
                  Sem suplentes disponíveis
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
              <h3 className="text-sm font-black font-headline tracking-tight text-tertiary uppercase">Escolha</h3>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-center text-on-surface-variant/80 text-xs font-bold px-4">
                Seleciona o marcador na coluna "Titulares".
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdversarioPanel({ hasLineups, oppInfo, oppFormation, oppStyleLabel, oppRows, oppBench }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 mx-3 mt-3 rounded-md border border-outline-variant/25 bg-surface-container">
        <span
          className="text-base font-black font-headline tracking-tight uppercase truncate"
          style={{ color: oppInfo?.color_primary || "#f59e0b" }}
        >
          {oppInfo?.name || "Adversário"}
        </span>
        {(oppFormation || oppStyleLabel) && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-on-surface-variant/80 shrink-0">
            {[oppFormation, oppStyleLabel].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden px-3 pb-3 pt-2">
        {/* Opponent pitch */}
        <div className="flex items-center justify-center overflow-hidden">
          {!hasLineups ? (
            <EmptyState icon="📋" message="Escalações indisponíveis durante a simulação" />
          ) : oppRows.ATA?.length === 0 && oppRows.MED?.length === 0 ? (
            <EmptyState icon="🤷" message="Sem dados da escalação do adversário" />
          ) : (
            <div className="relative rounded-md overflow-hidden border border-outline/40 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]" style={{ aspectRatio: "9/16", maxHeight: "380px" }}>
              <PitchFormation rows={oppRows} posColors={PITCH_POS_COLORS} />
            </div>
          )}
        </div>

        {/* Opponent bench */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h3 className="text-sm font-black font-headline tracking-tight text-tertiary uppercase">Banco</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
            {!hasLineups || oppBench.length === 0 ? (
              <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6">
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
      <p className="text-on-surface-variant/80 text-xs font-bold text-center px-4">{message}</p>
    </div>
  );
}

function BottomBar({ effectiveOutId, selectedInId, sourcePlayer, targetPlayer, isHalftime, isPenalty, canConfirmSwap, onResetSub, onConfirmSub, onResolveAction }) {
  return (
    <div className="shrink-0 border-t border-outline/40 bg-surface-container-high px-5 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-on-surface-variant/60 shrink-0 font-black uppercase tracking-wide">Sai</span>
          <span className="bg-rose-950/80 text-rose-200 border border-rose-800/50 text-[11px] font-black px-3 py-1.5 rounded-md truncate max-w-[35%]">
            {effectiveOutId ? sourcePlayer?.name || "?" : "—"}
          </span>
          {!isPenalty && (
            <>
              <span className="text-on-surface-variant/80 shrink-0 font-black text-base">→</span>
              <span className="text-[10px] text-on-surface-variant/60 shrink-0 font-black uppercase tracking-wide">Entra</span>
              <span className="bg-emerald-950/80 text-emerald-200 border border-emerald-800/50 text-[11px] font-black px-3 py-1.5 rounded-md truncate max-w-[35%]">
                {selectedInId ? targetPlayer?.name || "?" : "—"}
              </span>
            </>
          )}
        </div>

        {isHalftime ? (
          <>
            <button
              onClick={onResetSub}
              className="shrink-0 w-8 h-8 rounded-md bg-surface-container-high/80 hover:bg-surface-container-high text-on-surface-variant/80 hover:text-on-surface text-sm flex items-center justify-center transition-colors border border-outline/40"
            >
              ✕
            </button>
            <button
              onClick={onConfirmSub}
              disabled={!canConfirmSwap}
              className={`shrink-0 px-5 py-2 rounded-md text-[11px] font-black uppercase tracking-wide transition-all border ${
                canConfirmSwap
                  ? "bg-emerald-600/90 border-emerald-400/40 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:bg-emerald-500/90"
                  : "bg-surface-container-high/80 border-outline/40 text-on-surface-variant/60 cursor-not-allowed"
              }`}
            >
              Substituir
            </button>
          </>
        ) : (
          <button
            disabled={isPenalty ? !effectiveOutId : !canConfirmSwap}
            onClick={() =>
              isPenalty
                ? onResolveAction(effectiveOutId || null)
                : onResolveAction({ playerOut: effectiveOutId, playerIn: selectedInId })
            }
            className="shrink-0 px-5 py-2 rounded-md text-[11px] font-black uppercase tracking-wide bg-primary/90 hover:brightness-110 text-on-primary disabled:opacity-50 disabled:cursor-not-allowed border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.2)]"
          >
            Substituir
          </button>
        )}
      </div>
    </div>
  );
}