/**
 * TransferHub — Mercado de transferências (compra de jogadores).
 * Topo comum (TransferHeader: saldo + filtros) e cromos compactos com a cabeça
 * partilhada com os Leilões (TransferCardHead) e um "bilhete" de negócio:
 * preço, pechincha face ao valor, peso no saldo e ação.
 */
import { memo, useContext, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TeamLink } from "../shared/TeamLink.jsx";
import { GameContext } from "../../contexts/GameContext.jsx";
import { formatCurrency } from "../../utils/formatters.js";
import { Badge } from "../shared/Badge.jsx";
import { StarMark } from "../shared/PlayerStatusBadges.jsx";
import { Panel } from "../shared/Panel.jsx";
import { TabBar } from "../shared/TabBar.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { BudgetMeter, FilterChip, TransferCardHead, TransferHeader } from "../transfers/TransferChrome.jsx";
import { staggerItemProps } from "../../motion.js";
import {
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  POSITION_BAR_CLASS,
  POSITION_ACCENT_HEX,
} from "../../constants/index.js";

const POSITIONS = ["GR", "DEF", "MED", "ATA"];

// Rótulo curto por origem do negócio no histórico (uma linha por negócio).
const SOURCE_LABEL = {
  auction: "Leilão",
  fixed: "Mercado",
  proposal: "Cláusula",
  npc: "Transf.",
};

/**
 * TeamMark — mini-brasão (16px) duma equipa no histórico de transferências.
 * Bloco de iniciais com as cores da equipa (padrão AuctionResultRow, compacto).
 * @param {{ team: object | null, name: string }} props
 */
function TeamMark({ team, name }) {
  if (!team && !name) return null;
  const label = name || "—";
  if (team?.crest) {
    return (
      <span
        className="w-4 h-4 rounded-sm shrink-0 border border-outline-variant/20 shadow-md"
        style={{ backgroundColor: team?.color_primary || "#333" }}
      >
        <img
          src={team.crest}
          alt={label}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="crest-shadow w-full h-full object-contain p-px"
          loading="lazy"
        />
      </span>
    );
  }
  return (
    <span
      className="w-4 h-4 rounded-sm flex items-center justify-center overflow-hidden font-black text-[7px] leading-none shrink-0 border border-outline-variant/20"
      style={{
        backgroundColor: team?.color_primary || "#333",
        color: team?.color_secondary || "#fff",
      }}
      title={label}
    >
      {String(label).substring(0, 3).toUpperCase()}
    </span>
  );
}

/**
 * TransferRow — linha compacta de uma transferência concluída (histórico).
 * Faixa da posição à esquerda, nome (clicável — abre a página do jogador),
 * origem → destino (brasão + nome) e valor à direita. Leitura rápida, sem cards.
 * @param {{ rec: object, teams?: Array, onOpenPlayer?: (rec: object) => void }} props
 */
