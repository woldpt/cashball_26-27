/* ── TrendArrow — setinha de subida/descida na tabela ──────────────────── */

/**
 * @param {{ movement?: number }} props - >0 sobe, <0 desce, 0 sem mudança
 * @returns {JSX.Element}
 */
export function TrendArrow({ movement = 0 }) {
  if (movement > 0) {
    return (
      <span
        className="inline-flex items-center justify-center text-[10px] font-black leading-none text-emerald-400"
        title={`Subiu ${movement} pos${movement > 1 ? "ições" : "ição"}`}
      >
        ▲
      </span>
    );
  }
  if (movement < 0) {
    const down = -movement;
    return (
      <span
        className="inline-flex items-center justify-center text-[10px] font-black leading-none text-red-400"
        title={`Desceu ${down} pos${down > 1 ? "ições" : "ição"}`}
      >
        ▼
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-[10px] leading-none text-on-surface-variant/30">
      ·
    </span>
  );
}
