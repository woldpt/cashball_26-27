import { memo } from "react";
import { Tile } from "./Tile.jsx";
import { OddsTiles } from "./OddsTiles.jsx";

/**
 * Mercado 1X2 do servidor + árbitro — fundo da 3ª coluna do briefing,
 * por baixo do estádio e das ameaças.
 * @param {{ odds: { list: Array<Object> }, referee?: { name: string }|null }} props
 * @returns {JSX.Element}
 */
export const MarketPanel = memo(function MarketPanel({ odds, referee }) {
  return (
    <>
      <Tile
        label={
          <span className="inline-flex items-center gap-1">
            Mercado 1X2
            <span
              className="normal-case font-bold text-gray-700 cursor-help"
              title="Calculadas pelo servidor — iguais às das apostas em jogo"
            >
              ⓘ
            </span>
          </span>
        }
      >
        <OddsTiles odds={odds} />
      </Tile>
      {referee && (
        <Tile label="Árbitro">
          <span className="text-[10px] font-bold text-gray-400 truncate block">
            {referee.name}
          </span>
        </Tile>
      )}
    </>
  );
});
