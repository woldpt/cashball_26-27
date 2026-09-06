import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../../utils/formatters.js";
import {
  FLAG_TO_COUNTRY,
  AUCTION_BID_STEP,
  POSITION_TEXT_CLASS,
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  POSITION_BAR_CLASS,
  POSITION_ACCENT_HEX,
} from "../../constants/index.js";
import { AggBadge } from "../shared/AggBadge.jsx";
import { Badge } from "../shared/Badge.jsx";
import { StarMark } from "../shared/PlayerStatusBadges.jsx";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { StatTile } from "../shared/StatTile.jsx";
import { hexToRgba } from "../../utils/colorHelpers.js";

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

/**
 * AuctionCard — cromo de leilão (face única).
 *
 * De cima para baixo: faixa da posição · selo de posição + vendedor ·
 * herói (avatar com halo + skill) · nome · faixa de urgência (countdown
 * gigante) · preço (lance atual + base/salário) · mini-stats · licitação.
 * A cor de destaque deriva sempre da posição (POSITION_*).
 */
export function AuctionCard({ auction, me, teams, teamInfo, matchweekCount, socket, onOpenDetails }) {
  const [bidError, setBidError] = useState("");
  const [bidSuccess, setBidSuccess] = useState(false);

  const secs = useCountdown(auction.closed || auction.paused ? null : auction.endsAt);
  const posHex = POSITION_ACCENT_HEX[auction.position] || "#94a3b8";
  const posText = POSITION_TEXT_CLASS[auction.position] || "text-zinc-400";
  const countryName = FLAG_TO_COUNTRY?.[auction.nationality] || auction.nationality || "";

  const isSeller = auction.sellerTeamId === me?.teamId;
  const isLeader = auction.currentHighBidTeamId === me?.teamId;
  const isClosed = !!auction.closed;
  const isPaused = !isClosed && !!auction.paused;
  const urgent = !isClosed && !isPaused && secs != null && secs <= 15;
  const hasBid = auction.currentHighBidTeamId != null;

  const highBidTeam = auction.currentHighBidTeamId
    ? (teams || []).find((t) => t.id === auction.currentHighBidTeamId)
    : null;

  const minBid = hasBid
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

  const teamLabel = auction.team_name
    ? auction.isExClub
      ? `ex-${auction.team_name}`
      : auction.team_name
    : "Sem clube";

  const formVal = auction.form ?? 32;
  const formMood = formVal >= 41 ? "💪" : formVal <= 22 ? "😩" : "👍";
  const formClass = formVal >= 41 ? "text-emerald-400" : formVal <= 22 ? "text-rose-400" : "text-zinc-200";

  return (
    <div
      className={`relative flex flex-col rounded-xl overflow-hidden border border-outline-variant/25 bg-gradient-to-b ${POSITION_BG_GRADIENT_CLASS[auction.position] || "from-zinc-500/8"} via-surface-container/80 to-surface shadow-sm shadow-black/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${POSITION_GLOW_CLASS[auction.position] || ""}`}
    >
      {/* Faixa da posição (linguagem PlayerRow, na horizontal) */}
      <div className={`h-1 shrink-0 bg-gradient-to-r ${POSITION_BAR_CLASS[auction.position] || "from-zinc-400 via-zinc-500 to-zinc-600"}`} />

      {/* Selo de posição + vendedor + histórico */}
      <div className="px-3 pt-2.5 flex items-center gap-1.5">
        <Badge
          size="sm"
          style={{
            background: hexToRgba(posHex, 0.15),
            color: posHex,
            borderColor: hexToRgba(posHex, 0.35),
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
        <span className="ml-auto text-[9px] text-zinc-500 truncate max-w-[110px]" title={teamLabel}>
          {teamLabel}
        </span>
        <button
          type="button"
          onClick={() => onOpenDetails?.(auction)}
          className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
          title="Ver histórico do jogador"
          aria-label="Ver histórico do jogador"
        >
          <span className="material-symbols-outlined text-base leading-none block">history</span>
        </button>
      </div>

      {/* Herói: avatar com halo + skill sobreposta */}
      <div
        className="mx-3 mt-2 rounded-lg flex flex-col items-center pt-3 pb-2.5 px-2"
        style={{ background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${hexToRgba(posHex, 0.22)} 0%, transparent 70%)` }}
      >
        <div className="relative">
          <div
            className="rounded-full"
            style={{ boxShadow: `0 0 0 2px rgba(10,10,16,0.9), 0 0 0 4px ${posHex}, 0 0 22px ${hexToRgba(posHex, 0.45)}` }}
          >
            <PlayerAvatar
              seed={auction.playerId}
              position={auction.position}
              teamColor={posHex}
              nationality={auction.nationality}
              size="lg"
              photo={auction.photo || null}
            />
          </div>
          <span
            className={`absolute -bottom-1 -right-3 min-w-9 h-9 px-1.5 rounded-full bg-surface-container border-2 flex items-center justify-center font-headline font-black text-lg leading-none tabular-nums ${posText}`}
            style={{ borderColor: posHex, textShadow: "0 0 10px currentColor" }}
            title={`Skill ${auction.skill}`}
          >
            {auction.skill}
          </span>
        </div>
        <p className="mt-2 font-headline font-black text-on-surface text-base leading-tight truncate max-w-full">
          {auction.name}
        </p>
        <p className="text-[9px] text-zinc-500 truncate" title={countryName}>
          {[auction.nationality, countryName].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Faixa de urgência: countdown gigante */}
      <div className="px-3 mt-2">
        {isClosed ? (
          <div className="rounded-lg border border-outline-variant/15 bg-surface/50 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Leilão encerrado</p>
          </div>
        ) : isPaused ? (
          <div className="rounded-lg border border-outline-variant/15 bg-surface/50 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm leading-none">pause_circle</span>
              Em pausa · retoma no apito final
            </p>
          </div>
        ) : (
          <div
            className={`rounded-lg border py-1.5 text-center transition-colors ${urgent ? "border-error/50 bg-error-container/40 animate-pulse" : "border-outline-variant/15 bg-surface/50"}`}
          >
            <p className={`font-mono font-black tabular-nums leading-none text-[26px] ${urgent ? "text-error" : "text-on-surface"}`}>
              {formatSecs(secs)}
            </p>
            <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/70 mt-0.5">
              {urgent ? "a terminar!" : "restantes"}
            </p>
          </div>
        )}
      </div>

      {/* Preço: lance atual em destaque + base/salário */}
      {!isClosed && !isPaused && (
        <div className="px-4 mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/70">
              {hasBid ? "Lance atual" : "Preço base"}
            </p>
            <p className={`font-mono font-black tabular-nums leading-tight text-xl ${isLeader ? "text-emerald-400" : "text-on-surface"}`}>
              {formatCurrency(hasBid ? auction.currentHighBid : auction.startingPrice)}
            </p>
            <p className="text-[9px] text-zinc-500 truncate max-w-[130px]">
              {hasBid
                ? isLeader
                  ? "és tu que lideras"
                  : highBidTeam?.name || `Equipa ${auction.currentHighBidTeamId}`
                : "sem lances ainda"}
            </p>
          </div>
          <div className="text-right shrink-0">
            {hasBid && (
              <>
                <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60">Base</p>
                <p className="font-mono text-[11px] text-zinc-400 tabular-nums">{formatCurrency(auction.startingPrice)}</p>
              </>
            )}
            <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60 mt-1">Salário/sem</p>
            <p className="font-mono text-[11px] text-zinc-300 tabular-nums">{formatCurrency(auction.wage || 0)}</p>
          </div>
        </div>
      )}

      {/* Mini-stats do cromo */}
      {!isClosed && !isPaused && (
        <div className="px-3 mt-2 grid grid-cols-3 gap-1.5">
          <StatTile label="Forma">
            <span className={`tabular-nums ${formClass}`}>{formMood} {formVal}</span>
          </StatTile>
          <StatTile label="Jogos">
            <span className="tabular-nums">{auction.games_played ?? 0}</span>
          </StatTile>
          <StatTile label="Golos">
            <span className="tabular-nums">{auction.goals ?? 0}</span>
          </StatTile>
        </div>
      )}
      {!isClosed && !isPaused && auction.aggressiveness != null && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/50">Agressividade</span>
          <AggBadge value={auction.aggressiveness} />
        </div>
      )}

      {/* Zona de ação */}
      <div className="px-3 py-3 mt-auto">
        {isClosed ? (
          <div className="text-center py-1">
            {auction.result?.sold ? (
              <p className="font-headline font-black text-emerald-400 text-xs uppercase">
                Vendido a {auction.result.buyerTeamName} · {formatCurrency(auction.result.finalBid)}
              </p>
            ) : (
              <p className="font-headline font-black text-zinc-500 text-xs uppercase">Sem licitações</p>
            )}
          </div>
        ) : isPaused ? (
          <div className="rounded-lg py-2 text-center border border-outline-variant/15 bg-surface/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Pausado durante o jogo
            </p>
          </div>
        ) : isSeller ? (
          <div className="rounded-lg py-2 text-center border border-indigo-500/25 bg-indigo-500/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">O teu jogador · em leilão</p>
          </div>
        ) : isLeader ? (
          <div className="rounded-lg py-2 text-center border border-emerald-500/25 bg-emerald-500/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">A liderar</p>
            <p className="font-mono font-black text-white text-sm tabular-nums mt-0.5">
              {formatCurrency(auction.currentHighBid)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div
              className="flex items-center rounded-lg overflow-hidden border bg-surface/60"
              style={{ borderColor: hexToRgba(posHex, 0.4) }}
            >
              <span className="material-symbols-outlined text-base px-2.5 shrink-0" style={{ color: posHex }}>
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
                className="flex-1 min-w-0 bg-transparent py-2 pr-3 text-white font-mono text-xs outline-none"
                aria-label="Valor do lance"
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
              onClick={handleBid}
              className="w-full py-2 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110"
              style={{ background: posHex, color: "#0d0d14" }}
            >
              Licitar · mín. {formatCurrency(minBid)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
