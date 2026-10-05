import { memo } from "react";

const PICK = { home: "1", draw: "X", away: "2" };

/**
 * Botões do mercado 1X2 em estilo casa de apostas — mesma fonte do servidor
 * usada nas apostas em jogo.
 * @param {{ odds: { list: Array<Object> } }} props
 * @returns {JSX.Element}
 */
export const OddsTiles = memo(function OddsTiles({ odds }) {
  const home = odds.list.find((o) => o.key === "home")?.label;
  const away = odds.list.find((o) => o.key === "away")?.label;
  return (
    <div className="w-full min-w-0 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <span className="text-[11px] font-black text-on-surface truncate">
          {home} <span className="text-gray-500 font-bold">vs</span> {away}
        </span>
        <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 shrink-0">
          Resultado final
        </span>
      </div>
      <div className="grid w-full min-w-0 grid-cols-3 gap-1.5">
        {odds.list.map((o) => (
          <div
            key={o.key}
            className={`min-w-0 rounded-md border px-2 py-1.5 flex items-center justify-between gap-1 ${
              o.isFavorite
                ? "bg-primary/15 border-primary/40"
                : "bg-surface-container-highest/40 border-outline-variant/20"
            }`}
            title={`${o.label}${o.isFavorite ? " · favorito" : ""}`}
          >
            <span className="text-[11px] font-black text-gray-500">
              {PICK[o.key] ?? o.label}
            </span>
            <span
              className={`text-[13px] font-black tabular-nums ${
                o.isFavorite ? "text-primary" : "text-on-surface"
              }`}
            >
              {o.display}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
