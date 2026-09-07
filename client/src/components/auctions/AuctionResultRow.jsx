import { formatCurrency } from "../../utils/formatters.js";
import {
  POSITION_ACCENT_HEX,
  POSITION_BAR_CLASS,
} from "../../constants/index.js";
import { hexToRgba } from "../../utils/colorHelpers.js";
import { StarMark } from "../shared/PlayerStatusBadges.jsx";

/**
 * TeamMark — mini-brasão (16px) da equipa de origem/destino.
 * Braço de queda: bloco de iniciais com as cores da equipa (padrão
 * AuctionCard, em escala compacta).
 *
 * @param {{ team: object | null, name: string }} props
 */
function TeamMark({ team, name }) {
  if (!team && !name) return null;
  const label = name || "—";
  if (team?.crest) {
    return (
      <img
        src={team.crest}
        alt={label}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
        className="w-4 h-4 object-contain bg-white rounded-sm p-px shrink-0 border border-outline-variant/20"
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="w-4 h-4 rounded-sm flex items-center justify-center overflow-hidden font-black text-[7px] leading-none shrink-0 border border-outline-variant/20"
      style={{
        backgroundColor: team?.color_primary || "#333",
        color: team?.color_secondary || "#fff",
      }}
      title={label}
    >
      {String(label).substring(0, 3).toUpperCase()}
    </span>
  );
}

/**
 * AuctionResultRow — linha compacta de um leilão encerrado.
 *
 * Faixa da posição à esquerda, nome (clicável — abre a página do jogador)
 * com origem → destino (brasão + nome: vendedor → comprador), valor final à
 * direita. Sem cards: os Recentes são leitura rápida, não ação.
 *
 * @param {{ auction: object, teams?: Array, onOpenPlayer?: (auction: object) => void }} props
 */
export function AuctionResultRow({ auction, teams = [], onOpenPlayer }) {
  const posHex = POSITION_ACCENT_HEX[auction.position] || "#94a3b8";
  const sold = !!auction.result?.sold;

  // Origem (vendedor): mesma regra do AuctionCard — resolve por teams,
  // fallback para team_name do snapshot do leilão; "ex-" em ex-clubes.
  const sellerTeam =
    (teams || []).find((t) => Number(t.id) === Number(auction.sellerTeamId)) || null;
  const originName = sellerTeam?.name || auction.team_name || "Sem clube";
  const originLabel = auction.isExClub ? `ex-${originName}` : originName;

  // Destino (comprador): só quando vendido — buyerTeamId vem do auctionClosed.
  const buyerName = sold ? auction.result.buyerTeamName : null;
  const buyerTeam = sold
    ? (teams || []).find((t) => Number(t.id) === Number(auction.result?.buyerTeamId)) || null
    : null;

  // IDs negativos (juniors efémeros) não têm página de jogador.
  const canOpen = auction.playerId != null && auction.playerId >= 0;
  const star =
    !!auction.is_star && (auction.position === "MED" || auction.position === "ATA") && <StarMark />;

  return (
    <div className="relative flex items-center gap-2.5 short:gap-1.5 rounded-lg overflow-hidden border border-outline-variant/15 bg-surface-container/60 pl-3 short:pl-2 pr-3 short:pr-2 py-2 short:py-1.5">
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
        {canOpen ? (
          <button
            type="button"
            onClick={() => onOpenPlayer?.(auction)}
            className="block w-full text-left bg-transparent cursor-pointer hover:underline underline-offset-2 text-sm short:text-xs font-bold text-on-surface leading-tight truncate"
            title="Ver página do jogador"
          >
            {auction.name}
            {star}
          </button>
        ) : (
          <p className="text-sm short:text-xs font-bold text-on-surface leading-tight truncate">
            {auction.name}
            {star}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-500 leading-tight min-w-0">
          <TeamMark team={sellerTeam} name={originName} />
          <span className="truncate" title={originLabel}>
            {originLabel}
          </span>
          {sold ? (
            <>
              <span className="shrink-0 text-zinc-600" aria-hidden="true">
                →
              </span>
              <TeamMark team={buyerTeam} name={buyerName} />
              <span className="truncate text-zinc-300 font-semibold" title={buyerName}>
                {buyerName}
              </span>
            </>
          ) : (
            <span className="shrink-0 text-zinc-600">· sem licitações</span>
          )}
        </p>
      </div>
      <p className={`shrink-0 font-mono font-black tabular-nums text-sm short:text-xs ${sold ? "text-emerald-400" : "text-zinc-600"}`}>
        {sold ? formatCurrency(auction.result.finalBid) : "—"}
      </p>
    </div>
  );
}
