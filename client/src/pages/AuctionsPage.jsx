/**
 * AuctionsPage — Página de leilões ativos e recentes.
 * Aplica o design system da STYLE.md: tokens semânticos, cards com header,
 * grid responsivo e estados vazios padronizados.
 */
import { formatCurrency } from "../utils/formatters.js";
import { AuctionCard } from "../components/auctions/AuctionCard.jsx";
import { getTeamColor } from "../utils/teamHelpers.js";

export function AuctionsPage({ activeAuctions = [], me, teams, teamInfo, matchweekCount = 0, socket }) {
  const live = activeAuctions.filter((a) => !a.closed);
  const closed = activeAuctions.filter((a) => a.closed);

  const teamColorById = new Map(
    (teams || []).map((t) => [Number(t.id), t.color_primary ?? getTeamColor(t.id)])
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ── Summary widgets ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 md:p-4 shrink-0">
        <div className="bg-surface-container-low p-5 rounded-md flex flex-col justify-between h-28 border-l-4 border-primary">
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Leilões a decorrer
          </span>
          <span className="text-3xl font-black font-headline tracking-tighter text-on-surface tabular-nums">
            {live.length}
          </span>
        </div>
        <div className="bg-surface-container-low p-5 rounded-md flex flex-col justify-between h-28 border-l-4 border-tertiary">
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Leilões recentes
          </span>
          <span className="text-3xl font-black font-headline tracking-tighter text-on-surface tabular-nums">
            {closed.length}
          </span>
        </div>
        <div className="bg-surface-container-low p-5 rounded-md flex flex-col justify-between h-28 border-l-4 border-emerald-500">
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Caixa disponível
          </span>
          <span className="text-3xl font-black font-headline tracking-tighter text-on-surface tabular-nums">
            {formatCurrency(teamInfo?.budget || 0)}
          </span>
        </div>
      </div>

      {/* ── Active auctions panel ────────────────────────────────────── */}
      {live.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-0">
          <div className="bg-surface-container rounded-md overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
              <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">
                Em curso
              </h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {live.length} leilão{live.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-3 md:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {live.map((auction) => (
                  <AuctionCard
                    key={auction.playerId}
                    auction={auction}
                    me={me}
                    teams={teams}
                    teamInfo={teamInfo}
                    matchweekCount={matchweekCount}
                    socket={socket}
                    teamColorById={teamColorById}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Closed auctions panel ────────────────────────────────────── */}
      {closed.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-0">
          <div className="bg-surface-container rounded-md overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
              <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">
                Recentes
              </h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {closed.length} leilão{closed.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-3 md:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {closed.map((auction) => (
                  <AuctionCard
                    key={auction.playerId}
                    auction={auction}
                    me={me}
                    teams={teams}
                    teamInfo={teamInfo}
                    matchweekCount={matchweekCount}
                    socket={socket}
                    teamColorById={teamColorById}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {live.length === 0 && closed.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-3 md:p-4">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-outline-variant/25 bg-surface-container py-12">
            <span className="text-3xl text-on-surface-variant/40">⚖️</span>
            <p className="text-on-surface-variant/60 text-xs font-bold">Sem leilões a mostrar</p>
            <p className="text-on-surface-variant/40 text-[10px] text-center max-w-[260px]">
              Quando um clube colocar um jogador em leilão, aparece aqui.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