function TransferRow({ rec, teams = [], onOpenPlayer }) {
  const posHex = POSITION_ACCENT_HEX[rec.position] || "#94a3b8";
  const sellerTeam =
    (teams || []).find((t) => Number(t.id) === Number(rec.seller_team_id)) || null;
  const buyerTeam =
    (teams || []).find((t) => Number(t.id) === Number(rec.buyer_team_id)) || null;

  const originName = rec.seller_team_name || sellerTeam?.name || "Sem clube";
  const buyerName = rec.buyer_team_name || buyerTeam?.name || "";
  const srcLabel = SOURCE_LABEL[rec.source] || rec.source || "";

  // IDs negativos (juniors efémeros) não têm página de jogador.
  const canOpen = rec.player_id != null && rec.player_id >= 0;
  const star =
    !!rec.is_star && (rec.position === "MED" || rec.position === "ATA") && (
      <StarMark />
    );

  return (
    // shrink-0: sem isto, com a lista cheia (max-h-80) o flex esmaga as
    // linhas para caber em vez de fazer scroll (overflow-hidden anula o
    // mínimo automático) e os nomes saem cortados em cima/baixo.
    <div className="relative flex items-center gap-2.5 short:gap-1.5 rounded-lg overflow-hidden border border-outline-variant/15 bg-surface-container/60 pl-3 short:pl-2 pr-3 short:pr-2 py-2 short:py-1.5 shrink-0">
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${POSITION_BAR_CLASS[rec.position] || "from-zinc-400 via-zinc-500 to-zinc-600"}`}
      />
      <span
        className="shrink-0 text-[9px] font-black uppercase tracking-widest tabular-nums"
        style={{ color: posHex }}
      >
        {rec.position}
      </span>
      <div className="min-w-0 flex-1">
        {canOpen ? (
          <button
            type="button"
            onClick={() => onOpenPlayer?.({ id: rec.player_id })}
            className="block w-full text-left bg-transparent cursor-pointer hover:underline underline-offset-2 text-sm short:text-xs font-bold text-on-surface leading-tight truncate"
            title="Ver página do jogador"
          >
            {rec.player_name}
            {star}
          </button>
        ) : (
          <p className="text-sm short:text-xs font-bold text-on-surface leading-tight truncate">
            {rec.player_name}
            {star}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-500 leading-tight min-w-0">
          {srcLabel && (
            <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1 py-px rounded-sm border border-outline-variant/20 text-on-surface-variant">
              {srcLabel}
            </span>
          )}
          <TeamMark team={sellerTeam} name={originName} />
          <span className="truncate" title={originName}>
            <TeamLink teamId={rec.seller_team_id}>{originName}</TeamLink>
          </span>
          <span className="shrink-0 text-zinc-600" aria-hidden="true">
            →
          </span>
          {buyerName ? (
            <>
              <TeamMark team={buyerTeam} name={buyerName} />
              <span className="truncate text-zinc-300 font-semibold" title={buyerName}>
                <TeamLink teamId={rec.buyer_team_id}>{buyerName}</TeamLink>
              </span>
            </>
          ) : (
            <span className="shrink-0 text-zinc-600">Sem clube</span>
          )}
        </p>
      </div>
      <p className="shrink-0 font-mono font-black tabular-nums text-sm short:text-xs text-emerald-400">
        {formatCurrency(rec.amount || 0)}
      </p>
    </div>
  );
}

/**
 * DealTag — preço face ao valor do jogador («−25% do valor» é pechincha).
 * @param {{ pct: number }} props
 */
function DealTag({ pct }) {
  if (pct === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-outline-variant/30 bg-surface-container/60 text-[10px] font-black uppercase tracking-wider text-on-surface-variant"
        title="Preço igual ao valor de mercado do jogador"
      >
        = valor de mercado
      </span>
    );
  }
  const bargain = pct < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider tabular-nums ${
        bargain
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
          : "bg-amber-500/12 text-amber-300 border-amber-500/30"
      }`}
      title="Preço comparado com o valor de mercado do jogador"
    >
      <span className="material-symbols-outlined text-[13px] leading-none w-[1em] overflow-hidden">{bargain ? "trending_down" : "trending_up"}</span>
      {bargain ? "−" : "+"}
      {Math.abs(pct)}% do valor
    </span>
  );
}

