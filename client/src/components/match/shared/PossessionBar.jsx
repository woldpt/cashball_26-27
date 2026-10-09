/* ── Possession bar ─────────────────────────────────────────────────────── */
/**
 * Barra de posse; com `shots` mostra também remates e golos esperados.
 * @param {Object} props
 * @param {number} props.homePossession
 * @param {number} props.awayPossession
 * @param {string} [props.homeColor]
 * @param {string} [props.awayColor]
 * @param {boolean} [props.compact]
 * @param {{home: {shots: number, xg: number}, away: {shots: number, xg: number}}} [props.shots] - de buildShotStats.
 * @returns {JSX.Element | null}
 */
export function PossessionBar({ homePossession, awayPossession, homeColor, awayColor, compact = false, shots }) {
  if (homePossession == null) return null;
  const title = compact ? "Posse" : "Posse de Bola";
  const heightClass = compact ? "h-1.5" : "h-2";
  const paddingClass = compact ? "px-3 py-2" : "px-5 py-4";

  return (
    <div className="rounded-md overflow-hidden border border-outline-variant/25 bg-surface-container">
      <div className={`flex items-center justify-between ${paddingClass} bg-surface-container-high/50`}>
        <span className={`text-on-surface tabular-nums font-bold ${compact ? "text-[10px]" : "text-sm"}`}>
          {homePossession}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          {title}
        </span>
        <span className={`text-on-surface tabular-nums font-bold ${compact ? "text-[10px]" : "text-sm"}`}>
          {awayPossession}%
        </span>
      </div>
      {/* Consistent padding on all four sides — old `pt-0` trick removed. */}
      <div className={compact ? "mx-3 mb-2" : "p-3 md:p-4"}>
        <div className={`${heightClass} rounded-full overflow-hidden bg-surface-container-high/80 flex`}>
          {/* Inner segments inherit rounding from parent — no redundant rounded-l/r-full. */}
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${homePossession}%`,
              background: `linear-gradient(90deg, ${homeColor || "#6366f1"}, ${homeColor || "#6366f1"}cc)`,
              boxShadow: `0 0 12px ${homeColor || "#6366f1"}44`,
              // Separador fino: quando as duas equipas têm a mesma cor,
              // a divisão da posse continuava visível.
              borderRight: "2px solid rgba(255,255,255,0.7)",
            }}
          />
          <div
            className="h-full flex-1 transition-all duration-700 ease-out"
            style={{
              background: `linear-gradient(90deg, ${awayColor || "#f43f5e"}cc, ${awayColor || "#f43f5e"})`,
              boxShadow: `0 0 12px ${awayColor || "#f43f5e"}44`,
            }}
          />
        </div>
      </div>
      {shots && (
        <div className={`${compact ? "px-3 pb-2" : "px-5 pb-4"} space-y-1.5`}>
          {[
            ["Remates", shots.home.shots, shots.away.shots],
            ["Golos esperados", shots.home.xg.toFixed(2).replace(".", ","), shots.away.xg.toFixed(2).replace(".", ",")],
          ].map(([label, h, a]) => (
            <div key={label} className="flex items-center justify-between">
              <span className={`text-on-surface tabular-nums font-bold ${compact ? "text-[10px]" : "text-sm"}`}>{h}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{label}</span>
              <span className={`text-on-surface tabular-nums font-bold ${compact ? "text-[10px]" : "text-sm"}`}>{a}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
