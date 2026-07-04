import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { POSITION_FULL_LABELS, getPosStyle } from "../matchConstants.js";
import { MatchIcon } from "./MatchIcon.jsx";

/**
 * Match player card — always expanded (skill + RES + form).
 *
 * Layout: [bar] [POS] Nome ★  42 │ RES 4 │ <form-icon> [swap-icon]
 *
 * Visual signals (was previously overlapping):
 *  - Default state: position gradient background + position-colored bar.
 *  - Selected state: rose tinting only (gradient is suppressed to avoid
 *    two competing color systems on the same row).
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

  // Form: keep the 💪/😩/👍 emoji triplet used elsewhere in the app
  // (TacticsView, PlayersTab, MarketTab, SquadCard, PlayerHistoryModal)
  // for visual consistency. Color carries the unambiguous signal.
  const formIcon = form >= 115 ? "💪" : form <= 85 ? "😩" : "👍";
  const formColor =
    form >= 115 ? "text-emerald-400" : form <= 85 ? "text-rose-400" : "text-on-surface-variant";

  const skillColor = selected ? "text-rose-300" : "text-on-surface-variant/80";

  // Single visual signal in the selected state: rose tint. The position
  // bgGrad gradient is suppressed so only one color system dominates.
  const cardBg = selected
    ? "border-rose-400/60 bg-rose-500/10"
    : disabled
      ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
      : `cursor-pointer border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 hover:-translate-y-px hover:shadow-lg ${s.glow} shadow-sm shadow-black/30`;

  return (
    <button
      onClick={() => selectable && !disabled && onPick?.()}
      title={title}
      className={`relative group flex items-stretch rounded-md overflow-hidden border transition-all duration-200 select-none w-full text-left ${cardBg}`}
    >
      {/* Position accent bar */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${selected ? "from-rose-300 via-rose-400 to-rose-600" : s.bar}`} />

      {/* Position badge */}
      <span
        title={POSITION_FULL_LABELS[player.position]}
        className={`shrink-0 px-2 py-0.5 self-center ml-2 rounded text-[10px] font-bold uppercase tracking-widest border ${
          selected
            ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
            : `${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`
        } ${disabled ? "opacity-40" : ""}`}
      >
        {POSITION_SHORT_LABELS[player.position] || "?"}
      </span>

      {/* Name */}
      <span
        className={`flex-1 truncate text-xs font-semibold ml-2 ${
          selected ? "text-rose-100" : disabled ? "text-on-surface-variant/60" : "text-on-surface"
        }`}
      >
        {player.name}
        {hasStar && !disabled && (
          <span className="ml-0.5 text-amber-400" title="Craque" aria-label="Craque">★</span>
        )}
      </span>

      {/* ── Expanded: skill + RES + form (always visible) ── */}
      <div className="shrink-0 flex items-center gap-2 mr-2">
        <span className={`text-xs font-bold tabular-nums ${skillColor}`}>
          {player.skill ?? "—"}
        </span>
        <div className="w-px h-5 bg-outline-variant/25" />
        <div className="flex flex-col items-end gap-0.5 leading-tight">
          <span className="text-[9px] uppercase tracking-widest text-on-surface-variant/60 font-semibold">
            RES
          </span>
          <span className={`text-xs font-bold tabular-nums ${resColor}`}>
            {player.resistance ?? "–"}
          </span>
        </div>
        <div className="w-px h-5 bg-outline-variant/25" />
        <span className={`text-sm leading-none ${formColor}`}>{formIcon}</span>
      </div>

      {/* Swap affordance (halftime mode). Moved to the right end but
       * rendered as a real SVG swap icon (was `↔` glyph) at a visible
       * size; on hover the icon shifts to emerald to signal selection. */}
      {swapIndicator && !disabled && (
        <span
          className={`shrink-0 mr-2 flex items-center transition-colors ${
            selected ? "text-rose-400" : "text-on-surface-variant/60 group-hover:text-emerald-400"
          }`}
          aria-label="Disponível para substituição"
        >
          <MatchIcon name="swap" className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
