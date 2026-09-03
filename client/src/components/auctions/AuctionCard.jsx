import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../../utils/formatters.js";
import { FLAG_TO_COUNTRY, AUCTION_BID_STEP } from "../../constants/index.js";
import { AggBadge } from "../shared/AggBadge.jsx";
import { Badge } from "../shared/Badge.jsx";
import { StarMark } from "../shared/PlayerStatusBadges.jsx";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { StatTile } from "../shared/StatTile.jsx";
import { hexToRgba, posRingClass } from "../../utils/colorHelpers.js";

function useCountdown(endsAt) {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setSecs(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return secs;
}

export function AuctionCard({ auction, me, teams, teamInfo, matchweekCount, socket, teamColorById, onOpenDetails }) {
  const [flipped, setFlipped] = useState(false);
  const [bidError, setBidError] = useState("");
  const [bidSuccess, setBidSuccess] = useState(false);

  const secs = useCountdown(auction.closed || auction.paused ? null : auction.endsAt);
  const teamColor =
    auction.team_color_primary ||
    auction.color_primary ||
    teamColorById?.get(Number(auction.sellerTeamId)) ||
    "#95d4b3";
  const countryName = FLAG_TO_COUNTRY?.[auction.nationality] || auction.nationality || "—";

  // Em mobile o card não vira: um toque abre o histórico completo do jogador.
  const handleCardTap = () => {
    if (window.matchMedia("(min-width: 640px)").matches) setFlipped(!flipped);
    else onOpenDetails?.(auction);
  };



  const isSeller = auction.sellerTeamId === me?.teamId;
  const isLeader = auction.currentHighBidTeamId === me?.teamId;
  const isClosed = !!auction.closed;
  const isPaused = !isClosed && !!auction.paused;

  const highBidTeam = auction.currentHighBidTeamId
    ? teams.find((t) => t.id === auction.currentHighBidTeamId)
    : null;

  const minBid = auction.currentHighBidTeamId != null
    ? auction.currentHighBid + AUCTION_BID_STEP
    : auction.startingPrice;

  const [bidInput, setBidInput] = useState(() => String(minBid));

  const handleBid = useCallback(() => {
    const amount = Number(bidInput);
    if (!Number.isFinite(amount) || amount < minBid) {
      setBidError(`Lance mínimo: ${formatCurrency(minBid)}`);
      return;
    }
    if (teamInfo && amount > (teamInfo.budget || 0)) {
      setBidError("Orçamento insuficiente.");
      return;
    }
    setBidError("");
    socket.emit("placeAuctionBid", { playerId: auction.playerId, bidAmount: amount }, (res) => {
      if (res?.ok) {
        setBidSuccess(true);
        setTimeout(() => setBidSuccess(false), 3000);
      } else {
        setBidError(res?.error || "Erro ao processar o lance.");
        setTimeout(() => setBidError(""), 3000);
      }
    });
  }, [bidInput, minBid, auction.playerId, teamInfo, socket]);

  return (
    <div
      className="[perspective:1200px]"
      onClick={handleCardTap}
    >
      <div
        className="block w-full text-left"
        style={{
          transition: "transform 0.3s ease",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          position: "relative",
          minHeight: window.matchMedia("(min-width: 640px)").matches ? 316 : 250,
        }}
      >
        <div
          className={`absolute inset-0 rounded-xl overflow-hidden flex flex-col ring-2 ${posRingClass(auction.position)} [backface-visibility:hidden] transition-transform duration-300 [transform-origin:center_center] [transform:translateZ(0)]`}
          style={{
            WebkitBackfaceVisibility: "hidden",
            background: `linear-gradient(165deg, ${hexToRgba(teamColor, 0.3)} 0%, ${hexToRgba(teamColor, 0.18)} 42%, rgba(35,39,56,0.93) 100%)`,
            border: `2px solid ${isClosed || isPaused ? "#333" : hexToRgba(teamColor, 0.24)}`,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          }}
        >
          <div
            className="px-3 pt-2.5 pb-2 flex items-start gap-2"
            style={{
              background: `linear-gradient(135deg, ${teamColor}18 0%, transparent 100%)`,
              borderBottom: `1px solid ${teamColor}22`,
            }}
          >
            <PlayerAvatar
              seed={auction.playerId}
              position={auction.position}
              teamColor={teamColor}
              nationality={auction.nationality}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              {/* Mobile: só o essencial (nome + posição) */}
              <div className="flex items-center gap-1 mb-0.5 sm:hidden">
                <Badge
                  size="sm"
                  style={{
                    background: `${teamColor}22`,
                    color: teamColor,
                    borderColor: `${teamColor}55`,
                  }}
                >
                  {auction.position}
                </Badge>
                {!!auction.is_star && (auction.position === "MED" || auction.position === "ATA") && (
                  <StarMark />
                )}
              </div>
              {/* Desktop: posição + craque + estado */}
              <div className="hidden sm:flex items-center gap-1.5 mb-0.5 flex-wrap">
                <Badge
                  size="sm"
                  style={{
                    background: `${teamColor}22`,
                    color: teamColor,
                    borderColor: `${teamColor}55`,
                  }}
                >
                  {auction.position}
                </Badge>
                {!!auction.is_star && (auction.position === "MED" || auction.position === "ATA") && (
                  <StarMark />
                )}
                {(auction.suspension_until_matchweek ?? 0) > matchweekCount && (
                  <Badge variant="suspended">Suspenso</Badge>
                )}
                {(auction.injury_until_matchweek ?? 0) > matchweekCount && (
                  <Badge variant="injured">Lesionado</Badge>
                )}
              </div>
              <p className="font-headline font-black text-on-surface text-base leading-tight truncate">
                {auction.name}
              </p>
              <p className="text-[9px] text-zinc-500 truncate">
                {auction.team_name
                  ? auction.isExClub
                    ? `ex-${auction.team_name}`
                    : auction.team_name
                  : "Sem clube"}
              </p>
            </div>
            <div className="flex flex-col items-end shrink-0 gap-1">
              <span
                className="font-black text-lg sm:text-xl leading-none tabular-nums"
                style={{ color: teamColor }}
              >
                {auction.skill}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFlipped(true);
                }}
                className="text-[9px] font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs leading-none">info</span>
                Stats
              </button>
            </div>
          </div>

          <div className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: "1px solid #1e1e2e" }}>
            {isClosed ? (
              <span className="text-[10px] font-black uppercase text-zinc-500">Leilão encerrado</span>
            ) : isPaused ? (
              <span className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs leading-none">pause_circle</span>
                Em Pausa
              </span>
            ) : (
              <>
                <span
                  className="font-mono font-black text-xl tabular-nums leading-none"
                  style={{ color: secs != null && secs <= 15 ? "#f87171" : teamColor }}
                >
                  {secs != null ? `${secs}s` : "—"}
                </span>
                <span className="text-zinc-700 text-xs">restantes</span>
              </>
            )}
            <div className="ml-auto text-right">
              <p className="text-[9px] text-zinc-600 uppercase font-bold">
                {isClosed ? (auction.result?.sold ? "Vendido" : "Sem lances") : "Bid mais alto"}
              </p>              {isClosed && auction.result?.sold ? (
                <>
                  <p className="font-mono font-black text-sm text-emerald-400 tabular-nums">
                    {formatCurrency(auction.result.finalBid)}
                  </p>
                  <p className="text-[9px] text-zinc-500">{auction.result.buyerTeamName}</p>
                </>
              ) : isClosed ? (
                <p className="font-mono font-black text-sm text-zinc-500">—</p>
              ) : auction.currentHighBidTeamId != null ? (
                <>
                  <p className="font-mono font-black text-sm text-white tabular-nums">
                    {formatCurrency(auction.currentHighBid)}
                  </p>
                  <p className="text-[9px] text-zinc-500 truncate max-w-[100px]">
                    {highBidTeam?.name || `Equipa ${auction.currentHighBidTeamId}`}
                  </p>
                </>
              ) : (
                <p className="font-mono font-black text-sm text-zinc-500">
                  {formatCurrency(auction.startingPrice)} <span className="text-[9px] text-zinc-600">base</span>
                </p>
              )}
            </div>
          </div>


          <div className="px-3 py-2.5 flex-1 flex flex-col justify-end">
            {isClosed ? (
              <div className="text-center py-1.5">
                {auction.result?.sold ? (
                  <p className="font-headline font-black text-emerald-400 text-xs uppercase">
                    Vendido a {auction.result.buyerTeamName}
                  </p>
                ) : (
                  <p className="font-headline font-black text-zinc-500 text-xs uppercase">
                    Sem licitações
                  </p>
                )}
              </div>
            ) : isPaused ? (
              <div
                className="rounded-lg py-2 text-center"
                style={{ background: "#1a1a2333", border: "1px solid #3f3f5533" }}
              >
                <span className="material-symbols-outlined text-zinc-500 text-xl">pause_circle</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">
                  Pausado durante o jogo
                </p>
                <p className="text-[9px] text-zinc-600 mt-0.5">Retoma após o apito final</p>
              </div>
            ) : isSeller ? (
              <div
                className="rounded-lg py-1.5 sm:py-2 text-center"
                style={{ background: "#1e1b4b33", border: "1px solid #312e8133" }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">O teu jogador</p>
                <p className="font-headline font-black text-white text-xs mt-0.5 truncate">Em Leilão</p>
              </div>
            ) : isLeader ? (
              <div
                className="rounded-lg py-2 text-center"
                style={{ background: "#064e3b33", border: "1px solid #10b98133" }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">A liderar</p>
                <p className="font-mono font-black text-white text-sm tabular-nums mt-0.5">
                  {formatCurrency(auction.currentHighBid)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div
                  className="flex items-center rounded-lg overflow-hidden"
                  style={{ border: `1px solid ${teamColor}50`, background: "#111118" }}
                >
                  <span
                    className="material-symbols-outlined text-sm px-2.5 shrink-0"
                    style={{ color: teamColor }}
                  >
                    currency_exchange
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={minBid}
                    value={bidInput}
                    onChange={(e) => {
                      setBidInput(e.target.value);
                      setBidError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleBid()}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent py-2 pr-3 text-white font-mono text-xs outline-none"
                  />
                </div>
                {bidError && (
                  <p className="text-[10px] text-red-400 font-bold">{bidError}</p>
                )}
                {bidSuccess && (
                  <p className="text-[10px] text-emerald-400 font-bold">Lance registado!</p>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBid();
                  }}
                  className="w-full py-2 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110"
                  style={{ background: teamColor, color: "#0d0d14" }}
                >
                  Licitar
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className={`hidden sm:flex absolute inset-0 rounded-xl overflow-hidden flex-col ring-2 ${posRingClass(auction.position)} [backface-visibility:hidden]`}
          style={{
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: `linear-gradient(15deg, ${hexToRgba(teamColor, 0.18)} 0%, rgba(36,40,58,0.95) 52%, ${hexToRgba(teamColor, 0.2)} 100%)`,
            border: `2px solid ${hexToRgba(teamColor, 0.24)}`,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          }}
        >
          <div
            className="px-3 pt-2.5 pb-2 flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${teamColor}18 0%, transparent 100%)`,
              borderBottom: `1px solid ${teamColor}22`,
            }}
          >
            <PlayerAvatar
              seed={auction.playerId}
              position={auction.position}
              teamColor={teamColor}
              nationality={auction.nationality}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="font-headline font-black text-white text-sm leading-tight truncate">
                {auction.name}
              </p>
              <p className="text-[9px] text-zinc-500">{countryName}</p>
            </div>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Voltar"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
          </div>
          <div className="px-3 py-2 flex-1 overflow-hidden">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Historial</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
               <StatTile icon="sports_soccer" label="Jogos">
                 {auction.games_played ?? 0}
               </StatTile>
               <StatTile icon="stat_3" label="Golos">
                 {auction.goals ?? 0}
               </StatTile>
               <StatTile icon="square" label="Vermelhos">
                 {auction.red_cards ?? 0}
               </StatTile>
               <StatTile icon="personal_injury" label="Lesões">
                 {auction.injuries ?? 0}
               </StatTile>
             </div>
            {auction.aggressiveness != null && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-wide">Agressividade</span>
                <AggBadge value={auction.aggressiveness} />
              </div>
            )}
            {auction.form != null && (
              <div
                className="flex items-center justify-between gap-2 mb-2"
                title="Forma 70–130 (100 = normal; ≥115 em grande; ≤85 em baixo)"
              >
                <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-wide">Forma</span>
                <span className={`text-xs font-black tabular-nums ${(auction.form ?? 100) >= 115 ? "text-emerald-400" : (auction.form ?? 100) <= 85 ? "text-rose-400" : "text-zinc-200"}`}>
                  {(auction.form ?? 100) >= 115 ? "💪 " : (auction.form ?? 100) <= 85 ? "😩 " : "👍 "}{auction.form ?? 100}%
                </span>
              </div>
            )}
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Financeiro</p>
            <div
              className="rounded-md grid grid-cols-2"
              style={{ background: "#111118", border: "1px solid #26263a" }}
            >
              <div className="p-2 border-r border-zinc-800">
                <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Salário</p>
                <p className="font-black text-white text-xs font-mono tabular-nums">
                  {formatCurrency(auction.wage || 0)}
                  <span className="text-[9px] text-zinc-500 font-normal"> /sem</span>
                </p>
              </div>
              <div className="p-2">
                <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Preço Base</p>
                <p className="font-black text-xs font-mono tabular-nums" style={{ color: teamColor }}>
                  {formatCurrency(auction.startingPrice)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
