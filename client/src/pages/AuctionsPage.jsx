import { formatCurrency } from "../utils/formatters.js";
import { AuctionCard } from "../components/auctions/AuctionCard.jsx";
import { getTeamColor } from "../utils/teamHelpers.js";

export function AuctionsPage({ activeAuctions = [], me, teams, teamInfo, matchweekCount = 0, socket }) {
  const live = activeAuctions.filter((a) => !a.closed);
  const closed = activeAuctions.filter((a) => a.closed);

  const teamColorById = new Map(
    (teams || []).map((t) => [Number(t.id), getTeamColor(t.id)])
  );

  return (
    <div className="bg-surface-container rounded-lg shadow-sm overflow-hidden p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="material-symbols-outlined text-3xl text-primary">gavel</span>
        <div>
          <h1 className="font-headline font-black text-2xl text-white leading-tight">Leilões</h1>
          <p className="text-xs text-zinc-500">
            {live.length === 0
              ? "Sem leilões a decorrer"
              : `${live.length} leilão${live.length !== 1 ? "s" : ""} a decorrer`}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide">Caixa disponível</p>
          <p className="font-mono font-black text-lg text-white tabular-nums">
            {formatCurrency(teamInfo?.budget || 0)}
          </p>
        </div>
      </div>

      {live.length > 0 && (
        <section className="mb-8">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">
            Em curso
          </p>
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
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">
            Recentes
          </p>
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
        </section>
      )}

      {live.length === 0 && closed.length === 0 && (
        <div className="rounded-xl flex flex-col items-center justify-center py-20 gap-4 bg-surface/30 border border-outline-variant/20">
          <span className="material-symbols-outlined text-5xl text-zinc-600">gavel</span>
          <div className="text-center">
            <p className="font-headline font-black text-zinc-500 text-lg">Sem leilões ativos</p>
            <p className="text-zinc-600 text-sm mt-1">
              Quando um clube colocar um jogador em leilão, aparece aqui.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
