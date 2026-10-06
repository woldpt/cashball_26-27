import { useState, useEffect, useContext } from "react";
import { TeamLink } from "../shared/TeamLink.jsx";
import { GameContext } from "../../contexts/GameContext.jsx";
import { formatCurrency } from "../../utils/formatters.js";
import { BidForm } from "./BidForm.jsx";
import {
  AUCTION_BID_STEP,
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  POSITION_BAR_CLASS,
  POSITION_ACCENT_HEX,
} from "../../constants/index.js";
import { Badge } from "../shared/Badge.jsx";
import { StarMark } from "../shared/PlayerStatusBadges.jsx";
import { BudgetMeter, TransferCardHead } from "../transfers/TransferChrome.jsx";
import { auctionStanding } from "../../utils/auctionStanding.js";

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

function formatSecs(secs) {
  if (secs == null) return "—";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/* Anel de contagem decrescente — esvazia nos últimos 60 s; antes disso,
   anel cheio estático (só SVG, sem JS de animação). */
const RING_WINDOW = 60;
const RING_C = 2 * Math.PI * 10;
function AuctionRing({ secs, urgent }) {
  if (secs == null) return null;
  const pct = secs <= RING_WINDOW ? Math.max(0, secs / RING_WINDOW) : 1;
  const color = urgent ? "var(--color-error)" : "var(--color-primary)";
  return (
    <svg width="18" height="18" viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <circle cx="13" cy="13" r="10" fill="none" stroke={color} strokeWidth="3" opacity="0.2" />
      <circle
        cx="13"
        cy="13"
        r="10"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - pct)}
        transform="rotate(-90 13 13)"
        style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s" }}
      />
    </svg>
  );
}

