import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { POSITION_FULL_LABELS } from "../matchConstants.js";
import { FatigueIndicator } from "./FatigueIndicator.jsx";

/* ── Bench player card ──────────────────────────────────────────────────
 * Passive display card (a <div>, not a <button>). No hover elevation so
 * users don'texpect a click that does nothing. */
export function BenchPlayerCard({ player, posStyle, showSkill = true, showStar = true }) {
  const s = posStyle || {};
  return (
    <div
      className={`relative group flex items-stretch rounded-md overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 shadow-sm shadow-black/30`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${s.bar}`} />
      <div className="flex items-center gap-2 flex-1 py-2 px-3">
        <span
          title={POSITION_FULL_LABELS[player.position]}
          className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${s.badgeBg || ""} ${s.badgeText || ""} ${s.badgeBorder || ""}`}
        >
          {POSITION_SHORT_LABELS[player.position] || "?"}
        </span>
        <span className="flex flex-1 min-w-0 flex-col justify-center gap-0.5">
          <span className="truncate text-xs font-semibold text-on-surface">
            {player.name}
            {showStar && !!player.is_star && (player.position === "MED" || player.position === "ATA") && (
              <span className="ml-0.5 text-amber-400" title="Craque" aria-label="Craque">★</span>
            )}
          </span>
          <FatigueIndicator player={player} compact />
        </span>
        {showSkill && (
          <span className="text-[10px] font-semibold tabular-nums text-on-surface-variant/80 shrink-0">
            {player.skill ?? "—"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Bench list ───────────────────────────────────────────────────────── */
export function BenchPlayers({ players, posStyleFn, showSkill, showStar }) {
  if (!players || players.length === 0) {
    return (
      <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6 px-2">
        Sem suplentes disponíveis
      </p>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto space-y-1.5">
      {players.map((player) => (
        <BenchPlayerCard
          key={player.id ?? player.name}
          player={player}
          posStyle={posStyleFn?.(player.position)}
          showSkill={showSkill}
          showStar={showStar}
        />
      ))}
    </div>
  );
}
