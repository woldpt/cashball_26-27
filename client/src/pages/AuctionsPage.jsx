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
import { getTeamColor } from "../utils/teamHelpers.js";
import { useState } from "react";
import { motion } from "framer-motion";
import { staggerItemProps } from "../motion.js";

export function AuctionsPage({ activeAuctions = [], me, teams, teamInfo, matchweekCount = 0, socket, onOpenPlayerHistory }) {
  const [positionFilter, setPositionFilter] = useState("all");

  const live = activeAuctions.filter((a) => !a.closed && (positionFilter === "all" || a.position === positionFilter));
  const closed = activeAuctions.filter((a) => a.closed && (positionFilter === "all" || a.position === positionFilter));

  const teamColorById = new Map(
    (teams || []).map((t) => [Number(t.id), t.color_primary ?? getTeamColor(t.id)])
  );

  return (
    /* Scroll único da página: topo + painéis rolam juntos (sem overflow interno). */
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
      {/* ── Topo compacto: 3 widgets mini em linha em qualquer ecrã ─────── */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 p-2 sm:p-4 pb-1.5 shrink-0">
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

      {/* ── Position filter ─────────────────────────────────────────────── */}
      {activeAuctions.length > 0 && (
        <div className="px-2 sm:px-4 pb-1.5 shrink-0">
          <select
            className="bg-surface border border-outline-variant/30 rounded-sm px-1.5 sm:px-3 py-[3px] sm:py-1 text-[9px] sm:text-[10px] font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
          >
            <option value="all">Posição: Todas</option>
            <option value="GR">Guarda-Redes</option>
            <option value="DEF">Defesa</option>
            <option value="MED">Médio</option>
            <option value="ATA">Avançado</option>
          </select>
        </div>
      )}

      {/* ── Painéis empilhados no scroll único da página ────────────────── */}
      {(live.length > 0 || closed.length > 0) && (
        <div className="px-2 sm:px-4 pb-4 space-y-2 sm:space-y-3">
          {live.length > 0 && (
            <Panel title="Em curso" meta={`${live.length} leilão${live.length !== 1 ? "s" : ""}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {live.map((auction, i) => (
                  <motion.div key={auction.playerId} {...staggerItemProps(i)}>
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
            <Panel title="Recentes" meta={`${closed.length} leilão${closed.length !== 1 ? "s" : ""}`}>
              <div className="flex flex-col gap-1.5">
                {closed.map((auction, i) => (
                  <motion.div key={auction.playerId} {...staggerItemProps(i)}>
                    <AuctionResultRow auction={auction} />
                  </motion.div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {live.length === 0 && closed.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-3 md:p-4">
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