import { memo } from "react";

/* Visual por atmosfera — a barra acompanha o rótulo (morgue = fria). */
const ATMOSPHERE_STYLES = {
  volcano: { label: "Vulcão", icon: "🌋", bar: "from-emerald-400 to-emerald-600", text: "text-tertiary" },
  loud: { label: "Grande ambiente", icon: "📣", bar: "from-sky-400 to-sky-600", text: "text-primary" },
  mild: { label: "Ambiente morno", icon: "📣", bar: "from-gray-500 to-gray-600", text: "text-gray-400" },
  morgue: { label: "Morgue", icon: "🥶", bar: "from-red-500 to-red-700", text: "text-red-400" },
};

/**
 * Estádio e ambiente — lotação esperada, receita e ambiente (jogos em
 * casa). O ambiente reflete ocupação: vulcão (≥90%) dá bónus em campo,
 * morgue (<40%) encolhe a equipa. Os motivos explicam o porquê.
 * @param {{ stadium: { att: number, cap: number, fill: number, revenue: number, reasons: string[], atmosphereKey: string } }} props
 * @returns {JSX.Element}
 */
export const StadiumCard = memo(function StadiumCard({ stadium }) {
  const { att, cap, fill, revenue, reasons, atmosphereKey } = stadium;
  const atmosphere = ATMOSPHERE_STYLES[atmosphereKey] ?? ATMOSPHERE_STYLES.mild;
  return (
    <div className="min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl px-3.5 short:px-3 py-2 short:py-1.5 lg:flex-none lg:flex lg:flex-col lg:justify-center">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-widest text-gray-600 font-black">
          <span aria-hidden>🏟️</span> Estádio
        </span>
        <span className="text-right leading-none">
          <span className="block text-[8px] uppercase tracking-widest text-gray-600 font-black">
            Receita
          </span>
          <span className="text-[9px] font-black text-green-400 tabular-nums">
            +{revenue.toLocaleString("pt-PT")}€
          </span>
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-base lg:text-lg font-black text-white tabular-nums leading-none">
          {att.toLocaleString("pt-PT")}
        </span>
        <span className="text-[8px] text-gray-600 font-bold uppercase">
          espectadores
        </span>
        <span className="ml-auto text-[8px] text-gray-600 tabular-nums">
          Cap. {cap.toLocaleString("pt-PT")}
        </span>
      </div>
      <div
        className="mt-1 h-1 bg-black/40 rounded-full overflow-hidden"
        role="progressbar"
        aria-label={`Ocupação do estádio: ${fill}%`}
        aria-valuenow={fill}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          aria-hidden
          className={`h-full rounded-full bg-gradient-to-r ${atmosphere.bar}`}
          style={{ width: `${fill}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={`text-[8px] font-black uppercase tracking-widest ${atmosphere.text}`}>
          <span aria-hidden>{atmosphere.icon}</span> {atmosphere.label}
        </span>
        {reasons.length > 0 && (
          <span className="text-[8px] text-gray-500 font-bold truncate">
            {reasons.join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
});
