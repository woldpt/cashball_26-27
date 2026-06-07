import { POSITION_SHORT_LABELS } from "../../../constants/index.js";

/* ── Bench player card ────────────────────────────────────────────────── */
export function BenchPlayerCard({ player, posStyle, showSkill = true, showStar = true }) {
  const s = posStyle || {};
  return (
    <div
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${s.glow || ""} shadow-sm shadow-black/30`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${s.bar}`} />
      <div className="flex items-center gap-2 flex-1 py-1.5 px-2.5">
        <span
          className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${s.badgeBg || ""} ${s.badgeText || ""} ${s.badgeBorder || ""}`}
        >
          {POSITION_SHORT_LABELS[player.position] || "?"}
        </span>
        <span className="flex-1 truncate text-[10px] font-black text-on-surface">
          {player.name}
          {showStar && !!player.is_star && (player.position === "MED" || player.position === "ATA") && (
            <span className="ml-0.5 text-amber-400 font-black">*</span>
          )}
        </span>
        {showSkill && (
          <span className="text-[9px] font-black tabular-nums text-on-surface-variant/80 shrink-0">
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
      <p className="text-center text-on-surface-variant/60 text-xs font-bold py-6 px-2">
        Sem suplentes disponíveis
      </p>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto space-y-1">
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
