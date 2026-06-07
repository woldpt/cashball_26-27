import { useState } from "react";
import { POSITION_SHORT_LABELS, MAX_MATCH_SUBS } from "../../../constants/index.js";
import { getPosStyle } from "../matchConstants.js";
import {
  PossessionBar,
  EventCard,
  RefWeatherBar,
  TacticsButtons,
  ConfirmedSubsStrip,
  PlayerCard,
  PitchFormation,
} from "../shared/index.js";

const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };
const MATCH_EVENT_TYPES = [
  "goal", "penalty_goal", "own_goal", "penalty_miss",
  "yellow", "red", "injury", "substitution", "phase_start",
];

/* ── MatchIntervencaoView — 3-col unified halftime / action view ───────── */
export function MatchIntervencaoView({
  mode, fixture, liveMinute, teams, myTeamId,
  matchAction, injuryCountdown, tactic, onUpdateTactic,
  annotatedSquad, subbedOut, confirmedSubs, subsMade,
  swapSource, swapTarget, onSelectOut, onSelectIn,
  onConfirmSub, onResetSub, onResetAllSubs,
  redCardedHalftimeIds, injuredHalftimeIds, onResolveAction,
}) {
  const [centerTab, setCenterTab] = useState("subs");

  /* ── Mode booleans ────────────────────────────────────────────────── */
  const isHalftime = mode === "halftime";
  const actionType = matchAction?.type || null;
  const isPenalty = actionType === "penalty";
  const isForcedSwap = actionType === "injury" || actionType === "gk_red_card";
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

  /* ── Team info ────────────────────────────────────────────────────── */
  const isHome = myTeamId && fixture?.homeTeamId === myTeamId;
  const oppTeamId = isHome ? fixture?.awayTeamId : fixture?.homeTeamId;
  const oppInfo = teams?.find((t) => t.id === oppTeamId);
  const hInfo = teams?.find((t) => t.id === fixture?.homeTeamId);
  const aInfo = teams?.find((t) => t.id === fixture?.awayTeamId);

  /* ── Our squad ────────────────────────────────────────────────────── */
  const sortPlayers = (arr = []) =>
    [...arr].sort(
      (a, b) =>
        (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
        (b.skill ?? 0) - (a.skill ?? 0),
    );

  const onPitchPlayers = isHalftime
    ? sortPlayers(
        annotatedSquad.filter(
          (p) =>
            tactic?.positions?.[p.id] === "Titular" &&
            !subbedOut.includes(p.id) &&
            !redCardedHalftimeIds.has(p.id) &&
            !injuredHalftimeIds?.has(p.id),
        ),
      )
    : isPenalty
      ? sortPlayers(matchAction?.takerCandidates || [])
      : isActionSub
        ? sortPlayers(matchAction?.onPitch || [])
        : forceOutPlayer
          ? [forceOutPlayer]
          : [];

  const benchPlayers = isHalftime
    ? sortPlayers(
        annotatedSquad
          .filter((p) => tactic?.positions?.[p.id] === "Suplente")
          .filter((p) => !injuredHalftimeIds?.has(p.id)),
      )
    : isPenalty
      ? []
      : sortPlayers(matchAction?.benchPlayers || []);

  const playerById = (id) =>
    annotatedSquad.find((p) => p.id === id) ||
    onPitchPlayers.find((p) => p.id === id) ||
    benchPlayers.find((p) => p.id === id) ||
    null;

  const effectiveOutId =
    selectedOutId || (isForcedSwap ? forceOutPlayer?.id : null);
  const targetPlayer = playerById(selectedInId);

  const canConfirmSwap =
    !!effectiveOutId &&
    !!selectedInId &&
    (!isHalftime || subsMade < MAX_MATCH_SUBS);

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handlePickOut = (player) => {
    if (!player) return;
    onSelectOut(isHalftime ? player.id : player);
  };

  const handlePickIn = (player) => {
    if (!player) return;
    onSelectIn(isHalftime ? player.id : player);
  };

  /* ── Opponent data ────────────────────────────────────────────────── */
  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;
  const oppLineup = isHome ? fixture?.awayLineup : fixture?.homeLineup;
  const oppTactic = isHome ? fixture?._t2 : fixture?._t1;
  const oppFormation = oppTactic?.formation || null;
  const oppStyleRaw = oppTactic?.style?.toUpperCase?.() || null;
  const oppStyleLabel =
    oppStyleRaw === "OFENSIVO" ? "Ofensivo"
      : oppStyleRaw === "DEFENSIVO" ? "Defensivo"
        : oppStyleRaw === "EQUILIBRADO" ? "Equilibrado"
          : null;

  const oppStarters = hasLineups
    ? _sortByPos(oppLineup.filter((p) => p.is_starter === true).slice(0, 11))
    : [];
  const oppBench = hasLineups
    ? _sortByPos(oppLineup.filter((p) => p.is_starter === false))
    : [];

  const oppPositionRows = {
    ATA: oppStarters.filter((p) => p.position === "ATA"),
    MED: oppStarters.filter((p) => p.position === "MED"),
    DEF: oppStarters.filter((p) => p.position === "DEF"),
    GR: oppStarters.filter((p) => p.position === "GR"),
  };

  const oppPosColors = {
    GR: "bg-amber-500 text-zinc-950",
    DEF: "bg-sky-500 text-zinc-950",
    MED: "bg-emerald-500 text-zinc-950",
    ATA: "bg-rose-500 text-white",
  };

  /* ── Cronologia events ────────────────────────────────────────────── */
  const evts = fixture?.events || [];
  const weatherEvent = evts.find((e) => e.type === "weather");
  const visibleEvts = _filterEvents(evts, liveMinute);
  const ref = fixture?.referee;

  /* ── Action title ─────────────────────────────────────────────────── */
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

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[linear-gradient(170deg,#0d0d14_0%,#11111b_45%,#0e1018_100%)]">
      {/* Title bar */}
      <div className={`shrink-0 px-5 py-4 border-b border-outline/40 bg-gradient-to-r ${actionTheme}`}>
        <h2 className="text-base font-black font-headline tracking-tight text-on-surface uppercase text-center">
          {titleText}
        </h2>
        {isForcedSwap && injuryCountdown !== null && (
          <p className="text-center text-amber-300 font-black text-[10px] mt-1 tracking-wide animate-pulse">
            Auto-substituição em {injuryCountdown}s
          </p>
        )}
      </div>

      {/* ── 3-column grid ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[0.85fr_1.6fr] overflow-hidden">
        {/* ═══ COL ESQUERDA — Cronologia ═══ */}
        <div className="hidden md:flex flex-col min-h-0 overflow-hidden border-r border-outline/40">
          <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
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
            <CronologiaEvents events={visibleEvts} />
          </div>
        </div>

        {/* ═══ COL CENTRAL — Substituições / Adversário ═══════════════ */}
        <div className="flex flex-col min-h-0 overflow-hidden">
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
            />
          ) : (
            <AdversarioPanel
              hasLineups={hasLineups}
              oppInfo={oppInfo}
              oppFormation={oppFormation}
              oppStyleLabel={oppStyleLabel}
              oppPositionRows={oppPositionRows}
              oppPosColors={oppPosColors}
              oppBench={oppBench}
            />
          )}
        </div>
      </div>

      {/* ═══ BOTTOM BAR ─════════════════════════════════════════════ */}
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

function CronologiaEvents({ events }) {
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
  isHalftime, isPenalty, isForcedSwap, confirmedSubs, annotatedSquad,
  tactic, onUpdateTactic, onPitchPlayers, benchPlayers,
  effectiveOutId, selectedInId, handlePickOut, handlePickIn,
  forceOutPlayer, subbedOut, subsMade,
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <ConfirmedSubsStrip subs={confirmedSubs} annotatedSquad={annotatedSquad} />

      {isHalftime && (
        <div className="px-4 py-3 border-b border-outline/40">
          <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2.5">
            Mentalidade
          </span>
          <TacticsButtons value={tactic.style} onChange={onUpdateTactic} />
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden">
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">
              {isPenalty ? "Candidatos" : "Titulares"}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {onPitchPlayers.map((p) => (
              <OnPitchPlayerCard
                key={p.id}
                player={p}
                effectiveOutId={effectiveOutId}
                handlePickOut={handlePickOut}
                isHalftime={isHalftime}
                isPenalty={isPenalty}
                isForcedSwap={isForcedSwap}
                benchPlayers={benchPlayers}
                subbedOut={subbedOut}
                subsMade={subsMade}
                forceOutPlayer={forceOutPlayer}
              />
            ))}
            {onPitchPlayers.length === 0 && (
              <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6">
                Sem opções em campo
              </p>
            )}
          </div>
        </div>

        {!isPenalty ? (
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
              <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">Suplentes</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BenchPanelPlayers
                benchPlayers={benchPlayers}
                selectedInId={selectedInId}
                handlePickIn={handlePickIn}
                isHalftime={isHalftime}
                subbedOut={subbedOut}
                subsMade={subsMade}
                forceOutPlayer={forceOutPlayer}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
              <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">Escolha</h2>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-center text-on-surface-variant/80 text-xs font-bold px-4">
                Seleciona o marcador na coluna central.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OnPitchPlayerCard({ player, effectiveOutId, handlePickOut, isHalftime, isPenalty, isForcedSwap, benchPlayers, subbedOut, subsMade, forceOutPlayer }) {
  const grAvailableOnBench = benchPlayers.some(
    (bp) => bp.position === "GR" && !subbedOut.includes(bp.id),
  );
  const noGrReplacement = isHalftime && player.position === "GR" && !grAvailableOnBench;
  const isLockedForced = isForcedSwap && !!forceOutPlayer && player.id !== forceOutPlayer.id;
  const disabled =
    noGrReplacement ||
    isLockedForced ||
    (isHalftime && subsMade >= MAX_MATCH_SUBS) ||
    (isPenalty && ![]);
  const selected = effectiveOutId === player.id;
  const s = getPosStyle(player.position);

  return (
    <button
      key={player.id}
      onClick={() => !disabled && handlePickOut(player)}
      title={noGrReplacement ? "Não há GR no banco para substituir" : undefined}
      className={`relative group flex items-stretch rounded-md overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${selected ? "border-rose-400/60 bg-rose-500/10" : s.glow} shadow-sm shadow-black/30 w-full text-left select-none ${
        selected ? "" : disabled ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40" : "cursor-pointer"
      }`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${s.bar}`} />
      <span className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${
        selected ? "bg-rose-500/20 text-rose-200 border-rose-400/40" : s.badgeBg + " " + s.badgeText + " " + s.badgeBorder
      }`}>
        {POSITION_SHORT_LABELS[player.position]}
      </span>
      <span className={`flex-1 truncate text-[12px] font-black ${selected ? "text-rose-100" : "text-on-surface"}`}>
        {player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className="ml-0.5 text-amber-400 font-black">*</span>
        )}
      </span>
      <DetailedStats player={player} selected={selected} />
      {isHalftime && !isPenalty && (
        <span className={`text-sm shrink-0 transition-colors ml-1 ${
          selected ? "text-rose-400" : disabled ? "text-on-surface-variant/40" : "text-on-surface-variant/80 group-hover:text-emerald-400"
        }`}>↔</span>
      )}
    </button>
  );
}

function BenchPanelPlayers({ benchPlayers, selectedInId, handlePickIn, isHalftime, subbedOut, subsMade, forceOutPlayer }) {
  if (benchPlayers.length === 0) {
    return <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6">Sem suplentes disponíveis</p>;
  }
  return (
    <div className="space-y-1">
      {benchPlayers.map((p) => (
        <BenchPlayerCard2
          key={p.id}
          player={p}
          selectedInId={selectedInId}
          handlePickIn={handlePickIn}
          isHalftime={isHalftime}
          subbedOut={subbedOut}
          subsMade={subsMade}
          forceOutPlayer={forceOutPlayer}
        />
      ))}
    </div>
  );
}

function BenchPlayerCard2({ player, selectedInId, handlePickIn, isHalftime, subbedOut, subsMade, forceOutPlayer }) {
  const alreadyUsed = isHalftime && subbedOut.includes(player.id);
  const positionMismatch = !!forceOutPlayer && (forceOutPlayer.position === "GR") !== (player.position === "GR");
  const disabled = alreadyUsed || positionMismatch || (isHalftime && subsMade >= MAX_MATCH_SUBS);
  const selected = selectedInId === player.id;
  const s = getPosStyle(player.position);

  return (
    <button
      key={player.id}
      onClick={() => !disabled && handlePickIn(player)}
      className={`relative group flex items-stretch rounded-md overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${selected ? "border-emerald-400/60 bg-emerald-500/10" : s.glow} shadow-sm shadow-black/30 w-full text-left select-none ${
        alreadyUsed ? "opacity-25 cursor-not-allowed border-outline-variant/15 bg-surface-container/40" : disabled ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40" : "cursor-pointer"
      }`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${alreadyUsed ? "from-outline-variant/40 via-outline-variant/60 to-outline-variant/40" : s.bar}`} />
      <span className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${
        alreadyUsed ? "border-outline-variant/15 bg-surface-container/20 text-on-surface-variant/40" : selected ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" : s.badgeBg + " " + s.badgeText + " " + s.badgeBorder
      }`}>
        {POSITION_SHORT_LABELS[player.position]}
      </span>
      <span className={`flex-1 truncate text-[12px] font-black ${
        alreadyUsed ? "text-on-surface-variant/60" : selected ? "text-emerald-100" : "text-on-surface"
      }`}>
        {player.name}
        {!alreadyUsed && !!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className="ml-0.5 text-amber-400 font-black">*</span>
        )}
      </span>
      <DetailedStats player={player} alreadyUsed={alreadyUsed} />
    </button>
  );
}

function DetailedStats({ player, alreadyUsed }) {
  if (alreadyUsed) {
    return <span className="text-[10px] text-on-surface-variant/40 font-black">—</span>;
  }
  const resistance = player.resistance ?? 0;
  const form = player.form ?? 100;
  const skill = player.skill ?? 0;

  const resColor = resistance >= 4 ? "text-green-400" : resistance >= 3 ? "text-yellow-400" : "text-red-400";
  const skillColor = skill >= 40
    ? "bg-green-500/15 text-green-300 border-green-500/30"
    : skill >= 25
      ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
      : "bg-red-500/15 text-red-300 border-red-500/30";
  const textShadow = skill >= 40
    ? "0 0 12px rgba(34,197,94,0.35)"
    : skill >= 25
      ? "0 0 12px rgba(234,179,8,0.35)"
      : "0 0 12px rgba(239,68,68,0.35)";

  return (
    <div className="shrink-0 flex items-center gap-1.5">
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[8px] uppercase tracking-widest text-on-surface-variant/80 font-black leading-none">RES</span>
        <span className={`text-[14px] font-black tabular-nums leading-none ${resColor}`}>{player.resistance ?? "–"}</span>
      </div>
      <div className="w-px h-6 bg-outline-variant/25" />
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[8px] uppercase tracking-widest text-on-surface-variant/80 font-black leading-none">FORMA</span>
        <span className="text-[14px] leading-none">{form >= 115 ? "💪" : form <= 85 ? "😩" : "👍"}</span>
      </div>
      <div className="w-px h-6 bg-outline-variant/25" />
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black leading-none">Qualidade</span>
        <span className={`text-[16px] font-black tabular-nums leading-none px-2.5 py-1 rounded-lg border ${skillColor}`} style={{ textShadow }}>{player.skill ?? "–"}</span>
      </div>
    </div>
  );
}

function AdversarioPanel({ hasLineups, oppInfo, oppFormation, oppStyleLabel, oppPositionRows, oppPosColors, oppBench }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 m-2 rounded-md border border-outline-variant/25 bg-surface-container">
        <span
          className="text-base font-black font-headline tracking-tight uppercase truncate"
          style={{ color: oppInfo?.color_primary || "#f59e0b" }}
        >
          {oppInfo?.name || "Adversário"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {(oppFormation || oppStyleLabel) && (
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/80 shrink-0">
              {[oppFormation, oppStyleLabel].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden">
        <div className="flex items-center justify-center p-2 overflow-hidden border-r border-outline/40">
          {!hasLineups ? (
            <EmptyState icon="📋" message="Escalações indisponíveis durante a simulação" />
          ) : oppPositionRows.ATA?.length === 0 && oppPositionRows.MED?.length === 0 ? (
            <EmptyState icon="🤷" message="Sem dados da escalação do adversário" />
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-outline/40 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]" style={{ aspectRatio: "9/16", maxHeight: "380px" }}>
              <PitchFormation rows={oppPositionRows} posColors={oppPosColors} />
            </div>
          )}
        </div>

        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">Banco Adversário</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!hasLineups || oppBench.length === 0 ? (
              <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6 px-2">Sem dados do banco adversário</p>
            ) : (
              <div className="space-y-1">
                {oppBench.map((player) => (
                  <OppBenchPlayerCard key={player.id ?? player.name} player={player} />
                ))}
              </div>
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
          <span className="bg-rose-950/80 text-rose-200 border border-rose-800/50 text-[11px] font-black px-3 py-1.5 rounded-lg truncate max-w-[35%]">
            {effectiveOutId ? sourcePlayer?.name || "?" : "—"}
          </span>
          {!isPenalty && (
            <>
              <span className="text-on-surface-variant/80 shrink-0 font-black text-base">→</span>
              <span className="text-[10px] text-on-surface-variant/60 shrink-0 font-black uppercase tracking-wide">Entra</span>
              <span className="bg-emerald-950/80 text-emerald-200 border border-emerald-800/50 text-[11px] font-black px-3 py-1.5 rounded-lg truncate max-w-[35%]">
                {selectedInId ? targetPlayer?.name || "?" : "—"}
              </span>
            </>
          )}
        </div>

        {isHalftime ? (
          <>
            <button onClick={onResetSub} className="shrink-0 w-8 h-8 rounded-lg bg-surface-container-high/80 hover:bg-surface-container-high text-on-surface-variant/80 hover:text-on-surface text-sm flex items-center justify-center transition-colors border border-outline/40">✕</button>
            <button
              onClick={onConfirmSub}
              disabled={!canConfirmSwap}
              className={`shrink-0 px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all border ${
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
            className="shrink-0 px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide bg-primary/90 hover:brightness-110 text-on-primary disabled:opacity-50 disabled:cursor-not-allowed border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.2)]"
          >
            Substituir
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

const _sortByPos = (arr) =>
  [...arr].sort(
    (a, b) =>
      (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
      (b.skill ?? 0) - (a.skill ?? 0),
  );

function _filterEvents(evts, liveMinute) {
  return evts
    .filter((e) => e.minute <= liveMinute && MATCH_EVENT_TYPES.includes(e.type))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}
