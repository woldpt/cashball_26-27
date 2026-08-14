/**
 * AuctionsPage — Página de leilões ativos e recentes.
 * Aplica o design system da STYLE.md: tokens semânticos, cards com header,
 * grid responsivo e estados vazios padronizados.
 */
import { formatCurrency } from "../utils/formatters.js";
import { AuctionCard } from "../components/auctions/AuctionCard.jsx";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
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
        <SummaryWidget label="Leilões a decorrer" value={live.length} />
        <SummaryWidget
          label="Leilões recentes"
          value={closed.length}
          accentClass="border-tertiary"
        />
        <SummaryWidget
          label="Caixa disponível"
          value={formatCurrency(teamInfo?.budget || 0)}
          accentClass="border-emerald-500"
        />
      </div>

      {/* ── Active auctions panel ────────────────────────────────────── */}
      {live.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-0">
          <Panel title="Em curso" meta={`${live.length} leilão${live.length !== 1 ? "s" : ""}`}>
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
          </Panel>
        </div>
      )}

      {/* ── Closed auctions panel ────────────────────────────────────── */}
      {closed.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-0">
          <Panel title="Recentes" meta={`${closed.length} leilão${closed.length !== 1 ? "s" : ""}`}>
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
          </Panel>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {live.length === 0 && closed.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-3 md:p-4">
          <EmptyState
            emoji="⚖️"
            title="Sem leilões a mostrar"
            description="Quando um clube colocar um jogador em leilão, aparece aqui."
          />
        </div>
      )}
    </div>
  );
}
