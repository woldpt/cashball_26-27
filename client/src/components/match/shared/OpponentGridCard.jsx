import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { POSITION_FULL_LABELS } from "../matchConstants.js";
import { SkillBadge } from "../../shared/SkillBadge.jsx";

/**
 * Single opponent player row — passivo (sem hover, sem button).
 * Skills no badge único (SKILL dourado + RES + forma quando visível).
 *
 * @param {object} props - Props do jogador.
 * @param {object} props.player - Dados do jogador (id, name, position, skill, resistance, form, is_star).
 * @param {object} props.posStyle - Estilo da posição (getPosStyle).
 * @param {boolean} [props.hideResForm] - Ocultar RES e forma.
 */
export function OpponentGridCard({ player, posStyle, hideResForm = false }) {
  const s = posStyle;

  return (
    <div
      className={`relative flex items-center gap-1.5 rounded border border-outline-variant/20 ${s.bgGrad} via-surface-container/60 to-surface/20 bg-gradient-to-r px-2 py-1.5 min-w-0`}
    >
      {/* Faixa lateral por posição */}
      <div className={`shrink-0 w-0.5 self-stretch rounded-full bg-gradient-to-b ${s.bar}`} />

      {/* Posição + nome */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span
          className={`shrink-0 w-5 text-center text-[9px] font-bold uppercase tracking-widest rounded px-1 border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}
          title={POSITION_FULL_LABELS[player.position]}
        >
          {POSITION_SHORT_LABELS[player.position] || "?"}
        </span>
        <span className="truncate text-xs font-semibold text-on-surface min-w-0">
          {player.name}
          {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
            <span className="ml-0.5 text-amber-400" title="Craque" aria-label="Craque">★</span>
          )}
        </span>
      </div>

      {/* Skills à direita — badge único */}
      <SkillBadge
        skill={player.skill}
        resistance={player.resistance}
        form={player.form}
        hideResForm={hideResForm}
        size="sm"
      />
    </div>
  );
}
