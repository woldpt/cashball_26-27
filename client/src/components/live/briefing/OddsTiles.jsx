import { memo } from "react";

/**
 * Tiles do mercado 1X2 — mesma fonte do servidor usada nas apostas em jogo.
 * @param {{ odds: { list: Array<Object> } }} props
 * @returns {JSX.Element}
 */
export const OddsTiles = memo(function OddsTiles({ odds }) {
  return (
    <div className="flex w-full min-w-0 gap-1">
      {odds.list.map((o) => (
        <div
          key={o.key}
          className={`flex-1 rounded-md px-1 py-1 flex flex-col items-center gap-0.5 min-w-0 border ${
            o.key === "home"
              ? "bg-sky-500/10 border-sky-400/20"
              : o.key === "away"
                ? "bg-amber-500/10 border-amber-400/20"
                : "bg-gray-700/20 border-outline-variant/15"
          } ${o.isFavorite ? "ring-1 ring-amber-300/60" : ""}`}
          title={o.isFavorite ? "Favorito" : o.label}
        >
          <span className="text-[8px] text-gray-600 font-black uppercase truncate max-w-full">
            {o.label}
          </span>
          <span
            className={`text-[12px] font-black tabular-nums ${
              o.key === "home"
                ? "text-sky-400"
                : o.key === "away"
                  ? "text-amber-400"
                  : "text-gray-300"
            }`}
          >
            {o.display}
          </span>
          {o.prob != null && (
            <span className="text-[8px] font-black tabular-nums text-gray-500">
              {o.prob}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
});
