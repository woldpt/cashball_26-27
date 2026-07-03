import { useState } from "react";
import { MAX_MATCH_SUBS } from "../../../constants/index.js";
import {
  getPosStyle,
  PITCH_POS_COLORS,
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
  MatchIcon,
  PrimaryButton,
  GhostButton,
} from "../shared/index.js";

/* ── IntervencaoView — Substitutions + chronology + opponent ────────── */
export function IntervencaoView({
  mode, fixture, liveMinute, teams, myTeamId,
  isCupMatch, isCupExtraTime,
  matchAction, injuryCountdown, tactic, onUpdateTactic,
  annotatedSquad, subbedOut, confirmedSubs, subsMade,
  swapSource, swapTarget, onSelectOut, onSelectIn,
  onConfirmSub, onResetSub, onResetAllSubs,
  redCardedHalftimeIds, injuredHalftimeIds, onResolveAction,
}) {
  const [centerTab, setCenterTab] = useState("subs");

  /* ── Mode booleans ────────────────────────────────────────────── */
  const isHalftime = mode === "halftime";
  const isPreExtraTime = isHalftime && isCupMatch && (liveMinute ?? 0) >= 90 && !isCupExtraTime;
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
  const hInfo = teams?.find((t) => t.id === fixture?.homeTeamId);
  const aInfo = teams?.find((t) => t.id === fixture?.awayTeamId);
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
  const titleText = isPreExtraTime
    ? "Pausa antes do prolongamento"
    : isHalftime
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

      {/* Title bar — also hosts the "Anular todas" ghost button when
       * confirmed subs exist (was: previously buried in a strip BELOW the
       * bottom bar, easy to miss). Surfacing it here at top-right makes
       * it visible at the moment the user is reviewing their subs. */}
      <div className={`shrink-0 px-5 py-4 border-b border-outline-variant/20 bg-gradient-to-r ${actionTheme} flex items-center justify-between gap-4`}>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold font-headline tracking-tight text-on-surface uppercase text-center truncate">
            {titleText}
          </h2>
          {isForcedSwap && injuryCountdown !== null && (
            <p className="text-center text-amber-300 font-bold text-[11px] mt-1 tracking-wide animate-pulse">
              Auto-substituição em {injuryCountdown}s
            </p>
          )}
        </div>
        {isHalftime && confirmedSubs.length > 0 && (
          <GhostButton
            onClick={onResetAllSubs}
            icon={<MatchIcon name="reset" className="h-3.5 w-3.5 text-rose-400/80" />}
            className="text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
          >
            Anular todas
          </GhostButton>
        )}
      </div>

      {/* ── 2 columns: Chronology | Subs/Adversário ────────────── */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* ═══ Mobile: mini chronology (collapsible strip) ═══ */}
        <div className="flex md:hidden flex-col shrink-0 border-b border-outline-variant/20 bg-surface-container/50">
          <PossessionBar
            homePossession={fixture.homePossession}
            awayPossession={fixture.awayPossession}
            homeColor={hInfo?.color_primary}
            awayColor={aInfo?.color_primary}
            compact
          />
          <div className="max-h-36 overflow-y-auto px-3 py-2 space-y-1.5">
            <EventList events={visibleEvts.slice(-4)} />
          </div>
        </div>

        {/* ═══ LEFT: Chronology (desktop only) ═══ */}
        <div className="hidden md:flex flex-col min-h-0 overflow-hidden border-r border-outline-variant/20 md:w-[280px] lg:w-[320px] shrink-0">
          <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
            <h2 className="text-base font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
              Cronologia
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
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
          {/* Tab toggle — pill style.
           * Loosened from `p-1 gap-1` (very cramped) to `p-1.5 gap-2`.
           * Buttons bumped from `text-[11px]` / `py-2` / `font-black` to
           * `text-xs` / `py-2.5` / `font-bold` — they read as captions,
           * not actions, with the old sizing. */}
          <div className="shrink-0 px-4 py-3 bg-surface-container-high/50 border-b border-outline-variant/15">
            <div className="flex rounded-md bg-surface-container p-1.5 gap-2">
              {[
                { key: "subs", label: "Substituições" },
                { key: "adversario", label: "Adversário" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setCenterTab(tab.key)}
                  className={`flex-1 min-w-0 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${
                    centerTab === tab.key
                      ? "bg-surface-container-high text-on-surface shadow-sm shadow-black/20"
                      : "text-on-surface-variant/70 hover:text-on-surface-variant hover:bg-surface-container-high/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
            />
          ) : (
            <AdversarioPanel
              hasLineups={hasLineups}
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
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function EventList({ events }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
        <span className="text-2xl text-on-surface-variant/40">⚽</span>
        <p className="text-on-surface-variant/60 text-[11px] font-medium">Sem eventos</p>
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

function SubsPanel({
  isHalftime, isPenalty, isForcedSwap, tactic, onUpdateTactic, onPitchPlayers, benchPlayers,
  effectiveOutId, selectedInId, handlePickOut, handlePickIn,
  forceOutPlayer, subbedOut, subsMade,
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Tactics (halftime only) */}
      {isHalftime && (
        <div className="px-4 py-4 border-b border-outline-variant/15">
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-3">
            Mentalidade
          </span>
          <TacticsButtons value={tactic.style} onChange={onUpdateTactic} />
        </div>
      )}

      <div className="flex-1 flex flex-col md:grid md:grid-cols-2 min-h-0 overflow-hidden">
        {/* On-pitch column */}
        <div className="flex-1 md:flex-none flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
            <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              {isPenalty ? "Candidatos" : "Titulares"}
            </h3>
            <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
              {onPitchPlayers.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
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
              <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">
                Sem opções em campo
              </p>
            )}
          </div>
        </div>

        {/* Bench column */}
        {!isPenalty ? (
          <div className="flex-1 md:flex-none flex flex-col min-h-0 overflow-hidden border-t md:border-t-0 md:border-l border-outline-variant/15">
            <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
              <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                Suplentes
              </h3>
              <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
                {benchPlayers.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
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
                <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">
                  Sem suplentes disponíveis
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 md:flex-none flex flex-col min-h-0 overflow-hidden border-t md:border-t-0 md:border-l border-outline-variant/15">
            <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
              <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase">Escolha</h3>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-center text-on-surface-variant/80 text-xs font-medium px-4">
                Seleciona o marcador na coluna "Titulares".
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdversarioPanel({ hasLineups, oppFormation, oppStyleLabel, oppRows, oppBench }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Formation badge (if known) */}
      {(oppFormation || oppStyleLabel) && (
        <div className="shrink-0 px-4 pt-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-md bg-surface-container border border-outline-variant/25 text-on-surface-variant">
            {[oppFormation, oppStyleLabel].filter(Boolean).join(" · ")}
          </span>
        </div>
      )}

      {/* Normalized padding — old code mixed `px-3 pt-2 pb-3 pt-3`. */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-2 min-h-0 overflow-hidden p-4 gap-4">
        {/* Opponent pitch */}
        <div className="md:flex-1 md:min-h-0 md:flex md:items-center md:justify-center overflow-hidden">
          {!hasLineups ? (
            <EmptyState icon="📋" message="Escalações indisponíveis durante a simulação" />
          ) : oppRows.ATA?.length === 0 && oppRows.MED?.length === 0 ? (
            <EmptyState icon="🤷" message="Sem dados da escalação do adversário" />
          ) : (
            <div className="relative w-full max-w-[280px] md:max-w-none md:w-auto md:h-full mx-auto rounded-md overflow-hidden border border-outline-variant/25 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]" style={{ aspectRatio: "9/16" }}>
              <PitchFormation rows={oppRows} posColors={PITCH_POS_COLORS} />
            </div>
          )}
        </div>

        {/* Opponent bench */}
        <div className="flex-1 md:flex-none flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
            <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase">Banco</h3>
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
      <p className="text-on-surface-variant/80 text-xs font-medium text-center px-4">{message}</p>
    </div>
  );
}

/* BottomBar — restructured into two grouped clusters separated by a
 * vertical divider so the eye can scan "[who's leaving] → [who's coming in]"
 * and "[reset] [confirm]" as two distinct action groups. Was: 6+ siblings
 * flat in one row at gap-2/gap-3, with "Anular todas" buried BELOW the bar. */
function BottomBar({ effectiveOutId, selectedInId, sourcePlayer, targetPlayer, isHalftime, isPenalty, canConfirmSwap, onResetSub, onConfirmSub, onResolveAction }) {
  return (
    <div className="shrink-0 border-t border-outline-variant/25 bg-surface-container-high px-4 md:px-5 py-3">
      <div className="flex flex-col md:flex-row md:items-center gap-4 min-w-0">
        {/* Cluster A: the Sai/Entra chain (skipped entirely for penalty mode). */}
        {!isPenalty && (
          <div className="flex items-center gap-2 min-w-0 md:flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-on-surface-variant/60 shrink-0 font-semibold uppercase tracking-wide">Sai</span>
              <span className="flex-1 md:flex-none bg-rose-950/80 text-rose-200 border border-rose-800/50 text-xs font-semibold px-3 py-1.5 rounded-md truncate md:max-w-[45%]">
                {effectiveOutId ? sourcePlayer?.name || "?" : "—"}
              </span>
            </div>
            <MatchIcon name="chevron-right" className="h-4 w-4 text-on-surface-variant/60 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-on-surface-variant/60 shrink-0 font-semibold uppercase tracking-wide">Entra</span>
              <span className="flex-1 md:flex-none bg-emerald-950/80 text-emerald-200 border border-emerald-800/50 text-xs font-semibold px-3 py-1.5 rounded-md truncate md:max-w-[45%]">
                {selectedInId ? targetPlayer?.name || "?" : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Vertical divider between clusters on desktop. */}
        {!isPenalty && <div className="hidden md:block w-px h-8 bg-outline-variant/20 shrink-0" />}

        {/* Cluster B: Reset + Confirm buttons. */}
        <div className="flex items-center gap-2 shrink-0 md:ml-auto">
          {isHalftime ? (
            <>
              <GhostButton
                onClick={onResetSub}
                icon={<MatchIcon name="reset" className="h-3.5 w-3.5" />}
                aria-label="Limpar seleção"
              >
                Limpar
              </GhostButton>
              <PrimaryButton
                onClick={onConfirmSub}
                disabled={!canConfirmSwap}
                tone="emerald"
                icon={<MatchIcon name="confirm" className="h-4 w-4" />}
              >
                Substituir
              </PrimaryButton>
            </>
          ) : (
            <PrimaryButton
              disabled={isPenalty ? !effectiveOutId : !canConfirmSwap}
              onClick={() =>
                isPenalty
                  ? onResolveAction(effectiveOutId || null)
                  : onResolveAction({ playerOut: effectiveOutId, playerIn: selectedInId })
              }
              tone="indigo"
              icon={<MatchIcon name="confirm" className="h-4 w-4" />}
            >
              Substituir
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}