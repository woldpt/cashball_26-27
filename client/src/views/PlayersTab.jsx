import { motion } from "framer-motion";
import { PlayerRow } from "../components/shared/PlayerRow.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import {
  POSITION_TEXT_CLASS,
  FLAG_TO_COUNTRY,
} from "../constants/index.js";
import { formatCurrency } from "../utils/formatters.js";
import { staggerItemProps } from "../motion.js";

/**
 * @param {{
 *   mySquad: object[],
 *   annotatedSquad: object[],
 *   matchweekCount: number,
 *   season?: number,
 *   onOpenPlayerHistory: (player: object) => void,
 * }} props
 */
export function PlayersTab({
  mySquad,
  annotatedSquad,
  matchweekCount,
  season = 1,
  onOpenPlayerHistory,
}) {
  const wageByPos = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
  mySquad.forEach((p) => {
    if (wageByPos[p.position] !== undefined)
      wageByPos[p.position] += p.wage || 0;
  });
  // Índice de stagger contínuo através dos grupos de posição (com teto em
  // staggerItemProps — jogadores além do cap aparecem sem delay extra).
  const staggerIndex = new Map();
  {
    let i = 0;
    for (const pos of ["GR", "DEF", "MED", "ATA"]) {
      for (const p of annotatedSquad) {
        if (p.position === pos) staggerIndex.set(p.id, i++);
      }
    }
  }
  const maxPosWage = Math.max(...Object.values(wageByPos), 1);
  const posColorHex = {
    GR: "#eab308",
    DEF: "#3b82f6",
    MED: "#10b981",
    ATA: "#f43f5e",
  };

  return (
    <div className="space-y-4">
      {/* ── Linhas do plantel ── */}
      <Panel
        title="Gestão do Plantel"
        meta={`${mySquad.length} jogadores`}
      >
        {annotatedSquad.length === 0 ? (
          <EmptyState
            emoji="👥"
            title="Sem jogadores no plantel"
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {(["GR", "DEF", "MED", "ATA"]).map((pos) => {
              const group = annotatedSquad.filter((p) => p.position === pos);
              if (!group.length) return null;
              const posLabel =
                pos === "GR"
                  ? "Guarda-redes"
                  : pos === "DEF"
                    ? "Defesas"
                    : pos === "MED"
                      ? "Médios"
                      : "Avançados";
              return (
                <div key={pos}>
                  <div className="flex items-center gap-2 px-1 py-2 mt-1 first:mt-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">
                      {posLabel}
                    </span>
                    <span className="text-[9px] text-on-surface-variant/30 font-bold">
                      {group.length}
                    </span>
                  </div>
                  {group.map((player) => (
                    <motion.div
                      key={player.id}
                      {...staggerItemProps(staggerIndex.get(player.id) || 0)}
                    >
                      <PlayerRow
                        player={player}
                        matchweekCount={matchweekCount}
                        season={season}
                        showContractBadges
                        onOpenPlayerHistory={onOpenPlayerHistory}
                      />
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ── Wage distribution chart ── */}
      {/* Gráfico secundário — em landscape não sobra altura para isto. */}
      <div className="bg-surface-container-low p-3 sm:p-5 rounded-md short:hidden">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
          Distribuição Salarial por Posição
        </h3>
        <div className="flex items-end gap-3" style={{ height: "80px" }}>
          {["GR", "DEF", "MED", "ATA"].map((pos) => {
            const pct =
              maxPosWage > 0 ? (wageByPos[pos] / maxPosWage) * 100 : 0;
            return (
              <div
                key={pos}
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
                      backgroundColor: posColorHex[pos],
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
      </div>
    </div>
  );
}
