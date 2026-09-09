import { memo } from "react";

/**
 * Chips de forma recente (V/E/D) de uma equipa.
 * @param {{ last5?: string }} props
 * @returns {JSX.Element}
 */
export const FormChips = memo(function FormChips({ last5 = "" }) {
  if (!last5)
    return <span className="text-[9px] text-gray-700 font-bold">—</span>;
  const results = last5.split("");
  return (
    <div
      className="flex gap-0.5 shrink-0"
      role="img"
      aria-label={`Forma recente: ${results.join(" ")}`}
    >
      {results.map((r, i) => (
        <span
          key={`form-${i}-${r}`}
          aria-hidden
          className={`w-3.5 h-3.5 rounded-sm text-[7px] font-black flex items-center justify-center ${
            r === "V"
              ? "bg-green-500/20 text-green-400"
              : r === "D"
                ? "bg-red-500/20 text-red-400"
                : "bg-gray-700/40 text-gray-500"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
});
