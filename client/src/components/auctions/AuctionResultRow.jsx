import { formatCurrency } from "../../utils/formatters.js";
import {
  POSITION_ACCENT_HEX,
  POSITION_BAR_CLASS,
} from "../../constants/index.js";
import { hexToRgba } from "../../utils/colorHelpers.js";
import { StarMark } from "../shared/PlayerStatusBadges.jsx";

/**
 * AuctionResultRow — linha compacta de um leilão encerrado.
 *
 * Faixa da posição à esquerda, nome + desfecho no meio, valor final à
 * direita. Sem cards: os Recentes são leitura rápida, não ação.
 *
 * @param {{ auction: object }} props
 */
export function AuctionResultRow({ auction }) {
  const posHex = POSITION_ACCENT_HEX[auction.position] || "#94a3b8";
  const sold = !!auction.result?.sold;

  return (
    <div className="relative flex items-center gap-2.5 rounded-lg overflow-hidden border border-outline-variant/15 bg-surface-container/60 pl-3 pr-3 py-2">
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${POSITION_BAR_CLASS[auction.position] || "from-zinc-400 via-zinc-500 to-zinc-600"}`}
      />
      <span
        className="shrink-0 text-[9px] font-black uppercase tracking-widest tabular-nums"
        style={{ color: posHex }}
      >
        {auction.position}
      </span>
      <span
        className="shrink-0 w-1.5 h-1.5 rounded-full"
        style={{ background: sold ? "#34d399" : "#52525b", boxShadow: sold ? `0 0 8px ${hexToRgba("#34d399", 0.8)}` : "none" }}
        title={sold ? "Vendido" : "Sem lances"}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-on-surface leading-tight truncate">
          {auction.name}
          {!!auction.is_star && (auction.position === "MED" || auction.position === "ATA") && (
            <StarMark />
          )}
        </p>
        <p className="text-[9px] text-zinc-500 truncate">
          {sold ? `Vendido a ${auction.result.buyerTeamName}` : "Sem licitações"}
        </p>
      </div>
      <p className={`shrink-0 font-mono font-black tabular-nums text-sm ${sold ? "text-emerald-400" : "text-zinc-600"}`}>
        {sold ? formatCurrency(auction.result.finalBid) : "—"}
      </p>
    </div>
  );
}
