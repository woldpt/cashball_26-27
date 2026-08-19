const FATIGUE_BANDS = [
  {
    maxMinutes: 15,
    label: "Fresco",
    className: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  },
  {
    maxMinutes: 30,
    label: "Desgaste leve",
    className: "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
  },
  {
    maxMinutes: 45,
    label: "Desgaste",
    className: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  },
  {
    maxMinutes: 75,
    label: "Cansado",
    className: "text-orange-300 bg-orange-500/10 border-orange-500/25",
  },
  {
    maxMinutes: Infinity,
    label: "Muito cansado",
    className: "text-rose-300 bg-rose-500/10 border-rose-500/25",
  },
];

/** @param {number} minutes */
function getBand(minutes) {
  return FATIGUE_BANDS.find((band) => minutes < band.maxMinutes) || FATIGUE_BANDS[0];
}

/**
 * Shows match-only fatigue; absent when a player has no live match state.
 * @param {{ player?: { matchMinutes?: number, fatigueLoss?: number }, compact?: boolean, className?: string }} props
 */
export function FatigueIndicator({ player, compact = false, className = "" }) {
  const hasMatchState =
    player?.matchMinutes != null || player?.fatigueLoss != null;
  if (!hasMatchState) return null;

  const minutes = Math.max(0, Number(player.matchMinutes ?? 0));
  const fatigueLoss = Math.max(0, Number(player.fatigueLoss ?? 0));
  const band = getBand(minutes);
  const lossText = fatigueLoss > 0 ? ` -${fatigueLoss}` : "";

  return (
    <span
      className={`inline-flex w-fit items-center rounded border px-1 py-px text-[8px] font-black uppercase tracking-wide leading-none ${band.className} ${className}`}
      title={`${band.label}: ${minutes}' em campo${lossText ? ` · impacto ${lossText} skill` : ""}`}
      aria-label={`${band.label}, ${minutes} minutos jogados${lossText ? `, ${lossText} skill` : ""}`}
    >
      {compact ? band.label : `${band.label} · ${minutes}'`}
      {lossText}
    </span>
  );
}
