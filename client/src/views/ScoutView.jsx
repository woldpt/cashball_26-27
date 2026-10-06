import { useMemo, useState } from "react";
import { socket } from "../socket.js";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { PlayerRow } from "../components/shared/PlayerRow.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { FilterChip, TransferHeader } from "../components/transfers/TransferChrome.jsx";
import { AuctionBidModal } from "../components/modals/AuctionBidModal.jsx";
import {
  DIVISION_NAMES,
  TRANSFER_CLAUSE_MULT,
  TRANSFER_LISTED_PRICE_MULT,
  AUCTION_BID_STEP,
} from "../constants/index.js";
import { formatCurrency } from "../utils/formatters.js";
import { isSameTeamId, normalizeTeamId } from "../utils/teamHelpers.js";

/**
 * Converte um campo numérico de texto em número ou `null` (vazio/inválido).
 * @param {string} value - valor do input numérico.
 * @returns {number|null}
 */
function toNumOrNull(value) {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const PRICE_INPUT_TITLE = `Preço de aquisição: preço de lista (à venda/leilão) ou cláusula (valor × ${TRANSFER_CLAUSE_MULT}) se não listado`;

const SORTS = [
  { value: "quality-desc", label: "Qualidade ↓" },
  { value: "quality-asc", label: "Qualidade ↑" },
  { value: "value-desc", label: "Valor ↓" },
  { value: "value-asc", label: "Valor ↑" },
  { value: "age-asc", label: "Idade ↑" },
  { value: "age-desc", label: "Idade ↓" },
];

const TRANSFER_STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "none", label: "Sem lista" },
  { value: "fixed", label: "À venda" },
  { value: "auction", label: "Leilão" },
];

const POSITION_TABS = [
  { key: "all", label: "Todas" },
  { key: "GR", label: "GR" },
  { key: "DEF", label: "DEF" },
  { key: "MED", label: "MED" },
  { key: "ATA", label: "ATA" },
];

const DEFAULT_FILTERS = {
  name: "",
  position: "all",
  skillMin: "",
  skillMax: "",
  ageMin: "",
  ageMax: "",
  priceMin: "",
  priceMax: "",
  division: "all",
  transferStatus: "all",
  isStar: false,
  onlyAvailable: false,
  onlyAffordable: false,
  sort: "quality-desc",
};

// Filtros que vivem dentro de «Filtros avançados» (contam para o selo).
const ADVANCED_KEYS = ["skillMin", "skillMax", "ageMin", "ageMax", "priceMin", "priceMax", "division", "transferStatus", "sort"];

// Pesquisas prontas: partem dos filtros por defeito (resultado previsível).
const PRESETS = [
  { label: "Craques ao alcance", icon: "star", filters: { isStar: true, onlyAffordable: true } },
  { label: "Jovens promessas", icon: "child_care", filters: { ageMax: "21" } },
  { label: "À venda agora", icon: "sell", filters: { transferStatus: "fixed", sort: "value-asc" } },
  { label: "Guarda-redes", icon: "sports_handball", filters: { position: "GR" } },
];

const FIELD = "w-full min-w-0 min-h-10 bg-surface border border-outline-variant/30 rounded-lg px-3 text-xs font-medium text-on-surface focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/40";
const LABEL = "block mb-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant";

/**
 * Preço que o treinador paga por um jogador da pesquisa: lance mínimo
 * (leilão), preço de lista (à venda) ou cláusula (sem lista).
 * @param {object} player
 * @returns {number}
 */
function acquisitionPrice(player) {
  if (player.transfer_status === "auction") {
    return player.auction_high_bid_team_id != null
      ? player.auction_high_bid + AUCTION_BID_STEP
      : player.auction_starting_price || player.transfer_price || 0;
  }
  if (player.transfer_status === "fixed") {
    return player.transfer_price || Math.round((player.value || 0) * TRANSFER_LISTED_PRICE_MULT);
  }
  return Math.round((player.value || 0) * TRANSFER_CLAUSE_MULT);
}

const DEAL_TONE = {
  auction: "bg-amber-500 hover:bg-amber-400 text-black border-amber-300 shadow-[0_6px_16px_-8px_#f59e0b]",
  fixed: "bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-300 shadow-[0_6px_16px_-8px_#10b981]",
  proposal: "bg-primary hover:brightness-110 text-on-primary border-primary shadow-[0_6px_16px_-8px_var(--color-primary)]",
};

