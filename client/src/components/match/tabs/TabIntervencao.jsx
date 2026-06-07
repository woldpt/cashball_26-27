import {} from "react";
import { POSITION_SHORT_LABELS, MAX_MATCH_SUBS } from "../../../constants/index.js";
import { getPosStyle, POS_STYLES } from "../matchConstants.js";
import {
  TacticsButtons,
  ConfirmedSubsStrip,
} from "../shared/index.js";

const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };

/* ── TabIntervencao — Substitution / management ─────────────────────────── */
export function TabIntervencao({
  mode,
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
  onResetAllSubs,
  redCardedHalftimeIds,
  injuredHalftimeIds,
  onResolveAction,
  fixture,
  teams,
  myTeamId,
}) {
  const shouldReduceMotion = false;
  const actionType = matchAction?.type || null;
  const isHalftime = mode === "halftime";
  const isActionMode = mode === "action";
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

  const isHome = myTeamId && fixture?.homeTeamId === myTeamId;
  const oppTeamId = isHome ? fixture?.awayTeamId : fixture?.homeTeamId;
  const oppInfo = teams?.find((t) => t.id === oppTeamId);

  const homeGoals = fixture?.finalHomeGoals ?? 0;
  const awayGoals = fixture?.finalAwayGoals ?? 0;
  const myTeamGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;

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

  const canConfirmSwap =
    !!effectiveOutId &&
    !!selectedInId &&
    (!isHalftime || subsMade < MAX_MATCH_SUBS);

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

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[linear-gradient(170deg,#0d0d14_0%,#11111b_45%,#0e1018_100%)]">
      {/* ── Confirmed subs (halftime) ────────────────────────────────── */}
      <ConfirmedSubsStrip subs={confirmedSubs} annotatedSquad={annotatedSquad} />

      {/* ── Halftime tactics ─────────────────────────────────────────── */}
      {isHalftime && (
        <div className="shrink-0 px-5 py-4 border-b border-outline/40 bg-surface-container-high/50">
          <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
            Mentalidade
          </span>
          <TacticsButtons value={tactic.style} onChange={onUpdateTactic} />
        </div>
      )}

      {/* ── Title bar ────────────────────────────────────────────────── */}
      <div className={`shrink-0 px-5 py-4 border-b border-outline/40 bg-gradient-to-r ${actionTheme}`}>
        <div className="flex items-center gap-2">
          {oppInfo && (
            <span
              className="text-[10px] font-black uppercase tracking-[0.2em] shrink-0"
              style={{ color: oppInfo?.color_primary || "#f59e0b" }}
            >
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

      {/* ── Two columns ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
        {/* ── On pitch ───────────────────────────────────────────────── */}
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden border-b md:border-b-0 md:border-r border-outline/40">
          <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              Em Campo
            </h2>
            <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
              {onPitchPlayers.length} jogadores
            </span>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {onPitchPlayers.map((p, i) => (
              <OnPitchPlayerCard
                key={p.id}
                player={p}
                i={i}
                shouldReduceMotion={shouldReduceMotion}
                effectiveOutId={effectiveOutId}
                onPickOut={() => handlePickOut(p)}
                benchPlayers={benchPlayers}
                subbedOut={subbedOut}
                isHalftime={isHalftime}
                subsMade={subsMade}
                isPenalty={isPenalty}
                matchAction={matchAction}
                forceOutPlayer={forceOutPlayer}
                isForcedSwap={isForcedSwap}
              />
            ))}
            {onPitchPlayers.length === 0 && (
              <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6">
                Sem opções em campo
              </p>
            )}
          </div>
        </div>

        {/* ── Bench ──────────────────────────────────────────────────── */}
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex items-center justify-between bg-surface-container-high/50 border-b border-outline/40">
            <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
              {isPenalty ? "Escolha" : "Banco"}
            </h2>
            {!isPenalty && (
              <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                {benchPlayers.length} jogadores
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {isPenalty ? (
              <p className="text-center text-on-surface-variant/80 text-xs font-bold py-8 px-4">
                Seleciona o marcador na coluna "Em Campo".
              </p>
            ) : (
              benchPlayers.map((p, i) => (
                <BenchPlayerCard
                  key={p.id}
                  player={p}
                  i={i}
                  shouldReduceMotion={shouldReduceMotion}
                  selectedInId={selectedInId}
                  subbedOut={subbedOut}
                  isHalftime={isHalftime}
                  subsMade={subsMade}
                  forceOutPlayer={forceOutPlayer}
                  onPickIn={() => handlePickIn(p)}
                />
              ))
            )}
            {!isPenalty && benchPlayers.length === 0 && (
              <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6">
                Sem opções no banco
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <BottomBar
        effectiveOutId={effectiveOutId}
        selectedInId={selectedInId}
        playerById={playerById}
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

  /* ── Local handlers ─────────────────────────────────────────────── */
  function handlePickOut(player) {
    if (!player) return;
    onSelectOut(isActionMode ? player : player.id);
  }

  function handlePickIn(player) {
    if (!player) return;
    onSelectIn(isActionMode ? player : player.id);
  }
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function OnPitchPlayerCard({
  player, i, shouldReduceMotion, effectiveOutId, onPickOut,
  benchPlayers, subbedOut, isHalftime, subsMade,
  isPenalty, matchAction, forceOutPlayer, isForcedSwap,
}) {
  const grAvailableOnBench = benchPlayers.some(
    (bp) => bp.position === "GR" && !subbedOut.includes(bp.id),
  );
  const noGrReplacement = isHalftime && player.position === "GR" && !grAvailableOnBench;
  const isLockedForced = isForcedSwap && !!forceOutPlayer && player.id !== forceOutPlayer.id;
  const disabled =
    noGrReplacement ||
    isLockedForced ||
    (isHalftime && subsMade >= MAX_MATCH_SUBS) ||
    (isPenalty && !(matchAction?.takerCandidates || []).find((c) => c.id === player.id));
  const selected = effectiveOutId === player.id;
  const s = getPosStyle(player.position);

  return (
    <motion.button
      key={player.id}
      onClick={() => !disabled && onPickOut()}
      title={noGrReplacement ? "Não há GR no banco para substituir" : undefined}
      initial={shouldReduceMotion ? false : { opacity: 0, x: -10, filter: "blur(2px)" }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0, filter: "blur(0px)" }}
      transition={shouldReduceMotion ? undefined : { duration: 0.2, delay: Math.min(i, 6) * 0.02 }}
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${s.glow} shadow-sm shadow-black/30 w-full text-left select-none ${
        selected
          ? "border-rose-400/60 bg-rose-500/10"
          : disabled
            ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
            : "cursor-pointer"
      }`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${s.bar}`} />
      <span className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${
        selected
          ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
          : s.badgeBg + " " + s.badgeText + " " + s.badgeBorder
      }`}>
        {POSITION_SHORT_LABELS[player.position]}
      </span>
      <span className={`flex-1 truncate text-[11px] font-black ${selected ? "text-rose-100" : "text-on-surface"}`}>
        {player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className="ml-0.5 text-amber-400 font-black">*</span>
        )}
      </span>
      <div className="shrink-0 flex items-center gap-2 text-right">
        <span className={`text-[11px] font-black tabular-nums ${selected ? "text-rose-300" : "text-on-surface-variant"}`}>
          {player.skill ?? "—"}
        </span>
        <span className="text-[9px] text-cyan-400/60 tabular-nums">
          🛡️{player.resistance ?? "–"}
        </span>
        <FormBadge form={player.form} />
      </div>
    </motion.button>
  );
}

function BenchPlayerCard({
  player, i, shouldReduceMotion, selectedInId, subbedOut,
  isHalftime, subsMade, forceOutPlayer, onPickIn,
}) {
  const alreadyUsed = isHalftime && subbedOut.includes(player.id);
  const positionMismatch = !!forceOutPlayer && (forceOutPlayer.position === "GR") !== (player.position === "GR");
  const disabled = alreadyUsed || positionMismatch || (isHalftime && subsMade >= MAX_MATCH_SUBS);
  const selected = selectedInId === player.id;
  const s = getPosStyle(player.position);

  return (
    <motion.button
      key={player.id}
      onClick={() => !disabled && onPickIn()}
      initial={shouldReduceMotion ? false : { opacity: 0, x: 10, filter: "blur(2px)" }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0, filter: "blur(0px)" }}
      transition={shouldReduceMotion ? undefined : { duration: 0.2, delay: Math.min(i, 6) * 0.02 }}
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${selected ? "border-emerald-400/60 bg-emerald-500/10" : s.glow} shadow-sm shadow-black/30 w-full text-left select-none ${
        alreadyUsed
          ? "opacity-25 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
          : disabled
            ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
            : "cursor-pointer"
      }`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${alreadyUsed ? "from-outline-variant/40 via-outline-variant/60 to-outline-variant/40" : s.bar}`} />
      <span className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${
        alreadyUsed
          ? "border-outline-variant/15 bg-surface-container/20 text-on-surface-variant/40"
          : selected
            ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
            : s.badgeBg + " " + s.badgeText + " " + s.badgeBorder
      }`}>
        {POSITION_SHORT_LABELS[player.position]}
      </span>
      <span className={`flex-1 truncate text-[11px] font-black ${
        alreadyUsed
          ? "text-on-surface-variant/60"
          : selected
            ? "text-emerald-100"
            : "text-on-surface"
      }`}>
        {player.name}
        {!alreadyUsed && !!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className="ml-0.5 text-amber-400 font-black">*</span>
        )}
      </span>
      <div className="shrink-0 flex items-center gap-2">
        <span className={`text-[11px] font-black tabular-nums ${selected ? "text-emerald-300" : "text-on-surface-variant/80"}`}>
          {alreadyUsed ? "—" : (player.skill ?? "—")}
        </span>
        {!alreadyUsed && player.resistance != null && (
          <span className="text-[9px] text-cyan-400/60 tabular-nums">
            🛡️{player.resistance}
          </span>
        )}
        {!alreadyUsed && <FormBadge form={player.form} />}
      </div>
    </motion.button>
  );
}

function BottomBar({ effectiveOutId, selectedInId, playerById, isHalftime, isPenalty, canConfirmSwap, onResetSub, onConfirmSub, onResolveAction }) {
  return (
    <div className="shrink-0 border-t border-outline/40 bg-surface-container-high px-5 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-on-surface-variant/60 shrink-0 font-black uppercase tracking-wide">Sai</span>
          <span className="bg-rose-950/80 text-rose-200 border border-rose-800/50 text-[10px] font-black px-2.5 py-1 rounded-lg truncate max-w-[35%]">
            {effectiveOutId ? playerById(effectiveOutId)?.name || "?" : "—"}
          </span>
          {!isPenalty && (
            <>
              <span className="text-on-surface-variant/80 shrink-0 font-black text-sm">→</span>
              <span className="text-[10px] text-on-surface-variant/60 shrink-0 font-black uppercase tracking-wide">Entra</span>
              <span className="bg-emerald-950/80 text-emerald-200 border border-emerald-800/50 text-[10px] font-black px-2.5 py-1 rounded-lg truncate max-w-[35%]">
                {selectedInId ? playerById(selectedInId)?.name || "?" : "—"}
              </span>
            </>
          )}
        </div>

        {isHalftime ? (
          <>
            <button
              onClick={onResetSub}
              className="shrink-0 w-7 h-7 rounded-lg bg-surface-container-high/80 hover:bg-surface-container-high text-on-surface-variant/80 hover:text-on-surface text-xs flex items-center justify-center transition-colors border border-outline/40"
            >
              ✕
            </button>
            <button
              onClick={onConfirmSub}
              disabled={!canConfirmSwap}
              className={`shrink-0 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${
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
            className="shrink-0 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-primary/90 hover:brightness-110 text-on-primary disabled:opacity-50 disabled:cursor-not-allowed border border-primary/40 shadow-[0_0_16px_rgba(99,102,241,0.2)]"
          >
            Substituir
          </button>
        )}
      </div>
    </div>
  );
}

function FormBadge({ form }) {
  const f = form ?? 100;
  return (
    <span className={`text-[10px] font-black ${f >= 115 ? "text-emerald-400" : f <= 85 ? "text-rose-400" : "text-on-surface-variant"}`}>
      {f >= 115 ? "💪" : f <= 85 ? "😩" : "👍"}
    </span>
  );
}
