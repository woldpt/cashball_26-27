import { AggBadge } from "../shared/AggBadge.jsx";
import { formatCurrency } from "../../utils/formatters.js";
import { FLAG_TO_COUNTRY } from "../../constants/index.js";

/**
 * @param {{
 *   selectedAuctionPlayer: object|null,
 *   isAuctionExpanded: boolean,
 *   setIsAuctionExpanded: function,
 *   auctionResult: object|null,
 *   myAuctionBid: number|null,
 *   auctionBid: string,
 *   setAuctionBid: function,
 *   closeAuctionBid: function,
 *   submitAuctionBid: function,
 *   teams: Array,
 *   me: object|null,
 *   teamInfo: object|null,
 * }} props
 */
export function AuctionNotification({
  selectedAuctionPlayer,
  isAuctionExpanded,
  setIsAuctionExpanded,
  auctionResult,
  myAuctionBid,
  auctionBid,
  setAuctionBid,
  closeAuctionBid,
  submitAuctionBid,
  teams,
  me,
  teamInfo,
}) {
  if (!selectedAuctionPlayer) return null;

  const sellerTeam = teams.find(
    (t) => t.id === selectedAuctionPlayer.sellerTeamId,
  );
  const startingPrice =
    selectedAuctionPlayer.startingPrice ||
    selectedAuctionPlayer.transfer_price ||
    0;
  const isSeller = selectedAuctionPlayer.sellerTeamId === me?.teamId;

  return (
    <div
      className="w-full border-b-2 border-amber-600 shadow-2xl overflow-hidden relative"
      style={{
        background:
          "linear-gradient(90deg, #fbbf24 0%, #fde68a 40%, #fbbf24 60%, #f59e0b 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s linear infinite",
      }}
    >
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      {/* ── Collapsed strip — always visible ── */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left relative z-10"
        onClick={() => setIsAuctionExpanded((v) => !v)}
      >
        <span className="text-xs font-black uppercase tracking-widest bg-blue-700 text-white px-2 py-0.5 rounded shrink-0 shadow-md animate-pulse">
          Leilão
        </span>
        <span className="font-black text-zinc-950 truncate drop-shadow-sm">
          {selectedAuctionPlayer.name}
        </span>
        <span className="text-xs text-zinc-700 shrink-0">
          {selectedAuctionPlayer.position} · {selectedAuctionPlayer.skill}
        </span>
        <span className="font-black text-zinc-950 text-sm shrink-0 ml-auto">
          {formatCurrency(startingPrice)}
        </span>
        {auctionResult ? (
          <span
            className="text-xs font-black px-2 py-0.5 rounded shrink-0 ml-auto"
            style={{
              background: auctionResult.sold ? "#16a34a" : "#7f1d1d",
              color: "#fff",
            }}
          >
            {auctionResult.sold
              ? `Vendido · ${auctionResult.buyerTeamName} · ${formatCurrency(auctionResult.finalBid)}`
              : "Sem licitações"}
          </span>
        ) : myAuctionBid != null ? (
          <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white shrink-0">
            Lance: {formatCurrency(myAuctionBid)}
          </span>
        ) : null}
        <span className="text-zinc-600 text-sm shrink-0 ml-1">
          {isAuctionExpanded ? "▲" : "▼"}
        </span>
        {!auctionResult && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeAuctionBid();
            }}
            className="text-zinc-600 hover:text-zinc-950 font-bold text-base leading-none px-1 shrink-0"
          >
            ✕
          </button>
        )}
      </button>

      {/* ── Expanded panel ── */}
      {isAuctionExpanded && (
        <div className="border-t border-amber-500">
          {/* Player card */}
          <div className="p-3 sm:p-5 space-y-3 text-zinc-950">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Equipa
                </span>
                <span
                  className="font-black px-2 py-0.5 rounded text-xs leading-tight uppercase"
                  style={{
                    background: sellerTeam?.color_primary || "#1e3a8a",
                    color: sellerTeam?.color_secondary || "#ffffff",
                  }}
                >
                  {selectedAuctionPlayer.team_name || "Sem clube"}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Nacionalidade
                </span>
                <span
                  className="font-bold"
                  title={
                    FLAG_TO_COUNTRY[selectedAuctionPlayer.nationality] || ""
                  }
                >
                  {selectedAuctionPlayer.nationality || "—"}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Jogador
                </span>
                <span className="font-black text-lg leading-tight">
                  {selectedAuctionPlayer.name}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Posição
                </span>
                <span className="font-bold">
                  {selectedAuctionPlayer.position}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Força
                </span>
                <span className="font-black text-xl">
                  {selectedAuctionPlayer.skill}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Agressividade
                </span>
                <span className="font-bold">
                  <AggBadge value={selectedAuctionPlayer.aggressiveness} />
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Salário pretendido
                </span>
                <span className="font-bold">
                  {formatCurrency(selectedAuctionPlayer.wage || 0)} /sem
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-normal text-zinc-700 shrink-0">
                  Preço base
                </span>
                <span className="font-black">
                  {formatCurrency(startingPrice)}
                </span>
              </div>
              {selectedAuctionPlayer.is_star && (
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 font-black">★</span>
                  <span className="font-bold text-amber-700">Craque</span>
                </div>
              )}
            </div>

            {/* Historial box */}
            <div className="border border-zinc-700 rounded-lg p-3 bg-amber-300/50 text-sm">
              <p className="font-bold text-zinc-700 mb-1.5">Historial</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <div className="flex justify-between gap-2">
                  <span>Jogos</span>
                  <span className="font-bold">
                    {selectedAuctionPlayer.games_played || 0}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Golos</span>
                  <span className="font-bold">
                    {selectedAuctionPlayer.goals || 0}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Vermelhos</span>
                  <span className="font-bold">
                    {selectedAuctionPlayer.red_cards || 0}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Lesões</span>
                  <span className="font-bold">
                    {selectedAuctionPlayer.injuries || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom section — bid or result */}
          {auctionResult ? (
            <div className="px-5 py-4 bg-linear-to-r from-amber-500 to-amber-400 border-t-2 border-amber-600 text-zinc-950">
              {auctionResult.sold ? (
                <p className="font-black text-lg">
                  Vendido ao{" "}
                  <span className="uppercase">
                    {auctionResult.buyerTeamName}
                  </span>{" "}
                  por {formatCurrency(auctionResult.finalBid)}
                </p>
              ) : (
                <p className="font-black text-lg">
                  Não recebeu lances e saiu do leilão.
                </p>
              )}
              <p className="text-xs text-zinc-700 mt-1 font-medium">
                A fechar automaticamente...
              </p>
            </div>
          ) : myAuctionBid != null ? (
            <div className="px-5 py-4 bg-linear-to-r from-emerald-600 to-emerald-500 border-t-2 border-emerald-700 text-white">
              <p className="font-black text-sm uppercase tracking-widest mb-1">
                Lance registado
              </p>
              <p className="font-black text-2xl font-mono">
                {formatCurrency(myAuctionBid)}
              </p>
              <p className="text-xs text-emerald-200 mt-1 font-medium">
                A aguardar o resultado do leilão...
              </p>
            </div>
          ) : isSeller ? (
            <div className="px-5 py-4 bg-linear-to-r from-emerald-600 to-emerald-500 border-t-2 border-emerald-700 text-white">
              <p className="font-black text-sm uppercase tracking-widest mb-1">
                O teu jogador
              </p>
              <p className="font-black text-2xl font-mono">Em Leilão</p>
              <p className="text-xs text-emerald-200 mt-1 font-medium">
                A aguardar as licitações dos outros treinadores...
              </p>
            </div>
          ) : (
            <div className="px-4 py-3 sm:px-5 sm:py-4 bg-linear-to-r from-red-600 to-red-500 border-t-2 border-red-700 text-white">
              <p className="font-bold text-sm mb-1.5">Oferta (€):</p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  value={auctionBid}
                  onChange={(e) => setAuctionBid(e.target.value)}
                  placeholder={String(startingPrice)}
                  className="flex-1 min-w-0 bg-white border-2 border-zinc-300 rounded-lg px-3 py-2 text-zinc-950 font-mono text-lg outline-none focus:border-amber-500"
                  autoFocus
                />
                <button
                  onClick={submitAuctionBid}
                  className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase text-sm px-5 py-2.5 rounded-lg flex items-center gap-1.5"
                >
                  <span>✓</span> OK
                </button>
              </div>
              <p className="text-xs text-red-200 font-medium">
                Caixa: {formatCurrency(teamInfo?.budget || 0)}
                <span className="mx-1.5 opacity-50">·</span>
                Lance mais alto vence.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
