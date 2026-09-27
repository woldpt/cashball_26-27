/**
 * AuctionsPage — Página de leilões ativos e recentes.
 * Aplica o design system da STYLE.md: tokens semânticos, cards com header,
 * grid responsivo e estados vazios padronizados.
 *
 * Scroll: a página é full-bleed com UM único scroll (a raiz é o contentor).
 * O topo (widgets mini + filtro) e os painéis "Em curso"/"Recentes" rolam
 * juntos — sem áreas de scroll internas.
 */
import { formatCurrency } from "../utils/formatters.js";
import { AuctionCard } from "../components/auctions/AuctionCard.jsx";
import { AuctionResultRow } from "../components/auctions/AuctionResultRow.jsx";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { getTeamColor } from "../utils/teamHelpers.js";
import { POSITIONS } from "../utils/playerHelpers.js";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerItemProps } from "../motion.js";

export function AuctionsPage({ activeAuctions = [], highlightAuctionId = null, me, teams = [], teamInfo, matchweekCount = 0, socket, onOpenPlayerHistory }) {
  const [positionFilter, setPositionFilter] = useState("all");

  // Navegação com contexto (ex.: fallback do modal da scout): leva o cromo
  // correspondente para a vista e destaca-o com um anel âmbar.
  useEffect(() => {
    if (highlightAuctionId == null) return;
    document
      .getElementById(`auction-${highlightAuctionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightAuctionId, activeAuctions.length]);

  const matchesPos = (a) => positionFilter === "all" || a.position === positionFilter;
  const live = activeAuctions.filter((a) => !a.closed && matchesPos(a));
  // Recentes: mais recentes primeiro (defesa — a ordem do servidor é de
  // inserção, que já é cronológica, mas não contractual).
  const closed = activeAuctions
    .filter((a) => a.closed && matchesPos(a))
    .sort((a, b) => (b.closedMatchweek ?? 0) - (a.closedMatchweek ?? 0));

  const positionTabs = [
    { key: "all", label: `Todas · ${activeAuctions.length}` },
    ...POSITIONS.map((pos) => ({
      key: pos,
      label: `${pos} · ${activeAuctions.filter((a) => a.position === pos).length}`,
    })),
  ];

  const teamColorById = new Map(
    teams.map((t) => [Number(t.id), t.color_primary ?? getTeamColor(t.id)])
  );

  return (
    /* Scroll único da página: topo + painéis rolam juntos (sem overflow interno). */
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
      {/* ── Topo compacto: 3 widgets mini em linha em qualquer ecrã ─────── */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 short:gap-1 p-2 sm:p-4 short:p-1.5 pb-1.5 short:pb-1 shrink-0">
        <SummaryWidget
          label="Leilões a decorrer"
          value={live.length}
          valueClass="text-[11px] sm:text-2xl min-w-0 truncate"
          mini
        />
        <SummaryWidget
          label="Leilões recentes"
          value={closed.length}
          accentClass="border-tertiary"
          valueClass="text-[11px] sm:text-2xl min-w-0 truncate"
          mini
        />
        <SummaryWidget
          label="Caixa disponível"
          value={formatCurrency(teamInfo?.budget || 0)}
          accentClass="border-emerald-500"
          valueClass="text-[10px] sm:text-xl min-w-0 truncate"
          mini
        />
      </div>

      {/* ── Filtro de posição: chips (padrão TabBar, como PlayersTab) ───── */}
      {activeAuctions.length > 0 && (
        <div className="px-2 sm:px-4 short:px-2 pb-1.5 short:pb-1 shrink-0">
          <TabBar tabs={positionTabs} active={positionFilter} onChange={setPositionFilter} expand />
        </div>
      )}

      {/* ── Painéis empilhados no scroll único da página ────────────────── */}
      {(live.length > 0 || closed.length > 0) && (
        <div className="px-2 sm:px-4 short:px-2 pb-4 short:pb-2 space-y-2 sm:space-y-3 short:space-y-2">
          {live.length > 0 && (
            <Panel title="Em curso" meta={`${live.length} ${live.length === 1 ? "leilão" : "leilões"}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 short:gap-2">
                {live.map((auction, i) => (
                  <motion.div
                    key={auction.playerId}
                    id={`auction-${auction.playerId}`}
                    className={Number(auction.playerId) === Number(highlightAuctionId) ? "rounded-xl ring-2 ring-amber-400 scroll-mt-4" : undefined}
                    {...staggerItemProps(i)}
                  >
                    <AuctionCard
                      auction={auction}
                      me={me}
                      teams={teams}
                      teamInfo={teamInfo}
                      matchweekCount={matchweekCount}
                      socket={socket}
                      teamColorById={teamColorById}
                      onOpenDetails={onOpenPlayerHistory}
                    />
                  </motion.div>
                ))}
              </div>
            </Panel>
          )}

          {closed.length > 0 && (
            <Panel title="Recentes" meta={`${closed.length} ${closed.length === 1 ? "leilão" : "leilões"}`}>
              <div className="flex flex-col gap-1.5">
                {closed.map((auction, i) => (
                  <motion.div key={auction.playerId} {...staggerItemProps(i)}>
                    <AuctionResultRow
                      auction={auction}
                      teams={teams}
                      currentMatchweek={matchweekCount + 1}
                      onOpenPlayer={onOpenPlayerHistory}
                    />
                  </motion.div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {live.length === 0 && closed.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-3 md:p-4 short:p-2">
          <EmptyState
            emoji="⚖️"
            title={activeAuctions.length > 0 ? "Sem leilões para esta posição" : "Sem leilões a mostrar"}
            description={
              activeAuctions.length > 0
                ? "Escolhe outra posição no filtro."
                : "Quando um clube colocar um jogador em leilão, aparece aqui."
            }
          />
        </div>
      )}
    </div>
  );
}