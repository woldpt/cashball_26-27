import { useMemo, useState } from "react";
import { socket } from "../socket.js";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Button } from "../components/shared/Button.jsx";
import { PlayerRow } from "../components/shared/PlayerRow.jsx";
import {
  DIVISION_NAMES,
  SEASON_JORNADAS,
  TRANSFER_CLAUSE_MULT,
  TRANSFER_LISTED_PRICE_MULT,
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
  { value: "all", label: "Estado: Todos" },
  { value: "none", label: "Sem lista" },
  { value: "fixed", label: "À venda" },
  { value: "auction", label: "Leilão" },
];

function inputClass() {
  return "bg-surface border border-outline-variant/30 rounded-sm px-3 py-2.5 text-xs font-medium text-on-surface focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/30";
}

/**
 * @param {{
 *   me: object|null,
 *   players: Array,
 *   myBudget: number,
 *   matchweekCount: number,
 *   season?: number,
 *   playerSearchData: { results: Array, total: number, truncated: boolean },
 *   playerSearchLoading: boolean,
 *   setPlayerSearchLoading: function,
 *   setTransferProposalModal: function,
 *   setGameDialog: function,
 *   buyPlayer: function,
 *   openAuctionBid: function,
 *   onOpenPlayerHistory: (player: object) => void,
 * }} props
 */
