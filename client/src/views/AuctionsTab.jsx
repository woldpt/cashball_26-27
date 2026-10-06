/**
 * AuctionsTab — Página de leilões ativos e recentes.
 * Topo comum das transferências (saldo + chips «a liderar»/«superado») com os
 * filtros; «Em curso» ordenado pelo fim mais próximo; «Recentes» numa coluna
 * lateral no desktop e por baixo no telemóvel.
 *
 * Scroll: a página é full-bleed com UM único scroll (a raiz é o contentor) —
 * sem áreas de scroll internas.
 */
import { AuctionCard } from "../components/auctions/AuctionCard.jsx";
import { AuctionResultRow } from "../components/auctions/AuctionResultRow.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { FilterChip, TransferHeader } from "../components/transfers/TransferChrome.jsx";
import { POSITIONS } from "../utils/playerHelpers.js";
import { auctionStanding, sortByEnding } from "../utils/auctionStanding.js";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerItemProps } from "../motion.js";

export function AuctionsTab({ activeAuctions = [], highlightAuctionId = null, me, teams = [], teamInfo, matchweekCount = 0, socket, onOpenPlayerHistory }) {
  const [positionFilter, setPositionFilter] = useState("all");
  const [showOwnOnly, setShowOwnOnly] = useState(false);

  // Navegação com contexto (ex.: fallback do modal da scout): leva o cromo
  // correspondente para a vista e destaca-o com um anel âmbar.
  useEffect(() => {
    if (highlightAuctionId == null) return;
    document
      .getElementById(`auction-${highlightAuctionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightAuctionId, activeAuctions.length]);

  const matchesPos = (a) => positionFilter === "all" || a.position === positionFilter;
  // "Os meus": vendo ou licitei (em curso) ou comprei (recentes, via resultado).
  const matchesOwn = (a) => {
    if (!showOwnOnly) return true;
    if (me?.teamId == null) return false;
    if (auctionStanding(a, me.teamId)) return true;
    return Number(a.result?.buyerTeamId) === Number(me.teamId);
  };
  const openAll = activeAuctions.filter((a) => !a.closed);
  const liveAll = sortByEnding(openAll.filter(matchesPos));
  // Recentes: mais recentes primeiro (defesa — a ordem do servidor é de
  // inserção, que já é cronológica, mas não contractual).
  const closedAll = activeAuctions
    .filter((a) => a.closed && matchesPos(a))
    .sort((a, b) => (b.closedMatchweek ?? 0) - (a.closedMatchweek ?? 0));
  const live = liveAll.filter(matchesOwn);
  const closed = closedAll.filter(matchesOwn);

  const standings = openAll.map((a) => auctionStanding(a, me?.teamId));
  const leading = standings.filter((s) => s === "leader").length;
  const outbid = standings.filter((s) => s === "outbid").length;

  const positionTabs = [
    { key: "all", label: `Todas · ${activeAuctions.length}` },
    ...POSITIONS.map((pos) => ({
      key: pos,
      label: `${pos} · ${activeAuctions.filter((a) => a.position === pos).length}`,
    })),
  ];

  return (
    /* Scroll único da página: topo + painéis rolam juntos (sem overflow interno). */
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="p-2 sm:p-4 short:p-1.5 flex flex-col gap-3 sm:gap-4 short:gap-2">
        <TransferHeader
          icon="gavel"
          title="Leilões"
          budget={teamInfo?.budget || 0}
          chips={[
            { value: openAll.length, label: "a decorrer", icon: "timer" },
            ...(leading > 0 ? [{ value: leading, label: "a liderar", tone: "good", icon: "emoji_events" }] : []),
            ...(outbid > 0 ? [{ value: outbid, label: "superado", tone: "bad", icon: "trending_down" }] : []),
          ]}
        >
          {activeAuctions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <TabBar tabs={positionTabs} active={positionFilter} onChange={setPositionFilter} expand className="flex-1 min-w-[260px]" />
              <FilterChip active={showOwnOnly} onChange={setShowOwnOnly} icon="person">
                Os meus
              </FilterChip>
            </div>
          )}
        </TransferHeader>

        {live.length === 0 && closed.length === 0 ? (
          <div className="flex-1 flex items-center justify-center rounded-md bg-surface-container">
            <EmptyState
              icon="gavel"
              title={activeAuctions.length > 0 ? "Sem leilões com estes filtros" : "Sem leilões a mostrar"}
              description={
                activeAuctions.length > 0
                  ? showOwnOnly
                    ? "Ajusta a posição ou desliga «Os meus»."
                    : "Escolhe outra posição no filtro."
                  : "Quando um clube colocar um jogador em leilão, aparece aqui."
              }
            />
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-3 sm:gap-4 items-start ${closed.length > 0 && live.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
            {live.length > 0 && (
              <section className="min-w-0">
                <h2 className="mb-2 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-error animate-ping opacity-60" />
                    <span className="relative w-2 h-2 rounded-full bg-error" />
                  </span>
                  Em curso · {live.length}
                </h2>
                {/* auto-fill: colunas pela largura (evita a armadilha sm>md/lg do STYLE §7). */}
                <div className="grid gap-2.5 sm:gap-3 short:gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))]">
                  {live.map((auction, i) => (
                    <motion.div
                      key={auction.playerId}
                      id={`auction-${auction.playerId}`}
                      className={`min-w-0 ${Number(auction.playerId) === Number(highlightAuctionId) ? "rounded-xl ring-2 ring-amber-400 scroll-mt-4" : ""}`}
                      {...staggerItemProps(i)}
                    >
                      <AuctionCard
                        auction={auction}
                        me={me}
                        teams={teams}
                        teamInfo={teamInfo}
                        matchweekCount={matchweekCount}
                        socket={socket}
                        onOpenDetails={onOpenPlayerHistory}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {closed.length > 0 && (
              <aside className="min-w-0 xl:sticky xl:top-0">
                <Panel title="Recentes" icon="history" meta={`${closed.length}`}>
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
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
