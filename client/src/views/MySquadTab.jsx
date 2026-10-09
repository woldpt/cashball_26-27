import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PlayerRow } from "../components/shared/PlayerRow.jsx";
import { TransferHeader } from "../components/transfers/TransferChrome.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import {
  POSITION_ACCENT_HEX,
  POSITION_BAR_CLASS,
  POSITION_TEXT_CLASS,
} from "../constants/index.js";
import { formatCurrency } from "../utils/formatters.js";
import { staggerItemProps } from "../motion.js";

const POS_ORDER = ["GR", "DEF", "MED", "ATA"];

const POS_GROUP_LABEL = {
  GR: "Guarda-redes",
  DEF: "Defesas",
  MED: "Médios",
  ATA: "Avançados",
};

const FILTER_ALL = "ALL";

const SORT_OPTIONS = [
  { key: "alpha", label: "A–Z" },
  { key: "skill", label: "Skill" },
  { key: "wage", label: "Salário" },
  { key: "value", label: "Valor" },
];

const SORT_COMPARATORS = {
  alpha: (a, b) => (a.name || "").localeCompare(b.name || ""),
  skill: (a, b) => (b.skill || 0) - (a.skill || 0),
  wage: (a, b) => (b.wage || 0) - (a.wage || 0),
  value: (a, b) => (b.value || 0) - (a.value || 0),
};

/**
 * @param {{
 *   annotatedSquad: object[],
 *   matchweekCount: number,
 *   season?: number,
 *   onOpenPlayerHistory: (player: object) => void,
 * }} props
 */
export function MySquadTab({
  annotatedSquad,
  matchweekCount,
  season = 1,
  onOpenPlayerHistory,
}) {
  const [posFilter, setPosFilter] = useState(FILTER_ALL);
  const [sortKey, setSortKey] = useState("alpha");

  // Agrupamento, estatísticas, ordenação e índice de stagger contínuo numa
  // só passagem (a fonte é sempre o que se renderiza: annotatedSquad).
  const { groupedByPos, groupStats, wageByPos, staggerIndex } = useMemo(() => {
    const groups = { GR: [], DEF: [], MED: [], ATA: [] };
    const wages = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
    for (const p of annotatedSquad) {
      if (groups[p.position]) groups[p.position].push(p);
      if (wages[p.position] !== undefined) wages[p.position] += p.wage || 0;
    }
    // Ordenação só dentro de cada posição (a estrutura GR/DEF/MED/ATA fica).
    const compare = SORT_COMPARATORS[sortKey];
    const ordered = {};
    for (const pos of POS_ORDER) {
      ordered[pos] = compare ? [...groups[pos]].sort(compare) : groups[pos];
    }
    // Índice de stagger contínuo através dos grupos de posição (com teto em
    // staggerItemProps — jogadores além do cap aparecem sem delay extra).
    const index = new Map();
    let i = 0;
    for (const pos of POS_ORDER) {
      for (const p of ordered[pos]) index.set(p.id, i++);
    }
    const stats = {};
    for (const pos of POS_ORDER) {
      const group = groups[pos];
      stats[pos] = {
        count: group.length,
        wage: wages[pos],
      };
    }
    return {
      groupedByPos: ordered,
      groupStats: stats,
      wageByPos: wages,
      staggerIndex: index,
    };
  }, [annotatedSquad, sortKey]);

  const totalWage = Object.values(wageByPos).reduce((a, b) => a + b, 0);
  const total = annotatedSquad.length;
  const avgSkill = total
    ? Math.round(annotatedSquad.reduce((a, p) => a + (p.skill || 0), 0) / total)
    : 0;
  const unavailable = annotatedSquad.filter((p) => p.isUnavailable).length;
  const chips = [
    { label: total === 1 ? "jogador" : "jogadores", value: total, icon: "groups" },
    { label: "skill média", value: avgSkill, tone: "good", icon: "bolt" },
    ...(unavailable
      ? [{ label: "indisponíveis", value: unavailable, tone: "bad", icon: "healing" }]
      : []),
  ];

  const visiblePositions = posFilter === FILTER_ALL ? POS_ORDER : [posFilter];
  const visibleGroups = visiblePositions.filter(
    (pos) => groupedByPos[pos].length > 0,
  );

  return (
    <div className="space-y-4">
      <TransferHeader
        icon="groups"
        kicker="Clube"
        title="Plantel"
        valueLabel="Massa salarial/sem"
        valueClass="text-tertiary"
        budget={totalWage}
        chips={chips}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {[FILTER_ALL, ...POS_ORDER].map((key) => {
            const active = posFilter === key;
            const hex = POSITION_ACCENT_HEX[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setPosFilter(key)}
                style={active && hex ? { borderColor: hex, boxShadow: `0 0 14px -4px ${hex}` } : undefined}
                className={`inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                  active
                    ? "bg-primary/20 border-primary/60 text-on-surface"
                    : "bg-surface/60 border-outline-variant/25 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/50"
                }`}
              >
                <span className={!active && key !== FILTER_ALL ? POSITION_TEXT_CLASS[key] : ""}>
                  {key === FILTER_ALL ? "Todos" : key}
                </span>
                <span className="tabular-nums opacity-70">
                  {key === FILTER_ALL ? total : groupStats[key].count}
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex max-w-full flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              Ordenar
            </span>
            <TabBar size="sm" tabs={SORT_OPTIONS} active={sortKey} onChange={setSortKey} />
          </div>
        </div>
      </TransferHeader>

      {total === 0 ? (
        <EmptyState
          icon="group"
          title="Sem jogadores no plantel"
          description="Os jogadores do teu plantel aparecem aqui."
        />
      ) : visibleGroups.length === 0 ? (
        <EmptyState
          icon="search"
          title="Sem jogadores nesta posição"
          description="Ajusta o filtro para ver o resto do plantel."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {visibleGroups.map((pos) => {
            const stats = groupStats[pos];
            const pct = totalWage > 0 ? Math.round((stats.wage / totalWage) * 100) : 0;
            return (
              <section key={pos} aria-label={POS_GROUP_LABEL[pos]}>
                <div className="flex items-center gap-3 px-1 pb-2">
                  <h3 className={`font-headline font-black uppercase tracking-tight text-sm whitespace-nowrap ${POSITION_TEXT_CLASS[pos]}`}>
                    {POS_GROUP_LABEL[pos]}
                  </h3>
                  <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-wider tabular-nums whitespace-nowrap">
                    {stats.count} · {formatCurrency(stats.wage)}/sem
                  </span>
                  <div
                    className="ml-auto h-1.5 w-24 sm:w-40 rounded-full bg-surface/80 overflow-hidden"
                    title={`${pct}% da massa salarial`}
                  >
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${POSITION_BAR_CLASS[pos]} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-black text-on-surface-variant tabular-nums w-8 text-right">
                    {pct}%
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5 list-none m-0 p-0">
                  {groupedByPos[pos].map((player) => (
                    <motion.li
                      key={player.id}
                      className="list-none"
                      {...staggerItemProps(staggerIndex.get(player.id) ?? 0)}
                    >
                      <PlayerRow
                        player={player}
                        matchweekCount={matchweekCount}
                        season={season}
                        showContractBadges
                        showLastRating
                        onOpenPlayerHistory={onOpenPlayerHistory}
                      />
                    </motion.li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
