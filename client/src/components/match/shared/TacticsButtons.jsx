/* ── Mentality / Tactics buttons (halftime) ───────────────────────────── */
const TACTIC_OPTIONS = [
  { value: "Defensive", label: "Defensivo", accent: "#3b82f6" },
  { value: "Balanced", label: "Equilibrado", accent: "#6366f1" },
  { value: "Offensive", label: "Ofensivo", accent: "#f59e0b" },
];

export function TacticsButtons({ value, onChange, className }) {
  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className || ""}`}>
      {TACTIC_OPTIONS.map(({ value: optValue, label, accent }) => (
        <button
          key={optValue}
          onClick={() => onChange({ style: optValue })}
          className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${
            value === optValue
              ? "text-on-surface shadow-[0_0_20px_rgba(99,102,241,0.15)]"
              : "bg-surface-container-low/60 border-outline/40 text-on-surface-variant/80 hover:border-outline hover:text-on-surface-variant"
          }`}
          style={value === optValue ? {
            background: `${accent}25`,
            borderColor: `${accent}40`,
            boxShadow: `0 0 20px ${accent}25`,
          } : {}}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
