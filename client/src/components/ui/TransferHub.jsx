/**
 * TransferHub — Mercado de transferências (compra de jogadores).
 * Estilo cromo face única idêntico ao AuctionCard: faixa por posição,
 * herói com halo + skill, tiles Forma/Jogos/Golos e rodapé de ação único.
 */
import { useMemo, useState } from "react";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { AggBadge } from "../shared/AggBadge.jsx";
import { Badge } from "../shared/Badge.jsx";
import { StarMark } from "../shared/PlayerStatusBadges.jsx";
import { StatTile } from "../shared/StatTile.jsx";
import { Panel } from "../shared/Panel.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { hexToRgba } from "../../utils/colorHelpers.js";
import {
  FLAG_TO_COUNTRY,
  POSITION_TEXT_CLASS,
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  POSITION_BAR_CLASS,
  POSITION_ACCENT_HEX,
} from "../../constants/index.js";

/** @param {number} value */
function fmt(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function statusConfig(status) {
  if (status === "auction") return { label: "Leilão", variant: "info" };
  if (status === "fixed") return { label: "À Venda", variant: "sold" };
  return { label: "Sem Lista", variant: "neutral" };
}

// Rótulo curto por origem do negócio no histórico (uma linha por negócio).
const SOURCE_LABEL = {
  auction: "Leilão",
  fixed: "Mercado",
  proposal: "Cláusula",
  npc: "NPC",
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
      <img
        src={team.crest}
        alt={label}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="w-4 h-4 object-contain bg-white rounded-sm p-px shrink-0 border border-outline-variant/20"
        loading="lazy"
      />
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
    <div className="relative flex items-center gap-2.5 short:gap-1.5 rounded-lg overflow-hidden border border-outline-variant/15 bg-surface-container/60 pl-3 short:pl-2 pr-3 short:pr-2 py-2 short:py-1.5">
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${POSITION_BAR_CLASS[rec.position] || "from-zinc-400 via-zinc-500 to-zinc-600"}`}
      />
      <span
        className="shrink-0 text-[9px] font-black uppercase tracking-widest tabular-nums"
        style={{ color: posHex }}
      >
        {rec.position}
      </span>
      {srcLabel && (
        <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1 py-px rounded-sm border border-outline-variant/20 text-on-surface-variant">
          {srcLabel}
        </span>
      )}
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
          <TeamMark team={sellerTeam} name={originName} />
          <span className="truncate" title={originName}>
            {originName}
          </span>
          <span className="shrink-0 text-zinc-600" aria-hidden="true">
            →
          </span>
          {buyerName ? (
            <>
              <TeamMark team={buyerTeam} name={buyerName} />
              <span className="truncate text-zinc-300 font-semibold" title={buyerName}>
                {buyerName}
              </span>
            </>
          ) : (
            <span className="shrink-0 text-zinc-600">Sem clube</span>
          )}
        </p>
      </div>
      <p className="shrink-0 font-mono font-black tabular-nums text-sm short:text-xs text-emerald-400">
        {fmt(rec.amount || 0)}
      </p>
    </div>
  );
}

function MarketCard({
  player,
  budget,
  me,
  teams,
  teamColorById,
  isSameTeamId,
  onOpenDetails,
  onBuy,
  onBid,
  setGameDialog,
  matchweekCount,
}) {
  const price = player.marketPrice ?? 0;
  const affordable = budget >= price;
  const status = statusConfig(player.transfer_status);
  const isAuction = player.transfer_status === "auction";
  const isFixed = player.transfer_status === "fixed";
  const isListed = isAuction || isFixed;
  const isMyAuction = isSameTeamId(player.auction_seller_team_id, me?.teamId);
  const isSuspended = (player.suspension_until_matchweek ?? 0) > matchweekCount;
  const isInjured = (player.injury_until_matchweek ?? 0) > matchweekCount;

  const posHex = POSITION_ACCENT_HEX[player.position] || "#94a3b8";
  const posText = POSITION_TEXT_CLASS[player.position] || "text-zinc-400";
  const countryName = FLAG_TO_COUNTRY?.[player.nationality] || player.nationality || "";

  const sellerTeam =
    (teams || []).find((t) => Number(t.id) === Number(player.team_id)) || null;
  const sellerCrest = sellerTeam?.crest || player.team_crest || null;
  const sellerName = sellerTeam?.name || player.team_name || null;
  const teamLabel = player.team_name
    ? player.transfer_status === "auction" && player.isExClub
      ? `ex-${player.team_name}`
      : player.team_name
    : sellerName || "Sem clube";

  const formVal = player.form ?? 32;
  const formMood = formVal >= 41 ? "💪" : formVal <= 22 ? "😩" : "👍";
  const formClass = formVal >= 41 ? "text-emerald-400" : formVal <= 22 ? "text-rose-400" : "text-zinc-200";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(player)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails(player);
        }
      }}
      className={`relative flex flex-col rounded-xl overflow-hidden border border-outline-variant/25 bg-gradient-to-b ${POSITION_BG_GRADIENT_CLASS[player.position] || "from-zinc-500/8"} via-surface-container/80 to-surface shadow-sm shadow-black/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg cursor-pointer ${POSITION_GLOW_CLASS[player.position] || ""}`}
    >
      {/* Faixa da posição */}
      <div className={`h-1 shrink-0 bg-gradient-to-r ${POSITION_BAR_CLASS[player.position] || "from-zinc-400 via-zinc-500 to-zinc-600"}`} />

      {/* Header: selo posição + estado + símbolo clube.
          flex-wrap: em larguras muito estreitas (320px) com muitos selos
          (posição + à venda + estrela + suspenso/lesionado + clube) o header
          partia para a direita em overflow-hidden — passa a quebrar linha. */}
      <div className="px-3 short:px-2 pt-2.5 short:pt-1.5 flex flex-wrap items-center gap-1.5 short:gap-1">
        <Badge
          size="sm"
          style={{
            background: hexToRgba(posHex, 0.15),
            color: posHex,
            borderColor: hexToRgba(posHex, 0.35),
          }}
        >
          {player.position}
        </Badge>
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && <StarMark />}
        {isSuspended && <Badge variant="suspended">Suspenso</Badge>}
        {isInjured && <Badge variant="injured">Lesionado</Badge>}
        <span className="ml-auto text-[9px] text-zinc-500 truncate max-w-[110px]" title={teamLabel}>
          {teamLabel}
        </span>
        {sellerTeam || sellerCrest ? (
          sellerCrest ? (
            <img
              src={sellerCrest}
              alt={sellerName || teamLabel}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              className="w-6 h-6 object-contain bg-white rounded-sm p-0.5 shrink-0 border border-outline-variant/20"
              loading="lazy"
              title={sellerName || teamLabel}
            />
          ) : (
            <span
              className="w-6 h-6 rounded-sm flex items-center justify-center font-black text-[8px] leading-none shrink-0 border border-outline-variant/20"
              style={{
                backgroundColor: sellerTeam?.color_primary || teamColorById.get(Number(player.team_id)) || "#333",
                color: sellerTeam?.color_secondary || "#fff",
              }}
              title={sellerName || teamLabel}
            >
              {(sellerName || teamLabel).substring(0, 3).toUpperCase()}
            </span>
          )
        ) : null}
      </div>

      {/* Herói: avatar com halo + skill */}
      <div
        className="mx-3 short:mx-2 mt-2 short:mt-1 rounded-lg flex flex-col items-center pt-3 short:pt-2 pb-2.5 short:pb-1.5 px-2 short:px-1.5"
        style={{ background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${hexToRgba(posHex, 0.22)} 0%, transparent 70%)` }}
      >
        <div className="relative">
          <div
            className="rounded-full"
            style={{ boxShadow: `0 0 0 2px rgba(10,10,16,0.9), 0 0 0 4px ${posHex}, 0 0 22px ${hexToRgba(posHex, 0.45)}` }}
          >
            <PlayerAvatar
              seed={player.id}
              position={player.position}
              teamColor={posHex}
              nationality={player.nationality}
              size="lg"
              photo={player.photo || null}
            />
          </div>
          <span
            className={`absolute -bottom-1 -right-3 min-w-9 h-9 px-1.5 rounded-full bg-surface-container border-2 flex items-center justify-center font-headline font-black text-lg leading-none tabular-nums ${posText}`}
            style={{ borderColor: posHex, textShadow: "0 0 10px currentColor" }}
            title={`Skill ${player.skill}`}
          >
            {player.skill ?? 0}
          </span>
        </div>
        <p className="mt-2 short:mt-1 font-headline font-black text-on-surface text-base short:text-sm leading-tight truncate max-w-full">
          {player.name}
        </p>
        <p className="text-[9px] text-zinc-500 truncate" title={countryName}>
          {[player.nationality, countryName].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Preço + salário */}
      <div className="px-4 short:px-2 mt-3 short:mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/70">Preço</p>
          <p className={`font-mono font-black tabular-nums leading-tight text-xl short:text-base ${affordable ? "text-on-surface" : "text-rose-400"}`}>
            {fmt(price)}
          </p>
          <p className="text-[9px] text-zinc-500 truncate max-w-[130px]">
            {isListed ? (affordable ? "disponível" : "saldo insuficiente") : "sem lista"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60">Salário/sem</p>
          <p className="font-mono text-[11px] text-zinc-300 tabular-nums">{fmt(player.wage || 0)}</p>
        </div>
      </div>

      {/* Mini-stats */}
      <div className="px-3 short:px-2 mt-2 short:mt-1.5 grid grid-cols-3 gap-1.5 short:gap-1">
        <StatTile label="Forma">
          <span className={`tabular-nums ${formClass}`}>
            {formMood} {formVal}
          </span>
        </StatTile>
        <StatTile label="Jogos">
          <span className="tabular-nums">{player.games_played ?? 0}</span>
        </StatTile>
        <StatTile label="Golos">
          <span className="tabular-nums">{player.goals ?? 0}</span>
        </StatTile>
      </div>
      {player.aggressiveness != null && (
        <div className="mt-1.5 short:mt-1 flex items-center justify-center gap-1.5">
          <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/50">Agressividade</span>
          <AggBadge value={player.aggressiveness} />
        </div>
      )}

      {/* Rodapé único */}
      <div className="px-3 short:px-2 py-3 short:py-2 mt-auto">
        {!isListed ? (
          <div className="rounded-lg py-2 text-center border border-outline-variant/15 bg-surface/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sem transferência</p>
          </div>
        ) : isAuction ? (
          isMyAuction ? (
            <div className="rounded-lg py-2 text-center border border-indigo-500/25 bg-indigo-500/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">O teu leilão</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBid(player);
              }}
              disabled={!affordable}
              className="w-full py-2 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: posHex, color: "#0d0d14" }}
            >
              Licitar · {fmt(price)}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setGameDialog({
                mode: "confirm",
                title: `Comprar ${player.name}`,
                description: `${player.position} · Qualidade ${player.skill} · Preço: ${fmt(price)}`,
                confirmLabel: "Confirmar Compra",
                onConfirm: () => onBuy(player.id),
                onCancel: () => {},
              });
            }}
            disabled={!affordable}
            className="w-full py-2 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: posHex, color: "#0d0d14" }}
          >
            {affordable ? `Comprar · ${fmt(price)}` : "Saldo insuficiente"}
          </button>
        )}
      </div>
    </div>
  );
}

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
 *   isSameTeamId: function,
 *   buyPlayer: function,
 *   openAuctionBid: function,
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
  isSameTeamId,
  buyPlayer,
  openAuctionBid,
  onOpenPlayerHistory,
  setGameDialog,
  matchweekCount = 0,
}) {
  const [search, setSearch] = useState("");

  const teamColorById = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < (teams || []).length; i += 1) {
      const t = teams[i];
      if (!t) continue;
      map.set(Number(t.id), t.color_primary || t.colorPrimary || null);
    }
    return map;
  }, [teams]);

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

  return (
    <div className="flex flex-col gap-4 short:gap-2">
    <Panel title="Mercado de Transferências" meta={`${visible.length} jogador${visible.length !== 1 ? "es" : ""}`}>
      <div className="p-3 md:p-4 short:p-2">
        {/* Search + filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 short:gap-1.5 mb-4 short:mb-2">
          <div className="relative md:col-span-2">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-sm select-none pointer-events-none">
              search
            </span>
            <input
              type="text"
              className="w-full bg-surface border border-outline-variant/30 rounded-sm pl-9 pr-4 py-2.5 short:py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/30 text-on-surface"
              placeholder="Pesquisar jogador, clube ou nacionalidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="bg-surface border border-outline-variant/30 rounded-sm px-3 py-2.5 short:py-1.5 text-[11px] font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
            value={marketPositionFilter}
            onChange={(e) => setMarketPositionFilter(e.target.value)}
          >
            <option value="all">Posição: Todas</option>
            <option value="GR">Guarda-Redes</option>
            <option value="DEF">Defesa</option>
            <option value="MED">Médio</option>
            <option value="ATA">Avançado</option>
          </select>
          <select
            className="bg-surface border border-outline-variant/30 rounded-sm px-3 py-2.5 short:py-1.5 text-[11px] font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
            value={marketSort}
            onChange={(e) => setMarketSort(e.target.value)}
          >
            <option value="quality-desc">Qualidade ↓</option>
            <option value="quality-asc">Qualidade ↑</option>
            <option value="price-asc">Preço ↑</option>
            <option value="price-desc">Preço ↓</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            emoji="🔄"
            title="Sem jogadores disponíveis"
            description="Os jogadores colocados em transferência aparecem aqui."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 short:gap-2">
            {visible.map((player) => (
              <MarketCard
                key={player.id}
                player={player}
                budget={budget}
                me={me}
                teams={teams}
                teamColorById={teamColorById}
                isSameTeamId={isSameTeamId}
                onOpenDetails={onOpenPlayerHistory}
                onBuy={buyPlayer}
                onBid={openAuctionBid}
                setGameDialog={setGameDialog}
                matchweekCount={matchweekCount}
              />
            ))}
          </div>
        )}
      </div>
    </Panel>

    {/* ── Histórico de transferências concluídas (época atual) ──────────── */}
    {transferHistory.length > 0 && (
      <Panel
        title="Histórico de Transferências"
        meta={`${transferHistory.length} ${transferHistory.length === 1 ? "transferência" : "transferências"}`}
      >
        <div className="flex flex-col gap-1.5">
          {transferHistory.map((rec, i) => (
            <TransferRow
              key={rec.id ?? `${rec.player_id}-${rec.amount}-${i}`}
              rec={rec}
              teams={teams}
              onOpenPlayer={onOpenPlayerHistory}
            />
          ))}
        </div>
      </Panel>
    )}
    </div>
  );
}
