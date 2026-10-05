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
      <Tile>
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