const MarketCard = memo(function MarketCard({
  player,
  budget,
  me,
  teams,
  isSameTeamId,
  onOpenDetails,
  onBuy,
  onAuction,
  onRemove,
  setGameDialog,
  nowIdx,
}) {
  const price = player.marketPrice ?? 0;
  const affordable = budget >= price;
  const isListed = player.transfer_status === "fixed";
  const isOwn = isSameTeamId(player.team_id, me?.teamId);
  const suspLeft = (player.suspension_until_matchweek ?? 0) - nowIdx;
  const injLeft = (player.injury_until_matchweek ?? 0) - nowIdx;
  const posHex = POSITION_ACCENT_HEX[player.position] || "#94a3b8";
  const value = Number(player.value) || 0;
  const dealPct = value > 0 ? Math.round((price / value - 1) * 100) : null;

  const sellerTeam =
    (teams || []).find((t) => Number(t.id) === Number(player.team_id)) || null;
  const teamLabel = player.team_name || sellerTeam?.name || "Sem clube";

  const askBuy = () =>
    setGameDialog({
      mode: "confirm",
      title: `Comprar ${player.name}`,
      description: `${player.position} · Qualidade ${player.skill} · Preço: ${formatCurrency(price)}`,
      confirmLabel: "Confirmar Compra",
      onConfirm: () => onBuy(player.id),
      onCancel: () => {},
    });

  return (
    <article
      className={`relative flex flex-col rounded-xl overflow-hidden border border-outline-variant/25 bg-gradient-to-b ${POSITION_BG_GRADIENT_CLASS[player.position] || "from-zinc-500/8"} via-surface-container/80 to-surface shadow-sm shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${POSITION_GLOW_CLASS[player.position] || ""}`}
    >
      <div className={`h-1 shrink-0 bg-gradient-to-r ${POSITION_BAR_CLASS[player.position] || "from-zinc-400 via-zinc-500 to-zinc-600"}`} />

      <TransferCardHead
        player={player}
        team={sellerTeam}
        teamId={player.team_id}
        teamLabel={teamLabel}
        onOpen={() => onOpenDetails(player)}
        badges={
          <>
            {isOwn && <Badge variant="info" size="sm" title="Jogador do teu plantel">Teu</Badge>}
            {!isListed && <Badge variant="neutral" size="sm">Sem lista</Badge>}
            {!!player.is_star && (player.position === "MED" || player.position === "ATA") && <StarMark className="ml-0" />}
            {suspLeft > 0 && <Badge variant="suspended">🟥 {suspLeft + 1}J</Badge>}
            {injLeft > 0 && <Badge variant="injured">🩹 {injLeft + 1}J</Badge>}
          </>
        }
      />

      <div className="px-3 short:px-2 mt-2.5 flex items-center justify-between gap-2 text-[11px] text-on-surface-variant tabular-nums">
        <p>
          <b className="text-on-surface font-black">{player.games_played ?? 0}</b> jogos ·{" "}
          <b className="text-emerald-400 font-black">{player.goals ?? 0}</b> golos
        </p>
        <p title="Ordenado semanal">
          Ordenado <b className="text-on-surface font-black">{formatCurrency(player.wage || 0)}</b>/sem
        </p>
      </div>

      {/* Bilhete do negócio: preço, pechincha, peso no saldo e ação */}
      <div className="mt-auto pt-3 short:pt-2 px-2 pb-2">
        <div className="rounded-lg border border-outline-variant/15 bg-surface/60 p-2.5 short:p-2 space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/70">Preço</p>
              <p className={`font-mono font-black tabular-nums leading-tight text-xl short:text-base text-on-surface`}>
                {formatCurrency(price)}
              </p>
            </div>
            {dealPct != null && <DealTag pct={dealPct} />}
          </div>
          {!isOwn && isListed && <BudgetMeter price={price} budget={budget} />}

          {isOwn ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onRemove(player)}
                className="flex-1 min-h-10 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110 border border-outline-variant/30 bg-surface text-on-surface-variant"
              >
                Retirar
              </button>
              <button
                type="button"
                onClick={() => onAuction(player)}
                className="flex-1 min-h-10 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110 inline-flex items-center justify-center gap-1"
                style={{ background: posHex, color: "#0d0d14" }}
              >
                <span className="material-symbols-outlined text-[16px] leading-none w-[1em] overflow-hidden">gavel</span>
                Leiloar
              </button>
            </div>
          ) : !isListed ? (
            <p className="min-h-10 flex items-center justify-center rounded-lg border border-dashed border-outline-variant/25 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
              Sem transferência
            </p>
          ) : (
            <button
              type="button"
              onClick={askBuy}
              disabled={!affordable}
              className="w-full min-h-10 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110 inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:bg-rose-500/10 disabled:text-rose-300 disabled:border-rose-500/40"
              style={
                affordable
                  ? { background: posHex, color: "#0d0d14", border: `1px solid ${posHex}`, boxShadow: `0 6px 18px -8px ${posHex}` }
                  : undefined
              }
            >
              <span className="material-symbols-outlined text-[16px] leading-none w-[1em] overflow-hidden">{affordable ? "shopping_cart" : "block"}</span>
              {affordable ? "Comprar" : "Saldo insuficiente"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

// Ordenação em linguagem de treinador (o "piores primeiro" nunca é o que se procura).
const SORT_TABS = [
  { key: "quality-desc", label: "Melhores" },
  { key: "price-asc", label: "Baratos" },
  { key: "price-desc", label: "Caros" },
];

/**
 * @param {{
 *   players: Array,
 *   teams: Array,
 *   transferHistory: Array,
 *   budget: number,
 *   me: object,
 *   marketPositionFilter: string,
 *   setMarketPositionFilter: function,
 *   marketSort: string,
 *   setMarketSort: function,
 *   showOwnMarketPlayers: boolean,
 *   setShowOwnMarketPlayers: function,
 *   isSameTeamId: function,
 *   buyPlayer: function,
 *   listPlayerAuction: function,
 *   removeFromTransferList: function,
 *   onOpenPlayerHistory: function,
 *   setGameDialog: function,
 *   matchweekCount: number,
 * }} props
 */
export function TransferHub({
  players,
  teams,
  transferHistory = [],
  budget,
  me,
  marketPositionFilter,
  setMarketPositionFilter,
  marketSort,
  setMarketSort,
  showOwnMarketPlayers = false,
  setShowOwnMarketPlayers,
  isSameTeamId,
  buyPlayer,
  listPlayerAuction,
  removeFromTransferList,
  onOpenPlayerHistory,
  setGameDialog,
  matchweekCount = 0,
}) {
  const [search, setSearch] = useState("");
  const game = useContext(GameContext);
  const nowIdx = game?.calendarIndex ?? matchweekCount;

  // Histórico: omitir vendas por leilão (só listagens Mercado/cláusula/NPC),
  // porque as vendas de leilão já aparecem no separador "Leilões" (Recentes).
  const historyRecords = useMemo(() => {
    const list = transferHistory || [];
    return list.filter((rec) => rec.source !== "auction");
  }, [transferHistory]);

  // Contagens por posição para os chips (padrão MySquadTab): base não filtrada
  // por posição (marketPairs do contexto) com as mesmas regras da lista
  // (sem leilões + regra dos próprios à venda).
  const posCounts = useMemo(() => {
    const base = (game?.marketPairs ?? players).filter(
      (p) =>
        p.transfer_status !== "auction" &&
        (showOwnMarketPlayers
          ? p.team_id === me?.teamId
          : p.team_id !== me?.teamId),
    );
    const counts = { all: base.length, GR: 0, DEF: 0, MED: 0, ATA: 0 };
    for (const p of base) {
      if (counts[p.position] != null) counts[p.position] += 1;
    }
    return counts;
  }, [game?.marketPairs, players, me?.teamId, showOwnMarketPlayers]);

  const posTabs = useMemo(
    () => [
      { key: "all", label: `Todas · ${posCounts.all}` },
      ...POSITIONS.map((pos) => ({ key: pos, label: `${pos} · ${posCounts[pos]}` })),
    ],
    [posCounts],
  );

  const visible = useMemo(() => {
    const filtered = players.filter((p) => p.transfer_status !== "auction");
    if (!search.trim()) return filtered;
    const q = search.trim().toLowerCase();
    return filtered.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.team_name?.toLowerCase().includes(q) ||
        p.nationality?.toLowerCase().includes(q),
    );
  }, [players, search]);

  const listed = visible.filter((p) => p.transfer_status === "fixed");
  const affordableCount = listed.filter((p) => budget >= (p.marketPrice ?? 0)).length;
  const bargainCount = listed.filter((p) => p.value > 0 && (p.marketPrice ?? 0) < p.value).length;

  return (
    <div className="flex flex-col gap-3 sm:gap-4 short:gap-2">
      <TransferHeader
        icon="swap_horiz"
        title="Mercado"
        budget={budget}
        chips={[
          { value: listed.length, label: "à venda", icon: "sell" },
          { value: affordableCount, label: "cabem no saldo", tone: "good", icon: "savings" },
          ...(bargainCount > 0 ? [{ value: bargainCount, label: "abaixo do valor", tone: "warn", icon: "local_fire_department" }] : []),
        ]}
      >
        <TabBar size="sm" expand tabs={posTabs} active={marketPositionFilter} onChange={setMarketPositionFilter} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px] w-[1em] overflow-hidden select-none pointer-events-none">
              search
            </span>
            <input
              type="text"
              className="w-full min-h-10 bg-surface border border-outline-variant/30 rounded-lg pl-10 pr-4 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/40 text-on-surface"
              placeholder="Jogador, clube ou nacionalidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar no mercado"
            />
          </div>
          <FilterChip active={!!showOwnMarketPlayers} onChange={(v) => setShowOwnMarketPlayers?.(v)} icon="person">
            Os meus
          </FilterChip>
          <TabBar size="sm" expand tabs={SORT_TABS} active={marketSort} onChange={setMarketSort} className="w-full sm:w-72 sm:order-first" />
        </div>
      </TransferHeader>

      <div className={`grid grid-cols-1 gap-3 sm:gap-4 items-start ${historyRecords.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        {visible.length === 0 ? (
          <div className="rounded-md bg-surface-container">
            <EmptyState
              icon={showOwnMarketPlayers ? "person_off" : "storefront"}
              title={showOwnMarketPlayers ? "Não tens jogadores à venda" : "Mercado vazio"}
              description={
                showOwnMarketPlayers
                  ? "Põe um jogador à venda a partir do Plantel."
                  : search.trim()
                    ? "Nenhum jogador corresponde à pesquisa."
                    : "Os jogadores colocados em transferência aparecem aqui."
              }
            />
          </div>
        ) : (
          /* auto-fill: as colunas nascem da largura (evita a armadilha sm>md/lg do STYLE §7). */
          <div className="grid gap-2.5 sm:gap-3 short:gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))]">
            {visible.map((player, i) => (
              <motion.div key={player.id} className="min-w-0 flex flex-col [&>article]:flex-1" {...staggerItemProps(i)}>
                  <MarketCard
                    player={player}
                    budget={budget}
                    me={me}
                    teams={teams}
                    isSameTeamId={isSameTeamId}
                    onOpenDetails={onOpenPlayerHistory}
                    onBuy={buyPlayer}
                    onAuction={listPlayerAuction}
                    onRemove={removeFromTransferList}
                    setGameDialog={setGameDialog}
                    nowIdx={nowIdx}
                  />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Histórico de transferências concluídas (época atual, sem leilões) ── */}
        {historyRecords.length > 0 && (
          <aside className="xl:sticky xl:top-0">
            <Panel
              title="Últimos negócios"
              icon="history"
              meta={`${historyRecords.length}`}
            >
              <div className="flex flex-col gap-1.5 max-h-80 xl:max-h-[70vh] overflow-y-auto pr-1">
                {historyRecords.slice(0, 12).map((rec, i) => (
                  <TransferRow
                    key={rec.id ?? `${rec.player_id}-${rec.amount}-${i}`}
                    rec={rec}
                    teams={teams}
                    onOpenPlayer={onOpenPlayerHistory}
                  />
                ))}
              </div>
            </Panel>
          </aside>
        )}
      </div>
    </div>
  );
}
