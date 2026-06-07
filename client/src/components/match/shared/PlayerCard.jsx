import { POSITION_SHORT_LABELS } from "../../../constants/index.js";

/* ── Form badge (inline) ──────────────────────────────────────────────── */
function InlineFormBadge({ form }) {
  const f = form ?? 100;
  return (
    <span className={`text-[10px] font-black ${f >= 115 ? "text-emerald-400" : f <= 85 ? "text-rose-400" : "text-on-surface-variant"}`}>
      {f >= 115 ? "💪" : f <= 85 ? "😩" : "👍"}
    </span>
  );
}

/* ── Simple stats row (TabIntervencao style) ──────────────────────────── */
function SimpleStats({ player, selected, swapIndicator, onSwapClick }) {
  return (
    <div className="shrink-0 flex items-center gap-2 text-right">
      <span className={`text-[11px] font-black tabular-nums ${selected ? "text-rose-300" : "text-on-surface-variant"}`}>
        {player.skill ?? "—"}
      </span>
      <span className="text-[9px] text-cyan-400/60 tabular-nums">
        🛡️{player.resistance ?? "–"}
      </span>
      <InlineFormBadge form={player.form} />
      {swapIndicator && (
        <button
          onClick={onSwapClick}
          className={`text-sm shrink-0 transition-colors ml-1 ${
            selected
              ? "text-rose-400"
              : "text-on-surface-variant/80 group-hover:text-emerald-400"
          }`}
        >
          ↔
        </button>
      )}
    </div>
  );
}

/* ── Detailed stats columns (MatchIntervencaoView style) ──────────────── */
function DetailedStats({ player }) {
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
      {/* Resistência */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[8px] uppercase tracking-widest text-on-surface-variant/80 font-black leading-none">RES</span>
        <span className={`text-[14px] font-black tabular-nums leading-none ${resColor}`}>
          {player.resistance ?? "–"}
        </span>
      </div>
      <div className="w-px h-6 bg-outline-variant/25" />
      {/* Forma */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[8px] uppercase tracking-widest text-on-surface-variant/80 font-black leading-none">FORMA</span>
        <span className="text-[14px] leading-none">{form >= 115 ? "💪" : form <= 85 ? "😩" : "👍"}</span>
      </div>
      <div className="w-px h-6 bg-outline-variant/25" />
      {/* Qualidade */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black leading-none">Qualidade</span>
        <span
          className={`text-[16px] font-black tabular-nums leading-none px-2.5 py-1 rounded-lg border ${skillColor}`}
          style={{ textShadow }}
        >
          {player.skill ?? "–"}
        </span>
      </div>
    </div>
  );
}

/* ── Main PlayerCard ──────────────────────────────────────────────────── */
export function PlayerCard({
  player,
  posStyle,
  selected,
  disabled,
  showStar = true,
  statsMode = "simple", // "simple" | "detailed"
  swapIndicator = false,
  onSwapClick,
}) {
  const s = posStyle || {};

  return (
    <button
      className={`relative group flex items-stretch rounded-md overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${s.glow || ""} shadow-sm shadow-black/30 w-full text-left select-none ${
        selected
          ? "border-rose-400/60 bg-rose-500/10"
          : disabled
            ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
            : "cursor-pointer"
      }`}
      onClick={onSwapClick}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${s.bar}`} />
      {/* Position badge */}
      <span
        className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${
          selected
            ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
            : s.badgeBg + " " + s.badgeText + " " + s.badgeBorder
        }`}
      >
        {POSITION_SHORT_LABELS[player.position]}
      </span>
      {/* Name */}
      <span
        className={`flex-1 truncate text-[12px] font-black ${selected ? "text-rose-100" : "text-on-surface"}`}
      >
        {player.name}
        {showStar && !!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className="ml-0.5 text-amber-400 font-black">*</span>
        )}
      </span>
      {/* Stats */}
      {statsMode === "detailed" ? (
        <DetailedStats player={player} />
      ) : (
        <SimpleStats
          player={player}
          selected={selected}
          swapIndicator={swapIndicator}
          onSwapClick={onSwapClick}
        />
      )}
    </button>
  );
}
