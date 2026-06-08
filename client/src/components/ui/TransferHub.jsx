/**
 * TransferHub — Mercado de transferências (compra de jogadores).
 * Aplica o design system da STYLE.md: tokens semânticos, cards com header,
 * grid responsivo e estados vazios padronizados.
 */
import { useMemo, useState } from "react";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { AggBadge } from "../shared/AggBadge.jsx";

import { hexToRgba, posRingClass } from "../../utils/colorHelpers.js";

/** @param {number} value */
function fmt(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

/** @param {string} pos */
function posLabel(pos) {
  return (
    {
      GR: "Guarda-Redes",
      DEF: "Defesa",
      MED: "Médio",
      ATA: "Avançado",
    }[pos] || pos
  );
}

/** @param {string} status */
function statusConfig(status) {
  if (status === "auction") {
    return {
      label: "Leilão",
      cls: "bg-primary/20 text-primary border border-primary/35",
    };
  }
  if (status === "fixed") {
    return {
      label: "À Venda",
      cls: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    };
  }
  return {
    label: "Sem Lista",
    cls: "bg-zinc-700/20 text-zinc-400 border border-zinc-600/30",
  };
}

function MarketCard({
  player,
  budget,
  me,
  isSameTeamId,
  teamColorById,
  isFlipped,
  onFlip,
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
  const teamColor =
    player.team_color_primary ||
    player.color_primary ||
    teamColorById.get(Number(player.team_id)) ||
    "#95d4b3";
  const tintStrong = hexToRgba(teamColor, 0.3);
  const tintSoft = hexToRgba(teamColor, 0.18);
  const tintEdge = hexToRgba(teamColor, 0.24);

  return (
    <div className="[perspective:1200px] hover:scale-[1.02] transition-transform duration-300">
      <div
        className="block w-full text-left"
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFlip();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Virar card de ${player.name}`}
        aria-expanded={isFlipped}
      >
        <div
          className={`relative h-[360px] w-full transition-transform duration-300 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
        >
          <article
            className={`absolute inset-0 rounded-xl border-2 bg-surface-container-low/95 p-4 shadow-xl ring-2 ${posRingClass(player.position)} [backface-visibility:hidden] overflow-hidden`}
            style={{
              background: `linear-gradient(165deg, ${tintStrong} 0%, ${tintSoft} 42%, rgba(35,39,56,0.93) 100%)`,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
            }}
          >
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm tracking-widest ${status.cls}`}
                >
                  {status.label}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                  {(isSuspended || isInjured) && (
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm tracking-widest whitespace-nowrap border ${
                        isSuspended
                          ? "bg-error-container/40 text-error border-error/30"
                          : "bg-error-container/20 text-error border-error/20"
                      }`}
                    >
                      {isSuspended ? "🟥 Susp." : "🩹 Les."}
                    </span>
                  )}
                  <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider">
                    {player.position}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <PlayerAvatar seed={player.id} position={player.position} teamColor={teamColor} nationality={player.nationality} />
                <div className="text-right min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">
                    Qualidade
                  </p>
                  <p className="font-headline font-black text-4xl leading-none text-primary tabular-nums">
                    {player.skill ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-4 min-w-0">
                <p className="font-headline font-black uppercase text-base leading-tight text-on-surface truncate">
                  {player.name}
                  {!!player.is_star &&
                    (player.position === "MED" || player.position === "ATA") && (
                      <span className="ml-1 text-amber-400">★</span>
                    )}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                  {posLabel(player.position)}
                  {player.nationality ? ` · ${player.nationality}` : ""}
                </p>
                <p className="text-[11px] text-on-surface-variant/60 truncate">
                  {player.team_name || "Sem clube"}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-outline-variant/20 bg-surface-container p-2">
                  <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">
                    Agr
                  </p>
                  <div className="mt-1">
                    <AggBadge value={player.aggressiveness} />
                  </div>
                </div>
                <div className="rounded-md border border-outline-variant/20 bg-surface-container p-2">
                  <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">
                    Golos
                  </p>
                  <p className="font-headline font-black text-lg leading-none text-emerald-400">
                    {player.goals ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-4 flex items-end justify-between gap-2">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-black">
                    Preço
                  </p>
                  <p
                    className={`font-mono font-black text-sm tabular-nums ${affordable ? "text-on-surface" : "text-rose-400"}`}
                  >
                    {fmt(price)}
                  </p>
                </div>
                <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-wider">
                  tocar para virar
                </span>
              </div>
            </div>
          </article>

          <article
            className="absolute inset-0 rounded-xl border-2 border-outline-variant/35 bg-surface-container-low p-4 shadow-xl [transform:rotateY(180deg)] [backface-visibility:hidden] overflow-hidden"
            style={{
              background: `linear-gradient(15deg, ${tintSoft} 0%, rgba(36,40,58,0.95) 52%, ${hexToRgba(teamColor, 0.2)} 100%)`,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
            }}
          >
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-headline font-black uppercase text-sm text-on-surface truncate">
                    {player.name}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/60 truncate">
                    {player.team_name || "Sem clube"}
                  </p>
                </div>
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm tracking-widest ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
                <div className="rounded-md bg-surface-container p-1.5 border border-outline-variant/20 text-center">
                  <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Qual.</p>
                  <p className="font-headline font-black text-base text-primary">{player.skill ?? 0}</p>
                </div>
                <div className="rounded-md bg-surface-container p-1.5 border border-outline-variant/20 text-center">
                  <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Forma</p>
                  <p className={`font-black text-sm ${(player.form ?? 100) >= 115 ? "text-emerald-400" : (player.form ?? 100) <= 85 ? "text-rose-400" : "text-on-surface"}`}>{player.form ?? 100}%</p>
                </div>
                <div className="rounded-md bg-surface-container p-1.5 border border-outline-variant/20 text-center">
                  <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Resist.</p>
                  <p className="font-black text-sm text-cyan-400">{player.resistance ?? 0}</p>
                </div>
                <div className="rounded-md bg-surface-container p-1.5 border border-outline-variant/20 text-center">
                  <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Jogos</p>
                  <p className="font-black text-sm text-on-surface">{player.games_played ?? 0}</p>
                </div>
                <div className="rounded-md bg-surface-container p-1.5 border border-outline-variant/20 text-center">
                  <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Golos</p>
                  <p className="font-black text-sm text-emerald-400">{player.goals ?? 0}</p>
                </div>
                <div className="rounded-md bg-surface-container p-1.5 border border-outline-variant/20 text-center">
                  <p className="text-[8px] uppercase tracking-widest text-on-surface-variant font-black">Verm.</p>
                  <p className={`font-black text-sm ${(player.red_cards ?? 0) > 0 ? "text-rose-400" : "text-on-surface"}`}>{player.red_cards ?? 0}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">Agressividade</span>
                <AggBadge value={player.aggressiveness} />
              </div>

              <div className="mt-4 rounded-md bg-surface-container p-3 border border-outline-variant/20">
                <div className="flex justify-between text-[11px]">
                  <span className="text-on-surface-variant">Preço</span>
                  <span
                    className={`font-mono font-black tabular-nums ${affordable ? "text-on-surface" : "text-rose-400"}`}
                  >
                    {fmt(price)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] mt-1">
                  <span className="text-on-surface-variant">Ordenado</span>
                  <span className="font-mono font-black text-on-surface tabular-nums">
                    {fmt(player.contract_requested_wage || player.wage || 0)}
                  </span>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-1 gap-2 pt-4">
                {isListed ? (
                  isAuction ? (
                    isMyAuction ? (
                      <div className="py-2 text-center text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest border border-outline-variant/20 rounded-md">
                        O teu leilão
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBid(player);
                        }}
                        disabled={!affordable}
                        className="w-full py-2.5 bg-primary hover:brightness-110 disabled:opacity-30 text-on-primary font-headline font-black tracking-[0.14em] rounded-md transition-all uppercase text-[10px]"
                      >
                        {affordable ? "Licitar" : "Saldo insuficiente"}
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
                      className="w-full py-2.5 bg-primary hover:brightness-110 disabled:opacity-30 text-on-primary font-headline font-black tracking-[0.14em] rounded-md transition-all uppercase text-[10px]"
                    >
                      {affordable ? "Comprar" : "Saldo insuficiente"}
                    </button>
                  )
                ) : (
                  <div className="py-2 text-center text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest border border-outline-variant/20 rounded-md">
                    Sem transferência
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(player);
                  }}
                  className="w-full py-2.5 bg-surface-container-high hover:bg-surface-bright text-on-surface font-black tracking-[0.14em] rounded-md transition-all uppercase text-[10px] border border-outline-variant/25"
                >
                  Ver detalhes
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   players: Array,
 *   teams: Array,
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
  const [flippedId, setFlippedId] = useState(null);

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
    <section className="bg-surface-container rounded-md overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between bg-surface-container-high/50">
        <h2 className="text-base font-black font-headline tracking-tight text-tertiary uppercase">
          Mercado de Transferências
        </h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          {visible.length} jogador{visible.length !== 1 ? "es" : ""}
        </span>
      </div>

      <div className="p-3 md:p-4">
        {/* ── Search + filters ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
          <div className="relative md:col-span-2">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-sm select-none pointer-events-none">
              search
            </span>
            <input
              type="text"
              className="w-full bg-surface border border-outline-variant/30 rounded-sm pl-9 pr-4 py-2.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/30 text-on-surface"
              placeholder="Pesquisar jogador, clube ou nacionalidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="bg-surface border border-outline-variant/30 rounded-sm px-3 py-2.5 text-[11px] font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
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
            className="bg-surface border border-outline-variant/30 rounded-sm px-3 py-2.5 text-[11px] font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
            value={marketSort}
            onChange={(e) => setMarketSort(e.target.value)}
          >
            <option value="quality-desc">Qualidade ↓</option>
            <option value="quality-asc">Qualidade ↑</option>
            <option value="price-asc">Preço ↑</option>
            <option value="price-desc">Preço ↓</option>
          </select>
        </div>

        {/* ── Player grid ──────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-outline-variant/25 bg-surface-container py-12">
            <span className="text-3xl text-on-surface-variant/40">🔄</span>
            <p className="text-on-surface-variant/60 text-xs font-bold">Sem jogadores disponíveis</p>
            <p className="text-on-surface-variant/40 text-[10px] text-center max-w-[260px]">
              Os jogadores colocados em transferência aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map((player) => (
              <MarketCard
                key={player.id}
                player={player}
                budget={budget}
                me={me}
                isSameTeamId={isSameTeamId}
                teamColorById={teamColorById}
                isFlipped={flippedId === player.id}
                onFlip={() =>
                  setFlippedId((prev) => (prev === player.id ? null : player.id))
                }
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
    </section>
  );
}
