import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { getPosStyle } from "../matchConstants.js";

/**
 * Match player card — compact on desktop (hover to expand), always expanded on mobile.
 *
 * Desktop compact: [bar] [POS] Nome ★           42 ↔
 * Desktop hover:   [bar] [POS] Nome ★   42 │ RES 4 │ 💪 ↔
 * Mobile (always): [bar] [POS] Nome ★   42 │ RES 4 │ 💪 ↔
 *
 * Uses CSS-only responsive visibility: no React state needed.
 */
export function MatchPlayerCard({
  player,
  posStyle,
  selected = false,
  disabled = false,
  selectable = true,
  onPick,
  title,
  swapIndicator = false,
}) {
  const s = posStyle || getPosStyle(player.position);

  const resistance = player.resistance ?? 0;
  const form = player.form ?? 100;
  const hasStar = !!player.is_star && (player.position === "MED" || player.position === "ATA");

  const resColor =
    resistance >= 4 ? "text-green-400" : resistance >= 3 ? "text-yellow-400" : "text-red-400";
  const formEmoji = form >= 115 ? "💪" : form <= 85 ? "😩" : "👍";
  const formColor =
    form >= 115 ? "text-emerald-400" : form <= 85 ? "text-rose-400" : "text-on-surface-variant";

  const skillColor = selected ? "text-rose-300" : "text-on-surface-variant/80";

  return (
    <button
      onClick={() => selectable && !disabled && onPick?.()}
      title={title}
      className={`relative group flex items-stretch rounded-md overflow-hidden border transition-all duration-200 select-none w-full text-left ${
        selected
          ? "border-rose-400/60 bg-rose-500/10"
          : disabled
            ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
            : `cursor-pointer border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 hover:-translate-y-px hover:shadow-lg ${s.glow} shadow-sm shadow-black/30`
      }`}
    >
      {/* Position accent bar */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${selected ? "from-rose-300 via-rose-400 to-rose-600" : s.bar}`} />

      {/* Position badge */}
      <span
        className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${
          selected
            ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
            : `${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`
        } ${disabled ? "opacity-40" : ""}`}
      >
        {POSITION_SHORT_LABELS[player.position] || "?"}
      </span>

      {/* Name */}
      <span
        className={`flex-1 truncate text-[11px] font-black ${
          selected ? "text-rose-100" : disabled ? "text-on-surface-variant/60" : "text-on-surface"
        }`}
      >
        {player.name}
        {hasStar && !disabled && <span className="ml-0.5 text-amber-400 font-black">*</span>}
      </span>

      {/* ── Compact: skill only (desktop, no hover) ── */}
      <span className={`shrink-0 text-[11px] font-black tabular-nums mr-2 ${skillColor} hidden md:inline-block md:group-hover:hidden`}>
        {player.skill ?? "—"}
      </span>

      {/* ── Expanded: skill + RES + form (mobile always, desktop on hover) ── */}
      <div className={`shrink-0 flex items-center gap-1.5 mr-2 flex md:hidden md:group-hover:flex`}>
        <span className={`text-[11px] font-black tabular-nums ${skillColor}`}>
          {player.skill ?? "—"}
        </span>
        <div className="w-px h-5 bg-outline-variant/25" />
        <div className="flex flex-col items-end gap-0 leading-none">
          <span className="text-[7px] uppercase tracking-widest text-on-surface-variant/60 font-black">
            RES
          </span>
          <span className={`text-[12px] font-black tabular-nums ${resColor}`}>
            {player.resistance ?? "–"}
          </span>
        </div>
        <div className="w-px h-5 bg-outline-variant/25" />
        <span className={`text-[12px] ${formColor}`}>{formEmoji}</span>
      </div>

      {/* Swap indicator (halftime mode) */}
      {swapIndicator && !disabled && (
        <span
          className={`shrink-0 text-sm transition-colors mr-1 ${
            selected ? "text-rose-400" : "text-on-surface-variant/80 group-hover:text-emerald-400"
          }`}
        >
          ↔
        </span>
      )}
    </button>
  );
}