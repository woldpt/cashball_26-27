import { memo } from "react";
import { PitchFormation } from "../../match/shared/PitchFormation.jsx";
import { PITCH_POS_COLORS } from "../../match/matchConstants.js";

/**
 * Mini-campo com a formação provável do adversário — reutiliza o relvado
 * broadcast partilhado (PitchFormation) com as caras dos jogadores.
 * Diagnóstico: se a formação chega sem jogadores renderizáveis (payload
 * inesperado), regista a forma do payload na consola e mostra um fallback
 * visível em vez de um relvado vazio.
 * @param {{ formation?: { formation?: string, players?: Array<{ name: string, position: string, skill: number, isJunior?: boolean }> } | null, teamColor?: string|null, referee?: { name: string }|null, weather?: { emoji: string, label: string }|null }} props
 * @returns {JSX.Element|null}
 */
export const OpponentFormation = memo(function OpponentFormation({
  formation,
  teamColor,
  referee,
  weather,
}) {
  if (!formation || !formation.formation) return null;
  const rows = { ATA: [], MED: [], DEF: [], GR: [] };
  for (const p of formation.players ?? []) {
    if (rows[p.position]) rows[p.position].push(p);
  }
  const placed =
    rows.ATA.length + rows.MED.length + rows.DEF.length + rows.GR.length;
  if (placed === 0) {
    // Memoizado: só dispara por payload novo, sem spam em re-renders.
    console.warn(
      "[briefing] Formação provável sem jogadores renderizáveis:",
      JSON.stringify({
        formation: formation.formation,
        nPlayers: formation.players?.length ?? 0,
        positions: [
          ...new Set((formation.players ?? []).map((p) => p?.position)),
        ],
      }),
    );
  }
  return (
    <div className="min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden lg:flex-1 lg:flex lg:flex-col">
      <div className="flex items-center justify-between px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15 lg:shrink-0">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
          <span aria-hidden>♟️</span> Confronto tático em campo
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
          {formation.formation} adversário
        </span>
      </div>
      {placed > 0 ? (
        <div className="relative w-full h-72 short:h-44 lg:h-[320px] short:lg:h-[200px]">
          <PitchFormation
            rows={rows}
            posColors={PITCH_POS_COLORS}
            teamColor={teamColor}
            showFatigue={false}
          />
        </div>
      ) : (
        <p className="px-4 py-3 text-[11px] font-bold italic text-gray-600">
          11 provável indisponível de momento.
        </p>
      )}
      {(referee || weather) && (
        <div className="flex items-center justify-between gap-2 px-4 short:px-3 py-2 short:py-1.5 border-t border-outline-variant/15 lg:shrink-0">
          <span className="min-w-0 text-[9px] font-bold text-gray-500 truncate">
            {referee ? `Apita ${referee.name}` : ""}
          </span>
          {weather && (
            <span className="shrink-0 text-[9px] font-bold text-gray-500">
              <span aria-hidden>{weather.emoji}</span> {weather.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