/**
 * Botão de negócio com o preço por baixo do verbo (Licitar/Comprar/Proposta).
 * Sem saldo: desligado, com o valor em falta no `title`.
 *
 * @param {Object} props
 * @param {"auction"|"fixed"|"proposal"} props.kind
 * @param {string} props.label
 * @param {number} props.price
 * @param {number} props.budget
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function DealButton({ kind, label, price, budget, onClick }) {
  const affordable = budget >= price;
  return (
    <button
      type="button"
      disabled={!affordable}
      onClick={onClick}
      title={affordable ? undefined : `Faltam ${formatCurrency(price - budget)}`}
      className={`min-w-[92px] min-h-10 px-2.5 py-1 rounded-lg border flex flex-col items-center justify-center leading-none whitespace-nowrap transition-all active:scale-95 ${
        affordable
          ? DEAL_TONE[kind]
          : "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/20 cursor-not-allowed"
      }`}
    >
      <span className="text-[11px] font-black uppercase tracking-wide">{affordable ? label : "Sem saldo"}</span>
      <span className="mt-0.5 font-mono text-[10px] font-bold tabular-nums opacity-80">{formatCurrency(price)}</span>
    </button>
  );
}

/** @param {{ children: import("react").ReactNode }} props */
function StatusPill({ children }) {
  return (
    <span className="inline-flex items-center min-h-8 px-2.5 rounded-lg border border-dashed border-outline-variant/25 text-[10px] text-on-surface-variant/70 font-black uppercase tracking-wide whitespace-nowrap">
      {children}
    </span>
  );
}

/**
 * Par mín–máx com rótulo.
 * @param {{ label: string, min: string, max: string, onMin: (v: string) => void, onMax: (v: string) => void, title?: string }} props
 */
function RangeField({ label, min, max, onMin, onMax, title }) {
  return (
    <div title={title}>
      <span className={LABEL}>{label}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <input type="number" min="0" className={FIELD} placeholder="mín" value={min} onChange={(e) => onMin(e.target.value)} aria-label={`${label} mínimo`} />
        <span className="text-on-surface-variant/50 text-xs">–</span>
        <input type="number" min="0" className={FIELD} placeholder="máx" value={max} onChange={(e) => onMax(e.target.value)} aria-label={`${label} máximo`} />
      </div>
    </div>
  );
}

/**
 * @param {{
 *   me: object|null,
 *   players: Array,
 *   myBudget: number,
 *   matchweekCount: number,
 *   playerSearchData: { results: Array, total: number, truncated: boolean },
 *   playerSearchLoading: boolean,
 *   setPlayerSearchLoading: function,
 *   nextPlayerSearchId: function,
 *   setTransferProposalModal: function,
 *   setGameDialog: function,
 *   buyPlayer: function,
 *   onOpenPlayerHistory: (player: object) => void,
 *   openAuctionBid: function,
 *   activeAuctions: Array,
 * }} props
 */
