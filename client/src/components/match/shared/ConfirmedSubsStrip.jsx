/* ── Confirmed subs strip (halftime) ───────────────────────────────────── */
export function ConfirmedSubsStrip({ subs, annotatedSquad, className }) {
  if (!subs || subs.length === 0) return null;

  return (
    <div className={`shrink-0 px-3 py-2 border-b border-cyan-900/40 bg-cyan-950/20 flex flex-wrap gap-1.5 ${className || ""}`}>
      {subs.map((sub) => {
        const outP = annotatedSquad?.find((p) => p.id === sub.out);
        const inP = annotatedSquad?.find((p) => p.id === sub.in);
        return (
          <div
            key={`${sub.out}-${sub.in}`}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border border-cyan-800/40 bg-surface-container-high/80"
          >
            <span className="text-cyan-400 shrink-0">🔄</span>
            <span className="text-rose-300 truncate max-w-[80px]">
              {outP?.name ?? "?"}
            </span>
            <span className="text-on-surface-variant/80 shrink-0">→</span>
            <span className="text-emerald-300 truncate max-w-[80px]">
              {inP?.name ?? "?"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
