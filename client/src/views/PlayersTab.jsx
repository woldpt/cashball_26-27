import { useMemo } from "react";
import { motion } from "framer-motion";
import { PlayerRow } from "../components/shared/PlayerRow.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import {
  POSITION_ACCENT_HEX,
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

/**
 * @param {{
 *   annotatedSquad: object[],
 *   matchweekCount: number,
 *   season?: number,
 *   onOpenPlayerHistory: (player: object) => void,
 * }} props
 */
export function PlayersTab({
  annotatedSquad,
  matchweekCount,
  season = 1,
  onOpenPlayerHistory,
}) {
  // Agrupamento, massa salarial e índice de stagger contínuo numa só
  // passagem (a fonte é sempre o que se renderiza: annotatedSquad).
  const { groupedByPos, wageByPos, staggerIndex } = useMemo(() => {
    const groups = { GR: [], DEF: [], MED: [], ATA: [] };
    const wages = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
    for (const p of annotatedSquad) {
      if (groups[p.position]) groups[p.position].push(p);
      if (wages[p.position] !== undefined) wages[p.position] += p.wage || 0;
    }
    // Índice de stagger contínuo através dos grupos de posição (com teto em
    // staggerItemProps — jogadores além do cap aparecem sem delay extra).
    const index = new Map();
    let i = 0;
    for (const pos of POS_ORDER) {
      for (const p of groups[pos]) index.set(p.id, i++);
    }
    return { groupedByPos: groups, wageByPos: wages, staggerIndex: index };
  }, [annotatedSquad]);

  const maxPosWage = Math.max(...Object.values(wageByPos), 1);
  const wageSummary = POS_ORDER.map(
    (pos) => `${pos} ${formatCurrency(wageByPos[pos])}`,
  ).join(", ");
  const squadCountLabel = `${annotatedSquad.length} ${annotatedSquad.length === 1 ? "jogador" : "jogadores"}`;

  return (
    <div className="space-y-4">
      {/* ── Linhas do plantel ── */}
      <Panel
        title="Gestão do Plantel"
        meta={squadCountLabel}
      >
        {annotatedSquad.length === 0 ? (
          <EmptyState
            emoji="👥"
            title="Sem jogadores no plantel"
            description="Os jogadores do teu plantel aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {POS_ORDER.map((pos) => {
              const group = groupedByPos[pos];
              if (!group.length) return null;
              return (
                <section
                  key={pos}
                  aria-label={POS_GROUP_LABEL[pos]}
                >
                  <div className="flex items-center gap-2 px-1 py-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      {POS_GROUP_LABEL[pos]}
                    </h3>
                    <span className="text-[9px] text-on-surface-variant/70 font-bold">
                      {group.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1.5 list-none m-0 p-0">
                    {group.map((player) => (
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
      </Panel>

      {/* ── Distribuição salarial ── */}
      {/* Gráfico secundário — em landscape não sobra altura para isto. */}
      <Panel
        title="Distribuição Salarial por Posição"
        className="short:hidden"
      >
        <div
          className="flex items-end gap-3"
          style={{ height: "80px" }}
          role="img"
          aria-label={`Distribuição salarial por posição: ${wageSummary}`}
        >
          {POS_ORDER.map((pos) => {
            const pct =
              maxPosWage > 0 ? (wageByPos[pos] / maxPosWage) * 100 : 0;
            return (
              <div
                key={pos}
                aria-hidden
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
              >
                <div
                  className="w-full bg-primary/10 rounded-t-sm relative"
                  style={{ height: "60px" }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-sm transition-all duration-700"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: POSITION_ACCENT_HEX[pos],
                      opacity: 0.75,
                    }}
                  />
                </div>
                <span
                  className={`text-[10px] font-black uppercase ${POSITION_TEXT_CLASS[pos] || "text-zinc-400"}`}
                >
                  {pos}
                </span>
                <span className="text-[9px] text-on-surface-variant tabular-nums">
                  {formatCurrency(wageByPos[pos])}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
