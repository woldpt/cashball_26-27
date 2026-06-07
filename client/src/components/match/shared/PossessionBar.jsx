/* ── Possession bar ─────────────────────────────────────────────────────── */
export function PossessionBar({ homePossession, awayPossession, homeColor, awayColor, compact = false }) {
  if (homePossession == null) return null;
  const title = compact ? "Posse" : "Posse de Bola";
  const heightClass = compact ? "h-1.5" : "h-2";
  const paddingClass = compact ? "px-3 py-2" : "px-5 py-4";

  return (
    <div className="rounded-md overflow-hidden border border-outline-variant/25 bg-surface-container">
      <div className={`flex items-center justify-between ${paddingClass} bg-surface-container-high/50`}>
        <span className={`text-on-surface tabular-nums font-black ${compact ? "text-[10px]" : "text-sm font-headline tracking-tight"}`}>
          {homePossession}%
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          {title}
        </span>
        <span className={`text-on-surface tabular-nums font-black ${compact ? "text-[10px]" : "text-sm font-headline tracking-tight"}`}>
          {awayPossession}%
        </span>
      </div>
      <div className={`${compact ? "mx-3 mb-2" : "p-3 md:p-4 pt-0"}`}>
        <div className={`${heightClass} rounded-full overflow-hidden bg-surface-container-high/80 flex`}>
          <div
            className="h-full rounded-l-full transition-all duration-700 ease-out"
            style={{
              width: `${homePossession}%`,
              background: `linear-gradient(90deg, ${homeColor || "#6366f1"}, ${homeColor || "#6366f1"}cc)`,
              boxShadow: `0 0 12px ${homeColor || "#6366f1"}44`,
            }}
          />
          <div
            className="h-full flex-1 rounded-r-full transition-all duration-700 ease-out"
            style={{
              background: `linear-gradient(90deg, ${awayColor || "#f43f5e"}cc, ${awayColor || "#f43f5e"})`,
              boxShadow: `0 0 12px ${awayColor || "#f43f5e"}44`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