export function ScoutView({
  me,
  players,
  myBudget = 0,
  matchweekCount = 0,
  playerSearchData = { results: [], total: 0, truncated: false },
  playerSearchLoading = false,
  setPlayerSearchLoading,
  nextPlayerSearchId = () => 0,
  setTransferProposalModal,
  setGameDialog,
  buyPlayer,
  onOpenPlayerHistory,
  openAuctionBid,
  activeAuctions = [],
}) {
  const {
    results: playerSearchResults,
    total: playerSearchTotal,
    truncated: playerSearchTruncated,
  } = playerSearchData;

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const setField = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const [searched, setSearched] = useState(false);
  // Lance inline: modal local — só a scout o abre, não precisa de estado global.
  const [bidModalPlayer, setBidModalPlayer] = useState(null);
  const liveAuction = useMemo(
    () => activeAuctions.find((a) => Number(a.playerId) === Number(bidModalPlayer?.id)) ?? null,
    [activeAuctions, bidModalPlayer],
  );

  const humanTeamIds = useMemo(
    () => new Set(players.map((p) => normalizeTeamId(p.teamId))),
    [players],
  );

  const filteredResults = useMemo(() => {
    if (!filters.onlyAffordable) return playerSearchResults;
    return playerSearchResults.filter((player) => myBudget >= acquisitionPrice(player));
  }, [filters.onlyAffordable, playerSearchResults, myBudget]);

  const advancedCount = ADVANCED_KEYS.filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length;

  /** @param {Partial<typeof DEFAULT_FILTERS>} [next] - filtros a usar (já gravados no estado). */
  const search = (next) => {
    const q = next ? { ...filters, ...next } : filters;
    if (next) setFilters(q);
    setSearched(true);
    setPlayerSearchLoading(true);
    socket.emit("requestPlayerSearch", {
      searchId: nextPlayerSearchId(),
      name: q.name,
      position: q.position,
      skillMin: toNumOrNull(q.skillMin),
      skillMax: toNumOrNull(q.skillMax),
      ageMin: toNumOrNull(q.ageMin),
      ageMax: toNumOrNull(q.ageMax),
      priceMin: toNumOrNull(q.priceMin),
      priceMax: toNumOrNull(q.priceMax),
      division: q.division,
      transferStatus: q.transferStatus,
      isStar: q.isStar,
      onlyAvailable: q.onlyAvailable,
      onlyAffordable: q.onlyAffordable,
      sort: q.sort,
    });
  };

  const runPreset = (preset) => search({ ...DEFAULT_FILTERS, ...preset.filters });

  const renderActions = (player) => {
    const isOwnTeam = isSameTeamId(player.team_id, me?.teamId);
    const isHumanTeam = humanTeamIds.has(normalizeTeamId(player.team_id));
    const status = player.transfer_status;
    const price = acquisitionPrice(player);

    if (isOwnTeam) return <StatusPill>Tua equipa</StatusPill>;

    if (status === "auction") {
      return (
        <DealButton kind="auction" label="Licitar" price={price} budget={myBudget} onClick={() => setBidModalPlayer(player)} />
      );
    }

    if (status === "fixed") {
      return (
        <DealButton
          kind="fixed"
          label="Comprar"
          price={price}
          budget={myBudget}
          onClick={() => {
            setGameDialog({
              mode: "confirm",
              title: `Comprar ${player.name}`,
              description: `${player.position} · Qualidade ${player.skill} · Preço: ${formatCurrency(price)}`,
              confirmLabel: "Confirmar Compra",
              onConfirm: () => buyPlayer(player.id),
              onCancel: () => {},
            });
          }}
        />
      );
    }

    if (isHumanTeam) return <StatusPill>Outro treinador</StatusPill>;

    // contract_locked é calculado pelo servidor (mesma regra de contratos
    // do filtro onlyAvailable) — o client não duplica a matemática.
    if (player.contract_locked) return <StatusPill>🔒 Contrato</StatusPill>;

    return (
      <DealButton
        kind="proposal"
        label="Proposta"
        price={price}
        budget={myBudget}
        onClick={() => setTransferProposalModal({ player, suggestedPrice: price })}
      />
    );
  };

  const subtitle = (player) => {
    const parts = [];
    if (player.team_name) parts.push(player.team_name);
    if (player.division) {
      parts.push(DIVISION_NAMES[player.division] || `Div ${player.division}`);
    }
    if (player.age != null) parts.push(`${player.age} anos`);
    return parts.join(" · ");
  };

  const presetButtons = (
    <div className="flex flex-wrap justify-center gap-2 pt-3">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => runPreset(p)}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border border-primary/30 bg-primary/10 text-[11px] font-black uppercase tracking-wider text-on-surface hover:bg-primary/20 transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-[15px] leading-none w-[1em] overflow-hidden text-primary">{p.icon}</span>
          {p.label}
        </button>
      ))}
    </div>
  );

  const resultsMeta = searched
    ? `${playerSearchTotal} jogador${playerSearchTotal !== 1 ? "es" : ""}${playerSearchTruncated || filteredResults.length !== playerSearchResults.length ? ` · a mostrar ${filteredResults.length}` : ""}`
    : "—";

  return (
    <div className="flex flex-col gap-3 sm:gap-4 short:gap-2">
      <TransferHeader
        icon="travel_explore"
        title="Scout"
        budget={myBudget}
        chips={[
          { label: "base de dados global", icon: "public" },
          ...(searched && !playerSearchLoading ? [{ value: playerSearchTotal, label: "encontrados", tone: "good", icon: "group" }] : []),
        ]}
      >
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[20px] w-[1em] overflow-hidden select-none pointer-events-none">
              search
            </span>
            <input
              type="text"
              className={`${FIELD} min-h-11 pl-10 text-sm`}
              placeholder="Nome do jogador…"
              value={filters.name}
              onChange={(e) => setField("name")(e.target.value)}
              aria-label="Nome do jogador"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 min-h-11 px-4 sm:px-6 rounded-lg bg-primary text-on-primary font-headline font-black uppercase text-xs tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-[0_8px_20px_-10px_var(--color-primary)]"
          >
            Pesquisar
          </button>
        </form>

        <TabBar size="sm" expand tabs={POSITION_TABS} active={filters.position} onChange={setField("position")} />

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filters.isStar} onChange={setField("isStar")} icon="star">
            Craques
          </FilterChip>
          <FilterChip active={filters.onlyAvailable} onChange={setField("onlyAvailable")} icon="lock_open">
            Disponível
          </FilterChip>
          <FilterChip
            active={filters.onlyAffordable}
            onChange={(value) => {
              setField("onlyAffordable")(value);
              if (searched) search({ onlyAffordable: value });
            }}
            icon="savings"
          >
            Cabe no saldo
          </FilterChip>
        </div>

        <details className="group rounded-lg border border-outline-variant/15 bg-surface/40">
          <summary className="flex items-center gap-2 px-3 min-h-10 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px] leading-none w-[1em] overflow-hidden">tune</span>
            Filtros avançados
            {advancedCount > 0 && (
              <span className="px-1.5 py-px rounded-full bg-primary text-on-primary text-[9px] tabular-nums">{advancedCount}</span>
            )}
            <span className="ml-auto material-symbols-outlined text-[18px] leading-none w-[1em] overflow-hidden transition-transform group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 px-3 pb-3 pt-1">
            <RangeField label="Qualidade" min={filters.skillMin} max={filters.skillMax} onMin={setField("skillMin")} onMax={setField("skillMax")} />
            <RangeField label="Idade" min={filters.ageMin} max={filters.ageMax} onMin={setField("ageMin")} onMax={setField("ageMax")} />
            <RangeField label="Preço (€)" title={PRICE_INPUT_TITLE} min={filters.priceMin} max={filters.priceMax} onMin={setField("priceMin")} onMax={setField("priceMax")} />
            <label>
              <span className={LABEL}>Divisão</span>
              <select className={FIELD} value={filters.division} onChange={(e) => setField("division")(e.target.value)}>
                <option value="all">Todas</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {DIVISION_NAMES[d]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={LABEL}>Estado</span>
              <select className={FIELD} value={filters.transferStatus} onChange={(e) => setField("transferStatus")(e.target.value)}>
                {TRANSFER_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={LABEL}>Ordenar por</span>
              <select className={FIELD} value={filters.sort} onChange={(e) => setField("sort")(e.target.value)}>
                {SORTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {advancedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, ...Object.fromEntries(ADVANCED_KEYS.map((k) => [k, DEFAULT_FILTERS[k]])) }))}
                className="sm:col-span-2 xl:col-span-3 justify-self-start min-h-9 px-3 rounded-lg border border-outline-variant/25 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface"
              >
                Limpar filtros avançados
              </button>
            )}
          </div>
        </details>
      </TransferHeader>

      <Panel title="Resultados" icon="person_search" meta={resultsMeta}>
        {playerSearchLoading ? (
          <div className="flex flex-col gap-1.5" aria-busy="true" aria-label="A pesquisar">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-surface-container-high/70 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : !searched ? (
          <div>
            <EmptyState
              icon="travel_explore"
              title="Descobre o próximo craque"
              description="Pesquisa em toda a base de dados ou começa por um destes atalhos."
            />
            {presetButtons}
          </div>
        ) : filteredResults.length === 0 ? (
          <div>
            <EmptyState
              icon="search_off"
              title="Sem resultados"
              description={
                filters.onlyAffordable && playerSearchResults.length > 0
                  ? "Nenhum cabe no teu saldo com estes filtros."
                  : "Nenhum jogador corresponde aos filtros."
              }
            />
            {presetButtons}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredResults.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                matchweekCount={matchweekCount + 1}
                subtitle={subtitle(player)}
                onOpenPlayerHistory={onOpenPlayerHistory}
                actions={renderActions(player)}
              />
            ))}
          </div>
        )}
      </Panel>

      <AuctionBidModal
        player={bidModalPlayer}
        liveAuction={liveAuction}
        me={me}
        myBudget={myBudget}
        socket={socket}
        onClose={() => setBidModalPlayer(null)}
        onGoToAuctions={openAuctionBid}
      />
    </div>
  );
}
