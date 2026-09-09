import { memo } from "react";

/**
 * Medidor de dificuldade estimada — 5 segmentos + rótulo.
 * @param {{ score?: number, label?: string }} props
 * @returns {JSX.Element}
 */
export const DifficultyGauge = memo(function DifficultyGauge({
  score = 50,
  label = "Equilibrado",
}) {
  const filled = Math.max(0, Math.min(5, Math.round(((score ?? 50) / 100) * 5)));
  const theme =
    score <= 40
      ? { seg: "bg-gradient-to-b from-green-300 to-green-500", text: "text-green-400" }
      : score <= 62
        ? { seg: "bg-gradient-to-b from-amber-200 to-amber-500", text: "text-amber-400" }
        : score <= 80
          ? { seg: "bg-gradient-to-b from-orange-400 to-red-500", text: "text-orange-400" }
          : { seg: "bg-gradient-to-b from-red-500 to-red-700", text: "text-red-400" };
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] uppercase tracking-widest text-gray-600 font-black">
          Dificuldade
        </span>
        <span className={`text-[9px] font-black uppercase ${theme.text}`}>
          {label}
        </span>
      </div>
      <div
        className="flex gap-1"
        role="progressbar"
        aria-label={`Dificuldade: ${label}`}
        aria-valuenow={Math.round(score ?? 50)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            aria-hidden
            className={`h-1.5 lg:h-2.5 flex-1 rounded-full transition-all duration-300 ${
              i <= filled ? theme.seg : "bg-gray-700/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
});
