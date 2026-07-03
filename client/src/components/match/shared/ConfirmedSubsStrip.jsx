import { MatchIcon } from "./MatchIcon.jsx";

/* ── Confirmed subs strip (halftime) ─────────────────────────────────────
 * Removes the `max-w-[80px]` cap on player names — names were truncated so
 * aggressively the strip failed at its primary job (identifying out/in
 * players). Names now share the row evenly via `flex-1 min-w-0 truncate`. */
export function ConfirmedSubsStrip({ subs, annotatedSquad, className }) {
  if (!subs || subs.length === 0) return null;

  return (
    <div className={`shrink-0 px-3 py-2 border-b border-cyan-900/40 bg-cyan-950/20 flex flex-wrap gap-2 ${className || ""}`}>
      {subs.map((sub) => {
        const outP = annotatedSquad?.find((p) => p.id === sub.out);
        const inP = annotatedSquad?.find((p) => p.id === sub.in);
        return (
          <div
            key={`${sub.out}-${sub.in}`}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold border border-cyan-800/40 bg-surface-container-high/80"
          >
            <MatchIcon name="swap" className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-rose-300 truncate flex-1 min-w-0 max-w-[140px]">
              {outP?.name ?? "?"}
            </span>
            <MatchIcon name="chevron-right" className="h-3 w-3 text-on-surface-variant/60 shrink-0" />
            <span className="text-emerald-300 truncate flex-1 min-w-0 max-w-[140px]">
              {inP?.name ?? "?"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
