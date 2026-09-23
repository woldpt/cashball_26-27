/**
 * PostMatchPitch — pitch com as classificações 1–5★ do último jogo,
 * no fim do corpo do rescaldo (Jornal).
 *
 * Reutiliza o relvado broadcast partilhado (`PitchFormation`): os titulares
 * no relvado com as estrelas no lugar do número de qualidade, os suplentes
 * entrados numa linha por baixo.
 */
import { PitchFormation } from "../match/shared/PitchFormation.jsx";
import { PITCH_POS_COLORS } from "../match/matchConstants.js";
import { Stars } from "./Stars.jsx";

/**
 * @param {{ players?: Array<{ id: number, name: string, position: string, stars: number, starter: boolean }> | null }} props
 */
export function PostMatchPitch({ players }) {
  if (!Array.isArray(players) || players.length === 0) return null;
  const rows = { ATA: [], MED: [], DEF: [], GR: [] };
  const subs = [];
  for (const p of players) {
    if (p.starter && rows[p.position]) rows[p.position].push({ ...p, rating: p.stars });
    else if (!p.starter) subs.push(p);
  }
  const placed = rows.ATA.length + rows.MED.length + rows.DEF.length + rows.GR.length;
  if (placed === 0) return null;
  return (
    <div className="mt-3 border-t border-outline-variant/25 pt-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
        ⭐ Classificação do jogo
      </p>
      {/* Altura explícita: o PitchFormation usa h-full e não resolve contra min-h. */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-outline-variant/25 h-[420px] short:h-[300px]">
        <PitchFormation
          rows={rows}
          posColors={PITCH_POS_COLORS}
          showFatigue={false}
        />
      </div>
      {subs.length > 0 && (
        <p className="mt-2 text-[11px] font-bold text-on-surface-variant">
          Entraram:{" "}
          {subs.map((s, i) => (
            <span key={s.id ?? i} className="whitespace-nowrap">
              {i > 0 && " · "}
              {s.name}{" "}
              <Stars value={s.stars} className="text-amber-400 text-[10px]" />
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
