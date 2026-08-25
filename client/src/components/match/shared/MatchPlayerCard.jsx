import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { POSITION_FULL_LABELS, getPosStyle } from "../matchConstants.js";
import { FatigueIndicator } from "./FatigueIndicator.jsx";
import { MatchIcon } from "./MatchIcon.jsx";

/**
 * Match player card — always expanded (skill + fatigue + RES + form).
 *
 * Layout: [bar] [POS] Nome ★  [fatigue] [skill+glow] │ RES [cyan] │ <emoji form> [swap-icon]
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
  showFatigue = true,
  showMatchStats = false,
  goals = 0,
  yellowCards = 0,
  forcedOut = false,
  draggable = false,
  dragOver = false,
  onDragStart,
  onDragOver,
  onDragDrop,
  onDragEnd,
}) {
  const s = posStyle || getPosStyle(player.position);

  const form = player.form ?? 100;
  const hasStar = !!player.is_star && (player.position === "MED" || player.position === "ATA");

  // Skill color: position-colored (matches PlayersTab/TeamSquadCard which use
  // POSITION_TEXT_CLASS). Selected state falls back to white — rose
  // was confused with ATA (avançado) accent colors.
  const skillColor = selected ? "text-white" : s.badgeText;

  // Form: always render the full 💪/👍/😩 triplet. Hiding the neutral 👍
  // (86–114) made rows with/without a form icon have different widths,
  // shifting the skill/RES columns and misaligning the card list.
  const formIcon = form >= 115 ? "💪" : form <= 85 ? "😩" : "👍";
  const formColor =
    form >= 115 ? "text-emerald-400" : form <= 85 ? "text-rose-400" : "text-on-surface-variant";
  const matchStatsLabel = [
    goals > 0 ? `${goals} golo${goals > 1 ? "s" : ""}` : null,
    yellowCards > 0 ? `${yellowCards} cartão amarelo${yellowCards > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Single visual signal in the selected state: white tint. The position
  // bgGrad gradient is suppressed so only one color system dominates.
  const cardBg = forcedOut
    ? "border-red-500/70 ring-2 ring-red-500/40 bg-red-500/10 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
    : selected
      ? "border-white/60 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.15)]"
      : disabled
        ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
        : `cursor-pointer border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 hover:-translate-y-px hover:shadow-lg ${s.glow} shadow-sm shadow-black/30`;

  return (
    <button
      onClick={() => selectable && !disabled && onPick?.()}
      title={title}
      draggable={draggable && !disabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDragDrop}
      onDragEnd={onDragEnd}
      className={`relative group flex items-stretch rounded-md overflow-hidden border transition-all duration-200 select-none w-full text-left ${cardBg} ${
        dragOver
          ? "ring-2 ring-emerald-400/70 border-emerald-400/70 shadow-[0_0_16px_rgba(52,211,153,0.35)]"
          : ""
      }`}
    >
      {/* Forced swap label */}
      {forcedOut && (
        <span className="absolute top-0 right-0 px-1.5 py-px bg-red-500/90 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-md">
          Obrigatório
        </span>
      )}
      {/* Position accent bar */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${selected ? "from-white via-white to-white/60" : s.bar}`} />

      {/* Position badge */}
      <span
        title={POSITION_FULL_LABELS[player.position]}
        className={`shrink-0 px-2 py-0.5 self-center ml-2 rounded text-[10px] font-bold uppercase tracking-widest border ${
          selected
            ? "bg-white/20 text-white border-white/40"
            : `${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`
        } ${disabled ? "opacity-40" : ""}`}
      >
        {POSITION_SHORT_LABELS[player.position] || "?"}
      </span>

      {/* Name + match-only fatigue */}
      <span className="flex flex-1 min-w-0 flex-col justify-center ml-2 gap-0.5">
        <span
          className={`truncate text-xs font-semibold ${
            selected ? "text-white" : disabled ? "text-on-surface-variant/60" : "text-on-surface"
          }`}
        >
          {player.name}
          {hasStar && !disabled && (
            <span className="ml-0.5 text-amber-400" title="Craque" aria-label="Craque">★</span>
          )}
        </span>
        {showMatchStats && (goals > 0 || yellowCards > 0) && (
          <span
            className="flex items-center gap-1 text-[11px] leading-none"
            title={matchStatsLabel}
            aria-label={matchStatsLabel}
          >
            {Array.from({ length: goals }).map((_, i) => (
              <span key={`goal-${i}`} aria-hidden="true">⚽</span>
            ))}
            {yellowCards > 0 && <span aria-hidden="true">🟨</span>}
          </span>
        )}
        {showFatigue && <FatigueIndicator player={player} compact />}
      </span>

      {/* ── Expanded: skill + RES + form (always rendered) ── */}
      {/* Inner items-end: skill digit and RES value share one baseline
       * (was: skill centered against the whole RES label+value column). */}
      <div className="shrink-0 flex items-center mr-2">
        <div className="flex items-end gap-2">
          <span
            className={`text-lg font-black font-headline tabular-nums leading-none ${skillColor}`}
            style={{ textShadow: "0 0 10px currentColor" }}
          >
            {player.skill ?? "—"}
          </span>
          <div className="self-stretch w-px bg-outline-variant/25" />
          <div className="flex flex-col items-end leading-none">
            <span className="mb-0.5 text-[8px] uppercase tracking-widest text-on-surface-variant/40 font-semibold">
              RES
            </span>
            <span className="text-xs font-black tabular-nums text-cyan-400 leading-none">
              {player.resistance ?? "–"}
            </span>
          </div>
          <div className="self-stretch w-px bg-outline-variant/25" />
          <span className={`text-sm leading-none ${formColor}`}>{formIcon}</span>
        </div>
      </div>

      {/* Swap affordance (halftime mode). Moved to the right end but
       * rendered as a real SVG swap icon (was `↔` glyph) at a visible
       * size; on hover the icon shifts to emerald to signal selection. */}
      {swapIndicator && !disabled && (
        <span
          className={`shrink-0 mr-2 flex items-center transition-colors ${
            selected ? "text-white" : "text-on-surface-variant/60 group-hover:text-emerald-400"
          }`}
          aria-label="Disponível para substituição"
        >
          <MatchIcon name="swap" className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