const STANDING = {
  leader: { label: "A liderar", icon: "emoji_events", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35", ring: "ring-2 ring-emerald-400/70" },
  outbid: { label: "Superado · licita de novo", icon: "trending_down", cls: "bg-rose-500/15 text-rose-300 border-rose-500/35", ring: "ring-2 ring-rose-500/70" },
  seller: { label: "O teu jogador", icon: "sell", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/35", ring: "" },
};

/**
 * AuctionCard — cromo de leilão (face única), mesma cabeça do Mercado
 * (TransferCardHead). Contagem decrescente em chip no canto + barra que
 * esvazia no último minuto; fita com a posição do treinador; "bilhete" com o
 * lance e a licitação numa linha.
 */
export function AuctionCard({ auction, me, teams, teamInfo, matchweekCount, socket, onOpenDetails }) {
  const nowIdx = useContext(GameContext)?.calendarIndex ?? matchweekCount;

  const secs = useCountdown(auction.closed || auction.paused ? null : auction.endsAt);
  const posHex = POSITION_ACCENT_HEX[auction.position] || "#94a3b8";

  const isClosed = !!auction.closed;
  const isPaused = !isClosed && !!auction.paused;
  const urgent = !isClosed && !isPaused && secs != null && secs <= 15;
  const hasBid = auction.currentHighBidTeamId != null;
  const standing = isClosed ? null : auctionStanding(auction, me?.teamId);
  const st = standing ? STANDING[standing] : null;
  const budget = teamInfo?.budget || 0;

  const highBidTeam = auction.currentHighBidTeamId
    ? (teams || []).find((t) => t.id === auction.currentHighBidTeamId)
    : null;

  const minBid = hasBid
    ? auction.currentHighBid + AUCTION_BID_STEP
    : auction.startingPrice;

  const sellerTeam = (teams || []).find((t) => Number(t.id) === Number(auction.sellerTeamId)) || null;
  const sellerName = sellerTeam?.name || auction.team_name || null;
  const teamLabel = auction.team_name
    ? auction.isExClub
      ? `ex-${auction.team_name}`
      : auction.team_name
    : sellerName || "Sem clube";
  const suspLeft = (auction.suspension_until_matchweek ?? 0) - nowIdx;
  const injLeft = (auction.injury_until_matchweek ?? 0) - nowIdx;
  const lastMinutePct = secs != null && secs <= RING_WINDOW ? (secs / RING_WINDOW) * 100 : null;

  const corner = isClosed ? (
    <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Encerrado</span>
  ) : isPaused ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-outline-variant/30 bg-surface/70 text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
      <span className="material-symbols-outlined text-[13px] leading-none w-[1em] overflow-hidden">pause</span>
      Pausa
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full border font-mono font-black tabular-nums text-[12px] leading-none ${
        urgent ? "border-error/60 bg-error-container/60 text-error animate-pulse" : "border-outline-variant/30 bg-surface/70 text-on-surface"
      }`}
      title={urgent ? "A terminar!" : "Tempo restante"}
    >
      <AuctionRing secs={secs} urgent={urgent} />
      {formatSecs(secs)}
    </span>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails?.(auction)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails?.(auction);
        }
      }}
      className={`relative h-full flex flex-col rounded-xl overflow-hidden border border-outline-variant/25 bg-gradient-to-b ${POSITION_BG_GRADIENT_CLASS[auction.position] || "from-zinc-500/8"} via-surface-container/80 to-surface shadow-sm shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${POSITION_GLOW_CLASS[auction.position] || ""} ${st?.ring || ""}`}
    >
      {/* Faixa da posição + barra do último minuto (esvazia até ao fecho) */}
      <div className={`relative h-1 shrink-0 bg-gradient-to-r ${POSITION_BAR_CLASS[auction.position] || "from-zinc-400 via-zinc-500 to-zinc-600"}`}>
        {lastMinutePct != null && (
          <div className="absolute inset-0 bg-surface/80">
            <div
              className="h-full bg-error"
              style={{ width: `${lastMinutePct}%`, transition: "width 0.5s linear", boxShadow: "0 0 8px var(--color-error)" }}
            />
          </div>
        )}
      </div>

      <TransferCardHead
        player={{ ...auction, id: auction.playerId }}
        team={sellerTeam}
        teamId={auction.sellerTeamId}
        teamLabel={teamLabel}
        onOpen={() => onOpenDetails?.(auction)}
        corner={corner}
        badges={
          <>
            {!!auction.is_star && (auction.position === "MED" || auction.position === "ATA") && <StarMark className="ml-0" />}
            {suspLeft > 0 && <Badge variant="suspended">🟥 {suspLeft + 1}J</Badge>}
            {injLeft > 0 && <Badge variant="injured">🩹 {injLeft + 1}J</Badge>}
          </>
        }
      />

      <p className="px-3 short:px-2 mt-2 text-[10px] text-on-surface-variant tabular-nums">
        <b className="text-on-surface font-black">{auction.games_played ?? 0}</b> jogos ·{" "}
        <b className="text-emerald-400 font-black">{auction.goals ?? 0}</b> golos ·{" "}
        <b className="text-on-surface font-black">{formatCurrency(auction.wage || 0)}</b>/sem
      </p>

      {/* Bilhete: lance atual + licitação */}
      <div className="mt-auto pt-2.5 short:pt-1.5 px-2 pb-2 space-y-1.5">
        {st && (
          <div className={`flex items-center justify-center gap-1.5 rounded-md border py-1 text-[10px] font-black uppercase tracking-widest ${st.cls}`}>
            <span className="material-symbols-outlined text-[14px] leading-none w-[1em] overflow-hidden">{st.icon}</span>
            {st.label}
          </div>
        )}
        <div className="rounded-lg border border-outline-variant/15 bg-surface/60 p-2.5 short:p-2 space-y-2">
          {isClosed ? (
            auction.result?.sold ? (
              <p className="text-center font-headline font-black text-emerald-400 text-xs uppercase">
                Vendido a <TeamLink teamId={auction.result.buyerTeamId}>{auction.result.buyerTeamName}</TeamLink> · {formatCurrency(auction.result.finalBid)}
              </p>
            ) : (
              <p className="text-center font-headline font-black text-zinc-500 text-xs uppercase">Sem licitações</p>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/70">
                    {hasBid ? "Lance atual" : "Preço base"}
                  </p>
                  <p className={`font-mono font-black tabular-nums leading-tight text-xl short:text-base ${standing === "leader" ? "text-emerald-400" : standing === "outbid" ? "text-rose-400" : "text-on-surface"}`}>
                    {formatCurrency(hasBid ? auction.currentHighBid : auction.startingPrice)}
                  </p>
                  <p className="text-[9px] text-on-surface-variant truncate max-w-[180px]">
                    {hasBid
                      ? standing === "leader"
                        ? "és tu que lideras"
                        : highBidTeam?.name || `Equipa ${auction.currentHighBidTeamId}`
                      : "sem lances ainda"}
                  </p>
                </div>
                {hasBid && (
                  <div className="text-right shrink-0">
                    <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60">Base</p>
                    <p className="font-mono text-[11px] text-on-surface-variant tabular-nums">{formatCurrency(auction.startingPrice)}</p>
                  </div>
                )}
              </div>

              {isPaused ? (
                <p className="min-h-10 flex items-center justify-center rounded-lg border border-dashed border-outline-variant/25 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
                  Pausado · retoma no apito final
                </p>
              ) : standing === "seller" || standing === "leader" ? null : (
                <div onClick={(e) => e.stopPropagation()} className="space-y-2">
                  <BudgetMeter price={minBid} budget={budget} />
                  <BidForm
                    playerId={auction.playerId}
                    minBid={minBid}
                    budget={budget}
                    socket={socket}
                    accentHex={posHex}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
