import { memo } from "react";
import { PitchFormation } from "../../match/shared/PitchFormation.jsx";
import { PITCH_POS_COLORS } from "../../match/matchConstants.js";

/**
 * Mini-campo com a formação provável do adversário — reutiliza o relvado
 * broadcast partilhado (PitchFormation) com as caras dos jogadores.
 * @param {{ formation?: { formation?: string, players?: Array<{ name: string, position: string, skill: number, isJunior?: boolean }> } | null, teamColor?: string|null }} props
 * @returns {JSX.Element|null}
 */
export const OpponentFormation = memo(function OpponentFormation({
  formation,
  teamColor,
}) {
  if (!formation || !formation.formation) return null;
  const rows = { ATA: [], MED: [], DEF: [], GR: [] };
  for (const p of formation.players ?? []) {
    if (rows[p.position]) rows[p.position].push(p);
  }
  return (
    <div className="min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden lg:flex-1 lg:flex lg:flex-col">
      <div className="flex items-center justify-between px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15 lg:shrink-0">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
          <span aria-hidden>🔎</span> Formação provável
        </span>
        <span className="text-[10px] font-black text-white tabular-nums">
          {formation.formation}
        </span>
      </div>
      <div className="relative w-full h-64 short:h-40 lg:h-auto lg:flex-1 lg:min-h-[280px] short:lg:min-h-[180px]">
        <PitchFormation
          rows={rows}
          posColors={PITCH_POS_COLORS}
          teamColor={teamColor}
          showFatigue={false}
        />
      </div>
    </div>
  );
});