export function PlayerSearchView({
  me,
  players,
  myBudget = 0,
  matchweekCount = 0,
  season = 1,
  playerSearchData = { results: [], total: 0, truncated: false },
  playerSearchLoading = false,
  setPlayerSearchLoading,
  setTransferProposalModal,
  setGameDialog,
  buyPlayer,
  openAuctionBid,
  onOpenPlayerHistory,
}) {
  const {
    results: playerSearchResults,
    total: playerSearchTotal,
    truncated: playerSearchTruncated,
  } = playerSearchData;

  const [name, setName] = useState("");
  const [position, setPosition] = useState("all");
  const [skillMin, setSkillMin] = useState("");
  const [skillMax, setSkillMax] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [division, setDivision] = useState("all");
  const [transferStatus, setTransferStatus] = useState("all");
  const [isStar, setIsStar] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState("quality-desc");
  const [searched, setSearched] = useState(false);

  const humanTeamIds = useMemo(
    () => new Set(players.map((p) => normalizeTeamId(p.teamId))),
    [players],
  );

  const search = () => {
    setSearched(true);
    setPlayerSearchLoading(true);
    socket.emit("requestPlayerSearch", {
      name,
      position,
      skillMin: toNumOrNull(skillMin),
      skillMax: toNumOrNull(skillMax),
      ageMin: toNumOrNull(ageMin),
      ageMax: toNumOrNull(ageMax),
      priceMin: toNumOrNull(priceMin),
      priceMax: toNumOrNull(priceMax),
      division,
      transferStatus,
      isStar,
      onlyAvailable,
      sort,
    });
  };

  const renderActions = (player) => {
    const isOwnTeam = isSameTeamId(player.team_id, me?.teamId);
    const isHumanTeam = humanTeamIds.has(normalizeTeamId(player.team_id));
    const status = player.transfer_status;

    if (isOwnTeam) {
      return (
        <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase whitespace-nowrap">
          Tua equipa
        </span>
      );
    }

    if (status === "auction") {
      return (
        <button
          type="button"
          onClick={() => openAuctionBid()}
          className="px-3 py-1.5 rounded text-xs font-black uppercase bg-amber-600 hover:bg-amber-500 text-white border border-amber-500 transition-colors whitespace-nowrap"
        >
          Licitar
        </button>
      );
    }

    if (status === "fixed") {
      const price =
        player.transfer_price ||
        Math.round((player.value || 0) * TRANSFER_LISTED_PRICE_MULT);
      const affordable = myBudget >= price;
      return (
        <button
          type="button"
          disabled={!affordable}
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
          className={`px-3 py-1.5 rounded text-xs font-black uppercase transition-colors whitespace-nowrap ${
            affordable
              ? "bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500"
              : "bg-surface-container-high text-on-surface-variant/40 border border-outline-variant/20 cursor-not-allowed"
          }`}
        >
          {affordable ? "Comprar" : "Sem saldo"}
        </button>
      );
    }

    if (isHumanTeam) {
      return (
        <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase whitespace-nowrap">
          Outro treinador
        </span>
      );
    }

    const contractStart = player.contract_start_epoch || 0;
    const currentEpoch =
      (Math.max(1, season) - 1) * SEASON_JORNADAS +
      Math.min(SEASON_JORNADAS, matchweekCount + 1);
    const contractLocked =
      contractStart > 0 && currentEpoch < contractStart + SEASON_JORNADAS;
    if (contractLocked) {
      return (
        <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase whitespace-nowrap">
          🔒 Contrato
        </span>
      );
    }

    const suggestedPrice = Math.round((player.value || 0) * TRANSFER_CLAUSE_MULT);
    const affordable = myBudget >= suggestedPrice;
    return (
      <button
        type="button"
        disabled={!affordable}
        onClick={() => setTransferProposalModal({ player, suggestedPrice })}
        className={`px-3 py-1.5 rounded text-xs font-black uppercase transition-colors whitespace-nowrap ${
          affordable
            ? "bg-primary hover:brightness-110 text-on-primary"
            : "bg-surface-container-high text-on-surface-variant/40 border border-outline-variant/20 cursor-not-allowed"
        }`}
      >
        {affordable ? "Proposta" : "Sem saldo"}
      </button>
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

  return (
    <div className="space-y-4">
      <Panel title="Scout — Pesquisa de Jogadores" meta="Base de dados global">
        <div className="p-3 md:p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="relative md:col-span-2">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-sm select-none pointer-events-none">
                search
              </span>
              <input
                type="text"
                className={`${inputClass()} w-full pl-9 pr-4`}
                placeholder="Nome do jogador…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") search();
                }}
              />
            </div>
            <select
              className={inputClass()}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="all">Posição: Todas</option>
              <option value="GR">Guarda-Redes</option>
              <option value="DEF">Defesa</option>
              <option value="MED">Médio</option>
              <option value="ATA">Avançado</option>
            </select>
            <select
              className={inputClass()}
              value={division}
              onChange={(e) => setDivision(e.target.value)}
            >
              <option value="all">Divisão: Todas</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {DIVISION_NAMES[d]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                className={`${inputClass()} flex-1 min-w-0`}
                placeholder="Skill mín"
                value={skillMin}
                onChange={(e) => setSkillMin(e.target.value)}
                min="0"
              />
              <input
                type="number"
                className={`${inputClass()} flex-1 min-w-0`}
                placeholder="Skill máx"
                value={skillMax}
                onChange={(e) => setSkillMax(e.target.value)}
                min="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className={`${inputClass()} flex-1 min-w-0`}
                placeholder="Idade mín"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                min="0"
              />
              <input
                type="number"
                className={`${inputClass()} flex-1 min-w-0`}
                placeholder="Idade máx"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                min="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className={`${inputClass()} flex-1 min-w-0`}
                placeholder="Preço mín (€)"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                min="0"
                title={PRICE_INPUT_TITLE}
              />
              <input
                type="number"
                className={`${inputClass()} flex-1 min-w-0`}
                placeholder="Preço máx (€)"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                min="0"
                title={PRICE_INPUT_TITLE}
              />
            </div>
            <select
              className={inputClass()}
              value={transferStatus}
              onChange={(e) => setTransferStatus(e.target.value)}
            >
              {TRANSFER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className={inputClass()}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORTS.map((o, i) => (
                <option key={o.value} value={o.value}>
                  {i === 0 ? `Ordenar por: ${o.label}` : o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isStar}
                  onChange={(e) => setIsStar(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                Só craques (★)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                Disponível p/ compra
              </label>
            </div>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              onClick={search}
            >
              Pesquisar
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Resultados"
        meta={
          searched
            ? `${playerSearchTotal} jogador${playerSearchTotal !== 1 ? "es" : ""}${playerSearchTruncated ? ` (a mostrar ${playerSearchResults.length})` : ""}`
            : "—"
        }
      >
        {playerSearchLoading ? (
          <div className="p-8 text-center text-on-surface-variant font-bold">
            A pesquisar…
          </div>
        ) : !searched ? (
          <EmptyState
            emoji="🔍"
            title="Preenche os filtros e pesquisa"
            description="Procura jogadores em toda a base de dados."
          />
        ) : playerSearchResults.length === 0 ? (
          <EmptyState
            emoji="🤷"
            title="Sem resultados"
            description="Nenhum jogador corresponde aos filtros."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {playerSearchResults.map((player) => (
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
    </div>
  );
}
